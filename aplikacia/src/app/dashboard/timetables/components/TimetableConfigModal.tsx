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
		<div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm">
			<div className="w-full sm:max-w-2xl rounded-t-3xl sm:rounded-2xl bg-base-200 shadow-2xl border border-base-300 max-h-[95vh] sm:max-h-[90vh] sm:mx-4 overflow-y-auto">
				{/* Mobile drag indicator */}
				<div className="flex justify-center pt-2 sm:hidden">
					<div className="w-12 h-1.5 bg-base-300 rounded-full" />
				</div>
				<div className="flex items-center justify-between border-b border-base-300 px-4 sm:px-6 py-3 sm:py-4 sticky top-0 bg-base-200 z-10">
					<h3 className="text-base sm:text-lg font-semibold text-base-content">Timetable Configuration</h3>
					<button type="button" className="btn btn-ghost btn-sm btn-circle" onClick={handleClose}>
						✕
					</button>
				</div>

				<div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
					{error && (
						<Alert variant="error">
							{error}
						</Alert>
					)}

					{/* Timetable Info */}
					<div className="bg-base-100 rounded-xl p-3 sm:p-4 border border-base-300 space-y-3">
						<div className="space-y-1">
							<h3 className="text-sm sm:text-base font-semibold text-base-content">Timetable Info</h3>
							<p className="text-xs sm:text-sm text-base-content/60">Name, type, and date range.</p>
						</div>
						<label className="form-control">
							<span className="label-text text-xs sm:text-sm">Timetable Name</span>
							<Input
								value={localForm.name}
								onChange={(e) => setLocalForm({ ...localForm, name: e.target.value })}
								placeholder="e.g. Spring Season 2026"
							/>
						</label>

						{/* Type as pill selector */}
						<div className="form-control">
							<span className="label-text text-xs sm:text-sm mb-1.5">Type</span>
							<div className="flex flex-wrap gap-1.5">
								{timetableTypes.map((t) => (
									<button
										key={t.value}
										type="button"
										onClick={() => setLocalForm({ ...localForm, type: t.value })}
										className={`btn btn-sm rounded-full ${
											localForm.type === t.value
												? 'btn-primary'
												: 'btn-outline'
										}`}
									>
										{t.label}
									</button>
								))}
							</div>
						</div>

						<div className="grid grid-cols-2 gap-3">
							<label className="form-control">
								<span className="label-text text-xs sm:text-sm">Start Date</span>
								<Input
									type="date"
									value={localForm.startDate}
									onChange={(e) => setLocalForm({ ...localForm, startDate: e.target.value })}
								/>
							</label>
							<label className="form-control">
								<span className="label-text text-xs sm:text-sm">End Date</span>
								<Input
									type="date"
									value={localForm.endDate}
									onChange={(e) => setLocalForm({ ...localForm, endDate: e.target.value })}
									min={localForm.startDate || undefined}
								/>
							</label>
						</div>
						{localForm.type === 'weekly' && !localForm.startDate && !localForm.endDate && (
							<p className="text-[11px] sm:text-xs text-base-content/50">Dates are optional for weekly templates.</p>
						)}
					</div>

					{/* Schedule Settings */}
					<div className="bg-base-100 rounded-xl p-3 sm:p-4 border border-base-300 space-y-3">
						<div className="space-y-1">
							<h3 className="text-sm sm:text-base font-semibold text-base-content">Schedule Settings</h3>
							<p className="text-xs sm:text-sm text-base-content/60">Daily hours and lesson settings.</p>
						</div>
						<div className="grid grid-cols-2 gap-3">
							<label className="form-control">
								<span className="label-text text-xs sm:text-sm">Day Start</span>
								<Input
									type="time"
									step={localForm.slotMinutes * 60}
									value={localForm.dayStart}
									onChange={(e) => setLocalForm({ ...localForm, dayStart: e.target.value })}
								/>
							</label>
							<label className="form-control">
								<span className="label-text text-xs sm:text-sm">Day End</span>
								<Input
									type="time"
									step={localForm.slotMinutes * 60}
									value={localForm.dayEnd}
									onChange={(e) => setLocalForm({ ...localForm, dayEnd: e.target.value })}
								/>
							</label>
						</div>
						<div className="grid grid-cols-2 gap-3">
							<label className="form-control">
								<span className="label-text text-xs sm:text-sm">Lesson Duration (min)</span>
								<div className="flex items-center gap-1">
									<button type="button" className="btn btn-sm btn-circle btn-ghost" onClick={() => setLocalForm(prev => ({ ...prev, defaultLessonDuration: Math.max(15, prev.defaultLessonDuration - 5) }))}>−</button>
									<Input
										type="number"
										min={15}
										step={5}
										value={localForm.defaultLessonDuration}
										onChange={(e) =>
											setLocalForm({ ...localForm, defaultLessonDuration: Number(e.target.value) })
										}
										className="text-center"
									/>
									<button type="button" className="btn btn-sm btn-circle btn-ghost" onClick={() => setLocalForm(prev => ({ ...prev, defaultLessonDuration: prev.defaultLessonDuration + 5 }))}>+</button>
								</div>
							</label>
							<label className="form-control">
								<span className="label-text text-xs sm:text-sm">Grid Slot</span>
								<div className="flex flex-wrap gap-1.5 mt-1">
									{SLOT_MINUTES.map((minutes) => (
										<button
											key={minutes}
											type="button"
											onClick={() => setLocalForm({ ...localForm, slotMinutes: minutes })}
											className={`btn btn-xs rounded-full ${
												localForm.slotMinutes === minutes
													? 'btn-primary'
													: 'btn-outline'
											}`}
										>
											{minutes}m
										</button>
									))}
								</div>
							</label>
						</div>
					</div>

					{/* Navigation */}
					<div className="flex items-center justify-end gap-3 pt-3 sm:pt-4 border-t border-base-300 sticky bottom-0 bg-base-200 pb-2 -mx-4 sm:-mx-6 px-4 sm:px-6">
						<Button type="button" className="btn-ghost btn-sm sm:btn-md" onClick={handleClose}>
							Cancel
						</Button>
						<Button type="button" className="btn-primary btn-sm sm:btn-md" onClick={handleSave}>
							Save Settings
						</Button>
					</div>
				</div>
			</div>
		</div>
	)
}

