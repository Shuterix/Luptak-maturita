'use client'

import { useState } from 'react'
import { nanoid } from 'nanoid'
import { Button, Input, Alert } from '@/components'

type LessonType = 'group' | 'individual' | 'couple'
type LessonKind = 'lesson' | 'break' | 'unused'

interface LessonForm {
	id: string
	kind: LessonKind
	lessonType?: LessonType
	date: string
	startTime: string
	endTime: string
	duration: number
	teacherName?: string
	roomLabel?: string
	studentNames: string[]
	locked: boolean
	manualOverride: boolean
	notes?: string
	breakType?: 'consecutive' | 'default'
}

interface AddStaticLessonModalProps {
	isOpen: boolean
	onClose: () => void
	onAdd: (lesson: LessonForm) => void
	existingLessons: LessonForm[]
	slotMinutes: number
}

const lessonTypeOptions: { label: string; value: LessonType }[] = [
	{ label: 'Group', value: 'group' },
	{ label: 'Individual', value: 'individual' },
	{ label: 'Couple', value: 'couple' },
]

const kindOptions: { label: string; value: LessonKind }[] = [
	{ label: 'Lesson', value: 'lesson' },
	{ label: 'Break', value: 'break' },
	{ label: 'Unused Slot', value: 'unused' },
]

const toMinutes = (time: string) => {
	const [hours, minutes] = time.split(':').map(Number)
	return hours * 60 + minutes
}

const addDuration = (time: string, duration: number) => {
	const totalMinutes = toMinutes(time) + duration
	const hrs = Math.floor(totalMinutes / 60)
	const mins = totalMinutes % 60
	return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`
}

const lessonsOverlap = (a: LessonForm, b: LessonForm) => {
	if (a.date !== b.date) return false
	const aStart = toMinutes(a.startTime)
	const aEnd = toMinutes(a.endTime)
	const bStart = toMinutes(b.startTime)
	const bEnd = toMinutes(b.endTime)
	return aStart < bEnd && bStart < aEnd
}

const shareResources = (a: LessonForm, b: LessonForm) => {
	if (a.kind !== 'lesson' || b.kind !== 'lesson') return false
	if (a.teacherName && b.teacherName && a.teacherName === b.teacherName) return true
	if (a.roomLabel && b.roomLabel && a.roomLabel === b.roomLabel) return true
	if (a.studentNames.length && b.studentNames.length) {
		return a.studentNames.some((name) => b.studentNames.includes(name))
	}
	return false
}

export function AddStaticLessonModal({
	isOpen,
	onClose,
	onAdd,
	existingLessons,
	slotMinutes,
}: AddStaticLessonModalProps) {
	const [formData, setFormData] = useState<LessonForm>({
		id: '',
		kind: 'lesson',
		lessonType: 'group',
		date: '',
		startTime: '',
		endTime: '',
		duration: 45,
		teacherName: '',
		roomLabel: '',
		studentNames: [],
		locked: false,
		manualOverride: true,
		notes: '',
	})
	const [error, setError] = useState<string | null>(null)
	const [conflicts, setConflicts] = useState<LessonForm[]>([])
	const [showConflictWarning, setShowConflictWarning] = useState(false)

	if (!isOpen) return null

	const handleDateChange = (value: string) => {
		setFormData((prev) => ({ ...prev, date: value }))
		setError(null)
		setConflicts([])
		setShowConflictWarning(false)
	}

	const handleStartTimeChange = (value: string) => {
		setFormData((prev) => {
			const duration = prev.kind === 'lesson' ? prev.duration : toMinutes(prev.endTime) - toMinutes(prev.startTime)
			return {
				...prev,
				startTime: value,
				endTime: prev.kind === 'lesson' ? addDuration(value, duration) : prev.endTime,
			}
		})
		setError(null)
		checkConflicts()
	}

	const handleDurationChange = (value: number) => {
		setFormData((prev) => ({
			...prev,
			duration: value,
			endTime: addDuration(prev.startTime, value),
		}))
		checkConflicts()
	}

	const handleEndTimeChange = (value: string) => {
		setFormData((prev) => {
			const duration = Math.max(1, toMinutes(value) - toMinutes(prev.startTime))
			return {
				...prev,
				endTime: value,
				duration,
			}
		})
		checkConflicts()
	}

	const checkConflicts = () => {
		if (!formData.date || !formData.startTime || !formData.endTime) {
			setConflicts([])
			setShowConflictWarning(false)
			return
		}

		const detectedConflicts = existingLessons.filter((lesson) => {
			if (!lessonsOverlap(formData, lesson)) return false
			return shareResources(formData, lesson)
		})

		setConflicts(detectedConflicts)
		setShowConflictWarning(detectedConflicts.length > 0)
	}

	const handleSave = () => {
		setError(null)

		if (!formData.date) {
			setError('Please select a date')
			return
		}

		if (!formData.startTime) {
			setError('Please select a start time')
			return
		}

		if (formData.kind === 'lesson' && !formData.endTime) {
			setError('Please set duration or end time')
			return
		}

		const calculatedDuration = Math.max(1, toMinutes(formData.endTime) - toMinutes(formData.startTime))
		if (calculatedDuration <= 0) {
			setError('End time must be after start time')
			return
		}

		const finalLesson: LessonForm = {
			...formData,
			duration: calculatedDuration,
			id: `static-${nanoid()}`,
		}

		// Check for conflicts one more time
		const detectedConflicts = existingLessons.filter((lesson) => {
			if (!lessonsOverlap(finalLesson, lesson)) return false
			return shareResources(finalLesson, lesson)
		})

		if (detectedConflicts.length > 0 && !showConflictWarning) {
			setConflicts(detectedConflicts)
			setShowConflictWarning(true)
			return
		}

		if (detectedConflicts.length > 0) {
			const conflictDetails = detectedConflicts
				.map((c) => {
					const resource = c.teacherName
						? `Teacher: ${c.teacherName}`
						: c.roomLabel
							? `Room: ${c.roomLabel}`
							: c.studentNames.length
								? `Students: ${c.studentNames.join(', ')}`
								: 'Unknown conflict'
					return `${c.startTime}-${c.endTime} (${resource})`
				})
				.join('\n')

			const confirmed = window.confirm(
				`This lesson will override ${detectedConflicts.length} conflicting lesson${detectedConflicts.length === 1 ? '' : 's'}:\n\n${conflictDetails}\n\nAre you sure you want to continue?`
			)

			if (!confirmed) {
				return
			}
		}

		onAdd(finalLesson)
		handleClose()
	}

	const handleClose = () => {
		setFormData({
			id: '',
			kind: 'lesson',
			lessonType: 'group',
			date: '',
			startTime: '',
			endTime: '',
			duration: 45,
			teacherName: '',
			roomLabel: '',
			studentNames: [],
			locked: false,
			manualOverride: true,
			notes: '',
		})
		setError(null)
		setConflicts([])
		setShowConflictWarning(false)
		onClose()
	}

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-base-content/60 backdrop-blur-sm p-4">
			<div className="w-full max-w-2xl rounded-2xl bg-base-200 shadow-2xl border border-base-300 max-h-[90vh] overflow-y-auto">
				<div className="flex items-center justify-between border-b border-base-300 px-6 py-4 sticky top-0 bg-base-200 z-10">
					<h2 className="text-xl font-semibold text-base-content">Add Static Lesson</h2>
					<button type="button" className="btn btn-ghost btn-sm btn-circle" onClick={handleClose}>
						✕
					</button>
				</div>

				<div className="p-6 space-y-6">
					{error && <Alert variant="error">{error}</Alert>}

					{showConflictWarning && conflicts.length > 0 && (
						<Alert variant="warning">
							<div className="space-y-2">
								<p className="font-medium">Warning: This lesson conflicts with {conflicts.length} existing lesson{conflicts.length === 1 ? '' : 's'}</p>
								<ul className="text-sm list-disc list-inside space-y-1">
									{conflicts.map((conflict, idx) => (
										<li key={idx}>
											{conflict.startTime}-{conflict.endTime} -{' '}
											{conflict.teacherName
												? `Teacher: ${conflict.teacherName}`
												: conflict.roomLabel
													? `Room: ${conflict.roomLabel}`
													: conflict.studentNames.length
														? `Students: ${conflict.studentNames.join(', ')}`
														: 'Unknown conflict'}
										</li>
									))}
								</ul>
								<p className="text-sm mt-2">Clicking "Add Lesson" will override these conflicts.</p>
							</div>
						</Alert>
					)}

					<div className="grid gap-4 sm:grid-cols-2">
						<label className="form-control">
							<span className="label-text">Kind</span>
							<select
								className="select select-bordered"
								value={formData.kind}
								onChange={(e) => {
									const kind = e.target.value as LessonKind
									setFormData((prev) => ({
										...prev,
										kind,
										lessonType: kind === 'lesson' ? (prev.lessonType ?? 'group') : undefined,
									}))
									setError(null)
									setConflicts([])
									setShowConflictWarning(false)
								}}
							>
								{kindOptions.map((option) => (
									<option key={option.value} value={option.value}>
										{option.label}
									</option>
								))}
							</select>
						</label>

						{formData.kind === 'lesson' && (
							<label className="form-control">
								<span className="label-text">Lesson Type</span>
								<select
									className="select select-bordered"
									value={formData.lessonType ?? 'group'}
									onChange={(e) => setFormData((prev) => ({ ...prev, lessonType: e.target.value as LessonType }))}
								>
									{lessonTypeOptions.map((option) => (
										<option key={option.value} value={option.value}>
											{option.label}
										</option>
									))}
								</select>
							</label>
						)}
					</div>

					<div className="grid gap-4 sm:grid-cols-2">
						<label className="form-control">
							<span className="label-text">Date</span>
							<Input type="date" value={formData.date} onChange={(e) => handleDateChange(e.target.value)} />
						</label>

						<label className="form-control">
							<span className="label-text">Start Time</span>
							<Input
								type="time"
								step={slotMinutes * 60}
								value={formData.startTime}
								onChange={(e) => handleStartTimeChange(e.target.value)}
							/>
						</label>
					</div>

					{formData.kind === 'lesson' ? (
						<div className="grid gap-4 sm:grid-cols-2">
							<label className="form-control">
								<span className="label-text">Duration (minutes)</span>
								<Input
									type="number"
									min={slotMinutes}
									step={slotMinutes}
									value={formData.duration}
									onChange={(e) => handleDurationChange(Number(e.target.value))}
								/>
							</label>
							<label className="form-control">
								<span className="label-text">End Time</span>
								<Input type="time" value={formData.endTime} disabled className="input-disabled" />
								<span className="label-text-alt">Calculated automatically</span>
							</label>
						</div>
					) : (
						<label className="form-control">
							<span className="label-text">End Time</span>
							<Input type="time" value={formData.endTime} onChange={(e) => handleEndTimeChange(e.target.value)} />
						</label>
					)}

					{formData.kind === 'lesson' && (
						<>
							<div className="grid gap-4 sm:grid-cols-2">
								<label className="form-control">
									<span className="label-text">Teacher</span>
									<Input
										value={formData.teacherName ?? ''}
										onChange={(e) => {
											setFormData((prev) => ({ ...prev, teacherName: e.target.value }))
											checkConflicts()
										}}
										placeholder="Teacher name"
									/>
								</label>
								<label className="form-control">
									<span className="label-text">Room</span>
									<Input
										value={formData.roomLabel ?? ''}
										onChange={(e) => {
											setFormData((prev) => ({ ...prev, roomLabel: e.target.value }))
											checkConflicts()
										}}
										placeholder="Studio A"
									/>
								</label>
							</div>
							<label className="form-control">
								<span className="label-text">Participants (comma separated)</span>
								<textarea
									className="textarea textarea-bordered"
									rows={2}
									value={formData.studentNames.join(', ')}
									onChange={(e) => {
										const names = e.target.value.split(',').map((val) => val.trim()).filter(Boolean)
										setFormData((prev) => ({ ...prev, studentNames: names }))
										checkConflicts()
									}}
									placeholder="Alice, Bob, Charlie"
								/>
							</label>
						</>
					)}

					<label className="form-control">
						<span className="label-text">Notes</span>
						<textarea
							className="textarea textarea-bordered"
							rows={2}
							value={formData.notes ?? ''}
							onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
							placeholder="Additional notes..."
						/>
					</label>

					<div className="flex items-center gap-4">
						<label className="label cursor-pointer gap-2">
							<span className="label-text">Locked</span>
							<input
								type="checkbox"
								className="checkbox checkbox-primary"
								checked={formData.locked}
								onChange={(e) => setFormData((prev) => ({ ...prev, locked: e.target.checked }))}
							/>
						</label>
						{formData.kind === 'lesson' && (
							<label className="label cursor-pointer gap-2">
								<span className="label-text">Manual Override</span>
								<input
									type="checkbox"
									className="checkbox checkbox-primary"
									checked={formData.manualOverride}
									onChange={(e) => setFormData((prev) => ({ ...prev, manualOverride: e.target.checked }))}
								/>
							</label>
						)}
					</div>
				</div>

				<div className="flex items-center justify-between gap-3 border-t border-base-300 px-6 py-4">
					<Button className="btn-ghost" onClick={handleClose}>
						Cancel
					</Button>
					<Button className="btn-primary" onClick={handleSave}>
						Add Lesson
					</Button>
				</div>
			</div>
		</div>
	)
}

