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

interface DbTeacher {
	_id: string
	firstName: string
	lastName: string
	email: string
	unavailability?: any
}

interface TeacherConfig {
	teacherId: string
	maxLessonsPerDay: number
	room: string
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
	dbTeachers?: DbTeacher[]
	breaks: string
	lessonDuration: number
	studentBreakAfter: number
	teacherBreakAfter: number
	dayStart?: string
	dayEnd?: string
	includeWeekends?: boolean
	distributeLessons?: boolean
	onSave: (config: {
		teachers: TeacherForm[]
		couples: CoupleForm[]
		coupleConfigs: CoupleConfig[]
		teacherConfigs: TeacherConfig[]
		breaks: string
		lessonDuration: number
		studentBreakAfter: number
		teacherBreakAfter: number
		dayStart: string
		dayEnd: string
		includeWeekends: boolean
		distributeLessons: boolean
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
	dbTeachers = [],
	breaks,
	lessonDuration,
	studentBreakAfter,
	teacherBreakAfter,
	dayStart = '15:00',
	dayEnd = '20:00',
	includeWeekends = true,
	distributeLessons = true,
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
		
		// Helper to get windows from either format (direct day props or nested days Map)
		const getWindowsForDay = (day: string): Array<{ start: string; end: string }> => {
			// Try direct day property first (new format)
			if (unavailability[day] && Array.isArray(unavailability[day])) {
				return unavailability[day]
			}
			// Try nested days Map format (old format from Pair model)
			if (unavailability.days) {
				// Handle Map-like object
				if (unavailability.days.get && typeof unavailability.days.get === 'function') {
					return unavailability.days.get(day) || []
				}
				// Handle plain object
				if (unavailability.days[day] && Array.isArray(unavailability.days[day])) {
					return unavailability.days[day]
				}
			}
			return []
		}
		
		const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const
		const result: string[] = []
		
		for (const day of days) {
			const windows = getWindowsForDay(day)
			for (const window of windows) {
				if (window.start && window.end) {
					result.push(`${day.slice(0, 3)}: ${window.start}-${window.end}`)
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
	const [localDistributeLessons, setLocalDistributeLessons] = useState(distributeLessons)
	const [coupleConfigs, setCoupleConfigs] = useState<Record<string, CoupleConfig>>({})
	const [teacherConfigs, setTeacherConfigs] = useState<Record<string, TeacherConfig>>({})
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
					// Use default config for new couples - prefer couple's preferred teacher, else first db teacher
					const teacherName = pair.preferredTeacherId 
						? `${pair.preferredTeacherId.firstName} ${pair.preferredTeacherId.lastName}`
						: dbTeachers.length > 0 ? `${dbTeachers[0].firstName} ${dbTeachers[0].lastName}` : ''
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
	}, [isOpen, dbCouples.length, dbTeachers.length])

	// Initialize teacher configs when modal opens or dbTeachers change
	useEffect(() => {
		if (isOpen && dbTeachers.length > 0) {
			// Try to load saved teacher configs from localStorage
			const savedConfigsStr = typeof window !== 'undefined' ? window.localStorage.getItem('teacherConfigs') : null
			let savedConfigsMap: Record<string, TeacherConfig> = {}
			
			if (savedConfigsStr) {
				try {
					const savedConfigsArray = JSON.parse(savedConfigsStr) as TeacherConfig[]
					savedConfigsArray.forEach((config) => {
						if (config.teacherId) {
							savedConfigsMap[config.teacherId] = config
						}
					})
				} catch (e) {
					console.error('Failed to parse saved teacher configs:', e)
				}
			}

			// Start with saved configs, then add defaults for any teachers that don't have saved configs
			const initialConfigs: Record<string, TeacherConfig> = {}
			dbTeachers.forEach((teacher, index) => {
				if (savedConfigsMap[teacher._id]) {
					initialConfigs[teacher._id] = savedConfigsMap[teacher._id]
				} else {
					initialConfigs[teacher._id] = {
						teacherId: teacher._id,
						maxLessonsPerDay: 4,
						room: `Room ${String.fromCharCode(65 + index)}`, // Room A, B, C, etc.
					}
				}
			})
			setTeacherConfigs(initialConfigs)
		}
	}, [isOpen, dbTeachers.length])

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
				if (dbTeachers.length === 0) {
					setError('No teachers found in your club. Please add trainers to your club first.')
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
		
		// Save teacher configs to localStorage
		const teacherConfigsArray = Object.values(teacherConfigs)
		if (typeof window !== 'undefined') {
			window.localStorage.setItem('teacherConfigs', JSON.stringify(teacherConfigsArray))
		}
		
		onSave({
			teachers,
			couples,
			coupleConfigs: Object.values(coupleConfigs),
			teacherConfigs: teacherConfigsArray,
			breaks: localBreaks,
			lessonDuration: localLessonDuration,
			studentBreakAfter: localStudentBreakAfter,
			teacherBreakAfter: localTeacherBreakAfter,
			dayStart: localDayStart,
			dayEnd: localDayEnd,
			includeWeekends: localIncludeWeekends,
			distributeLessons: localDistributeLessons,
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
									<p className="text-sm text-base-content/60">
										Teachers from your club. Their unavailability is set in their profile.
									</p>
								</div>
								
								{dbTeachers.length > 0 ? (
									<>
								<div className="flex items-center justify-between">
											<span className="text-sm text-base-content/60">{dbTeachers.length} teacher(s) in club</span>
								</div>
								<div className="space-y-2 max-h-[400px] overflow-y-auto">
											{dbTeachers.map((teacher) => {
												const teacherName = `${teacher.firstName} ${teacher.lastName}`
												const isExpanded = expandedTeachers.has(teacher._id)
												const unavailabilityStr = convertUnavailabilityToString(teacher.unavailability)
												const config = teacherConfigs[teacher._id] || {
													teacherId: teacher._id,
													maxLessonsPerDay: 4,
													room: '',
												}
												
										return (
													<div key={teacher._id} className="border border-base-300 rounded-xl bg-base-100 overflow-hidden">
													<button
														type="button"
														onClick={() => {
															const newExpanded = new Set(expandedTeachers)
															if (isExpanded) {
																	newExpanded.delete(teacher._id)
															} else {
																	newExpanded.add(teacher._id)
															}
															setExpandedTeachers(newExpanded)
														}}
															className="w-full flex items-center justify-between p-4 hover:bg-base-200 transition"
													>
														<div className="flex items-center gap-3">
															<span className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`}>▶</span>
																<span className="font-medium">{teacherName}</span>
																{unavailabilityStr === 'Available anytime' && (
																	<span className="badge badge-sm badge-success">Available anytime</span>
															)}
														</div>
														<div className="flex items-center gap-2">
																{unavailabilityStr !== 'Available anytime' && (
																	<span className="text-xs text-warning">Has unavailability</span>
															)}
														</div>
													</button>
												{isExpanded && (
													<div className="p-4 pt-0 space-y-3 border-t border-base-300">
																<div className="text-sm">
																	<p className="font-medium text-base-content/70 mb-1">Unavailability (from profile):</p>
																	<p className={`text-sm ${unavailabilityStr === 'Available anytime' ? 'text-success' : 'text-warning'}`}>
																		{unavailabilityStr}
																	</p>
																	<p className="text-xs text-base-content/50 mt-1">
																		To change unavailability, the teacher must update their profile.
																	</p>
																</div>
														<div className="grid grid-cols-2 gap-3">
															<label className="form-control">
																<span className="label-text">Max lessons per day</span>
																<Input
																	type="number"
																	min={1}
																			value={config.maxLessonsPerDay}
																			onChange={(event) => {
																				setTeacherConfigs(prev => ({
																					...prev,
																					[teacher._id]: {
																						...config,
																						maxLessonsPerDay: Number(event.target.value) || 4,
																					}
																				}))
																			}}
																/>
															</label>
															<label className="form-control">
																<span className="label-text">Room</span>
																<Input
																			value={config.room}
																			onChange={(event) => {
																				setTeacherConfigs(prev => ({
																					...prev,
																					[teacher._id]: {
																						...config,
																						room: event.target.value,
																					}
																				}))
																			}}
																	placeholder="Room A"
																/>
															</label>
														</div>
													</div>
												)}
											</div>
										)
									})}
								</div>
									</>
								) : (
									<Alert variant="warning">
										No teachers found in your club. Please ensure trainers are registered and added to the club.
									</Alert>
								)}
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
											<button
												type="button"
												onClick={() => {
													// Close modal and reload page to trigger fresh fetch of couples
													onClose()
													setTimeout(() => window.location.reload(), 100)
												}}
												className="btn btn-xs btn-ghost gap-1 text-primary"
												title="Refresh couple unavailability from student data"
											>
												<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>
												Refresh
											</button>
										</div>
										<div className="space-y-2 max-h-[400px] overflow-y-auto">
											{dbCouples.map((pair) => {
												const studentA = pair.studentAId
												const studentB = pair.studentBId
												const coupleName = `${studentA.firstName} ${studentA.lastName} & ${studentB.firstName} ${studentB.lastName}`
												// Check both pair unavailability AND individual student unavailability
												const studentAUnavailStr = convertUnavailabilityToString(studentA?.unavailability)
												const studentBUnavailStr = convertUnavailabilityToString(studentB?.unavailability)
												const pairUnavailStr = convertUnavailabilityToString(pair.unavailability)
												// If pair doesn't have calculated unavailability but students do, show warning
												const hasStudentUnavailability = studentAUnavailStr !== 'Available anytime' || studentBUnavailStr !== 'Available anytime'
												const unavailabilityStr = pairUnavailStr !== 'Available anytime' ? pairUnavailStr : 
													hasStudentUnavailability ? '⚠ Needs refresh' : 'Available anytime'
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
																{unavailabilityStr === 'Available anytime' && (
																	<span className="badge badge-sm badge-ghost">Available anytime</span>
																)}
																{unavailabilityStr === '⚠ Needs refresh' && (
																	<span className="badge badge-sm badge-warning">⚠ Needs refresh</span>
																)}
																{unavailabilityStr !== 'Available anytime' && unavailabilityStr !== '⚠ Needs refresh' && (
																	<span className="text-xs text-base-content/60">Unavailable: {unavailabilityStr}</span>
																)}
															</div>
														</button>
														{isExpanded && (
															<div className="p-4 pt-0 space-y-3 border-t border-base-300">
																<div className="space-y-3 text-sm">
																	{/* Partner A */}
																	<div className="bg-base-300/30 rounded-lg p-3">
																		<div className="flex items-center justify-between mb-2">
																			<span className="font-medium text-base-content">{studentA.firstName} {studentA.lastName}</span>
																			<span className="badge badge-sm badge-ghost">Partner A</span>
																		</div>
																		{(() => {
																			const aStr = studentAUnavailStr
																			return aStr !== 'Available anytime' ? (
																				<div className="space-y-1">
																					<span className="text-error/70 text-xs font-medium">Cannot train:</span>
																					<div className="text-xs text-base-content/70 font-mono bg-base-200 rounded px-2 py-1">
																						{aStr}
																					</div>
																				</div>
																		) : (
																				<span className="text-success/70 text-xs">✓ Available anytime</span>
																			)
																		})()}
																	</div>
																	
																	{/* Partner B */}
																	<div className="bg-base-300/30 rounded-lg p-3">
																		<div className="flex items-center justify-between mb-2">
																			<span className="font-medium text-base-content">{studentB.firstName} {studentB.lastName}</span>
																			<span className="badge badge-sm badge-ghost">Partner B</span>
																		</div>
																		{(() => {
																			const bStr = studentBUnavailStr
																			return bStr !== 'Available anytime' ? (
																				<div className="space-y-1">
																					<span className="text-error/70 text-xs font-medium">Cannot train:</span>
																					<div className="text-xs text-base-content/70 font-mono bg-base-200 rounded px-2 py-1">
																						{bStr}
																					</div>
																				</div>
																		) : (
																				<span className="text-success/70 text-xs">✓ Available anytime</span>
																			)
																		})()}
																	</div>
																	
																	{/* Calculated Couple Unavailability */}
																		<div className="pt-2 border-t border-base-300">
																		<span className="text-base-content/60 font-medium">Combined Couple Unavailability: </span>
																		{pairUnavailStr !== 'Available anytime' ? (
																			<div className="mt-1 text-xs text-error/80 font-mono bg-error/10 rounded px-2 py-1 border border-error/20">
																				{pairUnavailStr}
																		</div>
																		) : hasStudentUnavailability ? (
																			<div className="mt-1 text-xs text-warning/80 font-mono bg-warning/10 rounded px-2 py-1 border border-warning/20">
																				⚠ Not calculated yet - click Refresh
																		</div>
																		) : (
																			<span className="text-success/70 text-sm">✓ Available anytime</span>
																	)}
																	</div>
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
																		{dbTeachers.map((teacher) => {
																			const teacherName = `${teacher.firstName} ${teacher.lastName}`
																			const currentCount = config.teacherLessons[teacherName] || 0
																			return (
																				<div key={teacher._id} className="flex items-center gap-2">
																					<label className="flex items-center gap-2 flex-1">
																						<input
																							type="checkbox"
																							className="checkbox checkbox-sm checkbox-primary"
																							checked={currentCount > 0}
																							onChange={(e) => {
																								const newTeacherLessons = { ...config.teacherLessons }
																								if (e.target.checked) {
																									newTeacherLessons[teacherName] = 1
																								} else {
																									delete newTeacherLessons[teacherName]
																								}
																								
																								// Calculate sum of teacherLessons and update desiredLessons
																								const teacherLessonsSum = Object.values(newTeacherLessons).reduce((sum, count) => sum + count, 0)
																								const newDesiredLessons = teacherLessonsSum > 0 ? Math.max(config.desiredLessons, teacherLessonsSum) : config.desiredLessons
																								
																								const newConfig = { ...config, teacherLessons: newTeacherLessons, desiredLessons: newDesiredLessons }
																								setCoupleConfigs((prev) => ({ ...prev, [pair._id]: newConfig }))
																							}}
																						/>
																						<span className="text-xs text-base-content/80 flex-1">{teacherName}</span>
																					</label>
																					{currentCount > 0 && (
																						<Input
																							type="number"
																							min="1"
																							max="10"
																							value={currentCount}
																							onChange={(e) => {
																								const count = Math.max(1, Math.min(10, Number(e.target.value) || 1))
																								const newTeacherLessons = { ...config.teacherLessons, [teacherName]: count }
																								
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
																		{dbTeachers.length === 0 && (
																			<p className="text-xs text-base-content/50">No teachers in club</p>
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
									<label className="label cursor-pointer">
										<div className="flex flex-col">
											<span className="label-text">Distribute lessons evenly across days</span>
											<span className="text-xs text-base-content/50">When enabled, lessons will be spread throughout the timetable period instead of being scheduled on the first available days</span>
										</div>
										<input
											type="checkbox"
											className="checkbox checkbox-primary"
											checked={localDistributeLessons}
											onChange={(e) => setLocalDistributeLessons(e.target.checked)}
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
										<h4 className="font-semibold mb-2">Teachers ({dbTeachers.length})</h4>
										<div className="space-y-2 text-sm">
											{dbTeachers.map((teacher) => {
												const teacherName = `${teacher.firstName} ${teacher.lastName}`
												const unavailStr = convertUnavailabilityToString(teacher.unavailability)
												const config = teacherConfigs[teacher._id] || { maxLessonsPerDay: 4, room: '' }
												return (
													<div key={teacher._id} className="flex justify-between items-start">
														<div>
															<span className="font-medium">{teacherName}</span>
															<span className="text-base-content/50 ml-2">
																(Max: {config.maxLessonsPerDay}/day, Room: {config.room || 'Not set'})
															</span>
												</div>
														<span className={`text-xs ${unavailStr === 'Available anytime' ? 'text-success' : 'text-warning'}`}>
															{unavailStr === 'Available anytime' ? '✓ Available anytime' : unavailStr}
														</span>
													</div>
												)
											})}
										</div>
									</div>
									<div className="rounded-xl border border-base-300 bg-base-100 p-4">
										<h4 className="font-semibold mb-2">Couples ({dbCouples.length})</h4>
										<div className="space-y-3 text-sm">
											{dbCouples.map((pair) => {
												const studentA = pair.studentAId
												const studentB = pair.studentBId
												const coupleName = `${studentA.firstName} ${studentA.lastName} & ${studentB.firstName} ${studentB.lastName}`
												// Check both pair unavailability AND individual student unavailability
												const studentAUnavailStrSummary = convertUnavailabilityToString(studentA?.unavailability)
												const studentBUnavailStrSummary = convertUnavailabilityToString(studentB?.unavailability)
												const pairUnavailStrSummary = convertUnavailabilityToString(pair.unavailability)
												const hasStudentUnavailabilitySummary = studentAUnavailStrSummary !== 'Available anytime' || studentBUnavailStrSummary !== 'Available anytime'
												const unavailabilityStrSummary = pairUnavailStrSummary !== 'Available anytime' ? pairUnavailStrSummary : 
													hasStudentUnavailabilitySummary ? '⚠ Needs refresh' : 'Available anytime'
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
																	Unavailability: {unavailabilityStrSummary}
																</p>
																<p className="text-xs text-base-content/60">
																	Desired: {config.desiredLessons} lessons · Priority: {config.priority} · Teachers: {teacherLessonsStr}
																</p>
															</div>
															{(pair.baseGroups && pair.baseGroups.length > 0) ? (
																<div className="flex flex-wrap gap-1 ml-2">
																	{pair.baseGroups.map(g => (
																		<span key={g} className="badge badge-outline badge-xs">{g}</span>
																	))}
																</div>
															) : pair.baseGroup ? (
																<span className="badge badge-outline badge-xs ml-2">{pair.baseGroup}</span>
															) : null}
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
											<div className="flex justify-between">
												<span>Distribute Lessons Evenly:</span>
												<span className="text-base-content/60">{localDistributeLessons ? 'Yes' : 'No'}</span>
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

