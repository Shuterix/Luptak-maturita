'use client'

import { useState, useMemo, useEffect } from 'react'
import { Button, Input, Alert } from '@/components'
import { X, Plus, Users } from 'lucide-react'
import { ParticipantSelectionModal } from './ParticipantSelectionModal'

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
	pairLabel?: string
	locked: boolean
	manualOverride: boolean
	notes?: string
	breakType?: 'consecutive' | 'default'
	status?: string
	cancellation?: { reason?: string; at?: string }
}

interface ClubTeacher {
	_id: string
	firstName: string
	lastName: string
}

interface ExternalTeacherData {
	_id: string
	name: string
	code: string
}

interface ClubStudent {
	_id: string
	firstName: string
	lastName: string
}

interface ClubCouple {
	pairId: string
	label: string
	studentA: string
	studentB: string
	baseGroups?: string[]
}

type TeacherSource = 'club' | 'external' | 'custom'

interface EditLessonModalProps {
	isOpen: boolean
	lesson: LessonForm | null
	onClose: () => void
	onSave: (lesson: LessonForm) => void
	onDelete: (id: string) => void
	existingLessons: LessonForm[]
	slotMinutes: number
	teachers: ClubTeacher[]
	externalTeachers?: ExternalTeacherData[]
	students: ClubStudent[]
	couples: ClubCouple[]
	rooms: string[]
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

export function EditLessonModal({
	isOpen,
	lesson,
	onClose,
	onSave,
	onDelete,
	existingLessons,
	slotMinutes,
	teachers,
	externalTeachers = [],
	students,
	couples,
	rooms,
}: EditLessonModalProps) {
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

	// Teacher source: 'club' for club trainers, 'external' for external teachers, 'custom' for freeform
	const [teacherSource, setTeacherSource] = useState<TeacherSource>('club')
	const [roomMode, setRoomMode] = useState<'select' | 'custom'>('select')

	// Participant management
	const [isParticipantModalOpen, setIsParticipantModalOpen] = useState(false)
	const [customParticipantName, setCustomParticipantName] = useState('')
	const [showCustomParticipantInput, setShowCustomParticipantInput] = useState(false)

	// For editing, keep the same behavior as in AddStaticLessonModal:
	// "Individual" lessons in this timetable represent one-couple lessons.
	const effectiveParticipantLessonType: LessonType =
		formData.lessonType === 'individual' ? 'couple' : (formData.lessonType ?? 'group')

	// Derive unique rooms (filter empty strings)
	const availableRooms = useMemo(() => {
		const uniqueRooms = [...new Set(rooms.filter(Boolean))]
		return uniqueRooms
	}, [rooms])

	// Available couples for checking
	const availableCouples = useMemo(() => {
		return couples.map((c) => ({
			id: c.pairId,
			label: c.label,
			studentA: c.studentA,
			studentB: c.studentB,
		}))
	}, [couples])

	// Populate form when lesson changes
	useEffect(() => {
		if (lesson && isOpen) {
			setFormData({
				...lesson,
				studentNames: lesson.studentNames ?? [],
			})
			setError(null)
			setConflicts([])
			setShowConflictWarning(false)
			setCustomParticipantName('')
			setShowCustomParticipantInput(false)

			// Determine teacher source based on current teacher
			if (lesson.teacherName) {
				const isClub = teachers.some(
					(t) => `${t.firstName} ${t.lastName}` === lesson.teacherName
				)
				const isExternal = externalTeachers.some((t) => t.name === lesson.teacherName)
				if (isClub) {
					setTeacherSource('club')
				} else if (isExternal) {
					setTeacherSource('external')
				} else {
					setTeacherSource('custom')
				}
			} else {
				setTeacherSource('club')
			}

			// Determine room mode
			if (lesson.roomLabel && availableRooms.includes(lesson.roomLabel)) {
				setRoomMode('select')
			} else if (lesson.roomLabel) {
				setRoomMode('custom')
			} else {
				setRoomMode('select')
			}
		}
	}, [lesson, isOpen]) // eslint-disable-line react-hooks/exhaustive-deps

	if (!isOpen || !lesson) return null

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

		const detectedConflicts = existingLessons.filter((existing) => {
			if (existing.id === formData.id) return false // Don't conflict with self
			if (!lessonsOverlap(formData, existing)) return false
			return shareResources(formData, existing)
		})

		setConflicts(detectedConflicts)
		setShowConflictWarning(detectedConflicts.length > 0)
	}

	// --- Teacher source change ---
	const handleTeacherSourceChange = (source: TeacherSource) => {
		setTeacherSource(source)
		setFormData((prev) => ({ ...prev, teacherName: '' }))
	}

	// --- Teacher selection from dropdown ---
	const handleTeacherSelect = (value: string) => {
		setFormData((prev) => ({ ...prev, teacherName: value }))
		checkConflicts()
	}

	// --- Room selection ---
	const handleRoomSelect = (value: string) => {
		if (value === '__custom__') {
			setRoomMode('custom')
			setFormData((prev) => ({ ...prev, roomLabel: '' }))
		} else {
			setRoomMode('select')
			setFormData((prev) => ({ ...prev, roomLabel: value }))
			checkConflicts()
		}
	}

	// --- Participant management ---
	const handleParticipantSelection = (selection: { studentNames: string[]; pairLabel?: string }) => {
		setFormData((prev) => ({
			...prev,
			studentNames: selection.studentNames,
			pairLabel: selection.pairLabel,
		}))
		checkConflicts()
	}

	const removeParticipant = (name: string) => {
		setFormData((prev) => {
			const newNames = prev.studentNames.filter((n) => n !== name)
			// If removing a participant that was part of a couple, clear pairLabel
			const pairLabel = prev.pairLabel
			if (pairLabel) {
				const couple = availableCouples.find((c) => c.label === pairLabel)
				if (couple && (couple.studentA === name || couple.studentB === name)) {
					return { ...prev, studentNames: newNames, pairLabel: undefined }
				}
			}
			return { ...prev, studentNames: newNames }
		})
		checkConflicts()
	}

	const addCustomParticipant = () => {
		const name = customParticipantName.trim()
		if (!name) return
		if (formData.studentNames.includes(name)) {
			setCustomParticipantName('')
			return
		}
		setFormData((prev) => ({
			...prev,
			studentNames: [...prev.studentNames, name],
		}))
		setCustomParticipantName('')
		setShowCustomParticipantInput(false)
		checkConflicts()
	}

	const handleLessonTypeChange = (value: LessonType) => {
		setFormData((prev) => ({
			...prev,
			lessonType: value,
			studentNames: [],
			pairLabel: undefined,
		}))
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

		const normalizedLesson: LessonForm = {
			...formData,
			duration: calculatedDuration,
			studentNames: formData.studentNames.filter(Boolean),
		}

		// Check for conflicts (excluding self)
		const allConflicts = existingLessons.filter((existing) => {
			if (existing.id === normalizedLesson.id) return false
			if (!lessonsOverlap(normalizedLesson, existing)) return false
			return shareResources(normalizedLesson, existing)
		})

		if (allConflicts.length > 0 && !showConflictWarning) {
			setConflicts(allConflicts)
			setShowConflictWarning(true)
			return
		}

		if (allConflicts.length > 0) {
			const conflictDetails = allConflicts
				.slice(0, 5)
				.map((c) => {
					const resource = c.teacherName
						? `Teacher: ${c.teacherName}`
						: c.roomLabel
							? `Room: ${c.roomLabel}`
							: c.studentNames.length
								? `Students: ${c.studentNames.join(', ')}`
								: 'Unknown conflict'
					return `${c.date} ${c.startTime}-${c.endTime} (${resource})`
				})
				.join('\n')

			const extra = allConflicts.length > 5 ? `\n...and ${allConflicts.length - 5} more` : ''

			const confirmed = window.confirm(
				`This change conflicts with ${allConflicts.length} existing lesson${allConflicts.length === 1 ? '' : 's'}:\n\n${conflictDetails}${extra}\n\nAre you sure you want to continue?`
			)

			if (!confirmed) {
				return
			}
		}

		onSave(normalizedLesson)
		handleClose()
	}

	const handleClose = () => {
		setError(null)
		setConflicts([])
		setShowConflictWarning(false)
		setIsParticipantModalOpen(false)
		setCustomParticipantName('')
		setShowCustomParticipantInput(false)
		onClose()
	}

	const handleDelete = () => {
		const confirmed = window.confirm('Are you sure you want to delete this lesson? This action cannot be undone.')
		if (confirmed) {
			onDelete(formData.id)
			handleClose()
		}
	}

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-base-content/60 backdrop-blur-sm p-4">
			<div className="w-full max-w-2xl rounded-2xl bg-base-200 shadow-2xl border border-base-300 max-h-[90vh] overflow-y-auto">
				<div className="flex items-center justify-between border-b border-base-300 px-6 py-4 sticky top-0 bg-base-200 z-10">
					<div>
						<h2 className="text-xl font-semibold text-base-content">
							{formData.kind === 'lesson' ? 'Edit Lesson' : 'Edit Time Slot'}
						</h2>
						<p className="text-xs text-base-content/60">{formData.date}</p>
					</div>
					<button type="button" className="btn btn-ghost btn-sm btn-circle" onClick={handleClose}>
						✕
					</button>
				</div>

				<div className="p-6 space-y-6">
					{error && <Alert variant="error">{error}</Alert>}

					{showConflictWarning && conflicts.length > 0 && (
						<Alert variant="warning">
							<div className="space-y-2">
								<p className="font-medium">
									Warning: This lesson conflicts with {conflicts.length} existing lesson
									{conflicts.length === 1 ? '' : 's'}
								</p>
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
								<p className="text-sm mt-2">Clicking &quot;Save Changes&quot; will override these conflicts.</p>
							</div>
						</Alert>
					)}

					{/* Kind & Lesson Type */}
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
									onChange={(e) => handleLessonTypeChange(e.target.value as LessonType)}
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

					{/* Date & Start Time */}
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

					{/* Duration & End Time */}
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

					{/* Teacher & Room (only for lessons) */}
					{formData.kind === 'lesson' && (
						<>
							<div className="grid gap-4 sm:grid-cols-2">
								{/* Teacher Selection */}
								<div className="form-control col-span-full sm:col-span-1">
									<span className="label-text mb-1">Teacher</span>
									{/* Source tabs */}
									<div className="flex rounded-lg border border-base-300 overflow-hidden mb-2">
										<button
											type="button"
											className={`flex-1 px-2 py-1.5 text-xs font-medium transition-colors ${teacherSource === 'club' ? 'bg-primary text-primary-content' : 'bg-base-100 hover:bg-base-200'}`}
											onClick={() => handleTeacherSourceChange('club')}
										>
											Club
										</button>
										<button
											type="button"
											className={`flex-1 px-2 py-1.5 text-xs font-medium transition-colors border-x border-base-300 ${teacherSource === 'external' ? 'bg-warning text-warning-content' : 'bg-base-100 hover:bg-base-200'}`}
											onClick={() => handleTeacherSourceChange('external')}
										>
											External
										</button>
										<button
											type="button"
											className={`flex-1 px-2 py-1.5 text-xs font-medium transition-colors ${teacherSource === 'custom' ? 'bg-secondary text-secondary-content' : 'bg-base-100 hover:bg-base-200'}`}
											onClick={() => handleTeacherSourceChange('custom')}
										>
											Custom
										</button>
									</div>

									{/* Club trainers dropdown */}
									{teacherSource === 'club' && (
										<select
											className="select select-bordered"
											value={formData.teacherName || ''}
											onChange={(e) => handleTeacherSelect(e.target.value)}
										>
											<option value="">Select club trainer...</option>
											{teachers.map((t) => (
												<option key={t._id} value={`${t.firstName} ${t.lastName}`}>
													{t.firstName} {t.lastName}
												</option>
											))}
										</select>
									)}

									{/* External teachers dropdown */}
									{teacherSource === 'external' && (
										<>
											{externalTeachers.length === 0 ? (
												<p className="text-sm text-base-content/50 py-2">
													No external teachers. Add them in Club Overview.
												</p>
											) : (
												<select
													className="select select-bordered"
													value={formData.teacherName || ''}
													onChange={(e) => handleTeacherSelect(e.target.value)}
												>
													<option value="">Select external teacher...</option>
													{externalTeachers.map((t) => (
														<option key={t._id} value={t.name}>
															{t.name}
														</option>
													))}
												</select>
											)}
										</>
									)}

									{/* Custom freeform input */}
									{teacherSource === 'custom' && (
										<Input
											value={formData.teacherName ?? ''}
											onChange={(e) => {
												setFormData((prev) => ({ ...prev, teacherName: e.target.value }))
												checkConflicts()
											}}
											placeholder="Enter teacher name (temporary)"
										/>
									)}
								</div>

								{/* Room Selection */}
								<div className="form-control">
									<span className="label-text">Room</span>
									{roomMode === 'select' ? (
										<select
											className="select select-bordered"
											value={formData.roomLabel || ''}
											onChange={(e) => handleRoomSelect(e.target.value)}
										>
											<option value="">Select room...</option>
											{availableRooms.map((room) => (
												<option key={room} value={room}>
													{room}
												</option>
											))}
											<option value="__custom__">✏️ Custom room...</option>
										</select>
									) : (
										<div className="flex gap-2">
											<Input
												value={formData.roomLabel ?? ''}
												onChange={(e) => {
													setFormData((prev) => ({ ...prev, roomLabel: e.target.value }))
													checkConflicts()
												}}
												placeholder="Enter room name"
												className="flex-1"
											/>
											<button
												type="button"
												className="btn btn-ghost btn-sm self-center"
												onClick={() => {
													setRoomMode('select')
													setFormData((prev) => ({ ...prev, roomLabel: '' }))
												}}
												title="Switch to dropdown"
											>
												<X className="h-4 w-4" />
											</button>
										</div>
									)}
								</div>
							</div>

							{/* Participants Section */}
							<div className="form-control">
								<span className="label-text mb-1">
									{formData.lessonType === 'group' ? 'Participants' : 'Couple'}
								</span>

								{/* Selected participants chips */}
								{formData.studentNames.length > 0 && (
									<div className="flex flex-wrap gap-2 mb-3">
										{formData.pairLabel ? (
											<span className="badge badge-primary badge-lg gap-1">
												{formData.pairLabel}
												<button
													type="button"
													className="ml-1"
													onClick={() => {
														setFormData((prev) => ({
															...prev,
															studentNames: [],
															pairLabel: undefined,
														}))
													}}
												>
													<X className="h-3 w-3" />
												</button>
											</span>
										) : (
											formData.studentNames.map((name) => (
												<span key={name} className="badge badge-primary badge-lg gap-1">
													{name}
													<button type="button" className="ml-1" onClick={() => removeParticipant(name)}>
														<X className="h-3 w-3" />
													</button>
												</span>
											))
										)}
									</div>
								)}

								{/* Select Participants button */}
								<div className="flex gap-2">
									<button
										type="button"
										className="btn btn-outline flex-1 gap-2"
										onClick={() => setIsParticipantModalOpen(true)}
									>
										<Users className="h-4 w-4" />
										{formData.studentNames.length > 0
											? `Change Selection (${formData.studentNames.length})`
											: formData.lessonType === 'group'
												? 'Select Participants'
												: 'Select Couple'}
									</button>
									{!showCustomParticipantInput && (
										<button
											type="button"
											className="btn btn-outline btn-sm self-center"
											onClick={() => setShowCustomParticipantInput(true)}
											title="Add custom name"
										>
											<Plus className="h-4 w-4" />
											Custom
										</button>
									)}
								</div>

								{/* Custom participant input */}
								{showCustomParticipantInput && (
									<div className="flex gap-2 mt-2">
										<Input
											value={customParticipantName}
											onChange={(e) => setCustomParticipantName(e.target.value)}
											onKeyDown={(e) => {
												if (e.key === 'Enter') {
													e.preventDefault()
													addCustomParticipant()
												}
											}}
											placeholder="Type a name..."
											className="flex-1"
										/>
										<button
											type="button"
											className="btn btn-primary btn-sm self-center"
											onClick={addCustomParticipant}
											disabled={!customParticipantName.trim()}
										>
											Add
										</button>
										<button
											type="button"
											className="btn btn-ghost btn-sm self-center"
											onClick={() => {
												setShowCustomParticipantInput(false)
												setCustomParticipantName('')
											}}
										>
											<X className="h-4 w-4" />
										</button>
									</div>
								)}
							</div>

							{/* Participant Selection Modal */}
							<ParticipantSelectionModal
								isOpen={isParticipantModalOpen}
								onClose={() => setIsParticipantModalOpen(false)}
								onConfirm={handleParticipantSelection}
								lessonType={effectiveParticipantLessonType}
								students={students}
								couples={couples}
								initialStudentNames={formData.studentNames}
								initialPairLabel={formData.pairLabel}
							/>
						</>
					)}

					{/* Notes */}
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

					{/* Locked & Manual Override */}
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
					<Button className="btn-error" onClick={handleDelete}>
						Delete
					</Button>
					<div className="flex items-center gap-2">
						<Button className="btn-ghost" onClick={handleClose}>
							Cancel
						</Button>
						<Button className="btn-primary" onClick={handleSave}>
							Save Changes
						</Button>
					</div>
				</div>
			</div>
		</div>
	)
}

