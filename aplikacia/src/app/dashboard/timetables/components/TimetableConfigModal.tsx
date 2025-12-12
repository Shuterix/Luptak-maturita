'use client'

import { useState, useEffect } from 'react'
import { Button, Input, Alert } from '@/components'

type TimetableType = 'weekly' | 'yearly' | 'after_school' | 'camp' | 'custom'

const SLOT_MINUTES = [5, 10, 15, 30] as const

interface TimetableFormState {
	name: string
	type: TimetableType
	startDate: string
	endDate: string
	dayStart: string
	dayEnd: string
	defaultLessonDuration: number
	slotMinutes: (typeof SLOT_MINUTES)[number]
}

interface TimetableConfigModalProps {
	isOpen: boolean
	onClose: () => void
	form: TimetableFormState
	onSave: (form: TimetableFormState) => void
}

const timetableTypes: { label: string; value: TimetableType }[] = [
	{ label: 'After School', value: 'after_school' },
	{ label: 'Weekly', value: 'weekly' },
	{ label: 'Camp', value: 'camp' },
	{ label: 'Yearly', value: 'yearly' },
	{ label: 'Custom', value: 'custom' },
]

export function TimetableConfigModal({ isOpen, onClose, form, onSave }: TimetableConfigModalProps) {
	const [localForm, setLocalForm] = useState<TimetableFormState>(form)
	const [error, setError] = useState<string | null>(null)

	// Update local form when prop changes
	useEffect(() => {
		setLocalForm(form)
	}, [form])

	if (!isOpen) return null

	const validateForm = (): boolean => {
		setError(null)
		if (!localForm.dayStart || !localForm.dayEnd) {
			setError('Day start and end times are required')
			return false
		}
		if (localForm.dayStart >= localForm.dayEnd) {
			setError('Day end time must be after day start time')
			return false
		}
		if (localForm.defaultLessonDuration < 15) {
			setError('Default lesson duration must be at least 15 minutes')
			return false
		}
		return true
	}

	const handleSave = () => {
		if (!validateForm()) return
		onSave(localForm)
		onClose()
		setError(null)
	}

	const handleClose = () => {
		setLocalForm(form) // Reset to original
		setError(null)
		onClose()
	}

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-base-content/60 p-4">
			<div className="w-full max-w-2xl rounded-2xl bg-base-200 shadow-2xl border border-base-300 max-h-[90vh] overflow-y-auto">
				<div className="flex items-center justify-between border-b border-base-300 px-6 py-4 sticky top-0 bg-base-200 z-10">
					<h3 className="text-lg font-semibold text-base-content">Timetable Configuration</h3>
					<button type="button" className="btn btn-ghost btn-sm" onClick={handleClose}>
						✕
					</button>
				</div>

				<div className="p-6 space-y-6">
					{error && (
						<Alert variant="error">
							{error}
						</Alert>
					)}

					<div className="space-y-4">
						<div className="space-y-1">
							<h3 className="text-lg font-semibold text-base-content">Schedule Settings</h3>
							<p className="text-sm text-base-content/60">Configure daily hours and default lesson settings.</p>
						</div>
						<div className="grid grid-cols-2 gap-4">
							<label className="form-control">
								<span className="label-text">Day Start</span>
								<Input
									type="time"
									step={localForm.slotMinutes * 60}
									value={localForm.dayStart}
									onChange={(e) => setLocalForm({ ...localForm, dayStart: e.target.value })}
								/>
							</label>
							<label className="form-control">
								<span className="label-text">Day End</span>
								<Input
									type="time"
									step={localForm.slotMinutes * 60}
									value={localForm.dayEnd}
									onChange={(e) => setLocalForm({ ...localForm, dayEnd: e.target.value })}
								/>
							</label>
						</div>
						<div className="grid grid-cols-2 gap-4">
							<label className="form-control">
								<span className="label-text">Default Lesson Duration (minutes)</span>
								<Input
									type="number"
									min={15}
									step={5}
									value={localForm.defaultLessonDuration}
									onChange={(e) =>
										setLocalForm({ ...localForm, defaultLessonDuration: Number(e.target.value) })
									}
								/>
							</label>
							<label className="form-control">
								<span className="label-text">Slot Minutes</span>
								<select
									className="select select-bordered"
									value={localForm.slotMinutes}
									onChange={(e) =>
										setLocalForm({
											...localForm,
											slotMinutes: Number(e.target.value) as (typeof SLOT_MINUTES)[number],
										})
									}
								>
									{SLOT_MINUTES.map((minutes) => (
										<option key={minutes} value={minutes}>
											{minutes} minutes
										</option>
									))}
								</select>
							</label>
						</div>
					</div>

					{/* Navigation */}
					<div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-base-300">
						<Button type="button" className="btn-outline" onClick={handleClose}>
							Cancel
						</Button>
						<Button type="button" className="btn-primary" onClick={handleSave}>
							Save Settings
						</Button>
					</div>
				</div>
			</div>
		</div>
	)
}

