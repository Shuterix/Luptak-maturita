'use client'

import { useState, useEffect } from 'react'
import { Button, Input, Alert } from '@/components'

type Step = 'teachers' | 'couples' | 'breaks' | 'review'

interface TeacherForm {
	id: string
	name: string
	availability: string
	maxLessonsPerDay: number
	room: string
	unavailableDates: string
}

interface CoupleForm {
	id: string
	name: string
	availability: string
	desiredLessons: number
	priority: number
	teacherLessons: string
	unavailableDates: string
}

interface DbCouple {
	_id: string
	studentAId: { firstName: string; lastName: string; email: string; unavailability?: any }
	studentBId: { firstName: string; lastName: string; email: string; unavailability?: any }
	baseGroup?: string
	preferredTeacherId?: { firstName: string; lastName: string }
	unavailability?: any
}

interface CoupleConfig {
	coupleId: string
	desiredLessons: number
	priority: number
	teacherLessons: Record<string, number> // teacher name -> number of lessons
}

interface SchedulerConfigModalProps {
	isOpen: boolean
	onClose: () => void
	teachers: TeacherForm[]
	couples: CoupleForm[]
	dbCouples?: DbCouple[]
	breaks: string
	lessonDuration: number
	studentBreakAfter: number
	teacherBreakAfter: number
	dayStart?: string
	dayEnd?: string
	includeWeekends?: boolean
	onSave: (config: {
		teachers: TeacherForm[]
		couples: CoupleForm[]
		coupleConfigs: CoupleConfig[]
		breaks: string
		lessonDuration: number
		studentBreakAfter: number
		teacherBreakAfter: number
		dayStart: string
		dayEnd: string
		includeWeekends: boolean
	}) => void
	onAddTeacher: () => void
	onRemoveTeacher: (id: string) => void
	onUpdateTeacher: (id: string, field: keyof TeacherForm, value: any) => void
	onAddCouple: () => void
	onRemoveCouple: (id: string) => void
	onUpdateCouple: (id: string, field: keyof CoupleForm, value: any) => void
}

const stepsConfig: { id: Step; title: string; description: string }[] = [
	{ id: 'teachers', title: 'Teachers', description: 'Configure teacher availability and preferences.' },
	{ id: 'couples', title: 'Couples', description: 'Set up couples and their availability.' },
	{ id: 'breaks', title: 'Breaks & Settings', description: 'Configure breaks and lesson settings.' },
	{ id: 'review', title: 'Review', description: 'Review all settings before generating.' },
]

export function SchedulerConfigModal({
	isOpen,
	onClose,
	teachers,
	couples,
	dbCouples = [],
	breaks,
	lessonDuration,
	studentBreakAfter,
	teacherBreakAfter,
	dayStart = '15:00',
	dayEnd = '20:00',
	includeWeekends = true,
	onSave,
	onAddTeacher,
	onRemoveTeacher,
	onUpdateTeacher,
	onAddCouple,
	onRemoveCouple,
	onUpdateCouple,
}: SchedulerConfigModalProps) {
	const convertUnavailabilityToString = (unavailability: any): string => {
		if (!unavailability) return 'Available anytime'
		
		const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const
		const result: string[] = []
		
		for (const day of days) {
			const windows = unavailability[day] || []
			for (const window of windows) {
				if (window.start && window.end) {
					result.push(`${window.start}-${window.end}`)
				}
			}
		}
		
		return result.length > 0 ? result.join(', ') : 'Available anytime'
	}
	const [currentStep, setCurrentStep] = useState<Step>('teachers')
	const [localBreaks, setLocalBreaks] = useState(breaks)
	const [localLessonDuration, setLocalLessonDuration] = useState(lessonDuration)
	const [localStudentBreakAfter, setLocalStudentBreakAfter] = useState(studentBreakAfter)
	const [localTeacherBreakAfter, setLocalTeacherBreakAfter] = useState(teacherBreakAfter)
	const [localDayStart, setLocalDayStart] = useState(dayStart)
	const [localDayEnd, setLocalDayEnd] = useState(dayEnd)
	const [localIncludeWeekends, setLocalIncludeWeekends] = useState(includeWeekends)
	const [coupleConfigs, setCoupleConfigs] = useState<Record<string, CoupleConfig>>({})
	const [error, setError] = useState<string | null>(null)
	const [expandedTeachers, setExpandedTeachers] = useState<Set<string>>(new Set())
	const [expandedCouples, setExpandedCouples] = useState<Set<string>>(new Set())

	// Initialize couple configs when modal opens or dbCouples change
	// Load saved configs from localStorage first, then add defaults for any missing couples
	useEffect(() => {
		if (isOpen && dbCouples.length > 0) {
			// Try to load saved couple configs from localStorage
			const savedConfigsStr = typeof window !== 'undefined' ? window.localStorage.getItem('coupleConfigs') : null
			let savedConfigsMap: Record<string, CoupleConfig> = {}
			
			if (savedConfigsStr) {
				try {
					const savedConfigsArray = JSON.parse(savedConfigsStr) as CoupleConfig[]
					savedConfigsArray.forEach((config) => {
						if (config.coupleId) {
							savedConfigsMap[config.coupleId] = config
						}
					})
				} catch (e) {
					console.error('Failed to parse saved couple configs:', e)
				}
			}

			// Start with saved configs, then add defaults for any couples that don't have saved configs
			const initialConfigs: Record<string, CoupleConfig> = {}
			dbCouples.forEach((pair) => {
				if (savedConfigsMap[pair._id]) {
					// Use saved config with all its properties (desiredLessons, priority, teacherLessons)
					initialConfigs[pair._id] = savedConfigsMap[pair._id]
				} else {
					// Use default config for new couples
					const teacherName = pair.preferredTeacherId 
						? `${pair.preferredTeacherId.firstName} ${pair.preferredTeacherId.lastName}`
						: teachers.length > 0 ? teachers[0].name : ''
					initialConfigs[pair._id] = {
						coupleId: pair._id,
						desiredLessons: 2,
						priority: 5,
						teacherLessons: teacherName ? { [teacherName]: 2 } : {},
					}
				}
			})
			setCoupleConfigs(initialConfigs)
		}
	}, [isOpen, dbCouples.length, teachers.length])

	// Update local day times when props change
	useEffect(() => {
		setLocalDayStart(dayStart)
		setLocalDayEnd(dayEnd)
		setLocalIncludeWeekends(includeWeekends)
		setLocalBreaks(breaks)
		setLocalLessonDuration(lessonDuration)
		setLocalStudentBreakAfter(studentBreakAfter)
		setLocalTeacherBreakAfter(teacherBreakAfter)
	}, [dayStart, dayEnd, includeWeekends, breaks, lessonDuration, studentBreakAfter, teacherBreakAfter])

	if (!isOpen) return null

	const currentStepIndex = stepsConfig.findIndex((s) => s.id === currentStep)
	const canGoNext = currentStepIndex < stepsConfig.length - 1
	const canGoPrev = currentStepIndex > 0

	const validateStep = (step: Step): boolean => {
		setError(null)
		switch (step) {
			case 'teachers':
				if (teachers.length === 0) {
					setError('Add at least one teacher')
					return false
				}
				if (teachers.some((t) => !t.name.trim())) {
					setError('All teachers must have a name')
					return false
				}
				return true
			case 'couples':
				// Only validate database couples - no manual couples allowed
				if (dbCouples.length === 0) {
					setError('No couples found in database. Please create couples in the Couples management page first.')
					return false
				}
				return true
			case 'breaks':
				if (localLessonDuration < 15) {
					setError('Lesson duration must be at least 15 minutes')
					return false
				}
				return true
			default:
				return true
		}
	}

	const handleNext = () => {
		if (!validateStep(currentStep)) return
		if (canGoNext) {
			const nextIndex = currentStepIndex + 1
			setCurrentStep(stepsConfig[nextIndex].id)
		}
	}

	const handlePrev = () => {
		if (canGoPrev) {
			const prevIndex = currentStepIndex - 1
			setCurrentStep(stepsConfig[prevIndex].id)
		}
	}

	const handleSave = () => {
		if (!validateStep('review')) return
		onSave({
			teachers,
			couples,
			coupleConfigs: Object.values(coupleConfigs),
			breaks: localBreaks,
			lessonDuration: localLessonDuration,
			studentBreakAfter: localStudentBreakAfter,
			teacherBreakAfter: localTeacherBreakAfter,
			dayStart: localDayStart,
			dayEnd: localDayEnd,
			includeWeekends: localIncludeWeekends,
		})
		onClose()
		setCurrentStep('teachers')
		setError(null)
	}

	const handleClose = () => {
		setCurrentStep('teachers')
		setError(null)
		setLocalBreaks(breaks)
		setLocalLessonDuration(lessonDuration)
		setLocalStudentBreakAfter(studentBreakAfter)
		setLocalTeacherBreakAfter(teacherBreakAfter)
		setLocalDayStart(dayStart)
		setLocalDayEnd(dayEnd)
		setLocalIncludeWeekends(includeWeekends)
		onClose()
	}

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-base-content/60 p-4">
			<div className="w-full max-w-4xl rounded-2xl bg-base-200 shadow-2xl border border-base-300 max-h-[90vh] overflow-y-auto">
				<div className="flex items-center justify-between border-b border-base-300 px-6 py-4 sticky top-0 bg-base-200 z-10">
					<h3 className="text-lg font-semibold text-base-content">Automatic Scheduler Configuration</h3>
					<button type="button" className="btn btn-ghost btn-sm" onClick={handleClose}>
						✕
					</button>
				</div>

				<div className="p-6 space-y-6">
					{/* Step Progress */}
					<div className="mb-6 space-y-4">
						<div className="flex flex-wrap items-center justify-between gap-2 text-sm text-base-content/70">
							<span>
								Step {currentStepIndex + 1} of {stepsConfig.length}
							</span>
						</div>
						<ul className="steps steps-horizontal w-full overflow-x-auto">
							{stepsConfig.map((step, idx) => (
								<li
									key={step.id}
									className={`step ${idx <= currentStepIndex ? 'step-primary' : ''}`}
									data-content={idx + 1}
								>
									<div className="mt-2 flex flex-col items-center gap-1 text-center">
										<span className="text-xs font-semibold uppercase tracking-wide text-base-content/70">
											{step.title}
										</span>
										<span className="text-[11px] text-base-content/40">{step.description}</span>
									</div>
								</li>
							))}
						</ul>
					</div>

					{error && (
						<Alert variant="error">
							{error}
						</Alert>
					)}

					{/* Step Content */}
					<div className="space-y-6">
						{currentStep === 'teachers' && (
							<div className="space-y-4">
								<div className="space-y-1">
									<h3 className="text-lg font-semibold text-base-content">Teachers</h3>
									<p className="text-sm text-base-content/60">Configure teacher availability and preferences.</p>
								</div>
								<div className="flex items-center justify-between">
									<span className="text-sm text-base-content/60">{teachers.length} teacher(s)</span>
									<Button className="btn-ghost btn-sm" onClick={onAddTeacher}>
										Add teacher
									</Button>
								</div>
								<div className="space-y-2 max-h-[400px] overflow-y-auto">
									{teachers.map((teacher) => {
										const isExpanded = expandedTeachers.has(teacher.id)
										return (
											<div key={teacher.id} className="border border-base-300 rounded-xl bg-base-100 overflow-hidden">
												<div className="relative">
													<button
														type="button"
														onClick={() => {
															const newExpanded = new Set(expandedTeachers)
															if (isExpanded) {
																newExpanded.delete(teacher.id)
															} else {
																newExpanded.add(teacher.id)
															}
															setExpandedTeachers(newExpanded)
														}}
														className="w-full flex items-center justify-between p-4 hover:bg-base-200 transition pr-20"
													>
														<div className="flex items-center gap-3">
															<span className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`}>▶</span>
															<span className="font-medium">{teacher.name || 'Unnamed Teacher'}</span>
															{!teacher.availability && (
																<span className="badge badge-sm badge-ghost">Available anytime</span>
															)}
														</div>
														<div className="flex items-center gap-2">
															{teacher.availability && (
																<span className="text-xs text-base-content/60">Unavailable: {teacher.availability}</span>
															)}
														</div>
													</button>
													{teachers.length > 1 && (
														<button
															type="button"
															className="absolute right-2 top-1/2 -translate-y-1/2 btn btn-ghost btn-sm text-error"
															onClick={(e) => {
																e.stopPropagation()
																onRemoveTeacher(teacher.id)
															}}
														>
															Remove
														</button>
													)}
												</div>
												{isExpanded && (
													<div className="p-4 pt-0 space-y-3 border-t border-base-300">
														<label className="form-control">
															<span className="label-text">Name</span>
															<Input
																value={teacher.name}
																onChange={(event) => onUpdateTeacher(teacher.id, 'name', event.target.value)}
																placeholder="e.g. Ms. Adams"
															/>
														</label>
														<label className="form-control">
															<span className="label-text">Unavailability (comma separated intervals when CANNOT train)</span>
															<Input
																value={teacher.availability}
																onChange={(event) => onUpdateTeacher(teacher.id, 'availability', event.target.value)}
																placeholder="08:00-12:00,13:00-16:00 (leave empty if available anytime)"
															/>
															<span className="label-text-alt text-base-content/50">
																Leave empty if available anytime. Format: HH:mm-HH:mm,HH:mm-HH:mm
															</span>
														</label>
														<div className="grid grid-cols-2 gap-3">
															<label className="form-control">
																<span className="label-text">Max lessons per day</span>
																<Input
																	type="number"
																	min={1}
																	value={teacher.maxLessonsPerDay}
																	onChange={(event) =>
																		onUpdateTeacher(teacher.id, 'maxLessonsPerDay', Number(event.target.value))
																	}
																/>
															</label>
															<label className="form-control">
																<span className="label-text">Room</span>
																<Input
																	value={teacher.room}
																	onChange={(event) => onUpdateTeacher(teacher.id, 'room', event.target.value)}
																	placeholder="Room A"
																/>
															</label>
														</div>
														<label className="form-control">
															<span className="label-text">Unavailable dates (optional, YYYY-MM-DD)</span>
															<Input
																value={teacher.unavailableDates}
																onChange={(event) =>
																	onUpdateTeacher(teacher.id, 'unavailableDates', event.target.value)
																}
																placeholder="2025-03-04,2025-03-05"
															/>
														</label>
													</div>
												)}
											</div>
										)
									})}
								</div>
							</div>
						)}

						{currentStep === 'couples' && (
							<div className="space-y-4">
								<div className="space-y-1">
									<h3 className="text-lg font-semibold text-base-content">Couples</h3>
									<p className="text-sm text-base-content/60">
										Couples from database with calculated unavailability (union of both partners' unavailability).
									</p>
								</div>
								
								{dbCouples.length > 0 ? (
									<>
										<div className="flex items-center justify-between">
											<span className="text-sm text-base-content/60">{dbCouples.length} couple(s) from database</span>
										</div>
										<div className="space-y-2 max-h-[400px] overflow-y-auto">
											{dbCouples.map((pair) => {
												const studentA = pair.studentAId
												const studentB = pair.studentBId
												const coupleName = `${studentA.firstName} ${studentA.lastName} & ${studentB.firstName} ${studentB.lastName}`
												const unavailabilityStr = convertUnavailabilityToString(pair.unavailability)
												const config = coupleConfigs[pair._id] || {
													coupleId: pair._id,
													desiredLessons: 2,
													priority: 5,
													teacherLessons: {},
												}
												const isExpanded = expandedCouples.has(pair._id)
												
												return (
													<div key={pair._id} className="border border-base-300 rounded-xl bg-base-200/60 overflow-hidden">
														<button
															type="button"
															onClick={() => {
																const newExpanded = new Set(expandedCouples)
																if (isExpanded) {
																	newExpanded.delete(pair._id)
																} else {
																	newExpanded.add(pair._id)
																}
																setExpandedCouples(newExpanded)
															}}
															className="w-full flex items-center justify-between p-4 hover:bg-base-300/50 transition"
														>
															<div className="flex items-center gap-3">
																<span className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`}>▶</span>
																<div className="text-left">
																	<div className="font-medium text-base-content">{coupleName}</div>
																	<div className="text-xs text-base-content/60">
																		Desired: {config.desiredLessons} lessons · Priority: {config.priority}
																	</div>
																</div>
																{pair.baseGroup && (
																	<span className="badge badge-outline badge-sm">{pair.baseGroup}</span>
																)}
															</div>
															<div className="flex items-center gap-2">
																{!pair.unavailability && (
																	<span className="badge badge-sm badge-ghost">Available anytime</span>
																)}
																{pair.unavailability && (
																	<span className="text-xs text-base-content/60">Unavailable: {unavailabilityStr}</span>
																)}
															</div>
														</button>
														{isExpanded && (
															<div className="p-4 pt-0 space-y-3 border-t border-base-300">
																<div className="space-y-2 text-sm">
																	<div>
																		<span className="text-base-content/60">Partner A: </span>
																		<span className="text-base-content">{studentA.firstName} {studentA.lastName}</span>
																		{studentA.unavailability ? (
																			<span className="text-base-content/50 ml-2">(has unavailability set)</span>
																		) : (
																			<span className="text-base-content/50 ml-2">(available anytime)</span>
																		)}
																	</div>
																	<div>
																		<span className="text-base-content/60">Partner B: </span>
																		<span className="text-base-content">{studentB.firstName} {studentB.lastName}</span>
																		{studentB.unavailability ? (
																			<span className="text-base-content/50 ml-2">(has unavailability set)</span>
																		) : (
																			<span className="text-base-content/50 ml-2">(available anytime)</span>
																		)}
																	</div>
																	{pair.unavailability && (
																		<div className="pt-2 border-t border-base-300">
																			<span className="text-base-content/60 font-medium">Calculated Couple Unavailability: </span>
																			<span className="text-base-content font-mono text-xs">{unavailabilityStr}</span>
																		</div>
																	)}
																	{!pair.unavailability && (
																		<div className="pt-2 border-t border-base-300">
																			<span className="text-base-content/60 font-medium">Couple Status: </span>
																			<span className="text-base-content">Available anytime</span>
																		</div>
																	)}
																</div>
																
																{/* Configuration inputs */}
																<div className="pt-3 border-t border-base-300 space-y-3">
																	<div className="grid grid-cols-2 gap-3">
																		<label className="form-control">
																			<span className="label-text text-xs">Desired Lessons</span>
																			<Input
																				type="number"
																				min="0"
																				value={config.desiredLessons}
																				onChange={(e) => {
																					const newDesiredLessons = Number(e.target.value) || 0
																					let newTeacherLessons = { ...config.teacherLessons }
																					
																					// If desiredLessons is set to 0, clear all teacherLessons
																					if (newDesiredLessons === 0) {
																						newTeacherLessons = {}
																					} else {
																						// If desiredLessons is less than sum of teacherLessons, adjust teacherLessons
																						const currentSum = Object.values(newTeacherLessons).reduce((sum, count) => sum + count, 0)
																						if (newDesiredLessons < currentSum) {
																							// Reduce teacherLessons proportionally or clear if needed
																							if (newDesiredLessons === 0) {
																								newTeacherLessons = {}
																							}
																						}
																					}
																					
																					const newConfig = { ...config, desiredLessons: newDesiredLessons, teacherLessons: newTeacherLessons }
																					setCoupleConfigs((prev) => ({ ...prev, [pair._id]: newConfig }))
																				}}
																				className="input-sm"
																			/>
																		</label>
																		<label className="form-control">
																			<span className="label-text text-xs">Priority (1-10)</span>
																			<Input
																				type="number"
																				min="1"
																				max="10"
																				value={config.priority}
																				onChange={(e) => {
																					const newConfig = { ...config, priority: Math.min(10, Math.max(1, Number(e.target.value) || 5)) }
																					setCoupleConfigs((prev) => ({ ...prev, [pair._id]: newConfig }))
																				}}
																				className="input-sm"
																			/>
																		</label>
																	</div>
																	
																	<div className="space-y-2">
																		<span className="label-text text-xs">Teacher Lessons</span>
																		{teachers.map((teacher) => {
																			const currentCount = config.teacherLessons[teacher.name] || 0
																			return (
																				<div key={teacher.id} className="flex items-center gap-2">
																					<label className="flex items-center gap-2 flex-1">
																						<input
																							type="checkbox"
																							className="checkbox checkbox-sm checkbox-primary"
																							checked={currentCount > 0}
																							onChange={(e) => {
																								const newTeacherLessons = { ...config.teacherLessons }
																								if (e.target.checked) {
																									newTeacherLessons[teacher.name] = 1
																								} else {
																									delete newTeacherLessons[teacher.name]
																								}
																								
																								// Calculate sum of teacherLessons and update desiredLessons
																								const teacherLessonsSum = Object.values(newTeacherLessons).reduce((sum, count) => sum + count, 0)
																								const newDesiredLessons = teacherLessonsSum > 0 ? Math.max(config.desiredLessons, teacherLessonsSum) : config.desiredLessons
																								
																								const newConfig = { ...config, teacherLessons: newTeacherLessons, desiredLessons: newDesiredLessons }
																								setCoupleConfigs((prev) => ({ ...prev, [pair._id]: newConfig }))
																							}}
																						/>
																						<span className="text-xs text-base-content/80 flex-1">{teacher.name}</span>
																					</label>
																					{currentCount > 0 && (
																						<Input
																							type="number"
																							min="1"
																							max="10"
																							value={currentCount}
																							onChange={(e) => {
																								const count = Math.max(1, Math.min(10, Number(e.target.value) || 1))
																								const newTeacherLessons = { ...config.teacherLessons, [teacher.name]: count }
																								
																								// Calculate sum of teacherLessons and update desiredLessons
																								const teacherLessonsSum = Object.values(newTeacherLessons).reduce((sum, count) => sum + count, 0)
																								const newDesiredLessons = Math.max(config.desiredLessons, teacherLessonsSum)
																								
																								const newConfig = { ...config, teacherLessons: newTeacherLessons, desiredLessons: newDesiredLessons }
																								setCoupleConfigs((prev) => ({ ...prev, [pair._id]: newConfig }))
																							}}
																							className="input-sm w-16"
																						/>
																					)}
																				</div>
																			)
																		})}
																		{teachers.length === 0 && (
																			<p className="text-xs text-base-content/50">No teachers available</p>
																		)}
																	</div>
																</div>
															</div>
														)}
													</div>
												)
											})}
										</div>
										<div className="alert alert-info">
											<p className="text-sm text-base-content/80">
												Unavailability is automatically calculated as the union of both partners' individual unavailability. 
												If no unavailability is set for a student, they are considered available anytime. 
												To modify unavailability, update each student's unavailability in their profile.
											</p>
										</div>
									</>
								) : (
									<div className="alert alert-warning">
										<p className="text-sm text-base-content/80">
											No couples found in database. Please create couples in the Couples management page first.
										</p>
									</div>
								)}
							</div>
						)}

						{currentStep === 'breaks' && (
							<div className="space-y-4">
								<div className="space-y-1">
									<h3 className="text-lg font-semibold text-base-content">Breaks & Settings</h3>
									<p className="text-sm text-base-content/60">Configure breaks, daily hours, and lesson settings.</p>
								</div>
								<div className="grid grid-cols-2 gap-4">
									<label className="form-control">
										<span className="label-text">Day Start</span>
										<Input
											type="time"
											value={localDayStart}
											onChange={(event) => setLocalDayStart(event.target.value)}
										/>
									</label>
									<label className="form-control">
										<span className="label-text">Day End</span>
										<Input
											type="time"
											value={localDayEnd}
											onChange={(event) => setLocalDayEnd(event.target.value)}
										/>
									</label>
								</div>
								<label className="form-control">
									<label className="label cursor-pointer">
										<span className="label-text">Include weekends (Saturday & Sunday)</span>
										<input
											type="checkbox"
											className="checkbox checkbox-primary"
											checked={localIncludeWeekends}
											onChange={(e) => setLocalIncludeWeekends(e.target.checked)}
										/>
									</label>
								</label>
								<label className="form-control">
									<span className="label-text">Default breaks (comma separated)</span>
									<textarea
										className="textarea textarea-bordered"
										rows={2}
										value={localBreaks}
										onChange={(event) => setLocalBreaks(event.target.value)}
										placeholder="12:00-12:30,15:00-15:15"
									></textarea>
								</label>
								<div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
									<label className="form-control">
										<span className="label-text">Lesson duration (minutes)</span>
										<Input
											type="number"
											min={5}
											step={5}
											value={localLessonDuration}
											onChange={(event) => setLocalLessonDuration(Number(event.target.value))}
										/>
									</label>
									<label className="form-control">
										<span className="label-text">Student break after # lessons</span>
										<Input
											type="number"
											min={1}
											value={localStudentBreakAfter}
											onChange={(event) => setLocalStudentBreakAfter(Number(event.target.value))}
										/>
									</label>
									<label className="form-control">
										<span className="label-text">Teacher break after # lessons</span>
										<Input
											type="number"
											min={1}
											value={localTeacherBreakAfter}
											onChange={(event) => setLocalTeacherBreakAfter(Number(event.target.value))}
										/>
									</label>
								</div>
							</div>
						)}

						{currentStep === 'review' && (
							<div className="space-y-4">
								<div className="space-y-1">
									<h3 className="text-lg font-semibold text-base-content">Review Configuration</h3>
									<p className="text-sm text-base-content/60">Please review all settings before generating.</p>
								</div>
								<div className="space-y-4">
									<div className="rounded-xl border border-base-300 bg-base-100 p-4">
										<h4 className="font-semibold mb-2">Teachers ({teachers.length})</h4>
										<div className="space-y-2 text-sm">
											{teachers.map((teacher) => (
												<div key={teacher.id} className="flex justify-between">
													<span>{teacher.name}</span>
													<span className="text-base-content/60">{teacher.availability}</span>
												</div>
											))}
										</div>
									</div>
									<div className="rounded-xl border border-base-300 bg-base-100 p-4">
										<h4 className="font-semibold mb-2">Couples ({dbCouples.length})</h4>
										<div className="space-y-3 text-sm">
											{dbCouples.map((pair) => {
												const studentA = pair.studentAId
												const studentB = pair.studentBId
												const coupleName = `${studentA.firstName} ${studentA.lastName} & ${studentB.firstName} ${studentB.lastName}`
												const unavailabilityStr = convertUnavailabilityToString(pair.unavailability)
												const config = coupleConfigs[pair._id] || {
													coupleId: pair._id,
													desiredLessons: 2,
													priority: 5,
													teacherLessons: {},
												}
												const teacherLessonsStr = Object.entries(config.teacherLessons)
													.map(([name, count]) => `${name}:${count}`)
													.join(', ') || 'None'
												
												return (
													<div key={pair._id} className="border-b border-base-300 pb-2 last:border-b-0">
														<div className="flex justify-between items-start">
															<div className="flex-1">
																<p className="font-medium text-base-content">{coupleName}</p>
																<p className="text-xs text-base-content/60 mt-1">
																	Unavailability: {unavailabilityStr}
																</p>
																<p className="text-xs text-base-content/60">
																	Desired: {config.desiredLessons} lessons · Priority: {config.priority} · Teachers: {teacherLessonsStr}
																</p>
															</div>
															{pair.baseGroup && (
																<span className="badge badge-outline badge-xs ml-2">{pair.baseGroup}</span>
															)}
														</div>
													</div>
												)
											})}
										</div>
									</div>
									<div className="rounded-xl border border-base-300 bg-base-100 p-4">
										<h4 className="font-semibold mb-2">Settings</h4>
										<div className="space-y-2 text-sm">
											<div className="flex justify-between">
												<span>Daily Hours:</span>
												<span className="text-base-content/60">{localDayStart} - {localDayEnd}</span>
											</div>
											<div className="flex justify-between">
												<span>Breaks:</span>
												<span className="text-base-content/60">{localBreaks || 'None'}</span>
											</div>
											<div className="flex justify-between">
												<span>Lesson Duration:</span>
												<span className="text-base-content/60">{localLessonDuration} minutes</span>
											</div>
											<div className="flex justify-between">
												<span>Student Break After:</span>
												<span className="text-base-content/60">{localStudentBreakAfter} lessons</span>
											</div>
											<div className="flex justify-between">
												<span>Teacher Break After:</span>
												<span className="text-base-content/60">{localTeacherBreakAfter} lessons</span>
											</div>
											<div className="flex justify-between">
												<span>Include Weekends:</span>
												<span className="text-base-content/60">{localIncludeWeekends ? 'Yes' : 'No'}</span>
											</div>
										</div>
									</div>
								</div>
							</div>
						)}
					</div>

					{/* Navigation */}
					<div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-base-300">
						<Button
							type="button"
							className="btn-secondary"
							onClick={handlePrev}
							disabled={!canGoPrev}
						>
							Back
						</Button>
						<div className="flex items-center gap-2">
							{currentStep === 'review' ? (
								<Button type="button" className="btn-primary" onClick={handleSave}>
									Save & Generate
								</Button>
							) : (
								<Button type="button" className="btn-primary" onClick={handleNext}>
									Next
								</Button>
							)}
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}

