'use client'

import { useState, useEffect } from 'react'
import { Button, Input, Alert } from '@/components'

interface GroupLesson {
	groupName: string
	lessonsTarget: {
		count: number
		timeScope: 'weekend' | 'week' | 'month' | 'timetable'
	}
	teachers: string[]
	participants: Couple[]
	staticTimeSlot?: {
		dayOfWeek: string
		startTime: string
		duration?: number
	}
	duration?: number // Custom duration in minutes (defaults to timetable's lessonDuration if not set)
	distributeAcrossDays?: boolean // When true, spread lessons evenly across timetable days
	preferredRoom?: string
	notes?: string
}

interface Couple {
	name: string
	studentA: { name: string; baseGroup?: string }
	studentB: { name: string; baseGroup?: string }
	baseGroup?: string
}

interface Teacher {
	name: string
	availability: string[]
	room: string
}

interface TimetableEditorModalProps {
	isOpen: boolean
	onClose: () => void
	teachers: Teacher[]
	couples: Couple[]
	onSave: (groupLessons: GroupLesson[]) => void
	initialGroupLessons?: GroupLesson[]
	startDate?: string
	endDate?: string
}

type Step = 'group-selection' | 'teacher-assignment' | 'timing' | 'participants' | 'settings' | 'review'

export function TimetableEditorModal({
	isOpen,
	onClose,
	teachers,
	couples,
	onSave,
	initialGroupLessons = [],
	startDate,
	endDate,
}: TimetableEditorModalProps) {
	const [currentStep, setCurrentStep] = useState<Step>('group-selection')
	const [groupLessons, setGroupLessons] = useState<GroupLesson[]>(initialGroupLessons)
	const [currentGroupIndex, setCurrentGroupIndex] = useState(0)
	const [availableGroups, setAvailableGroups] = useState<string[]>([])

	// Fetch groups from database when modal opens
	useEffect(() => {
		if (isOpen) {
			fetchGroups()
		}
	}, [isOpen])

	const fetchGroups = async () => {
		try {
			const res = await fetch('/api/groups', { cache: 'no-store' })
			if (res.ok) {
				const data = await res.json()
				setAvailableGroups(data.groups || [])
			}
		} catch (err) {
			console.error('Error fetching groups:', err)
		}
	}

	// Sync modal's internal state with initialGroupLessons prop when modal opens
	useEffect(() => {
		if (isOpen && initialGroupLessons) {
			console.log('TimetableEditorModal: Syncing with initialGroupLessons:', initialGroupLessons.map(gl => gl.groupName))
			setGroupLessons(initialGroupLessons)
		}
	}, [isOpen, initialGroupLessons])

	const [formData, setFormData] = useState({
		groupName: '',
		lessonsTarget: {
			count: 1,
			timeScope: 'week' as 'weekend' | 'week' | 'month' | 'timetable',
		},
		selectedTeachers: [] as string[],
		staticTimeSlot: {
			dayOfWeek: 'monday',
			startTime: '17:00',
			enabled: false,
		},
		duration: 45, // Default duration in minutes
		distributeAcrossDays: true, // Default to true for even distribution
		selectedParticipants: [] as Couple[],
		preferredRoom: '',
		notes: '',
	})

	const stepsConfig: { id: Step; title: string; description: string }[] = [
		{ id: 'group-selection', title: 'Group Basics', description: 'Pick the base group and lesson target.' },
		{ id: 'teacher-assignment', title: 'Teachers', description: 'Choose who can lead the class.' },
		{ id: 'timing', title: 'Schedule', description: 'Fix a slot or leave it flexible.' },
		{ id: 'participants', title: 'Couples', description: 'Select the couples for this group.' },
		{ id: 'settings', title: 'Room & Notes', description: 'Add supporting details.' },
		{ id: 'review', title: 'Review', description: 'Confirm everything looks right.' },
	]

	if (!isOpen) return null

	const daysOfWeek = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
	
	// Get available days based on timetable date range
	const getAvailableDays = (): string[] => {
		if (!startDate || !endDate) return daysOfWeek
		
		const start = new Date(startDate + 'T00:00:00') // Ensure local time
		const end = new Date(endDate + 'T23:59:59')
		const availableDaysSet = new Set<string>()
		
		// JavaScript Date.getDay(): 0=Sunday, 1=Monday, ..., 6=Saturday
		// Our array: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
		// Mapping: Sunday(0)->6, Monday(1)->0, Tuesday(2)->1, ..., Saturday(6)->5
		for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
			const jsDay = d.getDay()
			const arrayIndex = jsDay === 0 ? 6 : jsDay - 1
			const dayName = daysOfWeek[arrayIndex]
			availableDaysSet.add(dayName)
		}
		
		// Return days in order, but only those that appear in the timetable
		return daysOfWeek.filter(day => availableDaysSet.has(day))
	}

	const commitCurrentGroup = (): GroupLesson[] | null => {
		if (!formData.groupName) {
			console.log('TimetableEditorModal: commitCurrentGroup - No group name, returning null')
			return null
		}

		// Validate that the group has required fields
		if (!formData.selectedTeachers || formData.selectedTeachers.length === 0) {
			console.warn('TimetableEditorModal: commitCurrentGroup - Group has no teachers, cannot commit:', formData.groupName)
			return null
		}
		if (!formData.selectedParticipants || formData.selectedParticipants.length === 0) {
			console.warn('TimetableEditorModal: commitCurrentGroup - Group has no participants, cannot commit:', formData.groupName)
			return null
		}

		const newGroup: GroupLesson = {
			groupName: formData.groupName,
			lessonsTarget: formData.lessonsTarget,
			teachers: formData.selectedTeachers,
			participants: formData.selectedParticipants,
			staticTimeSlot: formData.staticTimeSlot?.enabled ? {
				dayOfWeek: formData.staticTimeSlot.dayOfWeek,
				startTime: formData.staticTimeSlot.startTime,
				duration: formData.duration || 45, // Use main duration field
			} : undefined,
			duration: formData.duration || 45, // Always save the duration
			distributeAcrossDays: formData.staticTimeSlot?.enabled ? false : formData.distributeAcrossDays, // Disable distribution for static slots
			preferredRoom: formData.preferredRoom || undefined,
			notes: formData.notes || undefined,
		}
		
		console.log('TimetableEditorModal: commitCurrentGroup - Committing group:', {
			groupName: newGroup.groupName,
			teachers: newGroup.teachers,
			participantsCount: newGroup.participants?.length || 0,
			hasStaticTimeSlot: !!newGroup.staticTimeSlot,
			currentGroupIndex,
			currentGroupsCount: groupLessons.length,
		})
		
		// Debug log to verify staticTimeSlot is being saved
		if (formData.staticTimeSlot?.enabled) {
			console.log('Saving group lesson with staticTimeSlot:', {
				groupName: newGroup.groupName,
				staticTimeSlot: newGroup.staticTimeSlot,
			})
		}

		const updatedGroups = [...groupLessons]
		if (currentGroupIndex < updatedGroups.length) {
			updatedGroups[currentGroupIndex] = newGroup
			console.log('TimetableEditorModal: Updated existing group at index', currentGroupIndex)
		} else {
			updatedGroups.push(newGroup)
			console.log('TimetableEditorModal: Added new group, total groups now:', updatedGroups.length)
		}
		setGroupLessons(updatedGroups)
		console.log('TimetableEditorModal: All groups after commit:', updatedGroups.map(gl => ({
			groupName: gl.groupName,
			teachers: gl.teachers,
			participantsCount: gl.participants?.length || 0,
		})))

		setFormData({
			groupName: '',
			lessonsTarget: {
				count: 1,
				timeScope: 'week',
			},
			selectedTeachers: [],
			staticTimeSlot: {
				dayOfWeek: 'monday',
				startTime: '17:00',
				enabled: false,
			},
			duration: 45,
			distributeAcrossDays: true,
			selectedParticipants: [],
			preferredRoom: '',
			notes: '',
		})
		setCurrentGroupIndex(updatedGroups.length)
		return updatedGroups
	}

	const handleNext = () => {
		switch (currentStep) {
			case 'group-selection':
				setCurrentStep('teacher-assignment')
				break
			case 'teacher-assignment':
				setCurrentStep('timing')
				break
			case 'timing':
				setCurrentStep('participants')
				break
			case 'participants':
				setCurrentStep('settings')
				break
			case 'settings':
				setCurrentStep('review')
				break
			case 'review':
				console.log('TimetableEditorModal: handleNext on review step - committing current group and adding another')
				const committed = commitCurrentGroup()
				if (committed) {
					console.log('TimetableEditorModal: Successfully committed group, total groups:', committed.length)
				} else {
					console.warn('TimetableEditorModal: Failed to commit group (no group name?)')
				}
				setCurrentStep('group-selection')
				break
		}
	}

	const handleBack = () => {
		switch (currentStep) {
			case 'teacher-assignment':
				setCurrentStep('group-selection')
				break
			case 'timing':
				setCurrentStep('teacher-assignment')
				break
			case 'participants':
				setCurrentStep('timing')
				break
			case 'settings':
				setCurrentStep('participants')
				break
			case 'review':
				setCurrentStep('settings')
				break
		}
	}

	const handleSave = () => {
		// Always commit the current group before saving all groups (only if it has a name and is valid)
		console.log('TimetableEditorModal: handleSave called - Current formData:', {
			groupName: formData.groupName,
			hasTeachers: formData.selectedTeachers.length > 0,
			hasParticipants: formData.selectedParticipants.length > 0,
			currentStep,
			currentGroupIndex,
		})
		console.log('TimetableEditorModal: handleSave - Current groupLessons state BEFORE commit:', groupLessons.map(gl => ({
			groupName: gl.groupName,
			teachers: gl.teachers,
			participantsCount: gl.participants?.length || 0,
		})))
		
		// Only commit if there's a group name AND it has all required fields (user is actively editing/creating a valid group)
		let finalGroupLessons = [...groupLessons] // Make a copy to avoid mutations
		
		if (formData.groupName && formData.selectedTeachers.length > 0 && formData.selectedParticipants.length > 0) {
			// Form has all required fields, try to commit
			const updated = commitCurrentGroup()
			if (updated) {
				finalGroupLessons = updated
				console.log('TimetableEditorModal: Successfully committed current group, new total:', finalGroupLessons.length)
			} else {
				console.warn('TimetableEditorModal: Failed to commit current group (validation failed)')
				// Keep existing groups - don't overwrite with incomplete form data
			}
		} else if (formData.groupName) {
			// Form has group name but is missing required fields
			console.warn('TimetableEditorModal: Form has group name but is incomplete (missing teachers or participants). Not committing, saving existing groups only.')
		} else {
			console.log('TimetableEditorModal: No group name in form, saving existing groups only')
		}
		
		console.log('TimetableEditorModal: Final groupLessons to save:', JSON.stringify(finalGroupLessons.map(gl => ({
			groupName: gl.groupName,
			teachers: gl.teachers,
			teachersCount: gl.teachers?.length || 0,
			participantsCount: gl.participants?.length || 0,
			staticTimeSlot: gl.staticTimeSlot,
			hasStaticTimeSlot: !!gl.staticTimeSlot,
		})), null, 2))
		
		if (finalGroupLessons.length === 0) {
			console.warn('TimetableEditorModal: WARNING - No group lessons to save!')
		}
		
		onSave(finalGroupLessons)
		onClose()
	}

	const renderStepContent = () => {
		const header = (title: string, description: string) => (
			<div className="space-y-1">
				<h3 className="text-lg font-semibold text-base-content">{title}</h3>
				<p className="text-sm text-base-content/60">{description}</p>
			</div>
		)

		switch (currentStep) {
			case 'group-selection':
				return (
					<div className="space-y-6">
						{header('Group basics', 'Choose the base group and set lesson targets for your time scope.')}

						<div className="space-y-4">
							<label className="form-control">
								<span className="label-text">Base group</span>
								<select
									value={formData.groupName}
									onChange={(e) => {
										setFormData((prev) => ({ ...prev, groupName: e.target.value, selectedParticipants: [] }))
									}}
									className="select select-bordered w-full"
								>
									<option value="">Select a group…</option>
									{availableGroups.map((group) => (
										<option key={group} value={group}>
											{group}
										</option>
									))}
								</select>
							</label>

							<div className="grid gap-4 sm:grid-cols-2">
								<label className="form-control">
									<span className="label-text">Number of lessons</span>
									<Input
										type="number"
										min="1"
										max="100"
										value={formData.lessonsTarget?.count ?? 1}
										onChange={(e) =>
											setFormData((prev) => ({
												...prev,
												lessonsTarget: {
													...prev.lessonsTarget,
													count: parseInt(e.target.value, 10) || 1,
												},
											}))
										}
									/>
								</label>

								<label className="form-control">
									<span className="label-text">Time scope</span>
									<select
										value={formData.lessonsTarget?.timeScope ?? 'week'}
										onChange={(e) =>
											setFormData((prev) => ({
												...prev,
												lessonsTarget: {
													...prev.lessonsTarget,
													timeScope: e.target.value as 'weekend' | 'week' | 'month' | 'timetable',
												},
											}))
										}
										className="select select-bordered w-full"
									>
										<option value="weekend">Per Weekend</option>
										<option value="week">Per Week</option>
										<option value="month">Per Month</option>
										<option value="timetable">Per This Timetable</option>
									</select>
								</label>
							</div>
							<span className="label-text-alt text-base-content/50">
								The algorithm will aim to schedule {formData.lessonsTarget?.count ?? 1} lesson{(formData.lessonsTarget?.count ?? 1) !== 1 ? 's' : ''} per {
									formData.lessonsTarget?.timeScope === 'weekend' ? 'weekend' : 
									formData.lessonsTarget?.timeScope === 'week' ? 'week' : 
									formData.lessonsTarget?.timeScope === 'month' ? 'month' : 
									'this timetable'
								}.
							</span>
						</div>
					</div>
				)

			case 'teacher-assignment':
				return (
					<div className="space-y-6">
						{header('Assign coaches', 'Pick every teacher who is allowed to lead this group lesson.')}

						<div className="grid gap-3">
							{teachers.map((teacher) => {
								const checked = formData.selectedTeachers.includes(teacher.name)
								return (
									<label
										key={teacher.name}
										className={`flex items-center justify-between gap-3 rounded-xl border p-3 transition ${
											checked ? 'border-primary bg-primary/10' : 'border-base-300 bg-base-200/40'
										}`}
									>
										<div className="flex items-center gap-3">
											<input
												type="checkbox"
												className="checkbox checkbox-primary"
												checked={checked}
												onChange={(e) => {
													if (e.target.checked) {
														setFormData((prev) => ({
															...prev,
															selectedTeachers: [...prev.selectedTeachers, teacher.name],
														}))
													} else {
														setFormData((prev) => ({
															...prev,
															selectedTeachers: prev.selectedTeachers.filter((t) => t !== teacher.name),
														}))
													}
												}}
											/>
											<div>
												<p className="font-medium text-base-content">{teacher.name}</p>
												<p className="text-xs text-base-content/60">
													Room {teacher.room} · {teacher.availability.length > 0 
														? `Unavailability ${teacher.availability.join(', ')}`
														: 'Available anytime'}
												</p>
											</div>
										</div>
									</label>
								)
							})}
						</div>
					</div>
				)

			case 'timing':
				return (
					<div className="space-y-6">
						{header('Scheduling', 'Lock the lesson to a fixed slot or keep it flexible for the generator.')}

						<div className="space-y-4">
							<label className="flex items-center gap-3 rounded-xl border border-base-300 bg-base-200/40 p-3">
								<input
									type="checkbox"
									className="toggle toggle-primary"
									checked={formData.staticTimeSlot.enabled}
									onChange={(e) =>
										setFormData((prev) => ({
											...prev,
											staticTimeSlot: { ...prev.staticTimeSlot, enabled: e.target.checked },
										}))
									}
								/>
								<div>
									<p className="font-medium text-base-content">Use a fixed weekly time</p>
									<p className="text-xs text-base-content/60">
										Disable this if the generator should find the best overlapping slot automatically.
									</p>
								</div>
							</label>

							{/* Duration field - always visible */}
							<label className="form-control">
								<span className="label-text">Duration (minutes)</span>
								<Input
									type="number"
									min="15"
									max="300"
									step="15"
									value={formData.duration}
									onChange={(e) => {
										const value = parseInt(e.target.value, 10)
										setFormData((prev) => ({
											...prev,
											duration: value > 0 ? value : 45,
										}))
									}}
								/>
								<span className="label-text-alt text-base-content/50">
									Default is 45 minutes. Group lessons can have longer durations.
								</span>
							</label>

							{formData.staticTimeSlot.enabled ? (
								<div className="grid gap-4 sm:grid-cols-2">
									<label className="form-control">
										<span className="label-text">Day of week</span>
										<select
											value={formData.staticTimeSlot.dayOfWeek}
											onChange={(e) =>
												setFormData((prev) => ({
													...prev,
													staticTimeSlot: { ...prev.staticTimeSlot, dayOfWeek: e.target.value },
												}))
											}
											className="select select-bordered w-full"
										>
											{getAvailableDays().map((day) => (
												<option key={day} value={day}>
													{day.charAt(0).toUpperCase() + day.slice(1)}
												</option>
											))}
										</select>
										{startDate && endDate && (
											<span className="label-text-alt text-base-content/50">
												Only days within the timetable date range are shown
											</span>
										)}
									</label>

									<label className="form-control">
										<span className="label-text">Start time</span>
										<Input
											type="time"
											value={formData.staticTimeSlot.startTime}
											onChange={(e) =>
												setFormData((prev) => ({
													...prev,
													staticTimeSlot: { ...prev.staticTimeSlot, startTime: e.target.value },
												}))
											}
										/>
									</label>
								</div>
							) : (
								<div className="space-y-4">
									<Alert>
										We&apos;ll look for a shared slot across all selected teachers and couples within the timetable window.
									</Alert>
									
									<label className="flex items-center gap-3 rounded-xl border border-base-300 bg-base-200/40 p-3">
										<input
											type="checkbox"
											className="toggle toggle-primary"
											checked={formData.distributeAcrossDays}
											onChange={(e) =>
												setFormData((prev) => ({
													...prev,
													distributeAcrossDays: e.target.checked,
												}))
											}
										/>
										<div>
											<p className="font-medium text-base-content">Distribute across days</p>
											<p className="text-xs text-base-content/60">
												Spread lessons evenly across all timetable days. E.g., 4 lessons over 2 days = 2 per day.
											</p>
										</div>
									</label>
								</div>
							)}
						</div>
					</div>
				)

			case 'participants': {
				// Only show couples that match the selected group
				const availableCouples = formData.groupName
					? couples.filter((couple) => couple.baseGroup === formData.groupName)
					: []

				const allSelected = availableCouples.length > 0 && 
					availableCouples.every((couple) => 
						formData.selectedParticipants.some((p) => p.name === couple.name)
					)

				const handleSelectAll = (checked: boolean) => {
					if (checked) {
						setFormData((prev) => ({
							...prev,
							selectedParticipants: [...availableCouples],
						}))
					} else {
						setFormData((prev) => ({
							...prev,
							selectedParticipants: [],
						}))
					}
				}

				return (
					<div className="space-y-6">
						{header('Couples', `Select couples from ${formData.groupName || 'the selected group'} to participate in this group lesson.`)}

						{!formData.groupName ? (
							<Alert variant="warning">
								Please select a group first to see available couples.
							</Alert>
						) : availableCouples.length === 0 ? (
							<Alert variant="info">
								No couples found in group <span className="font-semibold">{formData.groupName}</span>. Make sure couples are assigned to this group.
							</Alert>
						) : (
							<>
								{availableCouples.length > 1 && (
									<label className="flex items-center gap-3 rounded-xl border border-base-300 bg-base-200/60 p-3 cursor-pointer hover:bg-base-200/80 transition">
										<input
											type="checkbox"
											className="checkbox checkbox-primary"
											checked={allSelected}
											onChange={(e) => handleSelectAll(e.target.checked)}
										/>
										<span className="font-medium text-base-content">
											Select all ({availableCouples.length} couples)
										</span>
									</label>
								)}

								<div className="grid gap-3">
									{availableCouples.map((couple) => {
										const checked = formData.selectedParticipants.some((p) => p.name === couple.name)
										return (
											<label
												key={couple.name}
												className={`flex items-center justify-between gap-3 rounded-xl border p-3 transition cursor-pointer ${
													checked ? 'border-primary bg-primary/10' : 'border-base-300 bg-base-200/40 hover:bg-base-200/60'
												}`}
											>
												<div className="flex items-center gap-3">
													<input
														type="checkbox"
														className="checkbox checkbox-primary"
														checked={checked}
														onChange={(e) => {
															if (e.target.checked) {
																setFormData((prev) => ({
																	...prev,
																	selectedParticipants: [...prev.selectedParticipants, couple],
																}))
															} else {
																setFormData((prev) => ({
																	...prev,
																	selectedParticipants: prev.selectedParticipants.filter(
																		(p) => p.name !== couple.name,
																	),
																}))
															}
														}}
													/>
													<div>
														<p className="font-medium text-base-content">{couple.name}</p>
														<p className="text-xs text-base-content/60">
															Group {couple.baseGroup ?? '—'}
														</p>
													</div>
												</div>
											</label>
										)
									})}
								</div>
							</>
						)}

						{formData.selectedParticipants.length === 0 && formData.groupName && availableCouples.length > 0 && (
							<Alert variant="warning">
								Add at least one couple so the generator can schedule this group.
							</Alert>
						)}
					</div>
				)
			}

			case 'settings':
				return (
					<div className="space-y-6">
						{header('Room & notes', 'Capture the final details before reviewing the setup.')}

						<div className="grid gap-4">
							<label className="form-control">
								<span className="label-text">Preferred room</span>
								<select
									value={formData.preferredRoom}
									onChange={(e) => setFormData((prev) => ({ ...prev, preferredRoom: e.target.value }))}
									className="select select-bordered w-full"
								>
									<option value="">Any available room</option>
									{Array.from(new Set(teachers.map((t) => t.room))).map((room) => (
										<option key={room} value={room}>
											{room}
										</option>
									))}
								</select>
							</label>

							<label className="form-control">
								<span className="label-text">Notes</span>
								<textarea
									value={formData.notes}
									onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
									placeholder="Let the coaches know what to focus on, or who to sync with."
									className="textarea textarea-bordered h-24 resize-none"
								/>
								<span className="label-text-alt text-base-content/50">
									This shows up in the timetable export.
								</span>
							</label>
						</div>
					</div>
				)

			case 'review':
				return (
					<div className="space-y-6">
						{header('Review & confirm', 'Double-check the summary before saving this group.')}

						<div className="rounded-2xl border border-base-300 bg-base-200/50 p-5 space-y-4">
							<div className="flex flex-wrap items-center justify-between gap-3">
								<div>
									<p className="text-sm text-base-content/60">Group</p>
									<p className="text-lg font-semibold text-base-content">{formData.groupName || 'Not set'}</p>
								</div>
								<span className="badge badge-primary badge-outline">
									{formData.lessonsTarget.count}× per {
										formData.lessonsTarget.timeScope === 'weekend' ? 'weekend' : 
										formData.lessonsTarget.timeScope === 'week' ? 'week' : 
										formData.lessonsTarget.timeScope === 'month' ? 'month' : 
										'this timetable'
									}
								</span>
							</div>

							<div className="grid gap-3 sm:grid-cols-2 text-sm text-base-content/80">
								<div className="space-y-1">
									<p className="font-medium text-base-content/90">Teachers</p>
									<p>{formData.selectedTeachers.length ? formData.selectedTeachers.join(', ') : 'None selected'}</p>
								</div>
								<div className="space-y-1">
									<p className="font-medium text-base-content/90">Couples</p>
									<p>
										{formData.selectedParticipants.length
											? formData.selectedParticipants.map((p) => p.name).join(', ')
											: 'None selected'}
									</p>
								</div>
								<div className="space-y-1">
									<p className="font-medium text-base-content/90">Timing</p>
									{formData.staticTimeSlot.enabled ? (
										<p>
											{formData.staticTimeSlot.dayOfWeek}, {formData.staticTimeSlot.startTime} ·{' '}
											{formData.duration} min
										</p>
									) : (
										<p>Flexible · {formData.duration} min{formData.distributeAcrossDays ? ' · Distributed' : ''}</p>
									)}
								</div>
								<div className="space-y-1">
									<p className="font-medium text-base-content/90">Room</p>
									<p>{formData.preferredRoom || 'Any available room'}</p>
								</div>
							</div>

							{formData.notes && (
								<div className="rounded-xl bg-base-100/80 p-3 text-sm text-base-content/70">
									<p className="font-medium text-base-content/90 mb-1">Notes</p>
									<p>{formData.notes}</p>
								</div>
							)}
						</div>
					</div>
				)
		}
	}

	const getStepProgress = () => {
		const index = stepsConfig.findIndex((step) => step.id === currentStep)
		return index >= 0 ? index + 1 : 1
	}

	const currentStepIndex = stepsConfig.findIndex((step) => step.id === currentStep)

	return (
		<div className="fixed inset-0 bg-base-content/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50">
			<div className="bg-base-200 text-base-content rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-2xl max-h-[95vh] sm:max-h-[90vh] overflow-hidden border border-base-300 flex flex-col">
				{/* Mobile drag indicator */}
				<div className="flex justify-center pt-2 sm:hidden">
					<div className="w-12 h-1.5 bg-base-300 rounded-full" />
				</div>
				
				{/* Header - sticky on mobile */}
				<div className="flex justify-between items-center p-4 sm:p-6 pb-2 sm:pb-6 border-b border-base-300 sm:border-0">
					<h2 className="text-lg sm:text-xl font-bold text-base-content">Group Lesson Config</h2>
					<button
						onClick={onClose}
						className="btn btn-ghost btn-sm btn-circle text-base-content/70 hover:text-base-content"
					>
						✕
					</button>
				</div>

				{/* Scrollable content */}
				<div className="flex-1 overflow-y-auto p-4 sm:p-6 pt-2 sm:pt-0">
					{/* Progress indicator */}
					<div className="mb-6 space-y-4">
						<div className="flex flex-wrap items-center justify-between gap-2 text-sm text-base-content/70">
							<span>
								Step {getStepProgress()} of {stepsConfig.length}
							</span>
							<span>
								{groupLessons.length} group{groupLessons.length === 1 ? '' : 's'} configured
							</span>
						</div>
						{/* Simplified progress on mobile */}
						<div className="sm:hidden">
							<div className="flex items-center gap-2">
								<div className="flex-1 bg-base-300 rounded-full h-2">
									<div 
										className="bg-primary h-2 rounded-full transition-all" 
										style={{ width: `${(currentStepIndex + 1) / stepsConfig.length * 100}%` }}
									/>
								</div>
								<span className="text-xs font-medium">{stepsConfig[currentStepIndex]?.title}</span>
							</div>
						</div>
						{/* Full steps indicator on desktop */}
						<ul className="steps steps-horizontal w-full overflow-x-auto hidden sm:flex">
							{stepsConfig.map((step, index) => {
								const isDone = index < currentStepIndex
								const isCurrent = index === currentStepIndex
								return (
									<li
										key={step.id}
										className={`step ${isDone || isCurrent ? 'step-primary' : ''}`}
										data-content={isDone ? '✓' : index + 1}
									>
										<div className="mt-2 flex flex-col items-center gap-1 text-center">
											<span className="text-xs font-semibold uppercase tracking-wide text-base-content/70">
												{step.title}
											</span>
											<span className="text-[11px] text-base-content/40">{step.description}</span>
										</div>
									</li>
								)
							})}
						</ul>
					</div>

					{/* Step content */}
					<div className="mb-6">
						{renderStepContent()}
					</div>

					{/* Group lessons summary */}
					{groupLessons.length > 0 && (
						<div className="mt-6 pt-6 border-t border-base-300">
							<div className="flex items-center justify-between mb-3">
								<h4 className="font-medium text-base-content">Configured Groups:</h4>
								<Button onClick={handleSave} size="sm" variant="primary" className="hidden sm:flex">
									Save & Close
								</Button>
							</div>
							<div className="space-y-2">
								{groupLessons.map((group, index) => (
									<div key={index} className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 p-3 rounded-xl border border-base-300 bg-accent/20 hover:bg-accent/30 transition-colors">
										<div className="flex flex-col gap-1">
											<span className="font-medium text-base-content">{group.groupName}</span>
											<span className="text-xs text-base-content/70">
												{group.lessonsTarget?.count ?? 0}× per {group.lessonsTarget?.timeScope ?? 'week'}
												{' · '}{group.duration ?? 45} min
												{group.staticTimeSlot && (
													<> · {group.staticTimeSlot.dayOfWeek.charAt(0).toUpperCase() + group.staticTimeSlot.dayOfWeek.slice(1)} {group.staticTimeSlot.startTime}</>
												)}
												{!group.staticTimeSlot && group.distributeAcrossDays && (
													<> · <span className="text-success">distributed</span></>
												)}
											</span>
										</div>
										<div className="flex gap-2">
											<Button
												onClick={() => {
													setCurrentGroupIndex(index)
													setFormData({
														groupName: group.groupName,
														lessonsTarget: group.lessonsTarget || {
															count: 1,
															timeScope: 'week' as 'weekend' | 'week' | 'month' | 'timetable',
														},
														selectedTeachers: group.teachers,
														staticTimeSlot: group.staticTimeSlot ? {
															dayOfWeek: group.staticTimeSlot.dayOfWeek,
															startTime: group.staticTimeSlot.startTime,
															enabled: true,
														} : {
															dayOfWeek: 'monday',
															startTime: '17:00',
															enabled: false,
														},
														duration: group.duration ?? group.staticTimeSlot?.duration ?? 45,
														distributeAcrossDays: group.distributeAcrossDays ?? true,
														selectedParticipants: group.participants,
														preferredRoom: group.preferredRoom || '',
														notes: group.notes || '',
													})
													setCurrentStep('group-selection')
												}}
												variant="secondary"
												size="sm"
											>
												Edit
											</Button>
											<Button
												onClick={() => {
													const updatedGroups = groupLessons.filter((_, i) => i !== index)
													setGroupLessons(updatedGroups)
													// If we were editing this group, reset form
													if (currentGroupIndex === index) {
														setCurrentGroupIndex(updatedGroups.length)
														setFormData({
															groupName: '',
															lessonsTarget: { count: 1, timeScope: 'week' as const },
															selectedTeachers: [],
															staticTimeSlot: { dayOfWeek: 'monday', startTime: '17:00', enabled: false },
															duration: 45,
															distributeAcrossDays: true,
															selectedParticipants: [],
															preferredRoom: '',
															notes: '',
														})
													} else if (currentGroupIndex > index) {
														// Adjust index if we're editing a group after the removed one
														setCurrentGroupIndex(currentGroupIndex - 1)
													}
												}}
												variant="ghost"
												size="sm"
												className="text-error hover:bg-error/20"
											>
												Remove
											</Button>
										</div>
									</div>
								))}
							</div>
						</div>
					)}
				</div>

				{/* Sticky Navigation Footer */}
				<div className="sticky bottom-0 bg-base-200 border-t border-base-300 p-4 sm:p-6 pt-4">
					<div className="flex flex-wrap items-center justify-between gap-3">
						<Button onClick={handleBack} disabled={currentStep === 'group-selection'} variant="secondary" className="flex-1 sm:flex-none">
							Back
						</Button>

						<div className="flex items-center gap-2 flex-1 sm:flex-none justify-end">
							{/* Show Save button on first step if there are configured groups */}
							{currentStep === 'group-selection' && groupLessons.length > 0 && (
								<Button onClick={handleSave} variant="primary" className="flex-1 sm:flex-none">
									Save & Close
								</Button>
							)}
							{(currentStep === 'settings' || currentStep === 'review') && (
								<Button onClick={handleSave} variant="primary" className="hidden sm:flex">
									Save all groups
								</Button>
							)}
							<Button
								onClick={handleNext}
								disabled={
									(currentStep === 'group-selection' && !formData.groupName) ||
									(currentStep === 'teacher-assignment' && formData.selectedTeachers.length === 0) ||
									(currentStep === 'participants' && formData.selectedParticipants.length === 0)
								}
								className="btn-primary flex-1 sm:flex-none"
							>
								{currentStep === 'review'
									? 'Save & add'
									: currentStep === 'settings'
										? 'Review'
										: 'Next'}
							</Button>
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}
