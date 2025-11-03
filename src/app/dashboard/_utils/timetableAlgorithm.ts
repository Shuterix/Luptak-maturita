import { addMinutes, parse, addDays, format, isWeekend, isValid } from "date-fns"

export interface Teacher {
	name: string
	availability: string[]
	maxLessonsPerDay: number
	room: string
	unavailableDates?: string[] // dates (yyyy-MM-dd) when the teacher cannot work
}

export interface Student {
	name: string
	availability: string[]
	desiredLessons: number
	priority: number // higher = more important
	teacherLessons?: Record<string, number> // teacher name -> number of lessons with that teacher
	unavailableDates?: string[] // dates (yyyy-MM-dd) when the student cannot attend
	preferredTimes?: string[] // preferred time slots (e.g., ["09:00-11:00", "14:00-16:00"])
	weeklyLessons?: number // number of lessons per week
}

export interface TimetableLesson {
	start: string
	end: string
	teacher: string | null
	student: string | null
	room: string | null
	type: "lesson" | "break" | "unused"
	duration: number
	breakType?: "consecutive" | "default" // Optional field to distinguish break types
	breakFor?: "teacher" | "student" // Indicates who the break is for
	breakForName?: string // Name of the teacher or student the break is for
}

export interface ValidationResult {
	isValid: boolean
	errors: string[]
	warnings: string[]
	suggestions: string[]
}

export interface AlternativeDateSuggestion {
	date: string
	reason: string
	expectedSatisfaction: number // percentage of students that would be satisfied
}

// LESSON_DURATION is now configurable via TimetableConfig
export const DEFAULT_BREAKS = []

export interface DaySchedule {
	start: string
	end: string
}

export const DEFAULT_DAY_SCHEDULE: DaySchedule = {
	start: "08:00",
	end: "18:00",
}

const DEFAULT_SETTINGS = {
	lessonDuration: 45,       // lesson duration in minutes
	studentBreakAfter: 4,     // max consecutive lessons before student must rest
	teacherBreakAfter: 4,     // max consecutive lessons before teacher must rest
	maxDaysToSuggest: 14,     // maximum days to look ahead for alternative dates
}

export interface TimetableConfig {
	lessonDuration: number
	studentBreakAfter: number
	teacherBreakAfter: number
}

const timeStringToDate = (dateStr: string, timeStr: string) => {
	// Validate and normalize time string format
	if (!timeStr || typeof timeStr !== 'string') {
		throw new Error(`Invalid time string: ${timeStr}`)
	}
	
	// Handle various time formats and normalize to HH:mm
	let normalizedTimeStr = timeStr.trim()
	
	// Handle cases like "1", "12", "12:" by adding missing parts
	if (/^\d{1,2}$/.test(normalizedTimeStr)) {
		// Single or double digit - assume it's hours
		const hours = parseInt(normalizedTimeStr)
		if (hours < 0 || hours > 23) {
			throw new Error(`Invalid time string: ${timeStr}`)
		}
		normalizedTimeStr = `${hours.toString().padStart(2, '0')}:00`
	} else if (/^\d{1,2}:$/.test(normalizedTimeStr)) {
		// Hours with colon but no minutes
		const hours = parseInt(normalizedTimeStr.slice(0, -1))
		if (hours < 0 || hours > 23) {
			throw new Error(`Invalid time string: ${timeStr}`)
		}
		normalizedTimeStr = `${hours.toString().padStart(2, '0')}:00`
	} else if (/^\d{1,2}:\d{1,2}$/.test(normalizedTimeStr)) {
		// HH:mm format - validate and pad
		const [hours, minutes] = normalizedTimeStr.split(':').map(Number)
		if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
			throw new Error(`Invalid time string: ${timeStr}`)
		}
		normalizedTimeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
	} else {
		throw new Error(`Invalid time string format: ${timeStr}`)
	}

	const parsed = parse(`${dateStr} ${normalizedTimeStr}`, "yyyy-MM-dd HH:mm", new Date())
	if (!isValid(parsed)) {
		throw new Error(`Invalid time string: ${timeStr}`)
	}

	const [parsedDatePart] = format(parsed, "yyyy-MM-dd'T'HH:mm:ss").split("T")
	if (parsedDatePart === dateStr) return parsed

	const [hours, minutes] = normalizedTimeStr.split(":").map(Number)
	const adjusted = new Date(parsed)
	adjusted.setHours(hours)
	adjusted.setMinutes(minutes)
	adjusted.setSeconds(0, 0)
	return adjusted
}

// Helper function to safely parse break times
const parseBreakTime = (breakStr: string, date: string): { start: Date; end: Date } | null => {
	if (!breakStr || typeof breakStr !== 'string') return null
	
	const breakParts = breakStr.split("-")
	if (breakParts.length !== 2) return null
	
	try {
		const [startTime, endTime] = breakParts
		const start = timeStringToDate(date, startTime.trim())
		const end = timeStringToDate(date, endTime.trim())
		return { start, end }
	} catch (err) {
		console.warn(`Invalid break format: ${breakStr}`, err)
		return null
	}
}

const formatLocalDateTime = (date: Date) => format(date, "yyyy-MM-dd'T'HH:mm:ss")

const normalizeLessonTimes = (lessons: TimetableLesson[]) =>
	lessons.map((lesson) => {
		const startDate = new Date(lesson.start)
		const endDate = new Date(lesson.end)
		return {
			...lesson,
			start: isNaN(startDate.getTime()) ? lesson.start : formatLocalDateTime(startDate),
			end: isNaN(endDate.getTime()) ? lesson.end : formatLocalDateTime(endDate),
		}
	})

const dedupeBreakEntries = (lessons: TimetableLesson[]) =>
	lessons.reduce<TimetableLesson[]>((acc, lesson) => {
		if (lesson.type !== "break") {
			acc.push(lesson)
			return acc
		}

		const existingIndex = acc.findIndex(
			(l) =>
				l.type === "break" &&
				l.start === lesson.start &&
				l.end === lesson.end
		)

		if (existingIndex === -1) {
			acc.push(lesson)
		} else if (!acc[existingIndex].student && lesson.student) {
			acc[existingIndex] = lesson
		}

		return acc
	}, [])

const toLocalISOString = (date: Date) => format(date, "yyyy-MM-dd'T'HH:mm:ss")

const isOverlapping = (startA: Date, endA: Date, startB: Date, endB: Date) =>
	startA < endB && startB < endA

const isStudentAvailableOnDate = (student: Student, date: string) => {
	if (!student.unavailableDates || student.unavailableDates.length === 0) return true
	const normalizedDate = date.split("T")[0]
	return !student.unavailableDates.includes(normalizedDate)
}

const isTeacherAvailableOnDate = (teacher: Teacher, date: string) => {
	if (!teacher.unavailableDates || teacher.unavailableDates.length === 0) return true
	const normalizedDate = date.split("T")[0]
	return !teacher.unavailableDates.includes(normalizedDate)
}

// Comprehensive validation function
export function validateTimetableConfiguration(
	startDate: string,
	endDate: string,
	teachers: Teacher[],
	students: Student[],
	breaks: string[]
): ValidationResult {
	const errors: string[] = []
	const warnings: string[] = []
	const suggestions: string[] = []

	// Date validation
	const start = new Date(startDate)
	const end = new Date(endDate)
	
	if (isNaN(start.getTime()) || isNaN(end.getTime())) {
		errors.push("Invalid date format. Please use YYYY-MM-DD format.")
		return { isValid: false, errors, warnings, suggestions }
	}

	if (start > end) {
		errors.push("Start date must be before or equal to end date.")
	}

	const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
	if (daysDiff > 30) {
		warnings.push("Scheduling over more than 30 days may result in poor optimization.")
	}

	// Teacher validation
	if (teachers.length === 0) {
		errors.push("At least one teacher is required.")
	}

	teachers.forEach((teacher, index) => {
		if (!teacher.name.trim()) {
			errors.push(`Teacher ${index + 1}: Name is required.`)
		}

		if (teacher.availability.length === 0) {
			errors.push(`Teacher ${teacher.name}: At least one availability window is required.`)
		}

		teacher.availability.forEach((avail, availIndex) => {
			const [startTime, endTime] = avail.split("-")
			if (!startTime || !endTime) {
				errors.push(`Teacher ${teacher.name}: Invalid availability format "${avail}". Use HH:MM-HH:MM format.`)
			} else {
				const start = timeStringToDate("2025-01-01", startTime)
				const end = timeStringToDate("2025-01-01", endTime)
				if (isNaN(start.getTime()) || isNaN(end.getTime())) {
					errors.push(`Teacher ${teacher.name}: Invalid time format in availability "${avail}".`)
				} else if (start >= end) {
					errors.push(`Teacher ${teacher.name}: Start time must be before end time in availability "${avail}".`)
				}
			}
		})

		if (teacher.maxLessonsPerDay < 1) {
			errors.push(`Teacher ${teacher.name}: Maximum lessons per day must be at least 1.`)
		}

		if (teacher.maxLessonsPerDay > 12) {
			warnings.push(`Teacher ${teacher.name}: More than 12 lessons per day may be unsustainable.`)
		}

		if (!teacher.room.trim()) {
			errors.push(`Teacher ${teacher.name}: Room assignment is required.`)
		}
	})

	// Student validation
	if (students.length === 0) {
		errors.push("At least one student is required.")
	}

	students.forEach((student, index) => {
		if (!student.name.trim()) {
			errors.push(`Student ${index + 1}: Name is required.`)
		}

		if (student.availability.length === 0) {
			errors.push(`Student ${student.name}: At least one availability window is required.`)
		}

		student.availability.forEach((avail, availIndex) => {
			const [startTime, endTime] = avail.split("-")
			if (!startTime || !endTime) {
				errors.push(`Student ${student.name}: Invalid availability format "${avail}". Use HH:MM-HH:MM format.`)
			} else {
				const start = timeStringToDate("2025-01-01", startTime)
				const end = timeStringToDate("2025-01-01", endTime)
				if (isNaN(start.getTime()) || isNaN(end.getTime())) {
					errors.push(`Student ${student.name}: Invalid time format in availability "${avail}".`)
				} else if (start >= end) {
					errors.push(`Student ${student.name}: Start time must be before end time in availability "${avail}".`)
				}
			}
		})

		if (student.desiredLessons < 0) {
			errors.push(`Student ${student.name}: Desired lessons cannot be negative.`)
		}

		if (student.priority < 1 || student.priority > 10) {
			warnings.push(`Student ${student.name}: Priority should be between 1-10.`)
		}

		// Validate teacher-specific lessons
		if (student.teacherLessons) {
			const totalTeacherLessons = Object.values(student.teacherLessons).reduce((sum, count) => sum + count, 0)
			if (totalTeacherLessons !== student.desiredLessons) {
				warnings.push(`Student ${student.name}: Teacher-specific lessons (${totalTeacherLessons}) don't match desired lessons (${student.desiredLessons}).`)
			}

			Object.entries(student.teacherLessons).forEach(([teacherName, count]) => {
				if (!teachers.find(t => t.name === teacherName)) {
					errors.push(`Student ${student.name}: References non-existent teacher "${teacherName}".`)
				}
				if (count < 0) {
					errors.push(`Student ${student.name}: Cannot have negative lessons with teacher "${teacherName}".`)
				}
			})
		}
	})

	// Break validation
	breaks.forEach((breakTime, index) => {
		if (!breakTime || typeof breakTime !== 'string') {
			errors.push(`Break ${index + 1}: Invalid break time.`)
			return
		}
		
		const breakParts = breakTime.split("-")
		if (breakParts.length !== 2) {
			errors.push(`Break ${index + 1}: Invalid format "${breakTime}". Use HH:MM-HH:MM format.`)
			return
		}
		
		const [startTime, endTime] = breakParts
		if (!startTime || !endTime) {
			errors.push(`Break ${index + 1}: Invalid format "${breakTime}". Use HH:MM-HH:MM format.`)
			return
		}
		
		try {
			const start = timeStringToDate("2025-01-01", startTime.trim())
			const end = timeStringToDate("2025-01-01", endTime.trim())
			if (isNaN(start.getTime()) || isNaN(end.getTime())) {
				errors.push(`Break ${index + 1}: Invalid time format "${breakTime}".`)
			} else if (start >= end) {
				errors.push(`Break ${index + 1}: Start time must be before end time "${breakTime}".`)
			}
		} catch (err) {
			errors.push(`Break ${index + 1}: Invalid time format "${breakTime}". ${err instanceof Error ? err.message : 'Unknown error'}`)
		}
	})

	// Capacity analysis
	const totalTeacherCapacity = teachers.reduce((sum, teacher) => {
		const dailyCapacity = teacher.maxLessonsPerDay * daysDiff
		return sum + dailyCapacity
	}, 0)

	const totalStudentDemand = students.reduce((sum, student) => {
		return sum + student.desiredLessons
	}, 0)

	if (totalStudentDemand > totalTeacherCapacity) {
		warnings.push(`Total student demand (${totalStudentDemand}) exceeds teacher capacity (${totalTeacherCapacity}).`)
		suggestions.push("Consider adding more teachers, extending the date range, or reducing student lesson requirements.")
	}

	// Availability overlap analysis
	const hasOverlap = teachers.some(teacher => 
		students.some(student => 
			teacher.availability.some(tAvail => 
				student.availability.some(sAvail => {
					const [tStart, tEnd] = tAvail.split("-")
					const [sStart, sEnd] = sAvail.split("-")
					const tStartTime = timeStringToDate("2025-01-01", tStart)
					const tEndTime = timeStringToDate("2025-01-01", tEnd)
					const sStartTime = timeStringToDate("2025-01-01", sStart)
					const sEndTime = timeStringToDate("2025-01-01", sEnd)
					return isOverlapping(tStartTime, tEndTime, sStartTime, sEndTime)
				})
			)
		)
	)

	if (!hasOverlap) {
		warnings.push("No overlap found between teacher and student availability. Scheduling may be impossible.")
		suggestions.push("Check that at least some teachers and students have overlapping availability windows.")
	}

	return {
		isValid: errors.length === 0,
		errors,
		warnings,
		suggestions
	}
}

// Function to suggest alternative dates
export function suggestAlternativeDates(
	originalStartDate: string,
	originalEndDate: string,
	teachers: Teacher[],
	students: Student[],
	breaks: string[]
): AlternativeDateSuggestion[] {
	const suggestions: AlternativeDateSuggestion[] = []
	const originalStart = new Date(originalStartDate)
	const originalEnd = new Date(originalEndDate)
	const originalDays = Math.ceil((originalEnd.getTime() - originalStart.getTime()) / (1000 * 60 * 60 * 24)) + 1

	// Try different date ranges
	for (let offset = 1; offset <= DEFAULT_SETTINGS.maxDaysToSuggest; offset++) {
		// Try starting later
		const laterStart = addDays(originalStart, offset)
		const laterEnd = addDays(laterStart, originalDays - 1)
		
		if (laterEnd <= addDays(new Date(), 90)) { // Don't suggest dates too far in future
			const satisfaction = calculateExpectedSatisfaction(
				format(laterStart, "yyyy-MM-dd"),
				format(laterEnd, "yyyy-MM-dd"),
				teachers,
				students,
				breaks
			)
			
			if (satisfaction > 0.7) { // Only suggest if >70% satisfaction expected
				suggestions.push({
					date: `${format(laterStart, "yyyy-MM-dd")} to ${format(laterEnd, "yyyy-MM-dd")}`,
					reason: `Starting ${offset} day${offset > 1 ? 's' : ''} later`,
					expectedSatisfaction: satisfaction
				})
			}
		}

		// Try extending the range
		const extendedEnd = addDays(originalEnd, offset)
		if (extendedEnd <= addDays(new Date(), 90)) {
			const satisfaction = calculateExpectedSatisfaction(
				originalStartDate,
				format(extendedEnd, "yyyy-MM-dd"),
				teachers,
				students,
				breaks
			)
			
			if (satisfaction > 0.7) {
				suggestions.push({
					date: `${originalStartDate} to ${format(extendedEnd, "yyyy-MM-dd")}`,
					reason: `Extending by ${offset} day${offset > 1 ? 's' : ''}`,
					expectedSatisfaction: satisfaction
				})
			}
		}
	}

	// Try weekend alternatives if original dates include weekdays
	if (!isWeekend(originalStart) || !isWeekend(originalEnd)) {
		const nextWeekendStart = new Date(originalStart)
		while (!isWeekend(nextWeekendStart)) {
			nextWeekendStart.setDate(nextWeekendStart.getDate() + 1)
		}
		const nextWeekendEnd = addDays(nextWeekendStart, originalDays - 1)
		
		if (nextWeekendEnd <= addDays(new Date(), 90)) {
			const satisfaction = calculateExpectedSatisfaction(
				format(nextWeekendStart, "yyyy-MM-dd"),
				format(nextWeekendEnd, "yyyy-MM-dd"),
				teachers,
				students,
				breaks
			)
			
			if (satisfaction > 0.7) {
				suggestions.push({
					date: `${format(nextWeekendStart, "yyyy-MM-dd")} to ${format(nextWeekendEnd, "yyyy-MM-dd")}`,
					reason: "Weekend alternative",
					expectedSatisfaction: satisfaction
				})
			}
		}
	}

	return suggestions.sort((a, b) => b.expectedSatisfaction - a.expectedSatisfaction)
}

// Helper function to calculate expected satisfaction for alternative dates
function calculateExpectedSatisfaction(
	startDate: string,
	endDate: string,
	teachers: Teacher[],
	students: Student[],
	breaks: string[]
): number {
	// This is a simplified calculation - in reality, you'd run the full algorithm
	// For now, we'll use heuristics based on availability overlap and capacity
	
	const start = new Date(startDate)
	const end = new Date(endDate)
	const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
	
	// Calculate total capacity
	const totalCapacity = teachers.reduce((sum, teacher) => {
		return sum + (teacher.maxLessonsPerDay * days)
	}, 0)
	
	// Calculate total demand
	const totalDemand = students.reduce((sum, student) => {
		return sum + student.desiredLessons
	}, 0)
	
	// Calculate availability overlap score
	let overlapScore = 0
	teachers.forEach(teacher => {
		students.forEach(student => {
			teacher.availability.forEach(tAvail => {
				student.availability.forEach(sAvail => {
					const [tStart, tEnd] = tAvail.split("-")
					const [sStart, sEnd] = sAvail.split("-")
					const tStartTime = timeStringToDate("2025-01-01", tStart)
					const tEndTime = timeStringToDate("2025-01-01", tEnd)
					const sStartTime = timeStringToDate("2025-01-01", sStart)
					const sEndTime = timeStringToDate("2025-01-01", sEnd)
					
					if (isOverlapping(tStartTime, tEndTime, sStartTime, sEndTime)) {
						const overlapStart = new Date(Math.max(tStartTime.getTime(), sStartTime.getTime()))
						const overlapEnd = new Date(Math.min(tEndTime.getTime(), sEndTime.getTime()))
						const overlapMinutes = (overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60)
						overlapScore += overlapMinutes
					}
				})
			})
		})
	})
	
	// Normalize scores
	const capacityRatio = Math.min(1, totalCapacity / totalDemand)
	const overlapRatio = Math.min(1, overlapScore / (teachers.length * students.length * 480)) // 8 hours in minutes
	
	return (capacityRatio * 0.6 + overlapRatio * 0.4)
}

export function generateTimetable(
	date: string,
	teachers: Teacher[],
	students: Student[],
	breaks: string[] = DEFAULT_BREAKS,
	daySchedule: DaySchedule = DEFAULT_DAY_SCHEDULE,
	config: TimetableConfig = { lessonDuration: DEFAULT_SETTINGS.lessonDuration, studentBreakAfter: DEFAULT_SETTINGS.studentBreakAfter, teacherBreakAfter: DEFAULT_SETTINGS.teacherBreakAfter }
): { date: string; lessons: TimetableLesson[]; error?: string; warning?: string } {
	// Validate configuration first
	const validation = validateTimetableConfiguration(date, date, teachers, students, breaks)
	if (!validation.isValid) {
		return {
			date,
			lessons: [],
			error: `Configuration errors: ${validation.errors.join(", ")}`
		}
	}
	const timetable: TimetableLesson[] = []
	const studentLessonsCount: Record<string, number> = {}
	const studentTeacherLessonsCount: Record<string, Record<string, number>> = {} // student -> teacher -> count
	const studentLastTeacher: Record<string, string | null> = {}
	const teacherCooldown: Record<string, number> = {}

	students.forEach((s) => {
		studentLessonsCount[s.name] = 0
		studentLastTeacher[s.name] = null
		studentTeacherLessonsCount[s.name] = {}
		teachers.forEach((t) => {
			studentTeacherLessonsCount[s.name][t.name] = 0
		})
	})
	teachers.forEach((t) => {
		teacherCooldown[t.name] = 0
	})

	// Build all possible lesson slots, respecting default breaks
	const allSlots: { start: Date; end: Date; duration: number }[] = []
	const dayStart = timeStringToDate(date, daySchedule.start)
	const dayEnd = timeStringToDate(date, daySchedule.end)
	let slotStart = dayStart

	while (slotStart < dayEnd) {
		const slotEnd = addMinutes(slotStart, config.lessonDuration)
		if (slotEnd > dayEnd) break

		// Check if this slot overlaps with any default break
		const overlappingBreak = breaks.find((b) => {
			if (!b || typeof b !== 'string') return false
			const breakParts = b.split("-")
			if (breakParts.length !== 2) return false
			
			try {
				const [bStart, bEnd] = breakParts
				const breakStart = timeStringToDate(date, bStart.trim())
				const breakEnd = timeStringToDate(date, bEnd.trim())
				// Check if slot overlaps with break (either starts during break or ends during break)
				return (slotStart < breakEnd && slotEnd > breakStart)
			} catch (err) {
				console.warn(`Invalid break format: ${b}`, err)
				return false
			}
		})

		if (overlappingBreak) {
			// If slot overlaps with a break, skip to after the break ends
			try {
				const [bStart, bEnd] = overlappingBreak.split("-")
				const breakEnd = timeStringToDate(date, bEnd.trim())
				slotStart = breakEnd
			} catch (err) {
				console.warn(`Error parsing break end time: ${overlappingBreak}`, err)
				// Skip this break and continue
				slotStart = slotEnd
			}
		} else {
			// Only add slots that don't overlap with breaks
			allSlots.push({ start: slotStart, end: slotEnd, duration: config.lessonDuration })
			slotStart = slotEnd
		}
	}

	// Sort students by priority (high -> low), but also consider remaining lessons and teacher-specific needs
	const prioritizedStudents = [...students].sort((a, b) => {
		if (!isStudentAvailableOnDate(a, date) && isStudentAvailableOnDate(b, date)) return 1
		if (isStudentAvailableOnDate(a, date) && !isStudentAvailableOnDate(b, date)) return -1
		// First by priority
		if (b.priority !== a.priority) return b.priority - a.priority
		
		// Then by remaining lessons (students with more remaining lessons get priority)
		const aRemaining = a.desiredLessons - studentLessonsCount[a.name]
		const bRemaining = b.desiredLessons - studentLessonsCount[b.name]
		if (bRemaining !== aRemaining) return bRemaining - aRemaining
		
		// Finally by teacher-specific needs (students with more unmet teacher requirements get priority)
		const aTeacherNeeds = a.teacherLessons ? Object.entries(a.teacherLessons).reduce((sum, [teacherName, required]) => {
			const current = studentTeacherLessonsCount[a.name][teacherName] || 0
			return sum + Math.max(0, required - current)
		}, 0) : 0
		
		const bTeacherNeeds = b.teacherLessons ? Object.entries(b.teacherLessons).reduce((sum, [teacherName, required]) => {
			const current = studentTeacherLessonsCount[b.name][teacherName] || 0
			return sum + Math.max(0, required - current)
		}, 0) : 0
		
		return bTeacherNeeds - aTeacherNeeds
	})

	// Schedule lessons
	for (const slot of allSlots) {
		for (const t of Object.keys(teacherCooldown)) {
			if (teacherCooldown[t] > 0) teacherCooldown[t]--
		}

		// No need to check for break slots here since we already filtered them out when building slots

		// Try to schedule lessons for each teacher
		for (const teacher of teachers) {
			if (teacherCooldown[teacher.name] > 0) continue
			// Check teacher availability
			if (!teacher.availability.some((a) => {
				const [aStart, aEnd] = a.split("-")
				const startTime = timeStringToDate(date, aStart)
				const endTime = timeStringToDate(date, aEnd)
				return slot.start >= startTime && slot.end <= endTime
			})) continue

			// Teacher max lessons
			const teacherLessons = timetable.filter((l) => l.teacher === teacher.name).length
			if (teacherLessons >= teacher.maxLessonsPerDay) continue

			// Check teacher consecutive lesson limit BEFORE scheduling
			const teacherLessonsList = timetable.filter(l => l.teacher === teacher.name && l.type === 'lesson')
			if (teacherLessonsList.length > 0) {
				// Sort lessons by start time to ensure proper order
				const sortedLessons = teacherLessonsList.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
				
				// Find the most recent consecutive lesson run
				let consecutiveCount = 1
				for (let i = sortedLessons.length - 2; i >= 0; i--) {
					const currentLesson = sortedLessons[i + 1]
					const prevLesson = sortedLessons[i]
					const prevEnd = new Date(prevLesson.end)
					const currentStart = new Date(currentLesson.start)
					
					// Check if there's a break between these lessons (both default breaks and explicit breaks)
					const hasBreakBetween = breaks.some((b) => {
						const breakTime = parseBreakTime(b, date)
						if (!breakTime) return false
						// Check if the break is between the lessons
						return breakTime.start.getTime() > prevEnd.getTime() && breakTime.end.getTime() < currentStart.getTime()
					}) || timetable.some(lesson => {
						// Also check for explicit breaks in the timetable
						if (lesson.type === 'break') {
							const breakStart = new Date(lesson.start)
							const breakEnd = new Date(lesson.end)
							return breakStart.getTime() > prevEnd.getTime() && breakEnd.getTime() < currentStart.getTime()
						}
						return false
					})
					
					// Check if lessons are consecutive (no gap or only 5min gap for transitions) AND no break between them
					if (currentStart.getTime() - prevEnd.getTime() <= 5 * 60 * 1000 && !hasBreakBetween) {
						consecutiveCount++
					} else {
						// Gap or break found, stop counting
						break
					}
				}
				
				// Also check if there's a break coming up after the last lesson that would break the consecutive count
				if (sortedLessons.length > 0) {
					const lastLesson = sortedLessons[sortedLessons.length - 1]
					const lastLessonEnd = new Date(lastLesson.end)
					
					// Check if there's a break coming up after the last lesson
					const upcomingBreak = breaks.find((b) => {
						const breakTime = parseBreakTime(b, date)
						if (!breakTime) return false
						// Check if the break starts after the last lesson and before the current slot
						return breakTime.start.getTime() > lastLessonEnd.getTime() && breakTime.start.getTime() <= slot.start.getTime()
					})
					
					// If there's an upcoming break and the current slot is after the break ends, reset the consecutive count
					if (upcomingBreak) {
						const [bStart, bEnd] = upcomingBreak.split("-")
						const breakEnd = timeStringToDate(date, bEnd)
						
						// Only reset consecutive count if the current slot is after the break ends
						if (slot.start.getTime() >= breakEnd.getTime()) {
							consecutiveCount = 0
						}
					}
				}
				
				if (consecutiveCount >= config.teacherBreakAfter) {
					const lastLesson = sortedLessons[sortedLessons.length - 1]
					const lastLessonEnd = new Date(lastLesson.end)
					
					// Check if there's a default break or sufficient gap after the last lesson
					const hasDefaultBreak = breaks.some((b) => {
						const breakTime = parseBreakTime(b, date)
						if (!breakTime) return false
						// Check if the break starts within 90 minutes of the last lesson end (more lenient)
						return Math.abs(breakTime.start.getTime() - lastLessonEnd.getTime()) <= 90 * 60 * 1000
					})
					
					// If no default break, require a gap of at least one lesson duration
					if (!hasDefaultBreak) {
						const requiredBreakStart = new Date(lastLessonEnd.getTime() + config.lessonDuration * 60 * 1000)
						if (slot.start.getTime() < requiredBreakStart.getTime()) {
							console.log(`Teacher ${teacher.name} needs break - skipping slot at ${slot.start.toLocaleTimeString()}`)
							continue // Teacher needs a break
						}
					} else {
						// If there's a default break, check if the current slot is after the break
						const defaultBreak = breaks.find((b) => {
							const breakTime = parseBreakTime(b, date)
							if (!breakTime) return false
							return Math.abs(breakTime.start.getTime() - lastLessonEnd.getTime()) <= 90 * 60 * 1000
						})
						
						if (defaultBreak) {
							const breakTime = parseBreakTime(defaultBreak, date)
							if (breakTime) {
								// Only allow lessons after the default break ends (allow lessons that start exactly when break ends)
								if (slot.start.getTime() < breakTime.end.getTime()) {
									console.log(`Teacher ${teacher.name} needs to wait for default break to end - skipping slot at ${slot.start.toLocaleTimeString()}`)
									continue // Teacher needs to wait for break to end
								}
								
								// If we're past the default break, allow the lesson (consecutive count is reset after break)
								console.log(`Teacher ${teacher.name} can have lesson after default break at ${slot.start.toLocaleTimeString()}`)
								// Don't continue - allow the lesson to be scheduled
							}
						}
					}
				}
			}

			// Filter students who need lessons with this specific teacher
			const studentsNeedingThisTeacher = prioritizedStudents.filter((s) => {
				// Check if student needs more total lessons
				if (studentLessonsCount[s.name] >= s.desiredLessons) return false
				
				// If student has teacher-specific requirements, ONLY allow lessons with teachers they still need
				if (s.teacherLessons && Object.keys(s.teacherLessons).length > 0) {
					// Student has teacher-specific requirements - only allow if they need this specific teacher
					const currentLessonsWithTeacher = studentTeacherLessonsCount[s.name][teacher.name] || 0
					const requiredLessonsWithTeacher = s.teacherLessons[teacher.name] || 0
					return currentLessonsWithTeacher < requiredLessonsWithTeacher
				}
				
				// If no teacher-specific requirements, student can take lessons with any teacher
				return true
			})

			// Pick student from those who need this teacher
			// Sort by remaining lessons to prioritize students who need more lessons
			const sortedStudents = studentsNeedingThisTeacher.sort((a, b) => {
				const aRemaining = a.desiredLessons - studentLessonsCount[a.name]
				const bRemaining = b.desiredLessons - studentLessonsCount[b.name]
				return bRemaining - aRemaining
			})

			const availableStudent = sortedStudents.find((s) => {
				if (studentLessonsCount[s.name] >= s.desiredLessons) return false

				// Availability
				if (!s.availability.some((a) => {
					const [aStart, aEnd] = a.split("-")
					const startTime = timeStringToDate(date, aStart)
					const endTime = timeStringToDate(date, aEnd)
					return slot.start >= startTime && slot.end <= endTime
				})) return false

				// Check overlapping lessons
				const conflict = timetable.some((l) =>
					l.student === s.name &&
					isOverlapping(slot.start, slot.end, new Date(l.start), new Date(l.end))
				)
				if (conflict) return false

				// Check if student has a consecutive break during this time slot
				const hasConsecutiveBreak = timetable.some((l) =>
					l.type === "break" &&
					l.breakType === "consecutive" &&
					l.breakFor === "student" &&
					l.breakForName === s.name &&
					isOverlapping(slot.start, slot.end, new Date(l.start), new Date(l.end))
				)
				if (hasConsecutiveBreak) return false

				// Check consecutive lesson limit and enforce proper spacing
				const studentLessons = timetable.filter(l => l.student === s.name && l.type === 'lesson')
				if (studentLessons.length > 0) {
					// Sort lessons by start time to ensure proper order
					const sortedLessons = studentLessons.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
					
					// Find the most recent consecutive lesson run
					let consecutiveCount = 1
					let currentRunStart = sortedLessons.length - 1
					
					// Count backwards to find consecutive lessons
					for (let i = sortedLessons.length - 2; i >= 0; i--) {
						const currentLesson = sortedLessons[i + 1]
						const prevLesson = sortedLessons[i]
						const prevEnd = new Date(prevLesson.end)
						const currentStart = new Date(currentLesson.start)
						
						// Check if there's a break between these lessons
						const hasBreakBetween = breaks.some((b) => {
							const [bStart, bEnd] = b.split("-")
							const breakStart = timeStringToDate(date, bStart)
							const breakEnd = timeStringToDate(date, bEnd)
							// Check if the break is between the lessons
							return breakStart.getTime() > prevEnd.getTime() && breakEnd.getTime() < currentStart.getTime()
						})
						
						// Check if lessons are consecutive (no gap or only 5min gap for transitions) AND no break between them
						if (currentStart.getTime() - prevEnd.getTime() <= 5 * 60 * 1000 && !hasBreakBetween) {
							consecutiveCount++
							currentRunStart = i
						} else {
							// Gap or break found, stop counting
							break
						}
					}
					
					// If we have reached the consecutive limit, enforce a break
					if (consecutiveCount >= config.studentBreakAfter) {
						const lastLesson = sortedLessons[sortedLessons.length - 1]
						const lastLessonEnd = new Date(lastLesson.end)
						
						// Check if there's a default break or sufficient gap after the last lesson
						const hasDefaultBreak = breaks.some((b) => {
							const [bStart, bEnd] = b.split("-")
							const breakStart = timeStringToDate(date, bStart)
							const breakEnd = timeStringToDate(date, bEnd)
							// Check if the break starts within 30 minutes of the last lesson end (more lenient)
							return Math.abs(breakStart.getTime() - lastLessonEnd.getTime()) <= 90 * 60 * 1000
						})
						
						// If no default break, require a gap of at least one lesson duration
						if (!hasDefaultBreak) {
							const requiredBreakStart = new Date(lastLessonEnd.getTime() + config.lessonDuration * 60 * 1000)
							if (slot.start.getTime() < requiredBreakStart.getTime()) {
								console.log(`Student ${s.name} needs break - skipping slot at ${slot.start.toLocaleTimeString()}`)
								return false
							}
						} else {
							// If there's a default break, check if the current slot is after the break
							const defaultBreak = breaks.find((b) => {
								const [bStart, bEnd] = b.split("-")
								const breakStart = timeStringToDate(date, bStart)
								const breakEnd = timeStringToDate(date, bEnd)
								return Math.abs(breakStart.getTime() - lastLessonEnd.getTime()) <= 15 * 60 * 1000
							})
							
							if (defaultBreak) {
								const [bStart, bEnd] = defaultBreak.split("-")
								const breakStart = timeStringToDate(date, bStart)
								const breakEnd = timeStringToDate(date, bEnd)
								
								// Only allow lessons after the default break ends (allow lessons that start exactly when break ends)
								if (slot.start.getTime() < breakEnd.getTime()) {
									console.log(`Student ${s.name} needs to wait for default break to end - skipping slot at ${slot.start.toLocaleTimeString()}`)
									return false
								}
								
								// If we're past the default break, allow the lesson (consecutive count is reset after break)
								console.log(`Student ${s.name} can have lesson after default break at ${slot.start.toLocaleTimeString()}`)
								// Don't return false here - allow the lesson to be scheduled
							}
						}
					}
				}

				return true
			})

			if (!availableStudent) continue

			// Assign lesson
			timetable.push({
				start: slot.start.toISOString(),
				end: slot.end.toISOString(),
				teacher: teacher.name,
				student: availableStudent.name,
				room: teacher.room,
				type: "lesson",
				duration: slot.duration,
			})

			// Update counters
			studentLessonsCount[availableStudent.name]++
			studentTeacherLessonsCount[availableStudent.name][teacher.name]++
			studentLastTeacher[availableStudent.name] = teacher.name

			// Only check for consecutive breaks if student has reached their desired lessons
			const studentLessons = timetable.filter(l => l.student === availableStudent.name && l.type === 'lesson')
			const studentDesiredLessons = availableStudent.desiredLessons
			const studentScheduledLessons = studentLessons.length
			
			// Only insert consecutive breaks if student has reached their desired lessons
			// This ensures we prioritize scheduling all lessons first
			const shouldCheckBreaks = studentScheduledLessons >= studentDesiredLessons
			
			if (studentLessons.length > 0 && shouldCheckBreaks) {
				const sortedLessons = studentLessons.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
				
				// Find the most recent consecutive lesson run
				let consecutiveCount = 1
				for (let i = sortedLessons.length - 2; i >= 0; i--) {
					const currentLesson = sortedLessons[i + 1]
					const prevLesson = sortedLessons[i]
					const prevEnd = new Date(prevLesson.end)
					const currentStart = new Date(currentLesson.start)
					
					if (currentStart.getTime() - prevEnd.getTime() <= 15 * 60 * 1000) {
						consecutiveCount++
					} else {
						break
					}
				}
				
				// If we've reached the consecutive limit, insert a break
				if (consecutiveCount >= config.studentBreakAfter) {
					const lastLesson = sortedLessons[sortedLessons.length - 1]
					const lastLessonEnd = new Date(lastLesson.end)
					
					// Check if there's already a default break coming up
					const hasDefaultBreak = breaks.some((b) => {
						const [bStart, bEnd] = b.split("-")
						const breakStart = timeStringToDate(date, bStart)
						const breakEnd = timeStringToDate(date, bEnd)
						return Math.abs(breakStart.getTime() - lastLessonEnd.getTime()) <= 15 * 60 * 1000
					})
					
					// If no default break, insert an explicit break
					if (!hasDefaultBreak) {
						const breakStart = lastLessonEnd
						const breakEnd = new Date(breakStart.getTime() + config.lessonDuration * 60 * 1000)
						
						// Check if this break slot doesn't already exist
						const existingBreak = timetable.some(lesson =>
							lesson.type === "break" &&
							lesson.start === breakStart.toISOString() &&
							lesson.end === breakEnd.toISOString()
						)
						
						if (!existingBreak) {
							timetable.push({
								start: breakStart.toISOString(),
								end: breakEnd.toISOString(),
								teacher: null,
								student: null,
								room: null,
								type: "break",
								duration: config.lessonDuration,
								breakType: "consecutive", // Mark as consecutive break
								breakFor: "student", // Break is for the student
								breakForName: availableStudent.name, // Name of the student
							})
							console.log(`Inserted break for ${availableStudent.name} from ${breakStart.toLocaleTimeString()} to ${breakEnd.toLocaleTimeString()}`)
						}
					}
				}
			}

			// Check if we need to insert a break for the teacher after this lesson
			const teacherLessonsForBreak = timetable.filter(l => l.teacher === teacher.name && l.type === 'lesson')
			if (teacherLessonsForBreak.length > 0) {
				const sortedLessons = teacherLessonsForBreak.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
				
				// Find the most recent consecutive lesson run
				let consecutiveCount = 1
				for (let i = sortedLessons.length - 2; i >= 0; i--) {
					const currentLesson = sortedLessons[i + 1]
					const prevLesson = sortedLessons[i]
					const prevEnd = new Date(prevLesson.end)
					const currentStart = new Date(currentLesson.start)
					
					// Check if there's a break between these lessons (both default breaks and explicit breaks)
					const hasBreakBetween = breaks.some((b) => {
						const breakTime = parseBreakTime(b, date)
						if (!breakTime) return false
						// Check if the break is between the lessons
						return breakTime.start.getTime() > prevEnd.getTime() && breakTime.end.getTime() < currentStart.getTime()
					}) || timetable.some(lesson => {
						// Also check for explicit breaks in the timetable
						if (lesson.type === 'break') {
							const breakStart = new Date(lesson.start)
							const breakEnd = new Date(lesson.end)
							return breakStart.getTime() > prevEnd.getTime() && breakEnd.getTime() < currentStart.getTime()
						}
						return false
					})
					
					// Check if lessons are consecutive (no gap or only 5min gap for transitions) AND no break between them
					if (currentStart.getTime() - prevEnd.getTime() <= 5 * 60 * 1000 && !hasBreakBetween) {
						consecutiveCount++
					} else {
						// Gap or break found, stop counting
						break
					}
				}
				
				// If we've reached the consecutive limit, insert a break
				if (consecutiveCount >= config.teacherBreakAfter) {
					const lastLesson = sortedLessons[sortedLessons.length - 1]
					const lastLessonEnd = new Date(lastLesson.end)
					
					// Check if there's already a default break starting at the same time or very close
					const hasDefaultBreakAtSameTime = breaks.some((b) => {
						const breakTime = parseBreakTime(b, date)
						if (!breakTime) return false
						// Check if there's a default break starting within 5 minutes of the last lesson end
						return Math.abs(breakTime.start.getTime() - lastLessonEnd.getTime()) <= 5 * 60 * 1000
					})
					
					// Only insert explicit break if there's no default break at the same time
					if (!hasDefaultBreakAtSameTime) {
						const breakStart = lastLessonEnd
						const breakEnd = new Date(breakStart.getTime() + config.lessonDuration * 60 * 1000)
						
						// Check if this break slot doesn't already exist
						const existingBreak = timetable.some(lesson =>
							lesson.type === "break" &&
							lesson.start === breakStart.toISOString() &&
							lesson.end === breakEnd.toISOString()
						)
						
						if (!existingBreak) {
							timetable.push({
								start: breakStart.toISOString(),
								end: breakEnd.toISOString(),
								teacher: null,
								student: null,
								room: null,
								type: "break",
								duration: config.lessonDuration,
								breakType: "consecutive", // Mark as consecutive break
								breakFor: "teacher", // Break is for the teacher
								breakForName: teacher.name, // Name of the teacher
							})
							console.log(`Inserted break for teacher ${teacher.name} from ${breakStart.toLocaleTimeString()} to ${breakEnd.toLocaleTimeString()}`)
						}
					} else {
						console.log(`Teacher ${teacher.name} consecutive limit reached, but default break already exists at ${lastLessonEnd.toLocaleTimeString()}`)
					}
				}
			}

			// Lesson scheduled successfully
		}
	}

	// Warning if some students didn't get full lessons or teacher-specific lessons
	const unmet = students.filter((s) => {
		const totalScheduled = studentLessonsCount[s.name]
		const totalDesired = s.desiredLessons
		
		// Check if total lessons are unmet
		if (totalScheduled < totalDesired) return true
		
		// Check if teacher-specific lessons are unmet
		if (s.teacherLessons) {
			for (const [teacherName, requiredLessons] of Object.entries(s.teacherLessons)) {
				const scheduledWithTeacher = studentTeacherLessonsCount[s.name][teacherName] || 0
				if (scheduledWithTeacher < requiredLessons) return true
			}
		}
		
		return false
	})

	// Debug logging
	console.log('Scheduling Debug:', {
		date,
		totalSlots: allSlots.length,
		totalLessons: timetable.filter(l => l.type === 'lesson').length,
		studentProgress: students.map(s => ({
			name: s.name,
			desired: s.desiredLessons,
			scheduled: studentLessonsCount[s.name],
			remaining: s.desiredLessons - studentLessonsCount[s.name],
			teacherLessons: studentTeacherLessonsCount[s.name]
		}))
	})
	
	let warning
	if (unmet.length > 0) {
		const unmetDetails = unmet.map(s => {
			const totalScheduled = studentLessonsCount[s.name]
			const totalDesired = s.desiredLessons
			const teacherDetails = s.teacherLessons ? 
				Object.entries(s.teacherLessons).map(([teacher, required]) => {
					const scheduled = studentTeacherLessonsCount[s.name][teacher] || 0
					return `${teacher}: ${scheduled}/${required}`
				}).join(", ") : ""
			
			return `${s.name} (${totalScheduled}/${totalDesired}${teacherDetails ? `, ${teacherDetails}` : ""})`
		}).join(", ")
		
		warning = `⚠️ Could not schedule all lessons. Unmet: ${unmetDetails}`
		console.log('Scheduling Summary:', {
			totalSlots: allSlots.length,
			totalLessons: timetable.filter(l => l.type === 'lesson').length,
			studentProgress: Object.entries(studentLessonsCount).map(([name, count]) => ({
				name,
				scheduled: count,
				desired: students.find(s => s.name === name)?.desiredLessons || 0,
				teacherLessons: studentTeacherLessonsCount[name]
			}))
		})
	}
	return {
		date,
		lessons: timetable.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()),
		warning,
	}
}

export interface MultiDayTimetableResult {
	dateRange: { start: string; end: string }
	days: { date: string; lessons: TimetableLesson[]; warning?: string }[]
	error?: string
	summary: {
		totalLessons: number
		studentsSatisfied: number
		studentsUnmet: string[]
	}
	alternativeDateSuggestions?: AlternativeDateSuggestion[]
	validationWarnings?: string[]
	validationSuggestions?: string[]
}

export interface DayScheduleMap {
	[date: string]: DaySchedule
}

export function generateMultiDayTimetable(
	startDate: string,
	endDate: string,
	teachers: Teacher[],
	students: Student[],
	breaks: string[] = DEFAULT_BREAKS,
	daySchedules: DayScheduleMap = {},
	config: TimetableConfig = { lessonDuration: DEFAULT_SETTINGS.lessonDuration, studentBreakAfter: DEFAULT_SETTINGS.studentBreakAfter, teacherBreakAfter: DEFAULT_SETTINGS.teacherBreakAfter }
): MultiDayTimetableResult {
	
	// Validate configuration first
	const validation = validateTimetableConfiguration(startDate, endDate, teachers, students, breaks)
	if (!validation.isValid) {
		return {
			dateRange: { start: startDate, end: endDate },
			days: [],
			error: `Configuration errors: ${validation.errors.join(", ")}`,
			summary: {
				totalLessons: 0,
				studentsSatisfied: 0,
				studentsUnmet: students.map(s => s.name)
			}
		}
	}
	const start = new Date(startDate)
	const end = new Date(endDate)
	const days: { date: string; lessons: TimetableLesson[]; warning?: string }[] = []
	
	// Generate all dates in range
	const dates: string[] = []
	for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
		dates.push(d.toISOString().split("T")[0])
	}
	
	// Track student progress across all days
	const studentProgress: Record<string, { scheduled: number; desired: number }> = {}
	// Track per-teacher progress across days
	const studentTeacherProgress: Record<string, Record<string, number>> = {}
	// Track student state across days (for break enforcement)
const studentState: Record<string, {
	consecutive: number
	lastTeacher: string | null
	lastLessonTime: string | null
}> = {}
	
	students.forEach(s => {
		studentProgress[s.name] = { scheduled: 0, desired: s.desiredLessons }
		studentTeacherProgress[s.name] = {}
		teachers.forEach(t => {
			studentTeacherProgress[s.name][t.name] = 0
		})
		studentState[s.name] = {
			consecutive: 0,
			lastTeacher: null,
			lastLessonTime: null
		}
	})
	
	// Generate timetable for each day
	for (let dayIndex = 0; dayIndex < dates.length; dayIndex++) {
		const date = dates[dayIndex]
		
		// Create students for this day with remaining lessons (including teacher-specific)
		const dayStudents = students.map(s => {
			if (!isStudentAvailableOnDate(s, date)) {
				return {
					...s,
					desiredLessons: 0,
					teacherLessons: s.teacherLessons ? {} : undefined
				}
			}
			
			const remainingTotalLessons = Math.max(0, studentProgress[s.name].desired - studentProgress[s.name].scheduled)
			let remainingTeacherLessons: Record<string, number> | undefined
			if (s.teacherLessons) {
				remainingTeacherLessons = Object.entries(s.teacherLessons).reduce<Record<string, number>>((acc, [teacherName, required]) => {
					const already = studentTeacherProgress[s.name]?.[teacherName] || 0
					const remaining = Math.max(0, required - already)
					if (remaining > 0) {
						acc[teacherName] = remaining
					}
					return acc
				}, {})
			}

			return {
				...s,
				desiredLessons: remainingTotalLessons,
				teacherLessons: remainingTeacherLessons
			}
		}).filter(s => s.desiredLessons > 0 && isStudentAvailableOnDate(s, date))
		
		// Debug logging for multi-day distribution
		if (dayStudents.length > 0) {
			console.log(`Day ${dayIndex + 1} (${date}): Scheduling for ${dayStudents.length} students with remaining lessons:`, 
				dayStudents.map(s => `${s.name}: ${s.desiredLessons} total, ${Object.entries(s.teacherLessons || {}).map(([t, c]) => `${t}:${c}`).join(', ')}`))
		} else {
			console.log(`Day ${dayIndex + 1} (${date}): No students with remaining lessons to schedule`)
		}
		
		// Debug logging for teacher-specific progress
		console.log(`Day ${dayIndex + 1} (${date}): Current teacher-specific progress:`, 
			Object.entries(studentTeacherProgress).map(([studentName, teacherProgress]) => 
				`${studentName}: ${Object.entries(teacherProgress).map(([teacher, count]) => `${teacher}:${count}`).join(', ')}`
			).join(' | '))
		
		// Generate timetable with cross-day state tracking
	const scheduleForDay = daySchedules[date] ?? DEFAULT_DAY_SCHEDULE
		const dayResult = generateTimetableWithState(date, teachers, dayStudents, breaks, scheduleForDay, studentState, config)
		
		// Update progress
		dayResult.lessons.forEach(lesson => {
			if (lesson.student && lesson.type === "lesson") {
				studentProgress[lesson.student].scheduled++
				if (lesson.teacher) {
					studentTeacherProgress[lesson.student][lesson.teacher] = (studentTeacherProgress[lesson.student][lesson.teacher] || 0) + 1
				}
			}
		})
		
		// Debug logging for progress tracking
		const lessonsScheduledToday = dayResult.lessons.filter(l => l.type === 'lesson').length
		if (lessonsScheduledToday > 0) {
			console.log(`Day ${dayIndex + 1} (${date}): Scheduled ${lessonsScheduledToday} lessons. Progress:`, 
				Object.entries(studentProgress).map(([name, progress]) => `${name}: ${progress.scheduled}/${progress.desired}`).join(', '))
		}
		
	// Ensure required student breaks are explicitly recorded between consecutive lesson runs
	const lessonsByStudent: Record<string, TimetableLesson[]> = {}
	dayResult.lessons
		.filter(lesson => lesson.type === "lesson" && lesson.student)
		.forEach(lesson => {
			const studentName = lesson.student as string
			if (!lessonsByStudent[studentName]) {
				lessonsByStudent[studentName] = []
			}
			lessonsByStudent[studentName].push(lesson)
		})

	Object.entries(lessonsByStudent).forEach(([studentName, lessons]) => {
		const sortedLessons = lessons.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
		let consecutiveCount = 0

		for (let i = 0; i < sortedLessons.length; i++) {
			consecutiveCount += 1

			if (consecutiveCount >= config.studentBreakAfter) {
				const lastLessonInRun = sortedLessons[i]
				const nextLesson = sortedLessons[i + 1]
				if (!nextLesson) {
					break
				}

				const breakStart = new Date(lastLessonInRun.end)
				const breakEnd = new Date(breakStart.getTime() + config.lessonDuration * 60 * 1000)
				const nextLessonStart = new Date(nextLesson.start)

				if (breakEnd.getTime() <= nextLessonStart.getTime()) {
					// The gap between lessons already enforces the required rest period.
					// We intentionally do not insert an explicit break block here to avoid
					// duplicating the empty slot in the rendered timetable.
				}

				// reset count after enforced break
				consecutiveCount = 0
			}
		}
	})

	// Reset student state at end of day
	Object.values(studentState).forEach(state => {
		state.lastLessonTime = null
		state.consecutive = 0
	})
		
		days.push({
			...dayResult,
			warning: undefined
		})
	}
	
	// Evaluate unmet students after scheduling all days
	const unmetEvaluation = evaluateUnmetStudents(students, studentProgress, studentTeacherProgress)
	
	// Debug logging for final results
	console.log('Multi-day scheduling complete. Final progress:', 
		Object.entries(studentProgress).map(([name, progress]) => `${name}: ${progress.scheduled}/${progress.desired}`).join(', '))
	console.log('Unmet students:', unmetEvaluation.names)
	
	if (days.length > 0) {
		const lastIndex = days.length - 1
		days[lastIndex] = {
			...days[lastIndex],
			warning: unmetEvaluation.warning
		}
	}
	
	// Calculate summary
	const totalLessons = days.reduce((sum, day) => sum + day.lessons.filter(l => l.type === "lesson").length, 0)
	const studentsUnmet = unmetEvaluation.names
	const studentsSatisfied = students.length - studentsUnmet.length
	
	// Generate alternative date suggestions if there are unmet students
	let alternativeDateSuggestions: AlternativeDateSuggestion[] = []
	if (studentsUnmet.length > 0) {
		alternativeDateSuggestions = suggestAlternativeDates(startDate, endDate, teachers, students, breaks)
	}
	
	return {
		dateRange: { start: startDate, end: endDate },
		days,
		summary: {
			totalLessons,
			studentsSatisfied,
			studentsUnmet
		},
		alternativeDateSuggestions: alternativeDateSuggestions.length > 0 ? alternativeDateSuggestions : undefined,
		validationWarnings: validation.warnings.length > 0 ? validation.warnings : undefined,
		validationSuggestions: validation.suggestions.length > 0 ? validation.suggestions : undefined
	}
}

// Function to update existing timetable with new breaks while preserving lesson assignments
export function updateTimetableWithNewBreaks(
	existingTimetable: MultiDayTimetableResult,
	newBreaks: string[],
	teachers: Teacher[],
	students: Student[],
	daySchedules: DayScheduleMap = {},
	config: TimetableConfig = { lessonDuration: DEFAULT_SETTINGS.lessonDuration, studentBreakAfter: DEFAULT_SETTINGS.studentBreakAfter, teacherBreakAfter: DEFAULT_SETTINGS.teacherBreakAfter }
): MultiDayTimetableResult {

	// Create updated days by preserving lessons but updating break handling
	const updatedDays = existingTimetable.days.map(day => {
		const schedule = daySchedules[day.date] ?? DEFAULT_DAY_SCHEDULE
		
		// Get existing lessons (non-break lessons)
		const existingLessons = day.lessons.filter(lesson => lesson.type === 'lesson')
		
		// Check if any existing lessons conflict with new breaks
		const conflictingLessons: TimetableLesson[] = []
		const validLessons: TimetableLesson[] = []
		
		existingLessons.forEach(lesson => {
			const lessonStart = new Date(lesson.start)
			const lessonEnd = new Date(lesson.end)
			
			// Check if lesson conflicts with any new break
			const hasConflict = newBreaks.some(breakStr => {
				const breakTime = parseBreakTime(breakStr, day.date)
				if (!breakTime) return false
				
				// Check if lesson overlaps with break
				return lessonStart < breakTime.end && lessonEnd > breakTime.start
			})
			
			if (hasConflict) {
				conflictingLessons.push(lesson)
			} else {
				validLessons.push(lesson)
			}
		})
		
		// If there are conflicts, we need to reschedule those lessons
		if (conflictingLessons.length > 0) {
			
			// Create students for rescheduling based on conflicting lessons
			const studentsToReschedule: Student[] = []
			const studentLessonCounts: Record<string, Record<string, number>> = {}
			
			conflictingLessons.forEach(lesson => {
				if (lesson.student && lesson.teacher) {
					// Find or create student entry for rescheduling
					let student = studentsToReschedule.find(s => s.name === lesson.student)
					if (!student) {
						const originalStudent = students.find(s => s.name === lesson.student)
						if (originalStudent) {
							student = {
								...originalStudent,
								desiredLessons: 0,
								teacherLessons: {}
							}
							studentsToReschedule.push(student)
							studentLessonCounts[lesson.student] = {}
						}
					}
					
					if (student) {
						student.desiredLessons++
						if (!student.teacherLessons) student.teacherLessons = {}
						student.teacherLessons[lesson.teacher] = (student.teacherLessons[lesson.teacher] || 0) + 1
						studentLessonCounts[lesson.student][lesson.teacher] = (studentLessonCounts[lesson.student][lesson.teacher] || 0) + 1
					}
				}
			})
			
			// Generate new timetable for this day with the students that need rescheduling
			if (studentsToReschedule.length > 0) {
				const studentState: Record<string, { consecutive: number; lastTeacher: string | null; lastLessonTime: string | null }> = {}
				studentsToReschedule.forEach(s => {
					studentState[s.name] = { consecutive: 0, lastTeacher: null, lastLessonTime: null }
				})
				
				const rescheduledResult = generateTimetableWithState(
					day.date,
					teachers,
					studentsToReschedule,
					newBreaks,
					schedule,
					studentState,
					config
				)
				
				// Combine valid lessons with rescheduled lessons
				const allLessons = [...validLessons, ...rescheduledResult.lessons.filter(l => l.type === 'lesson')]
				
				// Sort lessons by start time
				allLessons.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
				
				return {
					...day,
					lessons: allLessons,
					warning: rescheduledResult.warning || (conflictingLessons.length > rescheduledResult.lessons.filter(l => l.type === 'lesson').length ? 
						`${conflictingLessons.length - rescheduledResult.lessons.filter(l => l.type === 'lesson').length} lessons could not be rescheduled due to break conflicts` : undefined)
				}
			}
		}
		
		// No conflicts, just return the existing lessons
		return {
			...day,
			lessons: validLessons
		}
	})
	
	// Recalculate summary
	const totalLessons = updatedDays.reduce((sum, day) => sum + day.lessons.filter(l => l.type === "lesson").length, 0)
	
	// Check which students are still unmet
	const studentProgress: Record<string, number> = {}
	students.forEach(s => studentProgress[s.name] = 0)
	
	updatedDays.forEach(day => {
		day.lessons.forEach(lesson => {
			if (lesson.student && lesson.type === "lesson") {
				studentProgress[lesson.student] = (studentProgress[lesson.student] || 0) + 1
			}
		})
	})
	
	const studentsUnmet = students.filter(s => studentProgress[s.name] < s.desiredLessons).map(s => s.name)
	const studentsSatisfied = students.length - studentsUnmet.length
	
	return {
		...existingTimetable,
		days: updatedDays,
		summary: {
			totalLessons,
			studentsSatisfied,
			studentsUnmet
		}
	}
}

// Helper function to generate timetable with cross-day state tracking
function generateTimetableWithState(
	date: string,
	teachers: Teacher[],
	students: Student[],
	breaks: string[],
	daySchedule: DaySchedule,
	studentState: Record<string, {
		consecutive: number
		lastTeacher: string | null
		lastLessonTime: string | null
	}>,
	config: TimetableConfig = { lessonDuration: DEFAULT_SETTINGS.lessonDuration, studentBreakAfter: DEFAULT_SETTINGS.studentBreakAfter, teacherBreakAfter: DEFAULT_SETTINGS.teacherBreakAfter }
): { date: string; lessons: TimetableLesson[]; error?: string; warning?: string } {
	const timetable: TimetableLesson[] = []
	const studentLessonsCount: Record<string, number> = {}
	const studentTeacherLessonsCount: Record<string, Record<string, number>> = {} // student -> teacher -> count
	const teacherConsecutive: Record<string, number> = {}
	const teacherCooldown: Record<string, number> = {}

	students.forEach((s) => {
		studentLessonsCount[s.name] = 0
		studentTeacherLessonsCount[s.name] = {}
		teachers.forEach((t) => {
			studentTeacherLessonsCount[s.name][t.name] = 0
		})
	})
	teachers.forEach((t) => {
		teacherConsecutive[t.name] = 0
		teacherCooldown[t.name] = 0
	})

	// Build all possible lesson slots, skipping explicit breaks
	const allSlots: { start: Date; end: Date; duration: number }[] = []
	const dayStart = timeStringToDate(date, daySchedule.start)
	const dayEnd = timeStringToDate(date, daySchedule.end)
	let slotStart = dayStart

	while (slotStart < dayEnd) {
		const slotEnd = addMinutes(slotStart, config.lessonDuration)
		if (slotEnd > dayEnd) break

		// Check if this slot overlaps with any default break
		const overlappingBreak = breaks.find((b) => {
			if (!b || typeof b !== 'string') return false
			const breakParts = b.split("-")
			if (breakParts.length !== 2) return false
			
			try {
				const [bStart, bEnd] = breakParts
				const breakStart = timeStringToDate(date, bStart.trim())
				const breakEnd = timeStringToDate(date, bEnd.trim())
				// Check if slot overlaps with break (either starts during break or ends during break)
				return (slotStart < breakEnd && slotEnd > breakStart)
			} catch (err) {
				console.warn(`Invalid break format: ${b}`, err)
				return false
			}
		})

		if (overlappingBreak) {
			// If slot overlaps with a break, skip to after the break ends
			try {
				const [bStart, bEnd] = overlappingBreak.split("-")
				const breakEnd = timeStringToDate(date, bEnd.trim())
				slotStart = breakEnd
			} catch (err) {
				console.warn(`Error parsing break end time: ${overlappingBreak}`, err)
				// Skip this break and continue
				slotStart = slotEnd
			}
		} else {
			// Only add slots that don't overlap with breaks
			allSlots.push({ start: slotStart, end: slotEnd, duration: config.lessonDuration })
			slotStart = slotEnd
		}
	}

	// Sort students by priority (high -> low), but also consider remaining lessons and teacher-specific needs
	const prioritizedStudents = [...students].sort((a, b) => {
		if (!isStudentAvailableOnDate(a, date) && isStudentAvailableOnDate(b, date)) return 1
		if (isStudentAvailableOnDate(a, date) && !isStudentAvailableOnDate(b, date)) return -1
		// First by priority
		if (b.priority !== a.priority) return b.priority - a.priority
		
		// Then by remaining lessons (students with more remaining lessons get priority)
		const aRemaining = a.desiredLessons - studentLessonsCount[a.name]
		const bRemaining = b.desiredLessons - studentLessonsCount[b.name]
		if (bRemaining !== aRemaining) return bRemaining - aRemaining
		
		// Finally by teacher-specific needs (students with more unmet teacher requirements get priority)
		const aTeacherNeeds = a.teacherLessons ? Object.entries(a.teacherLessons).reduce((sum, [teacherName, required]) => {
			const current = studentTeacherLessonsCount[a.name][teacherName] || 0
			return sum + Math.max(0, required - current)
		}, 0) : 0
		
		const bTeacherNeeds = b.teacherLessons ? Object.entries(b.teacherLessons).reduce((sum, [teacherName, required]) => {
			const current = studentTeacherLessonsCount[b.name][teacherName] || 0
			return sum + Math.max(0, required - current)
		}, 0) : 0
		
		return bTeacherNeeds - aTeacherNeeds
	})

	// Schedule lessons
	for (const slot of allSlots) {
		// Decrement cooldowns
		for (const t of Object.keys(teacherCooldown)) {
			if (teacherCooldown[t] > 0) teacherCooldown[t]--
		}


		// Try to schedule lessons for each teacher
		for (const teacher of teachers) {
			if (teacherCooldown[teacher.name] > 0) continue
			// Check teacher availability
			if (!teacher.availability.some((a) => {
				const [aStart, aEnd] = a.split("-")
				const startTime = timeStringToDate(date, aStart)
				const endTime = timeStringToDate(date, aEnd)
				return slot.start >= startTime && slot.end <= endTime
			})) continue

			// Teacher max lessons
			const teacherLessons = timetable.filter((l) => l.teacher === teacher.name).length
			if (teacherLessons >= teacher.maxLessonsPerDay) continue

			// Check teacher consecutive lesson limit BEFORE scheduling
			const teacherLessonsList = timetable.filter(l => l.teacher === teacher.name && l.type === 'lesson')
			if (teacherLessonsList.length > 0) {
				// Sort lessons by start time to ensure proper order
				const sortedLessons = teacherLessonsList.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
				
				// Find the most recent consecutive lesson run
				let consecutiveCount = 1
				for (let i = sortedLessons.length - 2; i >= 0; i--) {
					const currentLesson = sortedLessons[i + 1]
					const prevLesson = sortedLessons[i]
					const prevEnd = new Date(prevLesson.end)
					const currentStart = new Date(currentLesson.start)
					
					// Check if there's a break between these lessons (both default breaks and explicit breaks)
					const hasBreakBetween = breaks.some((b) => {
						const breakTime = parseBreakTime(b, date)
						if (!breakTime) return false
						// Check if the break is between the lessons
						return breakTime.start.getTime() > prevEnd.getTime() && breakTime.end.getTime() < currentStart.getTime()
					}) || timetable.some(lesson => {
						// Also check for explicit breaks in the timetable
						if (lesson.type === 'break') {
							const breakStart = new Date(lesson.start)
							const breakEnd = new Date(lesson.end)
							return breakStart.getTime() > prevEnd.getTime() && breakEnd.getTime() < currentStart.getTime()
						}
						return false
					})
					
					// Check if lessons are consecutive (no gap or only 5min gap for transitions) AND no break between them
					if (currentStart.getTime() - prevEnd.getTime() <= 5 * 60 * 1000 && !hasBreakBetween) {
						consecutiveCount++
					} else {
						// Gap or break found, stop counting
						break
					}
				}
				
				// Also check if there's a break coming up after the last lesson that would break the consecutive count
				if (sortedLessons.length > 0) {
					const lastLesson = sortedLessons[sortedLessons.length - 1]
					const lastLessonEnd = new Date(lastLesson.end)
					
					// Check if there's a break coming up after the last lesson
					const upcomingBreak = breaks.find((b) => {
						const breakTime = parseBreakTime(b, date)
						if (!breakTime) return false
						// Check if the break starts after the last lesson and before the current slot
						return breakTime.start.getTime() > lastLessonEnd.getTime() && breakTime.start.getTime() <= slot.start.getTime()
					})
					
					// If there's an upcoming break and the current slot is after the break ends, reset the consecutive count
					if (upcomingBreak) {
						const [bStart, bEnd] = upcomingBreak.split("-")
						const breakEnd = timeStringToDate(date, bEnd)
						
						// Only reset consecutive count if the current slot is after the break ends
						if (slot.start.getTime() >= breakEnd.getTime()) {
							consecutiveCount = 0
						}
					}
				}
				
				if (consecutiveCount >= config.teacherBreakAfter) {
					const lastLesson = sortedLessons[sortedLessons.length - 1]
					const lastLessonEnd = new Date(lastLesson.end)
					
					// Check if there's a default break or sufficient gap after the last lesson
					const hasDefaultBreak = breaks.some((b) => {
						const breakTime = parseBreakTime(b, date)
						if (!breakTime) return false
						// Check if the break starts within 90 minutes of the last lesson end (more lenient)
						return Math.abs(breakTime.start.getTime() - lastLessonEnd.getTime()) <= 90 * 60 * 1000
					})
					
					// If no default break, require a gap of at least one lesson duration
					if (!hasDefaultBreak) {
						const requiredBreakStart = new Date(lastLessonEnd.getTime() + config.lessonDuration * 60 * 1000)
						if (slot.start.getTime() < requiredBreakStart.getTime()) {
							console.log(`Teacher ${teacher.name} needs break - skipping slot at ${slot.start.toLocaleTimeString()}`)
							continue // Teacher needs a break
						}
					} else {
						// If there's a default break, check if the current slot is after the break
						const defaultBreak = breaks.find((b) => {
							const breakTime = parseBreakTime(b, date)
							if (!breakTime) return false
							return Math.abs(breakTime.start.getTime() - lastLessonEnd.getTime()) <= 90 * 60 * 1000
						})
						
						if (defaultBreak) {
							const breakTime = parseBreakTime(defaultBreak, date)
							if (breakTime) {
								// Only allow lessons after the default break ends (allow lessons that start exactly when break ends)
								if (slot.start.getTime() < breakTime.end.getTime()) {
									console.log(`Teacher ${teacher.name} needs to wait for default break to end - skipping slot at ${slot.start.toLocaleTimeString()}`)
									continue // Teacher needs to wait for break to end
								}
								
								// If we're past the default break, allow the lesson (consecutive count is reset after break)
								console.log(`Teacher ${teacher.name} can have lesson after default break at ${slot.start.toLocaleTimeString()}`)
								// Don't continue - allow the lesson to be scheduled
							}
						}
					}
				}
			}

			// Filter students who need lessons with this specific teacher
			const studentsNeedingThisTeacher = prioritizedStudents.filter((s) => {
				if (!isStudentAvailableOnDate(s, date)) return false
				
				// Check if student needs more total lessons
				if (studentLessonsCount[s.name] >= s.desiredLessons) return false
				
				// If student has teacher-specific requirements, ONLY allow lessons with teachers they still need
				if (s.teacherLessons && Object.keys(s.teacherLessons).length > 0) {
					// Student has teacher-specific requirements - only allow if they need this specific teacher
					const currentLessonsWithTeacher = studentTeacherLessonsCount[s.name][teacher.name] || 0
					const requiredLessonsWithTeacher = s.teacherLessons[teacher.name] || 0
					return currentLessonsWithTeacher < requiredLessonsWithTeacher
				}
				
				// If no teacher-specific requirements, student can take lessons with any teacher
				return true
			})

			// Pick student from those who need this teacher
			// Sort by remaining lessons to prioritize students who need more lessons
			const sortedStudents = studentsNeedingThisTeacher.sort((a, b) => {
				const aRemaining = a.desiredLessons - studentLessonsCount[a.name]
				const bRemaining = b.desiredLessons - studentLessonsCount[b.name]
				return bRemaining - aRemaining
			})

			const availableStudent = sortedStudents.find((s) => {
				if (!isStudentAvailableOnDate(s, date)) return false
				if (studentLessonsCount[s.name] >= s.desiredLessons) return false

				// Availability
				if (!s.availability.some((a) => {
					const [aStart, aEnd] = a.split("-")
					const startTime = timeStringToDate(date, aStart)
					const endTime = timeStringToDate(date, aEnd)
					return slot.start >= startTime && slot.end <= endTime
				})) return false

				// Check overlapping lessons
				const conflict = timetable.some((l) =>
					l.student === s.name &&
					isOverlapping(slot.start, slot.end, new Date(l.start), new Date(l.end))
				)
				if (conflict) return false

				// Check if student has a consecutive break during this time slot
				const hasConsecutiveBreak = timetable.some((l) =>
					l.type === "break" &&
					l.breakType === "consecutive" &&
					l.breakFor === "student" &&
					l.breakForName === s.name &&
					isOverlapping(slot.start, slot.end, new Date(l.start), new Date(l.end))
				)
				if (hasConsecutiveBreak) return false

				// Check consecutive lesson limit and enforce proper spacing
				const studentLessons = timetable.filter(l => l.student === s.name && l.type === 'lesson')
				if (studentLessons.length > 0) {
					// Sort lessons by start time to ensure proper order
					const sortedLessons = studentLessons.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
					
					// Find the most recent consecutive lesson run
					let consecutiveCount = 1
					let currentRunStart = sortedLessons.length - 1
					
					// Count backwards to find consecutive lessons
					for (let i = sortedLessons.length - 2; i >= 0; i--) {
						const currentLesson = sortedLessons[i + 1]
						const prevLesson = sortedLessons[i]
						const prevEnd = new Date(prevLesson.end)
						const currentStart = new Date(currentLesson.start)
						
						// Check if there's a break between these lessons
						const hasBreakBetween = breaks.some((b) => {
							const [bStart, bEnd] = b.split("-")
							const breakStart = timeStringToDate(date, bStart)
							const breakEnd = timeStringToDate(date, bEnd)
							// Check if the break is between the lessons
							return breakStart.getTime() > prevEnd.getTime() && breakEnd.getTime() < currentStart.getTime()
						})
						
						// Check if lessons are consecutive (no gap or only 5min gap for transitions) AND no break between them
						if (currentStart.getTime() - prevEnd.getTime() <= 5 * 60 * 1000 && !hasBreakBetween) {
							consecutiveCount++
							currentRunStart = i
						} else {
							// Gap or break found, stop counting
							break
						}
					}
					
					// If we have reached the consecutive limit, enforce a break
					if (consecutiveCount >= config.studentBreakAfter) {
						const lastLesson = sortedLessons[sortedLessons.length - 1]
						const lastLessonEnd = new Date(lastLesson.end)
						
						// Check if there's a default break or sufficient gap after the last lesson
						const hasDefaultBreak = breaks.some((b) => {
							const [bStart, bEnd] = b.split("-")
							const breakStart = timeStringToDate(date, bStart)
							const breakEnd = timeStringToDate(date, bEnd)
							// Check if the break starts within 30 minutes of the last lesson end (more lenient)
							return Math.abs(breakStart.getTime() - lastLessonEnd.getTime()) <= 90 * 60 * 1000
						})
						
						// If no default break, require a gap of at least one lesson duration
						if (!hasDefaultBreak) {
							const requiredBreakStart = new Date(lastLessonEnd.getTime() + config.lessonDuration * 60 * 1000)
							if (slot.start.getTime() < requiredBreakStart.getTime()) {
								console.log(`Student ${s.name} needs break - skipping slot at ${slot.start.toLocaleTimeString()}`)
								return false
							}
						} else {
							// If there's a default break, check if the current slot is after the break
							const defaultBreak = breaks.find((b) => {
								const [bStart, bEnd] = b.split("-")
								const breakStart = timeStringToDate(date, bStart)
								const breakEnd = timeStringToDate(date, bEnd)
								return Math.abs(breakStart.getTime() - lastLessonEnd.getTime()) <= 15 * 60 * 1000
							})
							
							if (defaultBreak) {
								const [bStart, bEnd] = defaultBreak.split("-")
								const breakStart = timeStringToDate(date, bStart)
								const breakEnd = timeStringToDate(date, bEnd)
								
								// Only allow lessons after the default break ends (allow lessons that start exactly when break ends)
								if (slot.start.getTime() < breakEnd.getTime()) {
									console.log(`Student ${s.name} needs to wait for default break to end - skipping slot at ${slot.start.toLocaleTimeString()}`)
									return false
								}
								
								// If we're past the default break, allow the lesson (consecutive count is reset after break)
								console.log(`Student ${s.name} can have lesson after default break at ${slot.start.toLocaleTimeString()}`)
								// Don't return false here - allow the lesson to be scheduled
							}
						}
					}
				}

				return true
			})

			if (!availableStudent) continue

			// Assign lesson
			timetable.push({
				start: slot.start.toISOString(),
				end: slot.end.toISOString(),
				teacher: teacher.name,
				student: availableStudent.name,
				room: teacher.room,
				type: "lesson",
				duration: slot.duration,
			})

			// Update counters
			studentLessonsCount[availableStudent.name]++
			studentTeacherLessonsCount[availableStudent.name][teacher.name]++
			studentState[availableStudent.name].lastTeacher = teacher.name
			studentState[availableStudent.name].lastLessonTime = slot.start.toISOString()

			// Check if we need to insert a break after this lesson
			const studentLessons = timetable.filter(l => l.student === availableStudent.name && l.type === 'lesson')
			if (studentLessons.length > 0) {
				const sortedLessons = studentLessons.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
				
				// Find the most recent consecutive lesson run
				let consecutiveCount = 1
				for (let i = sortedLessons.length - 2; i >= 0; i--) {
					const currentLesson = sortedLessons[i + 1]
					const prevLesson = sortedLessons[i]
					const prevEnd = new Date(prevLesson.end)
					const currentStart = new Date(currentLesson.start)
					
					if (currentStart.getTime() - prevEnd.getTime() <= 15 * 60 * 1000) {
						consecutiveCount++
					} else {
						break
					}
				}
				
				// If we've reached the consecutive limit, insert a break
				if (consecutiveCount >= config.studentBreakAfter) {
					const lastLesson = sortedLessons[sortedLessons.length - 1]
					const lastLessonEnd = new Date(lastLesson.end)
					
					// Check if there's already a default break coming up
					const hasDefaultBreak = breaks.some((b) => {
						const [bStart, bEnd] = b.split("-")
						const breakStart = timeStringToDate(date, bStart)
						const breakEnd = timeStringToDate(date, bEnd)
						return Math.abs(breakStart.getTime() - lastLessonEnd.getTime()) <= 15 * 60 * 1000
					})
					
					// If no default break, insert an explicit break
					if (!hasDefaultBreak) {
						const breakStart = lastLessonEnd
						const breakEnd = new Date(breakStart.getTime() + config.lessonDuration * 60 * 1000)
						
						// Check if this break slot doesn't already exist
						const existingBreak = timetable.some(lesson =>
							lesson.type === "break" &&
							lesson.start === breakStart.toISOString() &&
							lesson.end === breakEnd.toISOString()
						)
						
						if (!existingBreak) {
							timetable.push({
								start: breakStart.toISOString(),
								end: breakEnd.toISOString(),
								teacher: null,
								student: null,
								room: null,
								type: "break",
								duration: config.lessonDuration,
								breakType: "consecutive", // Mark as consecutive break
								breakFor: "student", // Break is for the student
								breakForName: availableStudent.name, // Name of the student
							})
							console.log(`Inserted break for ${availableStudent.name} from ${breakStart.toLocaleTimeString()} to ${breakEnd.toLocaleTimeString()}`)
						}
					}
				}
			}

			// Check if we need to insert a break for the teacher after this lesson
			const teacherLessonsForBreak = timetable.filter(l => l.teacher === teacher.name && l.type === 'lesson')
			if (teacherLessonsForBreak.length > 0) {
				const sortedLessons = teacherLessonsForBreak.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
				
				// Find the most recent consecutive lesson run
				let consecutiveCount = 1
				for (let i = sortedLessons.length - 2; i >= 0; i--) {
					const currentLesson = sortedLessons[i + 1]
					const prevLesson = sortedLessons[i]
					const prevEnd = new Date(prevLesson.end)
					const currentStart = new Date(currentLesson.start)
					
					// Check if there's a break between these lessons (both default breaks and explicit breaks)
					const hasBreakBetween = breaks.some((b) => {
						const breakTime = parseBreakTime(b, date)
						if (!breakTime) return false
						// Check if the break is between the lessons
						return breakTime.start.getTime() > prevEnd.getTime() && breakTime.end.getTime() < currentStart.getTime()
					}) || timetable.some(lesson => {
						// Also check for explicit breaks in the timetable
						if (lesson.type === 'break') {
							const breakStart = new Date(lesson.start)
							const breakEnd = new Date(lesson.end)
							return breakStart.getTime() > prevEnd.getTime() && breakEnd.getTime() < currentStart.getTime()
						}
						return false
					})
					
					// Check if lessons are consecutive (no gap or only 5min gap for transitions) AND no break between them
					if (currentStart.getTime() - prevEnd.getTime() <= 5 * 60 * 1000 && !hasBreakBetween) {
						consecutiveCount++
					} else {
						// Gap or break found, stop counting
						break
					}
				}
				
				// If we've reached the consecutive limit, insert a break
				if (consecutiveCount >= config.teacherBreakAfter) {
					const lastLesson = sortedLessons[sortedLessons.length - 1]
					const lastLessonEnd = new Date(lastLesson.end)
					
					// Check if there's already a default break starting at the same time or very close
					const hasDefaultBreakAtSameTime = breaks.some((b) => {
						const breakTime = parseBreakTime(b, date)
						if (!breakTime) return false
						// Check if there's a default break starting within 5 minutes of the last lesson end
						return Math.abs(breakTime.start.getTime() - lastLessonEnd.getTime()) <= 5 * 60 * 1000
					})
					
					// Only insert explicit break if there's no default break at the same time
					if (!hasDefaultBreakAtSameTime) {
						const breakStart = lastLessonEnd
						const breakEnd = new Date(breakStart.getTime() + config.lessonDuration * 60 * 1000)
						
						// Check if this break slot doesn't already exist
						const existingBreak = timetable.some(lesson =>
							lesson.type === "break" &&
							lesson.start === breakStart.toISOString() &&
							lesson.end === breakEnd.toISOString()
						)
						
						if (!existingBreak) {
							timetable.push({
								start: breakStart.toISOString(),
								end: breakEnd.toISOString(),
								teacher: null,
								student: null,
								room: null,
								type: "break",
								duration: config.lessonDuration,
								breakType: "consecutive", // Mark as consecutive break
								breakFor: "teacher", // Break is for the teacher
								breakForName: teacher.name, // Name of the teacher
							})
							console.log(`Inserted break for teacher ${teacher.name} from ${breakStart.toLocaleTimeString()} to ${breakEnd.toLocaleTimeString()}`)
						}
					} else {
						console.log(`Teacher ${teacher.name} consecutive limit reached, but default break already exists at ${lastLessonEnd.toLocaleTimeString()}`)
					}
				}
			}

			// Lesson scheduled successfully
		}
	}

// Add explicit breaks only if they do not already exist
	
	if (!breaks || breaks.length === 0) {
	} else {
		const normalizedBreaks = breaks.map(b => {
			const breakTime = parseBreakTime(b, date)
			if (!breakTime) {
				console.warn(`Skipping invalid break: ${b}`)
				return null
			}
			return {
				start: breakTime.start.toISOString(),
				end: breakTime.end.toISOString(),
				duration: (breakTime.end.getTime() - breakTime.start.getTime()) / 60000,
			}
		}).filter(Boolean)

		normalizedBreaks.forEach(breakSlot => {
	const existingBreak = timetable.some(lesson =>
		lesson.type === "break" &&
		lesson.start === breakSlot.start &&
		lesson.end === breakSlot.end
	)

	if (!existingBreak) {
		const breakEntry: TimetableLesson = {
			start: breakSlot.start,
			end: breakSlot.end,
			teacher: null,
			student: null,
			room: null,
			type: "break",
			duration: breakSlot.duration,
			breakType: "default", // Mark as default break
		}
		timetable.push(breakEntry)
		} else {
		}
		})
	}

	const studentProgressForDay = students.reduce<Record<string, { scheduled: number; desired: number }>>((acc, s) => {
		acc[s.name] = {
			scheduled: studentLessonsCount[s.name] || 0,
			desired: s.desiredLessons,
		}
		return acc
	}, {})

	const sortedLessons = normalizeLessonTimes([...timetable])
		.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
	const dedupedLessons = dedupeBreakEntries(sortedLessons)

const evaluation = evaluateUnmetStudents(students, studentProgressForDay, studentTeacherLessonsCount)
	if (evaluation.warning) {
		console.log('Scheduling Summary:', {
			totalSlots: allSlots.length,
			totalLessons: dedupedLessons.filter(l => l.type === 'lesson').length,
			studentProgress: Object.entries(studentLessonsCount).map(([name, count]) => ({
				name,
				scheduled: count,
				desired: students.find(s => s.name === name)?.desiredLessons || 0,
				teacherLessons: studentTeacherLessonsCount[name]
			}))
		})
	}

	// Timetable generation completed
	return {
		date,
		lessons: dedupedLessons,
		warning: evaluation.warning,
	}
}

function evaluateUnmetStudents(
	students: Student[],
	studentProgress: Record<string, { scheduled: number; desired: number }>,
	studentTeacherProgress: Record<string, Record<string, number>>
): { warning?: string; names: string[] } {
	const unmet = students.filter((s) => {
		const totalScheduled = studentProgress[s.name].scheduled
		const totalDesired = studentProgress[s.name].desired
		if (totalScheduled < totalDesired) return true
		if (s.teacherLessons) {
			for (const [teacherName, requiredLessons] of Object.entries(s.teacherLessons)) {
				const scheduledWithTeacher = studentTeacherProgress[s.name][teacherName] || 0
				if (scheduledWithTeacher < requiredLessons) return true
			}
		}
		return false
	})
	
	if (unmet.length === 0) {
		return { names: [] }
	}
	
	const warning = `⚠️ Could not schedule all lessons. Unmet: ${unmet.map(s => {
		const totalScheduled = studentProgress[s.name].scheduled
		const totalDesired = studentProgress[s.name].desired
		const teacherDetails = s.teacherLessons ? 
			Object.entries(s.teacherLessons).map(([teacher, required]) => {
				const scheduled = studentTeacherProgress[s.name][teacher] || 0
				return `${teacher}: ${scheduled}/${required}`
			}).join(", ") : ""
		return `${s.name} (${totalScheduled}/${totalDesired}${teacherDetails ? `, ${teacherDetails}` : ""})`
	}).join(", ")}`
	
	return {
		names: unmet.map(s => s.name),
		warning
	}
}