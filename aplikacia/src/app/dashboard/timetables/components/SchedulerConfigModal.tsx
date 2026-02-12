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
	// Helper: convert time string to minutes
	const timeToMin = (t: string) => {
		const [h, m] = t.split(':').map(Number)
		return h * 60 + m
	}
	const minToTime = (min: number) => {
		const h = Math.floor(min / 60)
		const m = min % 60
		return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
	}

	// Helper: get unavailability windows for a day from any format
	const getUnavailWindows = (unavailability: any, day: string): Array<{ start: string; end: string }> => {
		if (!unavailability) return []
		if (unavailability[day] && Array.isArray(unavailability[day])) return unavailability[day]
		if (unavailability.days) {
			if (unavailability.days.get && typeof unavailability.days.get === 'function') return unavailability.days.get(day) || []
			if (unavailability.days[day] && Array.isArray(unavailability.days[day])) return unavailability.days[day]
		}
		return []
	}

	/** Compute available time slots within the timetable range for each day */
	const convertToAvailabilityInRange = (unavailability: any, rangeStart: string, rangeEnd: string): { text: string; status: 'full' | 'partial' | 'none' } => {
		if (!rangeStart || !rangeEnd) {
			const str = convertUnavailabilityToString(unavailability)
			return { text: str, status: str === 'Available anytime' ? 'full' : 'partial' }
		}

		const rStart = timeToMin(rangeStart)
		const rEnd = timeToMin(rangeEnd)
		if (rStart >= rEnd) return { text: `Available ${rangeStart}-${rangeEnd}`, status: 'full' }

		const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const
		let fullyAvailableDays = 0
		let blockedDays = 0
		const restrictedEntries: string[] = []

		for (const day of days) {
			const windows = getUnavailWindows(unavailability, day)

			// Get unavailability windows that overlap with our timetable range
			const unavailSlots = windows
				.filter(w => w.start && w.end)
				.map(w => ({ start: timeToMin(w.start), end: timeToMin(w.end) }))
				.filter(w => w.end > rStart && w.start < rEnd)
				.sort((a, b) => a.start - b.start)

			if (unavailSlots.length === 0) {
				fullyAvailableDays++
				continue
			}

			// Compute available gaps within range
			let cursor = rStart
			const available: { start: number; end: number }[] = []
			for (const u of unavailSlots) {
				const uStart = Math.max(u.start, rStart)
				const uEnd = Math.min(u.end, rEnd)
				if (cursor < uStart) {
					available.push({ start: cursor, end: uStart })
				}
				cursor = Math.max(cursor, uEnd)
			}
			if (cursor < rEnd) {
				available.push({ start: cursor, end: rEnd })
			}

			if (available.length === 0) {
				blockedDays++
				restrictedEntries.push(`${day.slice(0, 3)}: ✗`)
			} else {
				const slots = available.map(s => `${minToTime(s.start)}-${minToTime(s.end)}`).join(', ')
				restrictedEntries.push(`${day.slice(0, 3)}: ${slots}`)
			}
		}

		if (fullyAvailableDays === 7) {
			return { text: `Fully available ${rangeStart}-${rangeEnd}`, status: 'full' }
		}
		if (blockedDays === 7) {
			return { text: 'Not available in timetable hours', status: 'none' }
		}

		const status = blockedDays > 0 ? 'partial' : 'partial'
		return { text: restrictedEntries.join(' · '), status }
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
		<div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm">
			<div className="w-full sm:max-w-4xl rounded-t-3xl sm:rounded-2xl bg-base-200 shadow-2xl border border-base-300 max-h-[95vh] sm:max-h-[90vh] sm:mx-4 overflow-y-auto">
				{/* Mobile drag indicator */}
				<div className="flex justify-center pt-2 sm:hidden">
					<div className="w-12 h-1.5 bg-base-300 rounded-full" />
				</div>
				<div className="flex items-center justify-between border-b border-base-300 px-4 sm:px-6 py-3 sm:py-4 sticky top-0 bg-base-200 z-10">
					<h3 className="text-base sm:text-lg font-semibold text-base-content">Scheduler Configuration</h3>
					<button type="button" className="btn btn-ghost btn-sm btn-circle" onClick={handleClose}>
						✕
					</button>
				</div>

				<div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
					{/* Step Progress - mobile-friendly pills */}
					<div className="mb-4 sm:mb-6">
						<div className="flex gap-1.5 sm:gap-2 overflow-x-auto scrollbar-none pb-1" style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
							{stepsConfig.map((step, idx) => (
								<button
									key={step.id}
									type="button"
									onClick={() => {
										// Allow clicking on previous/current steps
										if (idx <= currentStepIndex) {
											setCurrentStep(step.id)
										}
									}}
									className={`flex-shrink-0 flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-full transition-all text-xs sm:text-sm font-medium
										${idx === currentStepIndex
											? 'bg-primary text-primary-content shadow-md'
											: idx < currentStepIndex
												? 'bg-primary/20 text-primary cursor-pointer hover:bg-primary/30'
												: 'bg-base-300/50 text-base-content/40'
										}
									`}
								>
									<span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-bold
										${idx === currentStepIndex ? 'bg-primary-content/20' : idx < currentStepIndex ? 'bg-primary/20' : 'bg-base-content/10'}
									">
										{idx < currentStepIndex ? '✓' : idx + 1}
									</span>
									<span className="hidden sm:inline">{step.title}</span>
									<span className="sm:hidden">{step.title.split(' ')[0]}</span>
								</button>
							))}
						</div>
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
									<h3 className="text-base sm:text-lg font-semibold text-base-content">Teachers</h3>
									<p className="text-xs sm:text-sm text-base-content/60">
										Teachers from your club. Their unavailability is set in their profile.
									</p>
								</div>
								
								{dbTeachers.length > 0 ? (
									<>
								<div className="flex items-center justify-between">
											<span className="text-xs sm:text-sm text-base-content/60">{dbTeachers.length} teacher(s) in club</span>
								</div>
								<div className="space-y-2 max-h-[50vh] overflow-y-auto">
											{dbTeachers.map((teacher) => {
												const teacherName = `${teacher.firstName} ${teacher.lastName}`
												const isExpanded = expandedTeachers.has(teacher._id)
												const availInRange = convertToAvailabilityInRange(teacher.unavailability, localDayStart, localDayEnd)
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
															className="w-full flex items-center justify-between p-3 sm:p-4 hover:bg-base-200 transition active:bg-base-200 min-h-[48px]"
													>
														<div className="flex items-center gap-2 sm:gap-3 min-w-0">
															<span className={`transition-transform text-sm ${isExpanded ? 'rotate-90' : ''}`}>▶</span>
																<span className="font-medium text-sm sm:text-base truncate">{teacherName}</span>
														</div>
														<div className="flex items-center gap-2 flex-shrink-0 ml-2">
																{availInRange.status === 'full' ? (
																	<span className="badge badge-sm badge-success whitespace-nowrap">Available</span>
																) : availInRange.status === 'none' ? (
																	<span className="badge badge-sm badge-error whitespace-nowrap">Blocked</span>
																) : (
																	<span className="badge badge-sm badge-warning whitespace-nowrap">Partial</span>
															)}
														</div>
													</button>
												{isExpanded && (
													<div className="p-3 sm:p-4 pt-0 space-y-3 border-t border-base-300">
																<div className="text-sm">
																	<p className="font-medium text-base-content/70 mb-1">
																		Available in timetable hours ({localDayStart}–{localDayEnd}):
																	</p>
																	{availInRange.status === 'full' ? (
																		<span className="text-success text-xs sm:text-sm">✓ Fully available</span>
																	) : availInRange.status === 'none' ? (
																		<span className="text-error text-xs sm:text-sm">✗ Not available</span>
																	) : (
																		<div className="text-[11px] sm:text-xs text-warning font-mono bg-base-200 rounded px-2 py-1 break-all">
																			{availInRange.text}
																		</div>
																	)}
																	<p className="text-[11px] sm:text-xs text-base-content/50 mt-1">
																		Teacher must update their own profile to change this.
																	</p>
																</div>
														<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
															<label className="form-control">
																<span className="label-text text-xs sm:text-sm">Max lessons/day</span>
																<div className="flex items-center gap-1">
																	<button
																		type="button"
																		className="btn btn-sm btn-circle btn-ghost"
																		onClick={() => {
																			const val = Math.max(1, config.maxLessonsPerDay - 1)
																			setTeacherConfigs(prev => ({ ...prev, [teacher._id]: { ...config, maxLessonsPerDay: val } }))
																		}}
																	>−</button>
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
																		className="text-center"
																	/>
																	<button
																		type="button"
																		className="btn btn-sm btn-circle btn-ghost"
																		onClick={() => {
																			const val = config.maxLessonsPerDay + 1
																			setTeacherConfigs(prev => ({ ...prev, [teacher._id]: { ...config, maxLessonsPerDay: val } }))
																		}}
																	>+</button>
																</div>
															</label>
															<label className="form-control">
																<span className="label-text text-xs sm:text-sm">Room</span>
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
									<h3 className="text-base sm:text-lg font-semibold text-base-content">Couples</h3>
									<p className="text-xs sm:text-sm text-base-content/60">
										Couples with calculated unavailability (union of both partners).
									</p>
								</div>
								
								{dbCouples.length > 0 ? (
									<>
										<div className="flex items-center justify-between">
											<span className="text-xs sm:text-sm text-base-content/60">{dbCouples.length} couple(s)</span>
											<button
												type="button"
												onClick={() => {
													onClose()
													setTimeout(() => window.location.reload(), 100)
												}}
												className="btn btn-xs btn-ghost gap-1 text-primary min-h-[36px]"
												title="Refresh couple unavailability from student data"
											>
												<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>
												Refresh
											</button>
										</div>
										<div className="space-y-2 max-h-[50vh] overflow-y-auto">
											{dbCouples.map((pair) => {
												const studentA = pair.studentAId
												const studentB = pair.studentBId
												const coupleNameShort = `${studentA.firstName} & ${studentB.firstName}`
												const coupleNameFull = `${studentA.firstName} ${studentA.lastName} & ${studentB.firstName} ${studentB.lastName}`
												const studentAAvail = convertToAvailabilityInRange(studentA?.unavailability, localDayStart, localDayEnd)
												const studentBAvail = convertToAvailabilityInRange(studentB?.unavailability, localDayStart, localDayEnd)
												const pairAvail = convertToAvailabilityInRange(pair.unavailability, localDayStart, localDayEnd)
												const studentAUnavailStr = convertUnavailabilityToString(studentA?.unavailability)
												const studentBUnavailStr = convertUnavailabilityToString(studentB?.unavailability)
												const hasStudentUnavailability = studentAUnavailStr !== 'Available anytime' || studentBUnavailStr !== 'Available anytime'
												const pairUnavailStr = convertUnavailabilityToString(pair.unavailability)
												const needsRefresh = pairUnavailStr === 'Available anytime' && hasStudentUnavailability
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
															className="w-full flex items-center justify-between p-3 sm:p-4 hover:bg-base-300/50 active:bg-base-300/50 transition min-h-[56px]"
														>
															<div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
																<span className={`transition-transform text-sm flex-shrink-0 ${isExpanded ? 'rotate-90' : ''}`}>▶</span>
																<div className="text-left min-w-0">
																	<div className="font-medium text-sm sm:text-base text-base-content truncate sm:hidden">{coupleNameShort}</div>
																	<div className="font-medium text-sm sm:text-base text-base-content truncate hidden sm:block">{coupleNameFull}</div>
																	<div className="text-[11px] sm:text-xs text-base-content/60">
																		{config.desiredLessons} lessons · P{config.priority}
																	</div>
																</div>
															</div>
															<div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
																{pair.baseGroup && (
																	<span className="badge badge-outline badge-xs">{pair.baseGroup}</span>
																)}
																{needsRefresh ? (
																	<span className="badge badge-xs sm:badge-sm badge-warning whitespace-nowrap">Refresh</span>
																) : pairAvail.status === 'full' ? (
																	<span className="badge badge-xs sm:badge-sm badge-success whitespace-nowrap">Available</span>
																) : pairAvail.status === 'none' ? (
																	<span className="badge badge-xs sm:badge-sm badge-error whitespace-nowrap">Blocked</span>
																) : (
																	<span className="badge badge-xs sm:badge-sm badge-warning whitespace-nowrap">Partial</span>
																)}
															</div>
														</button>
														{isExpanded && (
															<div className="p-3 sm:p-4 pt-0 space-y-3 border-t border-base-300">
																<div className="space-y-2 text-sm">
																	{/* Partners - compact on mobile */}
																	<div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
																		<div className="bg-base-300/30 rounded-lg p-2 sm:p-3">
																			<div className="flex items-center justify-between mb-1">
																				<span className="font-medium text-xs sm:text-sm text-base-content">{studentA.firstName} {studentA.lastName}</span>
																			</div>
																			{studentAAvail.status === 'full' ? (
																				<span className="text-success/70 text-[11px] sm:text-xs">✓ Fully available</span>
																			) : studentAAvail.status === 'none' ? (
																				<span className="text-error/70 text-[11px] sm:text-xs">✗ Not available in timetable hours</span>
																			) : (
																				<div className="text-[11px] sm:text-xs text-warning/70 font-mono bg-base-200 rounded px-2 py-1 break-all">
																					{studentAAvail.text}
																				</div>
																			)}
																		</div>
																		<div className="bg-base-300/30 rounded-lg p-2 sm:p-3">
																			<div className="flex items-center justify-between mb-1">
																				<span className="font-medium text-xs sm:text-sm text-base-content">{studentB.firstName} {studentB.lastName}</span>
																			</div>
																			{studentBAvail.status === 'full' ? (
																				<span className="text-success/70 text-[11px] sm:text-xs">✓ Fully available</span>
																			) : studentBAvail.status === 'none' ? (
																				<span className="text-error/70 text-[11px] sm:text-xs">✗ Not available in timetable hours</span>
																			) : (
																				<div className="text-[11px] sm:text-xs text-warning/70 font-mono bg-base-200 rounded px-2 py-1 break-all">
																					{studentBAvail.text}
																				</div>
																			)}
																		</div>
																	</div>
																	
																	{/* Combined availability in timetable range */}
																	<div className="pt-2 border-t border-base-300">
																		<span className="text-base-content/60 text-xs font-medium">
																			Combined ({localDayStart}–{localDayEnd}):
																		</span>
																		{needsRefresh ? (
																			<span className="text-warning/80 text-xs ml-1">⚠ Needs refresh</span>
																		) : pairAvail.status === 'full' ? (
																			<span className="text-success/70 text-xs ml-1">✓ Fully available</span>
																		) : pairAvail.status === 'none' ? (
																			<span className="text-error/70 text-xs ml-1">✗ Not available</span>
																		) : (
																			<div className="mt-1 text-[11px] sm:text-xs text-warning/80 font-mono bg-warning/10 rounded px-2 py-1 border border-warning/20 break-all">
																				{pairAvail.text}
																			</div>
																		)}
																	</div>
																</div>
																
																{/* Configuration inputs - with +/- steppers */}
																<div className="pt-3 border-t border-base-300 space-y-3">
																	<div className="grid grid-cols-2 gap-3">
																		<label className="form-control">
																			<span className="label-text text-xs">Desired Lessons</span>
																			<div className="flex items-center gap-1">
																				<button type="button" className="btn btn-xs btn-circle btn-ghost" onClick={() => {
																					const val = Math.max(0, config.desiredLessons - 1)
																					const newTeacherLessons = val === 0 ? {} : { ...config.teacherLessons }
																					setCoupleConfigs(prev => ({ ...prev, [pair._id]: { ...config, desiredLessons: val, teacherLessons: newTeacherLessons } }))
																				}}>−</button>
																				<Input
																					type="number"
																					min="0"
																					value={config.desiredLessons}
																					onChange={(e) => {
																						const newDesiredLessons = Number(e.target.value) || 0
																						let newTeacherLessons = { ...config.teacherLessons }
																						if (newDesiredLessons === 0) newTeacherLessons = {}
																						setCoupleConfigs((prev) => ({ ...prev, [pair._id]: { ...config, desiredLessons: newDesiredLessons, teacherLessons: newTeacherLessons } }))
																					}}
																					className="input-sm text-center"
																				/>
																				<button type="button" className="btn btn-xs btn-circle btn-ghost" onClick={() => {
																					setCoupleConfigs(prev => ({ ...prev, [pair._id]: { ...config, desiredLessons: config.desiredLessons + 1 } }))
																				}}>+</button>
																			</div>
																		</label>
																		<label className="form-control">
																			<span className="label-text text-xs">Priority (1-10)</span>
																			<div className="flex items-center gap-1">
																				<button type="button" className="btn btn-xs btn-circle btn-ghost" onClick={() => {
																					const val = Math.max(1, config.priority - 1)
																					setCoupleConfigs(prev => ({ ...prev, [pair._id]: { ...config, priority: val } }))
																				}}>−</button>
																				<Input
																					type="number"
																					min="1"
																					max="10"
																					value={config.priority}
																					onChange={(e) => {
																						const newConfig = { ...config, priority: Math.min(10, Math.max(1, Number(e.target.value) || 5)) }
																						setCoupleConfigs((prev) => ({ ...prev, [pair._id]: newConfig }))
																					}}
																					className="input-sm text-center"
																				/>
																				<button type="button" className="btn btn-xs btn-circle btn-ghost" onClick={() => {
																					const val = Math.min(10, config.priority + 1)
																					setCoupleConfigs(prev => ({ ...prev, [pair._id]: { ...config, priority: val } }))
																				}}>+</button>
																			</div>
																		</label>
																	</div>
																	
																	<div className="space-y-2">
																		<span className="label-text text-xs">Teacher Lessons</span>
																		{dbTeachers.map((teacher) => {
																			const teacherName = `${teacher.firstName} ${teacher.lastName}`
																			const currentCount = config.teacherLessons[teacherName] || 0
																			return (
																				<div key={teacher._id} className="flex items-center gap-2 min-h-[40px]">
																					<label className="flex items-center gap-2 flex-1 cursor-pointer min-h-[40px]">
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
																								const teacherLessonsSum = Object.values(newTeacherLessons).reduce((sum, count) => sum + count, 0)
																								const newDesiredLessons = teacherLessonsSum > 0 ? Math.max(config.desiredLessons, teacherLessonsSum) : config.desiredLessons
																								const newConfig = { ...config, teacherLessons: newTeacherLessons, desiredLessons: newDesiredLessons }
																								setCoupleConfigs((prev) => ({ ...prev, [pair._id]: newConfig }))
																							}}
																						/>
																						<span className="text-xs text-base-content/80 flex-1">{teacherName}</span>
																					</label>
																					{currentCount > 0 && (
																						<div className="flex items-center gap-0.5">
																							<button type="button" className="btn btn-xs btn-circle btn-ghost" onClick={() => {
																								const count = Math.max(1, currentCount - 1)
																								const newTeacherLessons = { ...config.teacherLessons, [teacherName]: count }
																								const teacherLessonsSum = Object.values(newTeacherLessons).reduce((sum, c) => sum + c, 0)
																								setCoupleConfigs(prev => ({ ...prev, [pair._id]: { ...config, teacherLessons: newTeacherLessons, desiredLessons: Math.max(config.desiredLessons, teacherLessonsSum) } }))
																							}}>−</button>
																							<span className="w-6 text-center text-sm font-medium">{currentCount}</span>
																							<button type="button" className="btn btn-xs btn-circle btn-ghost" onClick={() => {
																								const count = Math.min(10, currentCount + 1)
																								const newTeacherLessons = { ...config.teacherLessons, [teacherName]: count }
																								const teacherLessonsSum = Object.values(newTeacherLessons).reduce((sum, c) => sum + c, 0)
																								setCoupleConfigs(prev => ({ ...prev, [pair._id]: { ...config, teacherLessons: newTeacherLessons, desiredLessons: Math.max(config.desiredLessons, teacherLessonsSum) } }))
																							}}>+</button>
																						</div>
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
										<div className="alert alert-info text-xs sm:text-sm">
											<p className="text-base-content/80">
												Unavailability is the union of both partners' schedules. 
												To change, update each student's profile.
											</p>
										</div>
									</>
								) : (
									<div className="alert alert-warning">
										<p className="text-xs sm:text-sm text-base-content/80">
											No couples found. Create couples in Couples management first.
										</p>
									</div>
								)}
							</div>
						)}

						{currentStep === 'breaks' && (
							<div className="space-y-4">
								<div className="space-y-1">
									<h3 className="text-base sm:text-lg font-semibold text-base-content">Breaks & Settings</h3>
									<p className="text-xs sm:text-sm text-base-content/60">Configure daily hours, lesson settings, and breaks.</p>
								</div>

								{/* Daily hours */}
								<div className="bg-base-100 rounded-xl p-3 sm:p-4 border border-base-300 space-y-3">
									<h4 className="text-sm font-medium text-base-content">Daily Hours</h4>
									<div className="grid grid-cols-2 gap-3">
										<label className="form-control">
											<span className="label-text text-xs sm:text-sm">Day Start</span>
											<Input
												type="time"
												value={localDayStart}
												onChange={(event) => setLocalDayStart(event.target.value)}
											/>
										</label>
										<label className="form-control">
											<span className="label-text text-xs sm:text-sm">Day End</span>
											<Input
												type="time"
												value={localDayEnd}
												onChange={(event) => setLocalDayEnd(event.target.value)}
											/>
										</label>
									</div>
								</div>

								{/* Toggle switches */}
								<div className="bg-base-100 rounded-xl border border-base-300 divide-y divide-base-300">
									<label className="flex items-center justify-between p-3 sm:p-4 cursor-pointer min-h-[48px]">
										<span className="label-text text-xs sm:text-sm pr-4">Include weekends</span>
										<input
											type="checkbox"
											className="toggle toggle-primary toggle-sm sm:toggle-md"
											checked={localIncludeWeekends}
											onChange={(e) => setLocalIncludeWeekends(e.target.checked)}
										/>
									</label>
									<label className="flex items-center justify-between p-3 sm:p-4 cursor-pointer min-h-[48px]">
										<div className="flex flex-col pr-4">
											<span className="label-text text-xs sm:text-sm">Distribute lessons evenly</span>
											<span className="text-[11px] sm:text-xs text-base-content/50">Spread across all days instead of filling first</span>
										</div>
										<input
											type="checkbox"
											className="toggle toggle-primary toggle-sm sm:toggle-md flex-shrink-0"
											checked={localDistributeLessons}
											onChange={(e) => setLocalDistributeLessons(e.target.checked)}
										/>
									</label>
								</div>

								{/* Lesson settings */}
								<div className="bg-base-100 rounded-xl p-3 sm:p-4 border border-base-300 space-y-3">
									<h4 className="text-sm font-medium text-base-content">Lesson Settings</h4>
									<div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
										<label className="form-control">
											<span className="label-text text-xs sm:text-sm">Duration (min)</span>
											<div className="flex items-center gap-1">
												<button type="button" className="btn btn-sm btn-circle btn-ghost" onClick={() => setLocalLessonDuration(prev => Math.max(5, prev - 5))}>−</button>
												<Input
													type="number"
													min={5}
													step={5}
													value={localLessonDuration}
													onChange={(event) => setLocalLessonDuration(Number(event.target.value))}
													className="text-center"
												/>
												<button type="button" className="btn btn-sm btn-circle btn-ghost" onClick={() => setLocalLessonDuration(prev => prev + 5)}>+</button>
											</div>
										</label>
										<label className="form-control">
											<span className="label-text text-xs sm:text-sm">Student break after</span>
											<div className="flex items-center gap-1">
												<button type="button" className="btn btn-sm btn-circle btn-ghost" onClick={() => setLocalStudentBreakAfter(prev => Math.max(1, prev - 1))}>−</button>
												<Input
													type="number"
													min={1}
													value={localStudentBreakAfter}
													onChange={(event) => setLocalStudentBreakAfter(Number(event.target.value))}
													className="text-center"
												/>
												<button type="button" className="btn btn-sm btn-circle btn-ghost" onClick={() => setLocalStudentBreakAfter(prev => prev + 1)}>+</button>
											</div>
											<span className="text-[10px] text-base-content/40 mt-0.5">lessons</span>
										</label>
										<label className="form-control">
											<span className="label-text text-xs sm:text-sm">Teacher break after</span>
											<div className="flex items-center gap-1">
												<button type="button" className="btn btn-sm btn-circle btn-ghost" onClick={() => setLocalTeacherBreakAfter(prev => Math.max(1, prev - 1))}>−</button>
												<Input
													type="number"
													min={1}
													value={localTeacherBreakAfter}
													onChange={(event) => setLocalTeacherBreakAfter(Number(event.target.value))}
													className="text-center"
												/>
												<button type="button" className="btn btn-sm btn-circle btn-ghost" onClick={() => setLocalTeacherBreakAfter(prev => prev + 1)}>+</button>
											</div>
											<span className="text-[10px] text-base-content/40 mt-0.5">lessons</span>
										</label>
									</div>
								</div>

								{/* Breaks */}
								<div className="bg-base-100 rounded-xl p-3 sm:p-4 border border-base-300 space-y-2">
									<h4 className="text-sm font-medium text-base-content">Break Times</h4>
									<label className="form-control">
										<span className="label-text text-[11px] sm:text-xs text-base-content/60">Comma separated time ranges</span>
										<textarea
											className="textarea textarea-bordered text-sm"
											rows={2}
											value={localBreaks}
											onChange={(event) => setLocalBreaks(event.target.value)}
											placeholder="12:00-12:30, 15:00-15:15"
										></textarea>
									</label>
								</div>
							</div>
						)}

						{currentStep === 'review' && (
							<div className="space-y-3 sm:space-y-4">
								<div className="space-y-1">
									<h3 className="text-base sm:text-lg font-semibold text-base-content">Review</h3>
									<p className="text-xs sm:text-sm text-base-content/60">Review settings before generating.</p>
								</div>
								<div className="space-y-3">
									<div className="rounded-xl border border-base-300 bg-base-100 p-3 sm:p-4">
										<h4 className="font-semibold text-sm mb-2">Teachers ({dbTeachers.length})</h4>
										<div className="space-y-2 text-xs sm:text-sm">
											{dbTeachers.map((teacher) => {
												const teacherName = `${teacher.firstName} ${teacher.lastName}`
												const teacherAvail = convertToAvailabilityInRange(teacher.unavailability, localDayStart, localDayEnd)
												const config = teacherConfigs[teacher._id] || { maxLessonsPerDay: 4, room: '' }
												return (
													<div key={teacher._id} className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-0.5">
														<div className="min-w-0">
															<span className="font-medium">{teacherName}</span>
															<span className="text-base-content/50 ml-1 sm:ml-2 text-xs">
																Max: {config.maxLessonsPerDay}/day · {config.room || 'No room'}
															</span>
														</div>
														<span className={`text-xs flex-shrink-0 ${teacherAvail.status === 'full' ? 'text-success' : teacherAvail.status === 'none' ? 'text-error' : 'text-warning'}`}>
															{teacherAvail.status === 'full' ? '✓ Available' : teacherAvail.status === 'none' ? '✗ Blocked' : '⚠ Partial'}
														</span>
													</div>
												)
											})}
										</div>
									</div>
									<div className="rounded-xl border border-base-300 bg-base-100 p-3 sm:p-4">
										<h4 className="font-semibold text-sm mb-2">Couples ({dbCouples.length})</h4>
										<div className="space-y-2 text-xs sm:text-sm">
											{dbCouples.map((pair) => {
												const studentA = pair.studentAId
												const studentB = pair.studentBId
												const config = coupleConfigs[pair._id] || {
													coupleId: pair._id,
													desiredLessons: 2,
													priority: 5,
													teacherLessons: {},
												}
												const teacherLessonsStr = Object.entries(config.teacherLessons)
													.map(([name, count]) => `${name.split(' ')[0]}:${count}`)
													.join(', ') || 'None'
												
												return (
													<div key={pair._id} className="border-b border-base-300 pb-2 last:border-b-0">
														<p className="font-medium text-base-content text-xs sm:text-sm">{studentA.firstName} & {studentB.firstName}</p>
														<p className="text-[11px] sm:text-xs text-base-content/60">
															{config.desiredLessons} lessons · P{config.priority} · {teacherLessonsStr}
														</p>
													</div>
												)
											})}
										</div>
									</div>
									<div className="rounded-xl border border-base-300 bg-base-100 p-3 sm:p-4">
										<h4 className="font-semibold text-sm mb-2">Settings</h4>
										<div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs sm:text-sm">
											<span className="text-base-content/60">Hours</span>
											<span className="text-right font-medium">{localDayStart} – {localDayEnd}</span>
											<span className="text-base-content/60">Lesson</span>
											<span className="text-right font-medium">{localLessonDuration} min</span>
											<span className="text-base-content/60">Weekends</span>
											<span className="text-right font-medium">{localIncludeWeekends ? 'Yes' : 'No'}</span>
											<span className="text-base-content/60">Distribute</span>
											<span className="text-right font-medium">{localDistributeLessons ? 'Yes' : 'No'}</span>
											<span className="text-base-content/60">Student break</span>
											<span className="text-right font-medium">After {localStudentBreakAfter}</span>
											<span className="text-base-content/60">Teacher break</span>
											<span className="text-right font-medium">After {localTeacherBreakAfter}</span>
											{localBreaks && (
												<>
													<span className="text-base-content/60">Breaks</span>
													<span className="text-right font-medium text-xs break-all">{localBreaks}</span>
												</>
											)}
										</div>
									</div>
								</div>
							</div>
						)}
					</div>

					{/* Navigation - sticky on mobile */}
					<div className="flex items-center justify-between gap-3 pt-3 sm:pt-4 border-t border-base-300 sticky bottom-0 bg-base-200 pb-2 -mx-4 sm:-mx-6 px-4 sm:px-6">
						<Button
							type="button"
							className="btn-ghost btn-sm sm:btn-md"
							onClick={handlePrev}
							disabled={!canGoPrev}
						>
							← Back
						</Button>
						{currentStep === 'review' ? (
							<Button type="button" className="btn-primary btn-sm sm:btn-md" onClick={handleSave}>
								Save & Generate
							</Button>
						) : (
							<Button type="button" className="btn-primary btn-sm sm:btn-md" onClick={handleNext}>
								Next →
							</Button>
						)}
					</div>
				</div>
			</div>
		</div>
	)
}

