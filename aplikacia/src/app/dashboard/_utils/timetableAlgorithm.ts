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
	baseGroup?: string // e.g., 'juniors1', 'juniors2' - assigned by coaches
	unavailability?: any // Weekly unavailability (times when CANNOT train) - day-specific
}

export interface Couple {
	name: string // pair label (e.g., "John & Jane")
	studentA: Student
	studentB: Student
	availability: string[] // intersection of both students' availability
	desiredLessons: number
	priority: number
	preferredTeacher?: string
	baseGroup?: string // inherited from students, can be overridden
	unavailableDates?: string[] // dates when either student cannot attend
	unavailability?: any // Weekly unavailability (times when CANNOT train) - day-specific
}

export interface GroupLesson {
	groupName: string // e.g., 'juniors1', 'juniors2'
	lessonsTarget: {
		count: number // number of lessons
		timeScope: 'weekend' | 'week' | 'month' | 'timetable' // time period for the target
	}
	teachers: string[] // multiple teachers can lead
	participants: Couple[] // couples participating in this group lesson
	staticTimeSlot?: { // optional static scheduling
		dayOfWeek: string // 'monday', 'tuesday', etc.
		startTime: string // 'HH:mm'
		duration?: number // overrides default duration (deprecated, use top-level duration)
	}
	duration?: number // Duration in minutes for all group lessons (automatic or static)
	distributeAcrossDays?: boolean // When true, spread lessons evenly across timetable days
	preferredRoom?: string
	notes?: string
}

export interface TimetableLesson {
	start: string
	end: string
	teacher: string | null
	teachers?: string[] // multiple teachers for group lessons
	student: string | null
	students?: string[] // multiple students for group lessons
	couple?: string | null // couple name for couple lessons
	couples?: string[] // couple names for group lessons
	room: string | null
	type: "lesson" | "break" | "unused"
	lessonType?: "individual" | "couple" | "group" // specific lesson type
	duration: number
	groupName?: string // for group lessons
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
	distributeLessons?: boolean // When true, lessons are spread evenly across all days
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

// const toLocalISOString = (date: Date) => format(date, "yyyy-MM-dd'T'HH:mm:ss")

const isOverlapping = (startA: Date, endA: Date, startB: Date, endB: Date) =>
	startA < endB && startB < endA

const isStudentAvailableOnDate = (student: Student, date: string) => {
	if (!student.unavailableDates || student.unavailableDates.length === 0) return true
	const normalizedDate = date.split("T")[0]
	return !student.unavailableDates.includes(normalizedDate)
}

// Check if a time slot is unavailable on a specific day of the week
const isTimeUnavailableOnDay = (unavailability: any, date: string, startTime: Date, endTime: Date): boolean => {
	if (!unavailability) return false
	
	// Get day of week from date
	const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
	const dateObj = new Date(date)
	const dayOfWeek = dayNames[dateObj.getDay()]
	
	// Helper to get windows from either format (direct day props or nested days Map)
	const getWindowsForDay = (day: string): Array<{ start: string; end: string }> => {
		if (!unavailability) return []
		// Try direct day property first (new format)
		if (unavailability[day] && Array.isArray(unavailability[day])) {
			return unavailability[day]
		}
		// Try nested days Map format (old format)
		if (unavailability.days) {
			if (unavailability.days.get && typeof unavailability.days.get === 'function') {
				return unavailability.days.get(day) || []
			}
			if (unavailability.days[day] && Array.isArray(unavailability.days[day])) {
				return unavailability.days[day]
			}
		}
		return []
	}
	
	const unavailWindows = getWindowsForDay(dayOfWeek)
	if (unavailWindows.length === 0) return false
	
	// Convert time strings to minutes for comparison
	const toMinutes = (time: string): number => {
		const parts = time.split(':')
		if (parts.length < 2) return 0
		const [h, m] = parts.map(Number)
		return (h || 0) * 60 + (m || 0)
	}
	
	const slotStartMinutes = startTime.getHours() * 60 + startTime.getMinutes()
	const slotEndMinutes = endTime.getHours() * 60 + endTime.getMinutes()
	
	// Check if the slot overlaps with any unavailable window
	for (const window of unavailWindows) {
		if (window.start && window.end) {
			const unavailStart = toMinutes(window.start)
			const unavailEnd = toMinutes(window.end)
			
			// Check if slot overlaps with unavailable window
			// Unavailability end time is exclusive - slot can start exactly at the end time
			if (slotStartMinutes < unavailEnd && slotEndMinutes > unavailStart) {
				return true // Slot is unavailable
			}
		}
	}
	
	return false // Slot is available
}

// const isTeacherAvailableOnDate = (teacher: Teacher, date: string) => {
// 	if (!teacher.unavailableDates || teacher.unavailableDates.length === 0) return true
// 	const normalizedDate = date.split("T")[0]
// 	return !teacher.unavailableDates.includes(normalizedDate)
// }

// Comprehensive validation function
export function validateTimetableConfiguration(
	startDate: string,
	endDate: string,
	teachers: Teacher[],
	students: Student[],
	couples: Couple[] = [],
	groupLessons: GroupLesson[] = [],
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
	if (!teachers || teachers.length === 0) {
		errors.push("At least one teacher is required.")
	}

	(teachers || []).forEach((teacher, index) => {
		if (!teacher.name.trim()) {
			errors.push(`Teacher ${index + 1}: Name is required.`)
		}

		if (!teacher.availability || teacher.availability.length === 0) {
			errors.push(`Teacher ${teacher.name}: At least one availability window is required.`)
		}

		(teacher.availability || []).forEach((avail) => {
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

	// Student validation - allow empty students if there are group lessons
	if ((!students || students.length === 0) && (!groupLessons || groupLessons.length === 0)) {
		errors.push("At least one student or group lesson is required.")
	}

	const studentList = Array.isArray(students) ? students : []

	studentList.forEach((student, index) => {
		if (!student.name.trim()) {
			errors.push(`Student ${index + 1}: Name is required.`)
		}

		if (!student.availability || student.availability.length === 0) {
			errors.push(`Student ${student.name}: At least one availability window is required.`)
		}

		(student.availability || []).forEach((avail) => {
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
	});

	// Couple validation
	(couples || []).forEach((couple, index) => {
		if (!couple?.name?.trim()) {
			errors.push(`Couple ${index + 1}: Name is required.`)
		}

		if (!couple.availability || couple.availability.length === 0) {
			errors.push(`Couple ${couple?.name || `Couple ${index + 1}`}: At least one availability window is required.`)
		}

		(couple.availability || []).forEach((avail) => {
			const [startTime, endTime] = avail.split("-")
			if (!startTime || !endTime) {
				errors.push(`Couple ${couple?.name || `Couple ${index + 1}`}: Invalid availability format "${avail}". Use HH:MM-HH:MM format.`)
			} else {
				const start = timeStringToDate("2025-01-01", startTime)
				const end = timeStringToDate("2025-01-01", endTime)
				if (isNaN(start.getTime()) || isNaN(end.getTime())) {
					errors.push(`Couple ${couple?.name || `Couple ${index + 1}`}: Invalid time format in availability "${avail}".`)
				} else if (start >= end) {
					errors.push(`Couple ${couple?.name || `Couple ${index + 1}`}: Start time must be before end time in availability "${avail}".`)
				}
			}
		})

		if (couple.desiredLessons < 0) {
			errors.push(`Couple ${couple?.name || `Couple ${index + 1}`}: Desired lessons cannot be negative.`)
		}

		if (couple.priority < 1 || couple.priority > 10) {
			warnings.push(`Couple ${couple?.name || `Couple ${index + 1}`}: Priority should be between 1-10.`)
		}

		// Check if preferred teacher exists
		if (couple.preferredTeacher && !teachers.find(t => t.name === couple.preferredTeacher)) {
			warnings.push(`Couple ${couple?.name || `Couple ${index + 1}`}: Preferred teacher "${couple.preferredTeacher}" does not exist.`)
		}
	});

	// Group lesson validation
	(groupLessons || []).forEach((groupLesson, index) => {
		if (!groupLesson?.groupName?.trim()) {
			errors.push(`Group lesson ${index + 1}: Group name is required.`)
		}

		if (groupLesson.lessonsTarget.count < 0) {
			errors.push(`Group lesson ${groupLesson?.groupName || `Group lesson ${index + 1}`}: Weekly lessons target cannot be negative.`)
		}

		if (!groupLesson.teachers || groupLesson.teachers.length === 0) {
			errors.push(`Group lesson ${groupLesson?.groupName || `Group lesson ${index + 1}`}: At least one teacher is required.`)
		}

		(groupLesson.teachers || []).forEach(teacherName => {
			if (!teachers.find(t => t.name === teacherName)) {
				errors.push(`Group lesson ${groupLesson?.groupName || `Group lesson ${index + 1}`}: Teacher "${teacherName}" does not exist.`)
			}
		})

		if (!groupLesson.participants || groupLesson.participants.length === 0) {
			errors.push(`Group lesson ${groupLesson?.groupName || `Group lesson ${index + 1}`}: At least one participant couple is required.`)
		}

		// Note: Group lesson participants are validated when converting from dbCouples in page.tsx
		// The couples parameter may be empty if no couples have desiredLessons > 0, but group lessons
		// can still be scheduled independently. We skip this validation check since participants
		// are validated against dbCouples during conversion, not against the couples parameter.
		// If a couple doesn't exist in dbCouples, it will have default availability during conversion.

		// Check static time slot format
		if (groupLesson.staticTimeSlot) {
			const { startTime, duration } = groupLesson.staticTimeSlot
			const start = timeStringToDate("2025-01-01", startTime)
			if (isNaN(start.getTime())) {
				errors.push(`Group lesson ${groupLesson?.groupName || `Group lesson ${index + 1}`}: Invalid start time format "${startTime}".`)
			}
			if (duration && duration <= 0) {
				errors.push(`Group lesson ${groupLesson?.groupName || `Group lesson ${index + 1}`}: Duration must be positive.`)
			}
		}
	});

	// Break validation
	(breaks || []).forEach((breakTime, index) => {
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
	const totalCapacity = (teachers || []).reduce((sum, teacher) => {
		return sum + (teacher.maxLessonsPerDay * days)
	}, 0)

	// Calculate total demand
	const totalDemand = (students || []).reduce((sum, student) => {
		return sum + student.desiredLessons
	}, 0)
	
	// Calculate availability overlap score
	let overlapScore: number = 0
	const teacherList = Array.isArray(teachers) ? teachers : []
	const studentList = Array.isArray(students) ? students : []
	teacherList.forEach(teacher => {
		studentList.forEach(student => {
			const availability = teacher.availability || []
			const studentAvailability = student.availability || []
			availability.forEach(tAvail => {
				studentAvailability.forEach(sAvail => {
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
	couples: Couple[] = [],
	groupLessons: GroupLesson[] = [],
	_breaks: string[] = DEFAULT_BREAKS,
	daySchedule: DaySchedule = DEFAULT_DAY_SCHEDULE,
	config: TimetableConfig = { lessonDuration: DEFAULT_SETTINGS.lessonDuration, studentBreakAfter: DEFAULT_SETTINGS.studentBreakAfter, teacherBreakAfter: DEFAULT_SETTINGS.teacherBreakAfter }
): { date: string; lessons: TimetableLesson[]; error?: string; warning?: string } {
	// Validate configuration first
	const validation = validateTimetableConfiguration(date, date, teachers, students, couples, groupLessons, _breaks)
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
	const coupleLessonsCount: Record<string, number> = {}
	const groupLessonsCount: Record<string, number> = {} // groupName -> count

	const studentList = Array.isArray(students) ? students : []
	const teacherList = Array.isArray(teachers) ? teachers : []
	studentList.forEach((s) => {
		studentLessonsCount[s.name] = 0
		studentLastTeacher[s.name] = null
		studentTeacherLessonsCount[s.name] = {}
		teacherList.forEach((t) => {
			studentTeacherLessonsCount[s.name][t.name] = 0
		})
	});
	(couples || []).forEach((c) => {
		coupleLessonsCount[c.name] = 0
	});
	(groupLessons || []).forEach((g) => {
		groupLessonsCount[g.groupName] = 0
	});
	(teachers || []).forEach((t) => {
		teacherCooldown[t.name] = 0
	});

	// Build all possible lesson slots, respecting default breaks
	const allSlots: { start: Date; end: Date; duration: number }[] = []
	const dayStart = timeStringToDate(date, daySchedule.start)
	const dayEnd = timeStringToDate(date, daySchedule.end)
	
	// Collect all availability windows from all teachers
	const allAvailabilityWindows: Array<{ start: Date; end: Date }> = []
	for (const teacher of teachers) {
		for (const availability of teacher.availability) {
			try {
				const [aStart, aEnd] = availability.split("-")
				const startTime = timeStringToDate(date, aStart.trim())
				const endTime = timeStringToDate(date, aEnd.trim())
				if (startTime < endTime && startTime < dayEnd && endTime > dayStart) {
					allAvailabilityWindows.push({
						start: startTime < dayStart ? dayStart : startTime,
						end: endTime > dayEnd ? dayEnd : endTime
					})
				}
			} catch (err) {
				// Skip invalid availability windows
				continue
			}
		}
	}
	
	// If no teacher availability found, use full day
	if (allAvailabilityWindows.length === 0) {
		allAvailabilityWindows.push({ start: dayStart, end: dayEnd })
	}
	
	// Generate slots for each availability window
	const slotMinutes = 15 // Use 15-minute increments for slot generation
	for (const window of allAvailabilityWindows) {
		let slotStart = window.start
		
		while (slotStart < window.end) {
			const slotEnd = addMinutes(slotStart, config.lessonDuration)
			if (slotEnd > window.end) break

			// Check if this slot overlaps with any default break
			const overlappingBreak = _breaks.find((b) => {
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
					// Skip this break and continue
					slotStart = addMinutes(slotStart, slotMinutes)
				}
			} else {
				// Only add slots that don't overlap with breaks and fit within the window
				if (slotStart >= window.start && slotEnd <= window.end) {
					allSlots.push({ start: slotStart, end: slotEnd, duration: config.lessonDuration })
				}
				slotStart = addMinutes(slotStart, slotMinutes) // Use smaller increments for more flexibility
			}
		}
	}
	
	// Sort slots by start time
	allSlots.sort((a, b) => a.start.getTime() - b.start.getTime())

	// Schedule group lessons first (highest priority)
	for (const groupLesson of groupLessons) {
		// Check if we've met the target for this group (simplified for single day)
		if (groupLessonsCount[groupLesson.groupName] >= groupLesson.lessonsTarget.count) {
			continue
		}

		// Check if we have static time slot
		if (groupLesson.staticTimeSlot) {
			const { startTime, duration: staticDuration } = groupLesson.staticTimeSlot
			const lessonDuration = groupLesson.duration || staticDuration || config.lessonDuration
			const lessonStart = timeStringToDate(date, startTime)
			const lessonEnd = addMinutes(lessonStart, lessonDuration)

			// Check if static time is available
			const isAvailable = !timetable.some(lesson =>
				isOverlapping(lessonStart, lessonEnd, new Date(lesson.start), new Date(lesson.end))
			)

			if (isAvailable) {
				// Check teacher availability
				const availableTeacher = groupLesson.teachers.find(teacherName => {
					const teacher = teachers.find(t => t.name === teacherName)
					if (!teacher) return false

					// Check teacher availability for this time
					const isAvailable = teacher.availability.some((a) => {
						const [aStart, aEnd] = a.split("-")
						const startTime = timeStringToDate(date, aStart)
						const endTime = timeStringToDate(date, aEnd)
						return lessonStart >= startTime && lessonEnd <= endTime
					}) && teacherCooldown[teacherName] === 0
					
					if (!isAvailable) return false
					
					// Check if teacher is already scheduled for another lesson at this time
					const hasConflict = timetable.some((l) => {
						if (!isOverlapping(lessonStart, lessonEnd, new Date(l.start), new Date(l.end))) {
							return false
						}
						// Check if teacher is in an individual or couple lesson
						if (l.teacher === teacherName) {
							return true
						}
						// Check if teacher is in another group lesson
						if (l.lessonType === 'group' && l.teachers && Array.isArray(l.teachers)) {
							return l.teachers.includes(teacherName)
						}
						return false
					})
					
					return !hasConflict
				})

				if (availableTeacher) {
					// Check all participants are available
					const allParticipantsAvailable = groupLesson.participants.every(couple => {
						// Check day-specific unavailability first
						if (couple.unavailability && isTimeUnavailableOnDay(couple.unavailability, date, lessonStart, lessonEnd)) {
							return false
						}
						return couple.availability.some((a) => {
							const [aStart, aEnd] = a.split("-")
							const startTime = timeStringToDate(date, aStart)
							const endTime = timeStringToDate(date, aEnd)
							return lessonStart >= startTime && lessonEnd <= endTime
						}) &&
						!timetable.some(lesson => {
							if (!isOverlapping(lessonStart, lessonEnd, new Date(lesson.start), new Date(lesson.end))) {
								return false
							}
							// Check if participant has an individual lesson
							if (lesson.student === couple.name) {
								return true
							}
							// Check if participant is in another couple lesson
							if (lesson.couple === couple.name) {
								return true
							}
							// Check if participant is in another group lesson
							if (lesson.couples && Array.isArray(lesson.couples) && lesson.couples.includes(couple.name)) {
								return true
							}
							return false
						})
					})

					if (allParticipantsAvailable) {
						// Schedule the group lesson
						timetable.push({
							start: lessonStart.toISOString(),
							end: lessonEnd.toISOString(),
							teachers: groupLesson.teachers,
							teacher: availableTeacher, // primary teacher
							couples: groupLesson.participants.map(p => p.name),
							room: groupLesson.preferredRoom || teachers.find(t => t.name === availableTeacher)?.room || null,
							type: "lesson",
							lessonType: "group",
							duration: lessonDuration,
							groupName: groupLesson.groupName,
							student: null,
						})

						// Update count based on timeScope
						if (groupLesson.lessonsTarget.timeScope === 'timetable') {
							groupLessonsCount[groupLesson.groupName] = (groupLessonsCount[groupLesson.groupName] || 0) + 1
						} else {
							localGroupLessonsCount[groupLesson.groupName] = (localGroupLessonsCount[groupLesson.groupName] || 0) + 1
						}
						teacherCooldown[availableTeacher] = 1 // Simple cooldown

						// Update participant lesson counts
						groupLesson.participants.forEach(couple => {
							coupleLessonsCount[couple.name]++
						})
					}
				}
			}
		} else {
			// Automatic scheduling - find available slot
			for (const slot of allSlots) {
				// Skip if slot is already taken
				if (timetable.some(lesson => isOverlapping(slot.start, slot.end, new Date(lesson.start), new Date(lesson.end)))) {
					continue
				}

				// Find available teacher
				const availableTeacher = groupLesson.teachers.find(teacherName => {
					const teacher = teachers.find(t => t.name === teacherName)
					if (!teacher || teacherCooldown[teacherName] > 0) return false

					const isAvailable = teacher.availability.some((a) => {
						const [aStart, aEnd] = a.split("-")
						const startTime = timeStringToDate(date, aStart)
						const endTime = timeStringToDate(date, aEnd)
						return slot.start >= startTime && slot.end <= endTime
					})
					
					if (!isAvailable) return false
					
					// Check if teacher is already scheduled for another lesson at this time
					const hasConflict = timetable.some((l) => {
						if (!isOverlapping(slot.start, slot.end, new Date(l.start), new Date(l.end))) {
							return false
						}
						// Check if teacher is in an individual or couple lesson
						if (l.teacher === teacherName) {
							return true
						}
						// Check if teacher is in another group lesson
						if (l.lessonType === 'group' && l.teachers && Array.isArray(l.teachers)) {
							return l.teachers.includes(teacherName)
						}
						return false
					})
					
					return !hasConflict
				})

				if (availableTeacher) {
					// Check all participants are available
					const allParticipantsAvailable = groupLesson.participants.every(couple => {
						// Check day-specific unavailability first
						if (couple.unavailability && isTimeUnavailableOnDay(couple.unavailability, date, slot.start, slot.end)) {
							return false
						}
						return couple.availability.some((a) => {
							const [aStart, aEnd] = a.split("-")
							const startTime = timeStringToDate(date, aStart)
							const endTime = timeStringToDate(date, aEnd)
							return slot.start >= startTime && slot.end <= endTime
						}) &&
						!timetable.some(lesson => {
							if (!isOverlapping(slot.start, slot.end, new Date(lesson.start), new Date(lesson.end))) {
								return false
							}
							// Check if participant has an individual lesson
							if (lesson.student === couple.name) {
								return true
							}
							// Check if participant is in another couple lesson
							if (lesson.couple === couple.name) {
								return true
							}
							// Check if participant is in another group lesson
							if (lesson.couples && Array.isArray(lesson.couples) && lesson.couples.includes(couple.name)) {
								return true
							}
							return false
						})
					})

					if (allParticipantsAvailable) {
						// Use custom duration if set, otherwise use slot duration
						const lessonDuration = groupLesson.duration || slot.duration
						const lessonEnd = addMinutes(slot.start, lessonDuration)
						
						// Schedule the group lesson
						timetable.push({
							start: slot.start.toISOString(),
							end: lessonEnd.toISOString(),
							teachers: groupLesson.teachers,
							teacher: availableTeacher,
							couples: groupLesson.participants.map(p => p.name),
							room: groupLesson.preferredRoom || teachers.find(t => t.name === availableTeacher)?.room || null,
							type: "lesson",
							lessonType: "group",
							duration: lessonDuration,
							groupName: groupLesson.groupName,
							student: null,
						})

						// Update count based on timeScope
						if (groupLesson.lessonsTarget.timeScope === 'timetable') {
							groupLessonsCount[groupLesson.groupName] = (groupLessonsCount[groupLesson.groupName] || 0) + 1
						} else {
							localGroupLessonsCount[groupLesson.groupName] = (localGroupLessonsCount[groupLesson.groupName] || 0) + 1
						}
						teacherCooldown[availableTeacher] = 1

						// Update participant lesson counts
						groupLesson.participants.forEach(couple => {
							coupleLessonsCount[couple.name]++
						})

						break // Found a slot, move to next group lesson
					}
				}
			}
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

			// Check if teacher is already scheduled for another lesson at this time
			const teacherConflict = timetable.some((l) => {
				if (!isOverlapping(slot.start, slot.end, new Date(l.start), new Date(l.end))) {
					return false
				}
				// Check if teacher is in an individual or couple lesson
				if (l.teacher === teacher.name) {
					return true
				}
				// Check if teacher is in a group lesson (via teachers array)
				if (l.lessonType === 'group' && l.teachers && Array.isArray(l.teachers)) {
					return l.teachers.includes(teacher.name)
				}
				return false
			})
			if (teacherConflict) continue

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
					const hasBreakBetween = _breaks.some((b) => {
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
					const upcomingBreak = _breaks.find((b) => {
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
					const hasDefaultBreak = _breaks.some((b) => {
						const breakTime = parseBreakTime(b, date)
						if (!breakTime) return false
						// Check if the break starts within 90 minutes of the last lesson end (more lenient)
						return Math.abs(breakTime.start.getTime() - lastLessonEnd.getTime()) <= 90 * 60 * 1000
					})
					
					// If no default break, require a gap of at least one lesson duration
					if (!hasDefaultBreak) {
						const requiredBreakStart = new Date(lastLessonEnd.getTime() + config.lessonDuration * 60 * 1000)
						if (slot.start.getTime() < requiredBreakStart.getTime()) {
							continue // Teacher needs a break
						}
					} else {
						// If there's a default break, check if the current slot is after the break
						const defaultBreak = _breaks.find((b) => {
							const breakTime = parseBreakTime(b, date)
							if (!breakTime) return false
							return Math.abs(breakTime.start.getTime() - lastLessonEnd.getTime()) <= 90 * 60 * 1000
						})
						
						if (defaultBreak) {
							const breakTime = parseBreakTime(defaultBreak, date)
							if (breakTime) {
								// Only allow lessons after the default break ends (allow lessons that start exactly when break ends)
								if (slot.start.getTime() < breakTime.end.getTime()) {
									continue // Teacher needs to wait for break to end
								}
								
								// If we're past the default break, allow the lesson (consecutive count is reset after break)
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

				// Check day-specific unavailability first
				if (s.unavailability && isTimeUnavailableOnDay(s.unavailability, date, slot.start, slot.end)) {
					return false
				}

				// Availability
				if (!s.availability.some((a) => {
					const [aStart, aEnd] = a.split("-")
					const startTime = timeStringToDate(date, aStart)
					const endTime = timeStringToDate(date, aEnd)
					return slot.start >= startTime && slot.end <= endTime
				})) return false

				// Check overlapping lessons (both individual and group lessons)
				const conflict = timetable.some((l) => {
					if (!isOverlapping(slot.start, slot.end, new Date(l.start), new Date(l.end))) {
						return false
					}
					// Check if student is in an individual lesson
					if (l.student === s.name) {
						return true
					}
					// Check if student is in a group lesson (via couples array)
					if (l.lessonType === 'group' && l.couples && Array.isArray(l.couples)) {
						return l.couples.includes(s.name)
					}
					// Check if student is in a couple lesson
					if (l.lessonType === 'couple' && l.couple === s.name) {
						return true
					}
					return false
				})
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
						const hasBreakBetween = _breaks.some((b) => {
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
						const hasDefaultBreak = _breaks.some((b) => {
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
								return false
							}
						} else {
							// If there's a default break, check if the current slot is after the break
							const defaultBreak = _breaks.find((b) => {
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
									return false
								}
								
								// If we're past the default break, allow the lesson (consecutive count is reset after break)
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
					const hasDefaultBreak = _breaks.some((b) => {
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
					const hasBreakBetween = _breaks.some((b) => {
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
					const hasDefaultBreakAtSameTime = _breaks.some((b) => {
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
						}
					} else {
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
	config: TimetableConfig = { lessonDuration: DEFAULT_SETTINGS.lessonDuration, studentBreakAfter: DEFAULT_SETTINGS.studentBreakAfter, teacherBreakAfter: DEFAULT_SETTINGS.teacherBreakAfter },
	groupLessons: GroupLesson[] = []
): MultiDayTimetableResult {
	
	// Validate configuration first
	const validation = validateTimetableConfiguration(startDate, endDate, teachers, students, [], groupLessons, breaks)
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
	// Track lessons scheduled per day per student (for distribution logic)
	const studentLessonsPerDay: Record<string, Record<number, number>> = {} // student -> dayIndex -> count
	
	students.forEach(s => {
		studentProgress[s.name] = { scheduled: 0, desired: s.desiredLessons }
		studentTeacherProgress[s.name] = {}
		studentLessonsPerDay[s.name] = {}
		teachers.forEach(t => {
			studentTeacherProgress[s.name][t.name] = 0
		})
		studentState[s.name] = {
			consecutive: 0,
			lastTeacher: null,
			lastLessonTime: null
		}
	})
	
	// Track group lesson counts across all days (for timetable timeScope)
	// Use a unique key for each group lesson configuration to handle multiple configs with same groupName
	const groupLessonsCount: Record<string, number> = {}
	// Track planned distribution for group lessons that have distributeAcrossDays enabled
	const groupLessonPlannedPerDay: Record<string, number[]> = {}
	if (groupLessons && Array.isArray(groupLessons)) {
		groupLessons.forEach((g: GroupLesson, index: number) => {
			// Only track counts for timetable timeScope
			if (g.lessonsTarget.timeScope === 'timetable') {
				const key = getGroupLessonKey(g, index)
				groupLessonsCount[key] = 0
				
				// Pre-calculate distribution across days if distributeAcrossDays is enabled
				// and it's not a static time slot (static slots have their own day logic)
				if (g.distributeAcrossDays && !g.staticTimeSlot) {
					const totalLessons = g.lessonsTarget.count
					const totalDays = dates.length
					const lessonsPerDay: number[] = []
					
					if (totalDays > 0) {
						// Distribute lessons evenly across days
						const basePerDay = Math.floor(totalLessons / totalDays)
						const remainder = totalLessons % totalDays
						
						for (let d = 0; d < totalDays; d++) {
							// Add 1 extra lesson to the first 'remainder' days
							lessonsPerDay.push(basePerDay + (d < remainder ? 1 : 0))
						}
					}
					
					groupLessonPlannedPerDay[key] = lessonsPerDay
				}
			}
		})
	}
	
	// Pre-calculate lesson days for each student when distribution is enabled
	// This ensures lessons are spread across the entire period, not just the first days
	const studentLessonDays: Record<string, number[]> = {}
	if (config.distributeLessons) {
		students.forEach(s => {
			const totalLessons = s.desiredLessons
			const totalDays = dates.length
			
			if (totalLessons <= 0 || totalDays <= 0) {
				studentLessonDays[s.name] = []
				return
			}
			
			// Calculate which days this student should have lessons
			// Spread lessons evenly across all available days
			const lessonDays: number[] = []
			
			if (totalLessons >= totalDays) {
				// More lessons than days - schedule on all days
				for (let d = 0; d < totalDays; d++) {
					lessonDays.push(d)
				}
			} else {
				// Fewer lessons than days - spread them out evenly
				// Calculate spacing between lessons
				const spacing = totalDays / totalLessons
				for (let i = 0; i < totalLessons; i++) {
					// Calculate the ideal day for this lesson
					// Use floor to get the day index, offset by half spacing to center lessons
					const idealDay = Math.floor(i * spacing + spacing / 2)
					lessonDays.push(Math.min(idealDay, totalDays - 1))
				}
			}
			
			studentLessonDays[s.name] = lessonDays
		})
	}
	
	// Generate timetable for each day
	for (let dayIndex = 0; dayIndex < dates.length; dayIndex++) {
		const date = dates[dayIndex]
		const remainingDays = dates.length - dayIndex
		
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
			
			// When distributeLessons is enabled, check if today is a scheduled lesson day for this student
			let lessonsForToday = remainingTotalLessons
			if (config.distributeLessons && remainingDays > 0) {
				const scheduledDays = studentLessonDays[s.name] || []
				const lessonsScheduledSoFar = studentProgress[s.name].scheduled
				
				if (scheduledDays.length > 0) {
					// Calculate which cycle we're in based on how many lessons have been scheduled
					// Each cycle has scheduledDays.length lessons (one per scheduled day)
					const cycleNumber = Math.floor(lessonsScheduledSoFar / scheduledDays.length)
					const lessonsInCurrentCycle = lessonsScheduledSoFar % scheduledDays.length
					
					// Check if today is a scheduled day in the distribution pattern
					const isScheduledDay = scheduledDays.includes(dayIndex)
					
					// How many lessons should be scheduled by this point in the current cycle
					const scheduledDaysPassedInCycle = scheduledDays.filter(d => d <= dayIndex).length
					
					// Calculate lessons for today
					// When distribution is enabled, we want to spread lessons evenly across days
					// If desiredLessons > number of days, we schedule multiple lessons on some days
					if (isScheduledDay) {
						// Calculate how many lessons should be scheduled on this day total
						// For example, if we need 10 lessons over 8 days:
						// - lessonsPerDayBase = floor(10/8) = 1
						// - extraLessons = 10 % 8 = 2
						// - Days 0 and 1 (positions 0 and 1) get 2 lessons each
						// - Days 2-7 (positions 2-7) get 1 lesson each
						const lessonsPerDayBase = Math.floor(s.desiredLessons / scheduledDays.length)
						const extraLessons = s.desiredLessons % scheduledDays.length
						const dayPositionInCycle = scheduledDays.indexOf(dayIndex)
						const totalLessonsForThisDay = lessonsPerDayBase + (dayPositionInCycle < extraLessons ? 1 : 0)
						
						// Get how many lessons have actually been scheduled on this day
						const lessonsScheduledOnThisDay = studentLessonsPerDay[s.name][dayIndex] || 0
						
						// Calculate how many more lessons we need on this day
						const lessonsNeededOnThisDay = Math.max(0, totalLessonsForThisDay - lessonsScheduledOnThisDay)
						
						// Set lessonsForToday to the number of lessons needed on this day
						lessonsForToday = Math.min(remainingTotalLessons, lessonsNeededOnThisDay)
					} else {
						// Not a scheduled day - only schedule if we're behind in the current cycle
						const behindBy = scheduledDaysPassedInCycle - lessonsInCurrentCycle
						lessonsForToday = behindBy > 0 ? Math.min(remainingTotalLessons, behindBy) : 0
					}
				} else {
					// No scheduled days (shouldn't happen with distributeLessons, but handle gracefully)
					lessonsForToday = remainingTotalLessons
				}
			}
			
			let remainingTeacherLessons: Record<string, number> | undefined
			if (s.teacherLessons) {
				remainingTeacherLessons = Object.entries(s.teacherLessons).reduce<Record<string, number>>((acc, [teacherName, required]) => {
					const already = studentTeacherProgress[s.name]?.[teacherName] || 0
					const remaining = Math.max(0, required - already)
					if (remaining > 0) {
						// For teacher-specific lessons, also respect the distribution
						// Limit to proportional amount based on overall lessons for today
						const proportion = lessonsForToday > 0 && remainingTotalLessons > 0 
							? lessonsForToday / remainingTotalLessons 
							: 1
						const lessonsForThisTeacher = Math.max(1, Math.ceil(remaining * proportion))
						acc[teacherName] = Math.min(remaining, lessonsForThisTeacher)
					}
					return acc
				}, {})
			}

			return {
				...s,
				desiredLessons: lessonsForToday,
				teacherLessons: remainingTeacherLessons
			}
		}).filter(s => s.desiredLessons > 0 && isStudentAvailableOnDate(s, date))
		
		
		// Generate timetable with cross-day state tracking
	const scheduleForDay = daySchedules[date] ?? DEFAULT_DAY_SCHEDULE
		const dayResult = generateTimetableWithState(date, teachers, dayStudents, breaks, scheduleForDay, studentState, config, groupLessons, groupLessonsCount, groupLessonPlannedPerDay, dayIndex)
		// Note: groupLessonsCount for timetable timeScope is updated inside generateTimetableWithState
		
		// Update progress
		dayResult.lessons.forEach(lesson => {
			if (lesson.student && lesson.type === "lesson") {
				studentProgress[lesson.student].scheduled++
				// Track lessons per day for distribution logic
				if (!studentLessonsPerDay[lesson.student][dayIndex]) {
					studentLessonsPerDay[lesson.student][dayIndex] = 0
				}
				studentLessonsPerDay[lesson.student][dayIndex]++
				if (lesson.teacher) {
					studentTeacherProgress[lesson.student][lesson.teacher] = (studentTeacherProgress[lesson.student][lesson.teacher] || 0) + 1
				}
			}
		})
		
		
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
					config,
					[], // groupLessons - not used in rescheduling
					{} // groupLessonsCount - not used in rescheduling
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

// Helper function to create unique key for group lesson configuration
// This allows multiple group lessons with same groupName to be tracked separately
function getGroupLessonKey(g: GroupLesson, index: number): string {
	// Create unique key: groupName + staticTimeSlot info (if present) + index
	if (g.staticTimeSlot) {
		return `${g.groupName}__static_${g.staticTimeSlot.dayOfWeek}_${g.staticTimeSlot.startTime}_${index}`
	}
	return `${g.groupName}__auto_${index}`
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
	config: TimetableConfig = { lessonDuration: DEFAULT_SETTINGS.lessonDuration, studentBreakAfter: DEFAULT_SETTINGS.studentBreakAfter, teacherBreakAfter: DEFAULT_SETTINGS.teacherBreakAfter },
	groupLessons: GroupLesson[] = [],
	groupLessonsCount: Record<string, number> = {},
	groupLessonPlannedPerDay: Record<string, number[]> = {},
	dayIndex: number = 0
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

	// Initialize group lesson tracking (only for non-timetable timeScope, timetable is tracked in parent)
	const localGroupLessonsCount: Record<string, number> = {}
	const coupleLessonsCount: Record<string, number> = {}
	if (groupLessons && Array.isArray(groupLessons)) {
		groupLessons.forEach((g: GroupLesson) => {
			// Only track locally for week/month/weekend timeScope
			if (g.lessonsTarget.timeScope !== 'timetable') {
				localGroupLessonsCount[g.groupName] = 0
			}
		})
	}

	// Build all possible lesson slots, skipping explicit breaks
	const allSlots: { start: Date; end: Date; duration: number }[] = []
	const dayStart = timeStringToDate(date, daySchedule.start)
	const dayEnd = timeStringToDate(date, daySchedule.end)
	
	// Collect all availability windows from all teachers
	const allAvailabilityWindows: Array<{ start: Date; end: Date }> = []
	for (const teacher of teachers) {
		for (const availability of teacher.availability) {
			try {
				const [aStart, aEnd] = availability.split("-")
				const startTime = timeStringToDate(date, aStart.trim())
				const endTime = timeStringToDate(date, aEnd.trim())
				if (startTime < endTime && startTime < dayEnd && endTime > dayStart) {
					allAvailabilityWindows.push({
						start: startTime < dayStart ? dayStart : startTime,
						end: endTime > dayEnd ? dayEnd : endTime
					})
				}
			} catch (err) {
				// Skip invalid availability windows
				continue
			}
		}
	}
	
	// If no teacher availability found, use full day
	if (allAvailabilityWindows.length === 0) {
		allAvailabilityWindows.push({ start: dayStart, end: dayEnd })
	}
	
	// Generate slots for each availability window
	const slotMinutes = 15 // Use 15-minute increments for slot generation
	for (const window of allAvailabilityWindows) {
		let slotStart = window.start
		
		while (slotStart < window.end) {
			const slotEnd = addMinutes(slotStart, config.lessonDuration)
			if (slotEnd > window.end) break

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
					// Skip this break and continue
					slotStart = addMinutes(slotStart, slotMinutes)
				}
			} else {
				// Only add slots that don't overlap with breaks and fit within the window
				if (slotStart >= window.start && slotEnd <= window.end) {
					allSlots.push({ start: slotStart, end: slotEnd, duration: config.lessonDuration })
				}
				slotStart = addMinutes(slotStart, slotMinutes) // Use smaller increments for more flexibility
			}
		}
	}
	
	// Sort slots by start time
	allSlots.sort((a, b) => a.start.getTime() - b.start.getTime())

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

	// Schedule group lessons first (highest priority)
	for (let groupIndex = 0; groupIndex < groupLessons.length; groupIndex++) {
		const groupLesson = groupLessons[groupIndex]
		// Calculate target based on time scope
		// Parse date as local time to avoid timezone issues
		const dateObj = parse(date, 'yyyy-MM-dd', new Date())
		const dayOfWeek = dateObj.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
		let shouldSchedule = false
		
		if (groupLesson.lessonsTarget.timeScope === 'weekend') {
			// Only schedule on Saturday or Sunday
			shouldSchedule = dayOfWeek === 'saturday' || dayOfWeek === 'sunday'
		} else if (groupLesson.lessonsTarget.timeScope === 'week') {
			// Schedule any day of the week
			shouldSchedule = true
		} else if (groupLesson.lessonsTarget.timeScope === 'month') {
			// Schedule any day (monthly target will be distributed)
			shouldSchedule = true
		} else if (groupLesson.lessonsTarget.timeScope === 'timetable') {
			// Schedule within the timetable date range
			shouldSchedule = true
		}
		
		if (!shouldSchedule) continue
		
		// Get unique key for this group lesson configuration
		const groupLessonKey = getGroupLessonKey(groupLesson, groupIndex)
		
		// Check if we've met the target for this group
		// For timetable timeScope, use the cross-day count; for others, use local count
		const countToCheck = groupLesson.lessonsTarget.timeScope === 'timetable' 
			? (groupLessonsCount[groupLessonKey] || 0)
			: (localGroupLessonsCount[groupLesson.groupName] || 0)
		if (countToCheck >= groupLesson.lessonsTarget.count) {
			continue
		}

		// Check if we have static time slot
		if (groupLesson.staticTimeSlot) {
			const staticDay = groupLesson.staticTimeSlot.dayOfWeek
			// Use the same dateObj to ensure consistent day-of-week calculation
			const currentDayName = dayOfWeek
			
			// Only schedule if the day matches
			if (staticDay !== currentDayName) {
				continue
			}
			
			const { startTime, duration: staticDuration } = groupLesson.staticTimeSlot
			const lessonDuration = groupLesson.duration || staticDuration || config.lessonDuration
			const lessonStart = timeStringToDate(date, startTime)
			const lessonEnd = addMinutes(lessonStart, lessonDuration)

			// Check if static time is available
			const isAvailable = !timetable.some(lesson =>
				isOverlapping(lessonStart, lessonEnd, new Date(lesson.start), new Date(lesson.end))
			)

			if (isAvailable) {
				// Check teacher availability
				const availableTeacher = groupLesson.teachers.find(teacherName => {
					const teacher = teachers.find(t => t.name === teacherName)
					if (!teacher) return false

					// Check teacher availability for this time
					const isAvailable = teacher.availability.some((a) => {
						const [aStart, aEnd] = a.split("-")
						const startTime = timeStringToDate(date, aStart)
						const endTime = timeStringToDate(date, aEnd)
						return lessonStart >= startTime && lessonEnd <= endTime
					}) && teacherCooldown[teacherName] === 0
					
					if (!isAvailable) return false
					
					// Check if teacher is already scheduled for another lesson at this time
					const hasConflict = timetable.some((l) => {
						if (!isOverlapping(lessonStart, lessonEnd, new Date(l.start), new Date(l.end))) {
							return false
						}
						// Check if teacher is in an individual or couple lesson
						if (l.teacher === teacherName) {
							return true
						}
						// Check if teacher is in another group lesson
						if (l.lessonType === 'group' && l.teachers && Array.isArray(l.teachers)) {
							return l.teachers.includes(teacherName)
						}
						return false
					})
					
					return !hasConflict
				})

				if (availableTeacher) {
					// Check all participants are available
					const allParticipantsAvailable = groupLesson.participants.every(couple => {
						// Check day-specific unavailability first
						if (couple.unavailability && isTimeUnavailableOnDay(couple.unavailability, date, lessonStart, lessonEnd)) {
							return false
						}
						return couple.availability.some((a) => {
							const [aStart, aEnd] = a.split("-")
							const startTime = timeStringToDate(date, aStart)
							const endTime = timeStringToDate(date, aEnd)
							return lessonStart >= startTime && lessonEnd <= endTime
						}) &&
						!timetable.some(lesson => {
							if (!isOverlapping(lessonStart, lessonEnd, new Date(lesson.start), new Date(lesson.end))) {
								return false
							}
							// Check if participant has an individual lesson
							if (lesson.student === couple.name) {
								return true
							}
							// Check if participant is in another couple lesson
							if (lesson.couple === couple.name) {
								return true
							}
							// Check if participant is in another group lesson
							if (lesson.couples && Array.isArray(lesson.couples) && lesson.couples.includes(couple.name)) {
								return true
							}
							return false
						})
					})

					if (allParticipantsAvailable) {
						// Schedule the group lesson
						timetable.push({
							start: lessonStart.toISOString(),
							end: lessonEnd.toISOString(),
							teachers: groupLesson.teachers,
							teacher: availableTeacher, // primary teacher
							couples: groupLesson.participants.map(p => p.name),
							room: groupLesson.preferredRoom || teachers.find(t => t.name === availableTeacher)?.room || null,
							type: "lesson",
							lessonType: "group",
							duration: lessonDuration,
							groupName: groupLesson.groupName,
							student: null,
						})

						// Update count based on timeScope
						if (groupLesson.lessonsTarget.timeScope === 'timetable') {
							groupLessonsCount[groupLessonKey] = (groupLessonsCount[groupLessonKey] || 0) + 1
						} else {
							localGroupLessonsCount[groupLesson.groupName] = (localGroupLessonsCount[groupLesson.groupName] || 0) + 1
						}
						teacherCooldown[availableTeacher] = 1 // Simple cooldown

						// Update participant lesson counts
						groupLesson.participants.forEach(couple => {
							coupleLessonsCount[couple.name] = (coupleLessonsCount[couple.name] || 0) + 1
						})
					}
				}
			}
		} else {
			// Automatic scheduling - find available slots until target is met
			for (const slot of allSlots) {
				// Decrement teacher cooldowns at the start of each slot iteration
				for (const t of Object.keys(teacherCooldown)) {
					if (teacherCooldown[t] > 0) teacherCooldown[t]--
				}
				
				// Check if we've already met the target for this group lesson on this day
				// For timetable timeScope, check cross-day count; for others, check local count
				const currentCount = groupLesson.lessonsTarget.timeScope === 'timetable' 
					? (groupLessonsCount[groupLessonKey] || 0)
					: (localGroupLessonsCount[groupLesson.groupName] || 0)
				
				if (currentCount >= groupLesson.lessonsTarget.count) {
					break // Target met, move to next group lesson
				}
				
				// Check if we've hit the daily limit for this group lesson (when distributeAcrossDays is enabled)
				const plannedPerDay = groupLessonPlannedPerDay[groupLessonKey]
				if (plannedPerDay && plannedPerDay.length > dayIndex) {
					// Count how many lessons we've scheduled today for this group
					const lessonsScheduledToday = timetable.filter(
						l => l.lessonType === 'group' && l.groupName === groupLesson.groupName
					).length
					const maxForToday = plannedPerDay[dayIndex] || 0
					
					if (lessonsScheduledToday >= maxForToday) {
						break // Daily limit reached, move to next group lesson
					}
				}
				
				// Find available teacher
				const availableTeacher = groupLesson.teachers.find(teacherName => {
					const teacher = teachers.find(t => t.name === teacherName)
					if (!teacher || teacherCooldown[teacherName] > 0) return false

					const isAvailable = teacher.availability.some((a) => {
						const [aStart, aEnd] = a.split("-")
						const startTime = timeStringToDate(date, aStart)
						const endTime = timeStringToDate(date, aEnd)
						return slot.start >= startTime && slot.end <= endTime
					})
					
					if (!isAvailable) return false
					
					// Check if teacher is already scheduled for another lesson at this time
					const hasConflict = timetable.some((l) => {
						if (!isOverlapping(slot.start, slot.end, new Date(l.start), new Date(l.end))) {
							return false
						}
						// Check if teacher is in an individual or couple lesson
						if (l.teacher === teacherName) {
							return true
						}
						// Check if teacher is in another group lesson
						if (l.lessonType === 'group' && l.teachers && Array.isArray(l.teachers)) {
							return l.teachers.includes(teacherName)
						}
						return false
					})
					
					return !hasConflict
				})

				if (availableTeacher) {
					// Check all participants are available
					const allParticipantsAvailable = groupLesson.participants.every(couple => {
						// Check day-specific unavailability first
						if (couple.unavailability && isTimeUnavailableOnDay(couple.unavailability, date, slot.start, slot.end)) {
							return false
						}
						return couple.availability.some((a) => {
							const [aStart, aEnd] = a.split("-")
							const startTime = timeStringToDate(date, aStart)
							const endTime = timeStringToDate(date, aEnd)
							return slot.start >= startTime && slot.end <= endTime
						}) &&
						!timetable.some(lesson => {
							if (!isOverlapping(slot.start, slot.end, new Date(lesson.start), new Date(lesson.end))) {
								return false
							}
							// Check if participant has an individual lesson
							if (lesson.student === couple.name) {
								return true
							}
							// Check if participant is in another couple lesson
							if (lesson.couple === couple.name) {
								return true
							}
							// Check if participant is in another group lesson
							if (lesson.couples && Array.isArray(lesson.couples) && lesson.couples.includes(couple.name)) {
								return true
							}
							return false
						})
					})

					if (allParticipantsAvailable) {
						// Use custom duration if set, otherwise use slot duration
						const lessonDuration = groupLesson.duration || slot.duration
						const lessonEnd = addMinutes(slot.start, lessonDuration)
						
						// Schedule the group lesson
						timetable.push({
							start: slot.start.toISOString(),
							end: lessonEnd.toISOString(),
							teachers: groupLesson.teachers,
							teacher: availableTeacher,
							couples: groupLesson.participants.map(p => p.name),
							room: groupLesson.preferredRoom || teachers.find(t => t.name === availableTeacher)?.room || null,
							type: "lesson",
							lessonType: "group",
							duration: lessonDuration,
							groupName: groupLesson.groupName,
							student: null,
						})

						// Update count based on timeScope
						if (groupLesson.lessonsTarget.timeScope === 'timetable') {
							groupLessonsCount[groupLessonKey] = (groupLessonsCount[groupLessonKey] || 0) + 1
						} else {
							localGroupLessonsCount[groupLesson.groupName] = (localGroupLessonsCount[groupLesson.groupName] || 0) + 1
						}
						teacherCooldown[availableTeacher] = 1

						// Update participant lesson counts
						groupLesson.participants.forEach(couple => {
							coupleLessonsCount[couple.name] = (coupleLessonsCount[couple.name] || 0) + 1
						})

						// Continue to next slot to try scheduling more lessons (don't break here)
						// The loop will check the count at the start of next iteration
					}
				}
			}
		}
	}

	// Schedule individual/couple lessons
	for (const slot of allSlots) {
		// CRITICAL: Skip this slot if it conflicts with any group lesson static time slot
		// Group lessons have absolute priority and should reserve their slots
		const conflictsWithGroupLesson = groupLessons.some((groupLesson, groupIndex) => {
			if (!groupLesson.staticTimeSlot) return false
			
			// Check if this group lesson should be scheduled today
			const dateObj = parse(date, 'yyyy-MM-dd', new Date())
			const dayOfWeek = dateObj.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
			
			// Check time scope
			let shouldSchedule = false
			if (groupLesson.lessonsTarget.timeScope === 'weekend') {
				shouldSchedule = dayOfWeek === 'saturday' || dayOfWeek === 'sunday'
			} else if (groupLesson.lessonsTarget.timeScope === 'week' || 
			           groupLesson.lessonsTarget.timeScope === 'month' || 
			           groupLesson.lessonsTarget.timeScope === 'timetable') {
				shouldSchedule = true
			}
			
			if (!shouldSchedule) return false
			
			// Check if day matches
			if (groupLesson.staticTimeSlot.dayOfWeek !== dayOfWeek) return false
			
			// Get unique key for this group lesson configuration
			const groupLessonKey = getGroupLessonKey(groupLesson, groupIndex)
			
			// Check if we've met the target (for timetable timeScope, use cross-day count)
			const countToCheck = groupLesson.lessonsTarget.timeScope === 'timetable' 
				? (groupLessonsCount[groupLessonKey] || 0)
				: (localGroupLessonsCount[groupLesson.groupName] || 0)
			if (countToCheck >= groupLesson.lessonsTarget.count) return false
			
			// Check if this slot overlaps with the group lesson's static time
			const { startTime, duration: staticDuration } = groupLesson.staticTimeSlot
			const lessonDuration = groupLesson.duration || staticDuration || config.lessonDuration
			const groupLessonStart = timeStringToDate(date, startTime)
			const groupLessonEnd = addMinutes(groupLessonStart, lessonDuration)
			
			return isOverlapping(slot.start, slot.end, groupLessonStart, groupLessonEnd)
		})
		
		if (conflictsWithGroupLesson) {
			continue // Skip this slot - it's reserved for a group lesson
		}
		
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

			// Check if teacher is already scheduled for another lesson at this time
			const teacherConflict = timetable.some((l) => {
				if (!isOverlapping(slot.start, slot.end, new Date(l.start), new Date(l.end))) {
					return false
				}
				// Check if teacher is in an individual or couple lesson
				if (l.teacher === teacher.name) {
					return true
				}
				// Check if teacher is in a group lesson (via teachers array)
				if (l.lessonType === 'group' && l.teachers && Array.isArray(l.teachers)) {
					return l.teachers.includes(teacher.name)
				}
				return false
			})
			if (teacherConflict) continue

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
									continue // Teacher needs to wait for break to end
								}
								
								// If we're past the default break, allow the lesson (consecutive count is reset after break)
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

				// Check day-specific unavailability first
				if (s.unavailability && isTimeUnavailableOnDay(s.unavailability, date, slot.start, slot.end)) {
					return false
				}

				// Availability
				if (!s.availability.some((a) => {
					const [aStart, aEnd] = a.split("-")
					const startTime = timeStringToDate(date, aStart)
					const endTime = timeStringToDate(date, aEnd)
					return slot.start >= startTime && slot.end <= endTime
				})) return false

				// Check overlapping lessons (both individual and group lessons)
				const conflict = timetable.some((l) => {
					if (!isOverlapping(slot.start, slot.end, new Date(l.start), new Date(l.end))) {
						return false
					}
					// Check if student is in an individual lesson
					if (l.student === s.name) {
						return true
					}
					// Check if student is in a group lesson (via couples array)
					if (l.lessonType === 'group' && l.couples && Array.isArray(l.couples)) {
						return l.couples.includes(s.name)
					}
					// Check if student is in a couple lesson
					if (l.lessonType === 'couple' && l.couple === s.name) {
						return true
					}
					return false
				})
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
									return false
								}
								
								// If we're past the default break, allow the lesson (consecutive count is reset after break)
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
						}
					} else {
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
				return null
			}
			return {
				start: breakTime.start.toISOString(),
				end: breakTime.end.toISOString(),
				duration: (breakTime.end.getTime() - breakTime.start.getTime()) / 60000,
			}
		}).filter(Boolean)

		normalizedBreaks.forEach(breakSlot => {
			if (!breakSlot) {
				return
			}
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