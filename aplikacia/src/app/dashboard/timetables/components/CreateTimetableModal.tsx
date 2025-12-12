'use client'

import { useState, useEffect } from 'react'
import { Button, Input } from '@/components'
import { TimetableConfigModal } from './TimetableConfigModal'

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

const defaultFormState: TimetableFormState = {
	name: '',
	type: 'after_school',
	startDate: '',
	endDate: '',
	dayStart: '15:00',
	dayEnd: '20:00',
	defaultLessonDuration: 45,
	slotMinutes: 15,
}

interface CreateTimetableModalProps {
	isOpen: boolean
	onClose: () => void
	onCreate: (form: TimetableFormState) => void
}

export function CreateTimetableModal({ isOpen, onClose, onCreate }: CreateTimetableModalProps) {
	const [form, setForm] = useState<TimetableFormState>({ ...defaultFormState })
	const [isConfigModalOpen, setIsConfigModalOpen] = useState(false)

	useEffect(() => {
		if (isOpen) {
			setForm({ ...defaultFormState })
			setIsConfigModalOpen(false)
		}
	}, [isOpen])

	if (!isOpen) return null

	const handleCreate = () => {
		if (!form.name.trim()) {
			return
		}
		// For weekly timetables, dates are optional (universal template)
		// For other types, dates are required
		if (form.type !== 'weekly' && (!form.startDate || !form.endDate)) {
			return
		}
		onCreate(form)
		onClose()
	}

	return (
		<>
			<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
				<div className="w-full max-w-2xl rounded-2xl bg-base-100 shadow-2xl">
					<div className="flex items-center justify-between border-b border-base-200 px-6 py-4">
						<h2 className="text-2xl font-semibold text-base-content">Create New Timetable</h2>
						<button type="button" className="btn btn-ghost btn-sm btn-circle" onClick={onClose}>
							✕
						</button>
					</div>

					<div className="p-6 space-y-6">
						<div className="space-y-4">
							<label className="form-control">
								<span className="label-text font-medium">Timetable Name</span>
								<Input
									value={form.name}
									onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
									placeholder="e.g., Spring 2025 After-School Schedule"
								/>
							</label>

							<label className="form-control">
								<span className="label-text font-medium">Timetable Type</span>
								<select
									className="select select-bordered w-full"
									value={form.type}
									onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value as TimetableType }))}
								>
									<option value="after_school">After School</option>
									<option value="weekly">Weekly (Universal Template)</option>
									<option value="yearly">Yearly</option>
									<option value="camp">Camp</option>
									<option value="custom">Custom</option>
								</select>
							</label>

							<div className="grid grid-cols-2 gap-4">
								<label className="form-control">
									<span className="label-text font-medium">
										Start Date
										{form.type === 'weekly' && <span className="text-xs text-base-content/60 ml-1">(optional for universal template)</span>}
									</span>
									<Input
										type="date"
										value={form.startDate}
										onChange={(e) => setForm((prev) => ({ ...prev, startDate: e.target.value }))}
									/>
								</label>
								<label className="form-control">
									<span className="label-text font-medium">
										End Date
										{form.type === 'weekly' && <span className="text-xs text-base-content/60 ml-1">(optional for universal template)</span>}
									</span>
									<Input
										type="date"
										value={form.endDate}
										onChange={(e) => setForm((prev) => ({ ...prev, endDate: e.target.value }))}
									/>
								</label>
							</div>
							{form.type === 'weekly' && (!form.startDate || !form.endDate) && (
								<div className="alert alert-info">
									<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
									<span className="text-sm">This will create a universal weekly template. You can specify dates when generating lessons.</span>
								</div>
							)}
						</div>

						<div className="flex items-center justify-between pt-4 border-t border-base-200">
							<Button className="btn-ghost" onClick={() => setIsConfigModalOpen(true)}>
								Advanced Settings
							</Button>
							<div className="flex gap-3">
								<Button className="btn-outline" onClick={onClose}>
									Cancel
								</Button>
								<Button
									className="btn-primary"
									onClick={handleCreate}
									disabled={!form.name.trim() || (form.type !== 'weekly' && (!form.startDate || !form.endDate))}
								>
									Create Timetable
								</Button>
							</div>
						</div>
					</div>
				</div>
			</div>

			<TimetableConfigModal
				isOpen={isConfigModalOpen}
				onClose={() => setIsConfigModalOpen(false)}
				form={form}
				onSave={(updatedForm) => {
					setForm(updatedForm)
					setIsConfigModalOpen(false)
				}}
			/>
		</>
	)
}

