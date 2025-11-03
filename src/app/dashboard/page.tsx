'use client'

import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react'
import { addMinutes } from 'date-fns'
import { generateMultiDayTimetable, Teacher, Student, DEFAULT_BREAKS, MultiDayTimetableResult, validateTimetableConfiguration, ValidationResult, DaySchedule, DEFAULT_DAY_SCHEDULE, DayScheduleMap, updateTimetableWithNewBreaks } from './_utils/timetableAlgorithm'

// Import SETTINGS for validation
const SETTINGS = {
	studentBreakAfter: 4,     // max consecutive lessons before student must rest (matches algorithm settings)
	teacherBreakAfter: 4,     // max consecutive lessons before teacher must rest (matches algorithm settings)
}
import { Button, Input, Alert } from '@/components'
import { Calendar, Clock, Users, CheckCircle, AlertTriangle, RefreshCw, Plus, Trash2, Download, Upload, FileText, CalendarDays, School, Edit3, X } from 'lucide-react'
import { motion } from 'framer-motion'

type LessonCell = {
	start: string
	end: string
	teacher: string | null
	student: string | null
	room: string | null
	type: 'lesson' | 'break' | 'unused'
	duration: number
	breakType?: 'consecutive' | 'default'
}

// Weekly Timetable Types
type WeeklyLesson = {
	id: string
	name: string
	teacher: string
	room: string
	dayOfWeek: number // 0 = Sunday, 1 = Monday, etc.
	startTime: string // HH:MM format
	endTime: string // HH:MM format
	studentGroups: string[] // Array of student group names
	maxStudents: number
	description?: string
}

type WeeklySchedule = {
	id: string
	name: string
	season: string
	startDate: string // YYYY-MM-DD
	endDate: string // YYYY-MM-DD
	lessons: WeeklyLesson[]
	afterSchoolStart: string // Default after-school start time
	afterSchoolEnd: string // Default after-school end time
}

type StudentGroup = {
	id: string
	name: string
	students: string[]
	level: string
	ageRange: string
}

// Sample initial data used to populate the form. In a real app these would come from an API or database.
const createDefaultTeacher = (index: number): Teacher => ({
	name: `Teacher ${index + 1}`,
	availability: ["08:00-18:00"], // Full day availability to allow scheduling throughout the day
	maxLessonsPerDay: 8, // Increased to allow more lessons
	room: `Studio ${index + 1}`
})

const createDefaultStudent = (index: number, teachers: Teacher[]): Student => ({
	name: `Student ${index + 1}`,
	availability: ["08:00-18:00"],
	desiredLessons: 8, // Allow enough lessons to fill the day properly
	priority: 3,
	teacherLessons: Object.fromEntries(teachers.map(t => [t.name, 4])) as Record<string, number>, // 4 lessons per teacher to fill the day
	unavailableDates: []
})

const initialTeachers: Teacher[] = [createDefaultTeacher(0), createDefaultTeacher(1)]
const initialStudents: Student[] = [createDefaultStudent(0, initialTeachers)]
const initialBreaks = [...DEFAULT_BREAKS]
// Default day schedule will be created from timetableConfig
const initialDaySchedules: DayScheduleMap = {}

// Weekly Timetable Initial Data
const initialStudentGroups: StudentGroup[] = [
	{
		id: 'group-1',
		name: 'Beginner Kids (5-8)',
		students: ['Student 1', 'Student 2'],
		level: 'Beginner',
		ageRange: '5-8 years'
	},
	{
		id: 'group-2',
		name: 'Intermediate Teens (13-16)',
		students: ['Student 3', 'Student 4'],
		level: 'Intermediate',
		ageRange: '13-16 years'
	}
]

const initialWeeklySchedule: WeeklySchedule = {
	id: 'weekly-1',
	name: 'Spring 2025 After-School Program',
	season: 'Spring 2025',
	startDate: '2025-03-01',
	endDate: '2025-06-15',
	afterSchoolStart: '15:30',
	afterSchoolEnd: '18:00',
	lessons: [
		{
			id: 'lesson-1',
			name: 'Ballet Basics',
			teacher: 'Teacher 1',
			room: 'Studio 1',
			dayOfWeek: 1, // Monday
			startTime: '15:30',
			endTime: '16:15',
			studentGroups: ['group-1'],
			maxStudents: 12,
			description: 'Introduction to ballet fundamentals'
		},
		{
			id: 'lesson-2',
			name: 'Hip Hop Teens',
			teacher: 'Teacher 2',
			room: 'Studio 2',
			dayOfWeek: 1, // Monday
			startTime: '16:30',
			endTime: '17:15',
			studentGroups: ['group-2'],
			maxStudents: 15,
			description: 'Modern hip hop dance for teenagers'
		},
		{
			id: 'lesson-3',
			name: 'Jazz Kids',
			teacher: 'Teacher 1',
			room: 'Studio 1',
			dayOfWeek: 3, // Wednesday
			startTime: '15:30',
			endTime: '16:15',
			studentGroups: ['group-1'],
			maxStudents: 12,
			description: 'Fun jazz dance for young children'
		}
	]
}

const roomColors: Record<string, string> = {
	"Studio 1": "bg-primary/20 border-primary/30",
	"Studio 2": "bg-secondary/20 border-secondary/30", 
	"Studio 3": "bg-accent/20 border-accent/30"
}

// const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/

// Removed unused utility functions

const getCellStyling = (lesson: LessonCell | null, room: string | null) => {
	if (!lesson) return ""
	if (lesson.type === 'break') {
		// Different colors for different break types
		if (lesson.breakType === 'consecutive') {
			return "bg-error/10 border-error/30" // Red color for consecutive breaks
		} else if (lesson.breakType === 'default') {
			return "bg-warning/10 border-warning/30" // Yellow color for default breaks
		}
		return "bg-warning/10 border-warning/30" // Default yellow for other breaks
	} else if (lesson.type === 'unused') {
		return "bg-base-300/20 border-base-300/30" // Light gray for unused time
	}
	return roomColors[room || ""] || ""
}


// Simple Lesson Display Component
const LessonDisplay = memo(function LessonDisplay({
	lesson,
	teacher,
	slot
}: {
	lesson: LessonCell | null
	teacher: string
	slot: string
}) {
	if (!lesson) {
		return (
			<div className="h-full min-h-[60px] w-full border-2 border-dashed border-base-300 rounded-lg flex items-center justify-center">
				<span className="text-xs text-base-content/50">
					Empty slot
				</span>
			</div>
		)
	}

	return (
		<div className={`p-2 rounded-lg transition-all duration-200 ${
			lesson.type === 'lesson' 
				? 'bg-primary text-primary-content border border-primary/20 hover:shadow-md'
				: 'bg-warning text-warning-content border border-warning/20 hover:shadow-md'
		}`}>
			{lesson.type === 'lesson' ? (
				<div className="flex items-center gap-3">
					<Users className="h-3 w-3" />
					<div className="flex-1 min-w-0">
						<div className="font-medium text-sm truncate">{lesson.student}</div>
						<div className="text-xs opacity-80 truncate">
							{new Date(lesson.start).toLocaleTimeString('en-US', { 
								hour: '2-digit', 
								minute: '2-digit',
								hour12: false 
							})} - {new Date(lesson.end).toLocaleTimeString('en-US', { 
								hour: '2-digit', 
								minute: '2-digit',
								hour12: false 
							})}
						</div>
					</div>
				</div>
			) : (
				<div className="flex items-center gap-3">
					<Clock className="h-3 w-3" />
					<div className="flex-1 min-w-0">
						<div className="font-medium text-sm">{lesson.breakType || 'Break'}</div>
						<div className="text-xs opacity-80">
							{new Date(lesson.start).toLocaleTimeString('en-US', { 
								hour: '2-digit', 
								minute: '2-digit',
								hour12: false 
							})} - {new Date(lesson.end).toLocaleTimeString('en-US', { 
								hour: '2-digit', 
								minute: '2-digit',
								hour12: false 
							})}
						</div>
					</div>
				</div>
			)}
		</div>
	)
})

LessonDisplay.displayName = 'LessonDisplay'

const TimetableDay = memo(function TimetableDay({
	dayData,
	teachers,
	formatTime,
	schedule,
	onScheduleChange,
	hasCustomSchedule,
	breaks,
	timetableConfig,
}: {
	dayData: { date: string; lessons: LessonCell[]; warning?: string }
	teachers: Teacher[]
	formatTime: (iso: string) => string
	schedule: DaySchedule
	onScheduleChange: (date: string, updates: Partial<DaySchedule> | null) => void
	hasCustomSchedule: boolean
	breaks: string[]
	timetableConfig: {
		lessonDuration: number
		studentBreakAfter: number
		teacherBreakAfter: number
		defaultDayStart: string
		defaultDayEnd: string
	}
}) {
	const timeSlots = useMemo(() => {
		const slots: string[] = []
		const dayStart = new Date(`${dayData.date}T${schedule.start}:00`)
		const dayEnd = new Date(`${dayData.date}T${schedule.end}:00`)
		if (isNaN(dayStart.getTime()) || isNaN(dayEnd.getTime()) || dayStart >= dayEnd) {
			return slots
		}
		
		// Use custom breaks from props
		const customBreakPeriods = breaks.map(breakTime => {
			const [startTime, endTime] = breakTime.split("-")
			return {
				start: new Date(`${dayData.date}T${startTime}:00`),
				end: new Date(`${dayData.date}T${endTime}:00`)
			}
		}).filter(breakPeriod => breakPeriod.start >= dayStart && breakPeriod.end <= dayEnd)
		
		// Also include consecutive breaks from the lessons data
		const consecutiveBreaks = dayData.lessons
			.filter(l => l.type === 'break' && l.breakType === 'consecutive')
			.map(breakLesson => ({
				start: new Date(breakLesson.start),
				end: new Date(breakLesson.end)
			}))
		
		// Also include default breaks from the lessons data
		const defaultBreaksFromLessons = dayData.lessons
			.filter(l => l.type === 'break' && l.breakType === 'default')
			.map(breakLesson => ({
				start: new Date(breakLesson.start),
				end: new Date(breakLesson.end)
			}))
		
		
		// Combine all breaks
		const breakPeriods = [...customBreakPeriods, ...consecutiveBreaks, ...defaultBreaksFromLessons]
		
		// Create a comprehensive list of all time boundaries (lesson starts, break starts, break ends)
		const timeBoundaries = new Set<number>()
		
		// Add day start and end
		timeBoundaries.add(dayStart.getTime())
		timeBoundaries.add(dayEnd.getTime())
		
		// Add break boundaries first
		breakPeriods.forEach(breakPeriod => {
			timeBoundaries.add(breakPeriod.start.getTime())
			timeBoundaries.add(breakPeriod.end.getTime())
		})
		
		// Add boundaries for all lessons and breaks to ensure proper time slot creation
		dayData.lessons.forEach(lesson => {
			timeBoundaries.add(new Date(lesson.start).getTime())
			timeBoundaries.add(new Date(lesson.end).getTime())
		})
		
		// Add 45-minute interval boundaries, but respect break boundaries
		let cursor = dayStart
		while (cursor < dayEnd) {
			timeBoundaries.add(cursor.getTime())
			const nextSlot = addMinutes(cursor, timetableConfig.lessonDuration)
			
			// Check if there's any break that starts within this potential slot
			const breakStartsInSlot = breakPeriods.find(breakPeriod => {
				return breakPeriod.start.getTime() > cursor.getTime() && 
					   breakPeriod.start.getTime() < nextSlot.getTime()
			})
			
			if (breakStartsInSlot) {
				// If a break starts within this slot, stop at the break start
				timeBoundaries.add(breakStartsInSlot.start.getTime())
				timeBoundaries.add(breakStartsInSlot.end.getTime())
				cursor = breakStartsInSlot.end
			} else {
				// Check if the next slot would start within a break
				const nextSlotStartsInBreak = breakPeriods.find(breakPeriod => {
					return nextSlot.getTime() > breakPeriod.start.getTime() && 
						   nextSlot.getTime() < breakPeriod.end.getTime()
				})
				
				if (nextSlotStartsInBreak) {
					// Skip to after the break
					timeBoundaries.add(nextSlotStartsInBreak.start.getTime())
					timeBoundaries.add(nextSlotStartsInBreak.end.getTime())
					cursor = nextSlotStartsInBreak.end
				} else {
					cursor = nextSlot
				}
			}
		}
		timeBoundaries.add(dayEnd.getTime()) // Ensure dayEnd is always a boundary
		
		
		
		// Convert to sorted array and create slots
		const sortedBoundaries = Array.from(timeBoundaries).sort((a, b) => a - b)
		
		// Create slots between consecutive boundaries, ensuring break periods are properly handled
		for (let i = 0; i < sortedBoundaries.length - 1; i++) {
			const startTime = sortedBoundaries[i]
			const endTime = sortedBoundaries[i + 1]
			const duration = endTime - startTime
			
			// Only create slots that are at least 15 minutes long
			if (duration >= 15 * 60 * 1000) {
				const slotStart = new Date(startTime)
				const slotEnd = new Date(endTime)
				
				// Check if this slot exactly matches a break period
				const isBreakSlot = breakPeriods.some(breakPeriod => {
					return slotStart.getTime() === breakPeriod.start.getTime() && 
						   slotEnd.getTime() === breakPeriod.end.getTime()
				})
				
				// Check if this slot is completely within a break period (should be skipped)
				const isWithinBreak = breakPeriods.some(breakPeriod => {
					return slotStart.getTime() >= breakPeriod.start.getTime() && 
						   slotEnd.getTime() <= breakPeriod.end.getTime() &&
						   !(slotStart.getTime() === breakPeriod.start.getTime() && 
							 slotEnd.getTime() === breakPeriod.end.getTime())
				})
				
				// Only add the slot if it's not completely within a break (unless it exactly matches a break)
				if (!isWithinBreak || isBreakSlot) {
					slots.push(new Date(startTime).toISOString())
				}
			}
		}
		
		return slots
	}, [dayData.date, schedule.end, schedule.start, breaks, dayData.lessons])
		
		return (
			<motion.div 
				key={dayData.date} 
				className="card bg-base-100 shadow-lg mb-6"
				initial={{ opacity: 0, y: 20 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.3 }}
			>
				<div className="card-body">
					<div className="flex items-center gap-4 mb-4">
						<Calendar className="h-6 w-6 text-primary" />
						<h2 className="card-title text-primary">
						{new Date(dayData.date).toLocaleDateString('en-US', { 
							weekday: 'long', 
							year: 'numeric', 
							month: 'long', 
							day: 'numeric' 
						})}
						</h2>
					</div>
					
					{dayData.warning && (
						<Alert variant="warning" className="mb-4">
							{dayData.warning}
						</Alert>
					)}

			<div className="grid grid-cols-1 sm:grid-cols-[repeat(2,minmax(0,1fr))_auto] gap-4 items-end mb-6">
				<Input
					label="Day Start"
					type="time"
					value={schedule.start}
					onChange={(e) => onScheduleChange(dayData.date, { start: e.target.value })}
				/>
				<Input
					label="Day End"
					type="time"
					value={schedule.end}
					onChange={(e) => onScheduleChange(dayData.date, { end: e.target.value })}
				/>
				<Button
					className="btn-ghost"
					onClick={() => onScheduleChange(dayData.date, null)}
					disabled={!hasCustomSchedule}
				>
					Reset
				</Button>
			</div>

					<div className="overflow-x-auto">
						<table className="table table-zebra w-full">
							<thead>
								<tr>
									<th className="bg-base-200">
										<div className="flex items-center gap-3">
											<Clock className="h-4 w-4" />
											Time
										</div>
									</th>
								{teachers.map((t) => (
										<th key={t.name} className="bg-base-200">
											<div className="flex items-center gap-3">
												<Users className="h-4 w-4" />
												{t.name}
											</div>
										</th>
									))}
								</tr>
							</thead>
							<tbody>
								{timeSlots.map((slotStartIso, index) => {
									const slotStart = new Date(slotStartIso)
									
									// Calculate slot end time based on the next boundary
									let slotEnd: Date
									if (index < timeSlots.length - 1) {
										slotEnd = new Date(timeSlots[index + 1])
									} else {
										// For the last slot, use the day end time
										slotEnd = new Date(`${dayData.date}T${schedule.end}:00`)
									}
									
									const slotLabel = `${formatTime(slotStart.toISOString())}-${formatTime(slotEnd.toISOString())}`
									
									// Check if this slot contains a default break (use dynamic breaks from props)
									const isDefaultBreak = breaks.some(breakTime => {
										const [startTime, endTime] = breakTime.split("-")
										const breakStart = new Date(`${dayData.date}T${startTime}:00`)
										const breakEnd = new Date(`${dayData.date}T${endTime}:00`)
										// Check if this slot exactly matches a break period
										return slotStart.getTime() === breakStart.getTime() && slotEnd.getTime() === breakEnd.getTime()
									})
									
									// Calculate row height based on duration
									const durationMinutes = Math.round((slotEnd.getTime() - slotStart.getTime()) / (1000 * 60))
									const baseHeight = 60 // Base height for 45 minutes
									const rowHeight = Math.max(20, (durationMinutes / timetableConfig.lessonDuration) * baseHeight) // Minimum 20px height
									
									return (
										<tr key={slotStartIso} className="hover" style={{ height: `${rowHeight}px` }}>
											<td className="font-medium bg-base-100">{slotLabel}</td>
										{teachers.map((teacher) => {
											let lesson = null
											
											if (isDefaultBreak) {
												// For default breaks, show break in all teacher columns
												lesson = {
													start: slotStart.toISOString(),
													end: slotEnd.toISOString(),
													teacher: null,
													student: null,
													room: null,
													type: 'break' as const,
													duration: Math.round((slotEnd.getTime() - slotStart.getTime()) / (1000 * 60)),
													breakType: 'default' as const
												}
											} else {
												// For regular slots, find the actual lesson
												lesson = dayData.lessons.find(
													(l) =>
														new Date(l.start).getTime() === slotStart.getTime() &&
														new Date(l.end).getTime() === slotEnd.getTime() &&
														l.teacher === teacher.name
												) || null
												
												// If no lesson found, check if there's an explicit break at this time
												if (!lesson) {
													const explicitBreak = dayData.lessons.find(
														(l) =>
															l.type === 'break' &&
															new Date(l.start).getTime() === slotStart.getTime() &&
															new Date(l.end).getTime() === slotEnd.getTime()
													)
													if (explicitBreak) {
														lesson = explicitBreak
													} else if (durationMinutes < timetableConfig.lessonDuration && durationMinutes >= 15) {
														// Mark slots shorter than 45 minutes as unused time
														// This handles leftover time after breaks or at the end of the day
														lesson = {
															start: slotStart.toISOString(),
															end: slotEnd.toISOString(),
															teacher: null,
															student: null,
															room: null,
															type: 'unused' as const,
															duration: durationMinutes
														}
													}
													// If duration >= lessonDuration and no lesson/break, leave as null (empty slot available for lessons)
													// If duration < 15 minutes, also leave as null (transition period, not worth showing as unused)
												}
											}
											
											return (
												<td key={teacher.name + slotStartIso} className={getCellStyling(lesson, lesson?.room || null)}>
													<LessonDisplay 
														lesson={lesson} 
														teacher={teacher.name} 
														slot={slotStart.toISOString()}
													/>
												</td>
											)
										})}
										</tr>
									)
								})}
							</tbody>
						</table>
					</div>
				</div>
			</motion.div>
		)
})

TimetableDay.displayName = 'TimetableDay'

// Weekly Timetable Component
const WeeklyTimetable = memo(function WeeklyTimetable({
	weeklySchedule,
	studentGroups,
	teachers,
	onScheduleChange,
	onLessonChange,
	onStudentGroupChange
}: {
	weeklySchedule: WeeklySchedule
	studentGroups: StudentGroup[]
	teachers: Teacher[]
	onScheduleChange: (updates: Partial<WeeklySchedule>) => void
	onLessonChange: (lessonId: string, updates: Partial<WeeklyLesson>) => void
	onStudentGroupChange: (groupId: string, updates: Partial<StudentGroup>) => void
}) {
	const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
	const [editingLesson, setEditingLesson] = useState<WeeklyLesson | null>(null)
	const [isModalOpen, setIsModalOpen] = useState(false)
	const [selectedDay, setSelectedDay] = useState<number | null>(null)
	const [isDayModalOpen, setIsDayModalOpen] = useState(false)
	
	// Generate responsive time slots based on actual lesson times
	const generateTimeSlots = () => {
		const slots = []
		const start = weeklySchedule.afterSchoolStart
		const end = weeklySchedule.afterSchoolEnd
		
		// Get all unique lesson times
		const allTimes = new Set<string>()
		weeklySchedule.lessons.forEach(lesson => {
			allTimes.add(lesson.startTime)
			allTimes.add(lesson.endTime)
		})
		
		// Convert times to minutes for easier manipulation
		const timeToMinutes = (time: string) => {
			const [hour, min] = time.split(':').map(Number)
			return hour * 60 + min
		}
		
		const minutesToTime = (minutes: number) => {
			const hour = Math.floor(minutes / 60)
			const min = minutes % 60
			return `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`
		}
		
		// Get all time boundaries
		const timeBoundaries = new Set<number>()
		const [startHour, startMin] = start.split(':').map(Number)
		const [endHour, endMin] = end.split(':').map(Number)
		const startMinutes = startHour * 60 + startMin
		const endMinutes = endHour * 60 + endMin
		
		// Add start and end times
		timeBoundaries.add(startMinutes)
		timeBoundaries.add(endMinutes)
		
		// Add all lesson times
		allTimes.forEach(time => {
			timeBoundaries.add(timeToMinutes(time))
		})
		
		// Add intermediate slots for better visualization
		const sortedBoundaries = Array.from(timeBoundaries).sort((a, b) => a - b)
		
		// Calculate lesson density to determine slot intervals
		const totalDuration = endMinutes - startMinutes
		const lessonCount = weeklySchedule.lessons.length
		const density = lessonCount / (totalDuration / 60) // lessons per hour
		
		// Create slots between boundaries, with smart intervals based on density
		for (let i = 0; i < sortedBoundaries.length - 1; i++) {
			const currentTime = sortedBoundaries[i]
			const nextTime = sortedBoundaries[i + 1]
			const duration = nextTime - currentTime
			
			// Add the start time
			slots.push(minutesToTime(currentTime))
			
			// Determine interval based on density and duration
			let interval = 30 // default 30 minutes
			if (density > 2) {
				// High density: use 15-minute intervals
				interval = 15
			} else if (density < 0.5) {
				// Low density: use 60-minute intervals
				interval = 60
			}
			
			// Add intermediate slots based on duration and interval
			if (duration > interval) {
				for (let minutes = currentTime + interval; minutes < nextTime; minutes += interval) {
					slots.push(minutesToTime(minutes))
				}
			} else if (duration > 15) {
				// For medium gaps, add a midpoint
				const midpoint = currentTime + Math.floor(duration / 2)
				slots.push(minutesToTime(midpoint))
			}
		}
		
		// Add the final end time
		slots.push(minutesToTime(endMinutes))
		
		// Remove duplicates and sort
		return [...new Set(slots)].sort((a, b) => timeToMinutes(a) - timeToMinutes(b))
	}
	
	const timeSlots = generateTimeSlots()
	
	const getLessonsForDay = (dayOfWeek: number) => {
		return weeklySchedule.lessons.filter(lesson => lesson.dayOfWeek === dayOfWeek)
			.sort((a, b) => a.startTime.localeCompare(b.startTime))
	}

	// Filter lessons to show only group lessons (lessons with student groups)
	const getGroupLessonsForDay = (dayOfWeek: number) => {
		return weeklySchedule.lessons.filter(lesson => 
			lesson.dayOfWeek === dayOfWeek && lesson.studentGroups.length > 0
		).sort((a, b) => a.startTime.localeCompare(b.startTime))
	}

	// Get lessons at a specific time slot, handling overlaps
	const getLessonsAtTime = (dayOfWeek: number, timeSlot: string) => {
		const timeToMinutes = (time: string) => {
			const [hour, min] = time.split(':').map(Number)
			return hour * 60 + min
		}
		
		const slotMinutes = timeToMinutes(timeSlot)
		
		// Get all group lessons that start at this exact time
		return weeklySchedule.lessons.filter(lesson => {
			if (lesson.dayOfWeek !== dayOfWeek) return false
			if (lesson.studentGroups.length === 0) return false // Only group lessons
			
			const startMinutes = timeToMinutes(lesson.startTime)
			return slotMinutes === startMinutes
		})
	}

	const addLesson = (dayOfWeek: number, timeSlot?: string) => {
		// Helper function to add minutes to time
		const addMinutesToTime = (time: string, minutes: number) => {
			const [hour, min] = time.split(':').map(Number)
			const totalMinutes = hour * 60 + min + minutes
			const newHour = Math.floor(totalMinutes / 60)
			const newMin = totalMinutes % 60
			return `${newHour.toString().padStart(2, '0')}:${newMin.toString().padStart(2, '0')}`
		}

		const newLesson: WeeklyLesson = {
			id: `lesson-${Date.now()}`,
			name: 'New Lesson',
			teacher: teachers[0]?.name || '',
			room: teachers[0]?.room || '',
			dayOfWeek,
			startTime: timeSlot || weeklySchedule.afterSchoolStart,
			endTime: timeSlot ? addMinutesToTime(timeSlot, 45) : '16:15',
			studentGroups: [],
			maxStudents: 12,
			description: ''
		}
		onScheduleChange({
			lessons: [...weeklySchedule.lessons, newLesson]
		})
	}

	const removeLesson = (lessonId: string) => {
		onScheduleChange({
			lessons: weeklySchedule.lessons.filter(lesson => lesson.id !== lessonId)
		})
	}

	const getLessonAtTime = (dayOfWeek: number, timeSlot: string) => {
		// Convert time slot to minutes for comparison
		const timeToMinutes = (time: string) => {
			const [hour, min] = time.split(':').map(Number)
			return hour * 60 + min
		}
		
		const slotMinutes = timeToMinutes(timeSlot)
		
		// Only show lesson at its exact start time, not throughout its duration
		return weeklySchedule.lessons.find(lesson => {
			if (lesson.dayOfWeek !== dayOfWeek) return false
			
			const startMinutes = timeToMinutes(lesson.startTime)
			
			// Only show the lesson at its exact start time
			return slotMinutes === startMinutes
		})
	}

	const handleEditLesson = (lesson: WeeklyLesson) => {
		setEditingLesson(lesson)
		setIsModalOpen(true)
	}

	const handleSaveLesson = (updatedLesson: WeeklyLesson) => {
		onLessonChange(updatedLesson.id, updatedLesson)
		setIsModalOpen(false)
		setEditingLesson(null)
	}

	const handleCloseModal = () => {
		setIsModalOpen(false)
		setEditingLesson(null)
	}

	const handleOpenDayModal = (dayIndex: number) => {
		setSelectedDay(dayIndex)
		setIsDayModalOpen(true)
	}

	const handleCloseDayModal = () => {
		setIsDayModalOpen(false)
		setSelectedDay(null)
	}

	return (
		<div className="space-y-6">
			{/* Schedule Header */}
			<div className="card bg-base-100 shadow-lg">
				<div className="card-body">
					<div className="flex items-center gap-4 mb-4">
						<School className="h-6 w-6 text-primary" />
						<h3 className="card-title">Weekly Schedule Configuration</h3>
					</div>
					
					<div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
						<Input
							label="Schedule Name"
							value={weeklySchedule.name}
							onChange={(e) => onScheduleChange({ name: e.target.value })}
						/>
						<Input
							label="Season"
							value={weeklySchedule.season}
							onChange={(e) => onScheduleChange({ season: e.target.value })}
						/>
						<Input
							label="Start Date"
							type="date"
							value={weeklySchedule.startDate}
							onChange={(e) => onScheduleChange({ startDate: e.target.value })}
						/>
						<Input
							label="End Date"
							type="date"
							value={weeklySchedule.endDate}
							onChange={(e) => onScheduleChange({ endDate: e.target.value })}
						/>
					</div>
					
					<div className="grid md:grid-cols-2 gap-4 mt-4">
						<Input
							label="After School Start Time"
							type="time"
							value={weeklySchedule.afterSchoolStart}
							onChange={(e) => onScheduleChange({ afterSchoolStart: e.target.value })}
						/>
						<Input
							label="After School End Time"
							type="time"
							value={weeklySchedule.afterSchoolEnd}
							onChange={(e) => onScheduleChange({ afterSchoolEnd: e.target.value })}
						/>
					</div>
				</div>
			</div>

			{/* Enhanced Weekly Grid with Time Slots */}
			<div className="card bg-base-100 shadow-lg">
				<div className="card-body">
					<div className="flex items-center gap-4 mb-6">
						<CalendarDays className="h-6 w-6 text-primary" />
						<h3 className="card-title">Weekly Group Lessons</h3>
					</div>
					
					{/* Time Range Info */}
					<div className="mb-4 p-3 bg-primary/5 border border-primary/20 rounded-lg">
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-2">
								<Clock className="h-4 w-4 text-primary" />
								<span className="text-sm font-medium text-primary">
									Time Range: {weeklySchedule.afterSchoolStart} - {weeklySchedule.afterSchoolEnd}
								</span>
							</div>
							<div className="text-xs text-base-content/60">
								{timeSlots.length} time slots • {weeklySchedule.lessons.filter(l => l.studentGroups.length > 0).length} group lessons
							</div>
						</div>
					</div>

					{/* Time-based Grid Layout */}
					<div className="overflow-x-auto">
						<div className="min-w-[800px]">
							{/* Header Row */}
							<div className="grid grid-cols-7 gap-2 mb-4">
						{dayNames.map((dayName, dayIndex) => {
							const isWeekend = dayIndex === 0 || dayIndex === 6
							return (
										<div key={dayIndex} className={`text-center py-2 ${isWeekend ? 'opacity-60' : ''}`}>
											<div className={`font-semibold ${isWeekend ? 'text-base-content/60' : 'text-primary'}`}>
											{dayName}
											</div>
											<div className="text-xs text-base-content/50">
												{dayIndex === 0 ? 'Sun' : 
												 dayIndex === 1 ? 'Mon' :
												 dayIndex === 2 ? 'Tue' :
												 dayIndex === 3 ? 'Wed' :
												 dayIndex === 4 ? 'Thu' :
												 dayIndex === 5 ? 'Fri' : 'Sat'}
											</div>
										</div>
									)
								})}
									</div>
									
							{/* Time Slots Grid */}
							<div className="space-y-1">
								{timeSlots.map((timeSlot, timeIndex) => {
									// Calculate row height based on time duration
									const getRowHeight = () => {
										if (timeIndex === timeSlots.length - 1) return 'min-h-[60px]'
										
										const timeToMinutes = (time: string) => {
											const [hour, min] = time.split(':').map(Number)
											return hour * 60 + min
										}
										
										const currentMinutes = timeToMinutes(timeSlot)
										const nextMinutes = timeToMinutes(timeSlots[timeIndex + 1])
										const duration = nextMinutes - currentMinutes
										
										// Base height of 60px for 30 minutes, scale proportionally
										const baseHeight = 60
										const height = Math.max(40, (duration / 30) * baseHeight)
										
										return `min-h-[${height}px]`
									}
									
									return (
										<motion.div 
											key={timeSlot} 
											className={`grid grid-cols-7 gap-2 ${getRowHeight()}`}
											initial={{ opacity: 0, x: -20 }}
											animate={{ opacity: 1, x: 0 }}
											transition={{ delay: timeIndex * 0.05 }}
										>
										{/* Day Columns */}
										{dayNames.map((dayName, dayIndex) => {
											const isWeekend = dayIndex === 0 || dayIndex === 6
											const lessons = getLessonsAtTime(dayIndex, timeSlot)
											
											return (
												<div 
													key={`${dayIndex}-${timeSlot}`}
													className={`min-h-[60px] border-2 border-dashed rounded-lg transition-all duration-200 ${
														isWeekend 
															? 'border-base-300 bg-base-100/50' 
															: lessons.length > 0
																? 'border-primary/30 bg-primary/5' 
																: 'border-base-300 bg-base-100 hover:border-primary/50 hover:bg-primary/5'
													}`}
													onClick={() => !isWeekend && handleOpenDayModal(dayIndex)}
												>
													{lessons.length > 0 ? (
														<div className="h-full p-2 space-y-1">
															{lessons.map((lesson, lessonIndex) => (
																<motion.div 
																	key={lesson.id}
																	className="p-2 bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-lg hover:shadow-md transition-all duration-200 cursor-pointer group"
																	initial={{ opacity: 0, scale: 0.95 }}
																	animate={{ opacity: 1, scale: 1 }}
																	whileHover={{ scale: 1.02 }}
																	onClick={(e) => {
																		e.stopPropagation()
																		handleEditLesson(lesson)
																	}}
																>
																	<div className="flex items-start justify-between mb-1">
																		<div className="flex-1 min-w-0">
																			<div className="font-semibold text-xs text-primary truncate group-hover:text-primary-focus">
																				{lesson.name}
																			</div>
																			<div className="text-xs text-base-content/70 flex items-center gap-1">
																				<Clock className="h-3 w-3" />
															{lesson.startTime} - {lesson.endTime}
														</div>
													</div>
																		<div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
													<Button
																				onClick={(e) => {
																					e.stopPropagation()
																					handleEditLesson(lesson)
																				}}
																				className="btn-ghost btn-xs text-primary hover:bg-primary/10"
																			>
																				<Edit3 className="h-3 w-3" />
																			</Button>
																			<Button
																				onClick={(e) => {
																					e.stopPropagation()
																					removeLesson(lesson.id)
																				}}
																				className="btn-ghost btn-xs text-error hover:bg-error/10"
													>
														<Trash2 className="h-3 w-3" />
													</Button>
																		</div>
												</div>
												
												<div className="space-y-1">
																		<div className="text-xs text-base-content/60 truncate flex items-center gap-1">
																			<Users className="h-3 w-3" />
																			{lesson.teacher}
													</div>
																		<div className="text-xs text-base-content/60 truncate flex items-center gap-1">
																			<School className="h-3 w-3" />
																			{lesson.room}
												</div>
																		{lesson.studentGroups.length > 0 && (
																			<div className="text-xs text-primary flex items-center gap-1">
																				<Users className="h-3 w-3" />
																				{lesson.studentGroups.length} group(s)
											</div>
																		)}
																	</div>
																</motion.div>
															))}
															{lessons.length > 1 && (
																<div className="text-xs text-primary/70 text-center mt-1">
																	+{lessons.length - 1} more lesson{lessons.length > 2 ? 's' : ''}
																</div>
															)}
														</div>
													) : !isWeekend ? (
														<motion.button
															onClick={(e) => {
																e.stopPropagation()
																handleOpenDayModal(dayIndex)
															}}
															className="w-full h-full flex flex-col items-center justify-center text-base-content/40 hover:text-primary hover:bg-primary/5 transition-all duration-200 group p-2"
															whileHover={{ scale: 1.02 }}
															whileTap={{ scale: 0.98 }}
														>
															<div className="text-xs font-medium text-base-content/60 mb-1">
																{timeSlot}
															</div>
															<motion.div
																className="flex flex-col items-center gap-1"
																initial={{ opacity: 0 }}
																whileHover={{ opacity: 1 }}
															>
																<Plus className="h-4 w-4" />
																<span className="text-xs font-medium">Manage Day</span>
															</motion.div>
														</motion.button>
													) : (
														<div className="w-full h-full flex items-center justify-center text-base-content/20">
															<span className="text-xs font-medium">Weekend</span>
														</div>
													)}
												</div>
											)
										})}
									</motion.div>
								)
							})}
							</div>
						</div>
					</div>
					
					{/* Quick Add Lesson Buttons */}
					<motion.div 
						className="mt-6 p-4 bg-gradient-to-r from-base-200 to-base-300 rounded-lg border border-base-300"
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.2 }}
					>
						<div className="flex items-center gap-4 mb-4">
							<Plus className="h-5 w-5 text-primary" />
							<h4 className="font-semibold text-base-content">Quick Add Lessons</h4>
						</div>
						<div className="grid grid-cols-7 gap-2">
							{dayNames.map((dayName, dayIndex) => {
								const isWeekend = dayIndex === 0 || dayIndex === 6
								return (
									<motion.div
										key={dayIndex}
										whileHover={{ scale: 1.05 }}
										whileTap={{ scale: 0.95 }}
									>
											<Button
												onClick={() => addLesson(dayIndex)}
											disabled={isWeekend}
											className={`btn-outline btn-sm w-full transition-all duration-200 ${
												isWeekend 
													? 'opacity-50 cursor-not-allowed' 
													: 'hover:btn-primary hover:shadow-md'
											}`}
										>
											<Plus className="h-3 w-3 mr-1" />
											{dayName.slice(0, 3)}
											</Button>
									</motion.div>
							)
						})}
					</div>
						<div className="mt-3 text-xs text-base-content/60 text-center">
							💡 Click on any empty time slot or use these buttons to add lessons quickly
						</div>
					</motion.div>
				</div>
			</div>

			{/* Enhanced Student Groups */}
			<div className="card bg-base-100 shadow-lg">
				<div className="card-body">
					<div className="flex items-center justify-between mb-6">
						<div className="flex items-center gap-4">
							<Users className="h-6 w-6 text-primary" />
							<h3 className="card-title">Student Groups</h3>
						</div>
						<Button
							onClick={() => {
								const newGroup: StudentGroup = {
									id: `group-${Date.now()}`,
									name: 'New Group',
									students: [],
									level: 'Beginner',
									ageRange: '5-8 years'
								}
								onStudentGroupChange('', newGroup)
							}}
							className="btn-outline btn-sm flex items-center gap-3"
						>
							<Plus className="h-4 w-4" />
							Add Group
						</Button>
					</div>
					
					<div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
						{studentGroups.map((group) => (
							<motion.div 
								key={group.id} 
								className="p-4 border border-base-300 rounded-lg bg-base-50 hover:shadow-md transition-all duration-200"
								initial={{ opacity: 0, y: 20 }}
								animate={{ opacity: 1, y: 0 }}
								whileHover={{ scale: 1.02 }}
							>
								<div className="flex items-start justify-between mb-4">
									<div className="flex-1">
									<Input
										value={group.name}
										onChange={(e) => onStudentGroupChange(group.id, { name: e.target.value })}
											className="font-semibold text-lg"
											placeholder="Group Name"
									/>
									</div>
									<Button
										onClick={() => onStudentGroupChange(group.id, {})}
										className="btn-ghost btn-xs text-error hover:bg-error/10"
									>
										<Trash2 className="h-3 w-3" />
									</Button>
								</div>
								
								<div className="space-y-3">
									<div className="flex items-center gap-2">
										<span className="text-sm font-medium text-base-content/70">Level:</span>
									<Input
										value={group.level}
										onChange={(e) => onStudentGroupChange(group.id, { level: e.target.value })}
											placeholder="Beginner"
											className="text-sm"
									/>
									</div>
									<div className="flex items-center gap-2">
										<span className="text-sm font-medium text-base-content/70">Age:</span>
									<Input
										value={group.ageRange}
										onChange={(e) => onStudentGroupChange(group.id, { ageRange: e.target.value })}
											placeholder="5-8 years"
											className="text-sm"
									/>
									</div>
									<div>
										<label className="text-sm font-medium text-base-content/70 mb-1 block">
											Students ({group.students.length})
										</label>
									<Input
										value={group.students.join(', ')}
										onChange={(e) => {
											const students = e.target.value.split(',').map(s => s.trim()).filter(Boolean)
											onStudentGroupChange(group.id, { students })
										}}
											placeholder="Student 1, Student 2, ..."
											className="text-sm"
									/>
								</div>
							</div>
							</motion.div>
						))}
					</div>
				</div>
			</div>

			{/* Lesson Edit Modal */}
			<LessonEditModal
				lesson={editingLesson}
				teachers={teachers}
				studentGroups={studentGroups}
				isOpen={isModalOpen}
				onClose={handleCloseModal}
				onSave={handleSaveLesson}
			/>

			{/* Day Modal */}
			{selectedDay !== null && (
				<DayModal
					dayName={dayNames[selectedDay]}
					dayIndex={selectedDay}
					lessons={getLessonsForDay(selectedDay)}
					teachers={teachers}
					studentGroups={studentGroups}
					isOpen={isDayModalOpen}
					onClose={handleCloseDayModal}
					onLessonChange={onLessonChange}
					onAddLesson={addLesson}
					onRemoveLesson={removeLesson}
				/>
			)}
		</div>
	)
})

// Lesson Editing Modal Component
const LessonEditModal = memo(function LessonEditModal({
	lesson,
	teachers,
	studentGroups,
	isOpen,
	onClose,
	onSave
}: {
	lesson: WeeklyLesson | null
	teachers: Teacher[]
	studentGroups: StudentGroup[]
	isOpen: boolean
	onClose: () => void
	onSave: (lesson: WeeklyLesson) => void
}) {
	const [editedLesson, setEditedLesson] = useState<WeeklyLesson | null>(null)

	useEffect(() => {
		if (lesson) {
			setEditedLesson({ ...lesson })
		}
	}, [lesson])

	if (!isOpen || !editedLesson) return null

	const handleSave = () => {
		onSave(editedLesson)
		onClose()
	}

	return (
		<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
			<motion.div 
				className="bg-base-100 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
				initial={{ opacity: 0, scale: 0.95 }}
				animate={{ opacity: 1, scale: 1 }}
				exit={{ opacity: 0, scale: 0.95 }}
			>
				<div className="p-6">
					<div className="flex items-center justify-between mb-6">
						<h3 className="text-xl font-bold text-primary">Edit Lesson</h3>
						<Button onClick={onClose} className="btn-ghost btn-sm">
							<X className="h-4 w-4" />
						</Button>
					</div>

					<div className="space-y-4">
						<div className="grid md:grid-cols-2 gap-4">
							<Input
								label="Lesson Name"
								value={editedLesson.name}
								onChange={(e) => setEditedLesson(prev => prev ? { ...prev, name: e.target.value } : null)}
								placeholder="Enter lesson name"
							/>
							<Input
								label="Room"
								value={editedLesson.room}
								onChange={(e) => setEditedLesson(prev => prev ? { ...prev, room: e.target.value } : null)}
								placeholder="Enter room"
							/>
						</div>

						<div className="grid md:grid-cols-2 gap-4">
							<div>
								<label className="label">
									<span className="label-text">Teacher</span>
								</label>
								<select
									value={editedLesson.teacher}
									onChange={(e) => setEditedLesson(prev => prev ? { ...prev, teacher: e.target.value } : null)}
									className="select select-bordered w-full"
								>
									{teachers.map(teacher => (
										<option key={teacher.name} value={teacher.name}>
											{teacher.name}
										</option>
									))}
								</select>
							</div>
							<Input
								label="Max Students"
								type="number"
								min="1"
								value={editedLesson.maxStudents}
								onChange={(e) => setEditedLesson(prev => prev ? { ...prev, maxStudents: parseInt(e.target.value) || 1 } : null)}
							/>
						</div>

						<div className="grid md:grid-cols-2 gap-4">
							<Input
								label="Start Time"
								type="time"
								value={editedLesson.startTime}
								onChange={(e) => setEditedLesson(prev => prev ? { ...prev, startTime: e.target.value } : null)}
							/>
							<Input
								label="End Time"
								type="time"
								value={editedLesson.endTime}
								onChange={(e) => setEditedLesson(prev => prev ? { ...prev, endTime: e.target.value } : null)}
							/>
						</div>

						<div>
							<label className="label">
								<span className="label-text">Student Groups</span>
							</label>
							<div className="grid grid-cols-2 gap-2">
								{studentGroups.map(group => (
									<label key={group.id} className="flex items-center gap-2 cursor-pointer">
										<input
											type="checkbox"
											checked={editedLesson.studentGroups.includes(group.id)}
											onChange={(e) => {
												const newGroups = e.target.checked
													? [...editedLesson.studentGroups, group.id]
													: editedLesson.studentGroups.filter(id => id !== group.id)
												setEditedLesson(prev => prev ? { ...prev, studentGroups: newGroups } : null)
											}}
											className="checkbox checkbox-sm"
										/>
										<span className="text-sm">{group.name}</span>
									</label>
								))}
							</div>
						</div>

						<div>
							<label className="label">
								<span className="label-text">Description</span>
							</label>
							<textarea
								value={editedLesson.description || ''}
								onChange={(e) => setEditedLesson(prev => prev ? { ...prev, description: e.target.value } : null)}
								className="textarea textarea-bordered w-full"
								placeholder="Enter lesson description"
								rows={3}
							/>
						</div>
					</div>

					<div className="flex gap-3 justify-end mt-6">
						<Button onClick={onClose} className="btn-outline">
							Cancel
						</Button>
						<Button onClick={handleSave} className="btn-primary">
							Save Changes
						</Button>
					</div>
				</div>
			</motion.div>
		</div>
	)
})

// Day Modal Component for detailed lesson management
const DayModal = memo(function DayModal({
	dayName,
	dayIndex,
	lessons,
	teachers,
	studentGroups,
	isOpen,
	onClose,
	onLessonChange,
	onAddLesson,
	onRemoveLesson
}: {
	dayName: string
	dayIndex: number
	lessons: WeeklyLesson[]
	teachers: Teacher[]
	studentGroups: StudentGroup[]
	isOpen: boolean
	onClose: () => void
	onLessonChange: (lessonId: string, updates: Partial<WeeklyLesson>) => void
	onAddLesson: (dayOfWeek: number) => void
	onRemoveLesson: (lessonId: string) => void
}) {
	const [editingLesson, setEditingLesson] = useState<WeeklyLesson | null>(null)
	const [isEditModalOpen, setIsEditModalOpen] = useState(false)

	const handleEditLesson = (lesson: WeeklyLesson) => {
		setEditingLesson(lesson)
		setIsEditModalOpen(true)
	}

	const handleSaveLesson = (updatedLesson: WeeklyLesson) => {
		onLessonChange(updatedLesson.id, updatedLesson)
		setIsEditModalOpen(false)
		setEditingLesson(null)
	}

	const handleCloseEditModal = () => {
		setIsEditModalOpen(false)
		setEditingLesson(null)
	}

	if (!isOpen) return null

	return (
		<>
			<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
				<motion.div 
					className="bg-base-100 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
					initial={{ opacity: 0, scale: 0.95 }}
					animate={{ opacity: 1, scale: 1 }}
					exit={{ opacity: 0, scale: 0.95 }}
				>
					<div className="p-6">
						<div className="flex items-center justify-between mb-6">
							<div className="flex items-center gap-4">
								<Calendar className="h-6 w-6 text-primary" />
								<h3 className="text-2xl font-bold text-primary">{dayName} Lessons</h3>
							</div>
							<div className="flex gap-3">
								<Button
									onClick={() => onAddLesson(dayIndex)}
									className="btn-primary flex items-center gap-2"
								>
									<Plus className="h-4 w-4" />
									Add Lesson
								</Button>
								<Button onClick={onClose} className="btn-ghost">
									<X className="h-4 w-4" />
								</Button>
							</div>
						</div>

						{lessons.length === 0 ? (
							<div className="text-center py-12">
								<Calendar className="h-16 w-16 text-base-content/30 mx-auto mb-4" />
								<h4 className="text-lg font-semibold text-base-content/70 mb-2">No Lessons Scheduled</h4>
								<p className="text-base-content/50 mb-4">Add lessons to {dayName} to get started</p>
								<Button
									onClick={() => onAddLesson(dayIndex)}
									className="btn-primary"
								>
									<Plus className="h-4 w-4 mr-2" />
									Add First Lesson
								</Button>
							</div>
						) : (
							<div className="grid gap-4">
								{lessons.map((lesson) => (
									<motion.div
										key={lesson.id}
										className="p-4 border border-base-300 rounded-lg bg-base-50 hover:shadow-md transition-all duration-200"
										initial={{ opacity: 0, y: 20 }}
										animate={{ opacity: 1, y: 0 }}
										whileHover={{ scale: 1.01 }}
									>
										<div className="flex items-start justify-between mb-3">
											<div className="flex-1">
												<h4 className="font-semibold text-lg text-primary mb-1">{lesson.name}</h4>
												<div className="flex items-center gap-4 text-sm text-base-content/70">
													<div className="flex items-center gap-1">
														<Clock className="h-4 w-4" />
														{lesson.startTime} - {lesson.endTime}
													</div>
													<div className="flex items-center gap-1">
														<Users className="h-4 w-4" />
														{lesson.teacher}
													</div>
													<div className="flex items-center gap-1">
														<School className="h-4 w-4" />
														{lesson.room}
													</div>
												</div>
											</div>
											<div className="flex gap-2">
												<Button
													onClick={() => handleEditLesson(lesson)}
													className="btn-ghost btn-sm text-primary hover:bg-primary/10"
												>
													<Edit3 className="h-4 w-4" />
												</Button>
												<Button
													onClick={() => onRemoveLesson(lesson.id)}
													className="btn-ghost btn-sm text-error hover:bg-error/10"
												>
													<Trash2 className="h-4 w-4" />
												</Button>
											</div>
										</div>
										
										{lesson.description && (
											<p className="text-sm text-base-content/60 mb-2">{lesson.description}</p>
										)}
										
										{lesson.studentGroups.length > 0 && (
											<div className="flex items-center gap-2">
												<Users className="h-4 w-4 text-primary" />
												<span className="text-sm text-primary font-medium">
													{lesson.studentGroups.length} group(s) assigned
												</span>
											</div>
										)}
									</motion.div>
								))}
							</div>
						)}
					</div>
				</motion.div>
			</div>

			{/* Lesson Edit Modal */}
			<LessonEditModal
				lesson={editingLesson}
				teachers={teachers}
				studentGroups={studentGroups}
				isOpen={isEditModalOpen}
				onClose={handleCloseEditModal}
				onSave={handleSaveLesson}
			/>
		</>
	)
})

DayModal.displayName = 'DayModal'

LessonEditModal.displayName = 'LessonEditModal'

// Unified Timetable Component
const UnifiedTimetable = memo(function UnifiedTimetable({
	mode,
			teachers,
			students,
	studentGroups,
	onTeachersChange,
	onStudentsChange,
	onStudentGroupsChange,
	onTimetableChange,
	onGenerateTimetable
}: {
	mode: 'single-day' | 'multi-day' | 'weekly'
	teachers: Teacher[]
	students: Student[]
	studentGroups: StudentGroup[]
	onTeachersChange: (teachers: Teacher[]) => void
	onStudentsChange: (students: Student[]) => void
	onStudentGroupsChange: (groups: StudentGroup[]) => void
	onTimetableChange: (timetable: any) => void
	onGenerateTimetable: () => void
}) {
	const [currentMode, setCurrentMode] = useState<'single-day' | 'multi-day' | 'weekly'>('multi-day')
	const [dateRange, setDateRange] = useState({ start: "2025-01-10", end: "2025-01-12" })
	const [weeklySchedule, setWeeklySchedule] = useState<WeeklySchedule>(initialWeeklySchedule)
	const [generatedTimetable, setGeneratedTimetable] = useState<any>(null)
	const [isLoading, setIsLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [currentWeekPage, setCurrentWeekPage] = useState(1)
	const [weeksPerPage] = useState(2) // Show 2 weeks per page
	const [groupLessons, setGroupLessons] = useState<any[]>([]) // Store group lessons
	const [newGroupLesson, setNewGroupLesson] = useState({
		name: '',
		teacher: '',
		room: '',
		startTime: '09:00',
		endTime: '09:45',
		dayOfWeek: 1, // Monday
		studentGroups: [] as string[],
		duration: 45,
		maxStudents: 12
	})
	const [editingLesson, setEditingLesson] = useState<any>(null)
	
	// Break and scheduling configuration
	const [breakConfig, setBreakConfig] = useState({
		lessonDuration: 45,
		studentBreakAfter: 4,
		teacherBreakAfter: 4,
		defaultDayStart: "08:00",
		defaultDayEnd: "18:00",
		defaultBreaks: "12:00-13:00, 15:00-15:15",
		preferMorningLessons: false,
		avoidBackToBack: true,
		balanceTeacherLoad: true
	})

	// Helper function to parse break times
	const parseBreakTimes = (breakString: string) => {
		return breakString.split(',').map(breakTime => {
			const [start, end] = breakTime.trim().split('-')
			return { start: start.trim(), end: end.trim() }
		})
	}

	// Helper function to add minutes to time
	const addMinutesToTime = (time: string, minutes: number) => {
		const [hour, min] = time.split(':').map(Number)
		const totalMinutes = hour * 60 + min + minutes
		const newHour = Math.floor(totalMinutes / 60)
		const newMin = totalMinutes % 60
		return `${newHour.toString().padStart(2, '0')}:${newMin.toString().padStart(2, '0')}`
	}

	// Helper function to generate timetable with proper breaks
	const generateTimetableWithBreaks = (startDate: string, endDate: string) => {
		const start = new Date(startDate)
		const end = new Date(endDate)
		const days = []
		const breakTimes = parseBreakTimes(breakConfig.defaultBreaks)
		
		for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
			const dayLessons: any[] = []
			const currentDate = new Date(d)
			const dateString = currentDate.toISOString().split('T')[0]
			
			// First, add all configured breaks to the day
			breakTimes.forEach(breakTime => {
				dayLessons.push({
					id: `scheduled-break-${breakTime.start}-${breakTime.end}`,
					start: `${dateString}T${breakTime.start}:00`,
					end: `${dateString}T${breakTime.end}:00`,
					student: 'Break',
					teacher: 'Break',
					type: 'break'
				})
			})
			
		// Generate lessons for the day, avoiding scheduled breaks
		let currentTime = breakConfig.defaultDayStart
		let consecutiveLessonCount = 0
		
		// First, add group lessons to the day
		groupLessons.forEach(groupLesson => {
			// Calculate the actual date for this group lesson based on dayOfWeek
			const currentDate = new Date(dateString)
			const dayOfWeek = currentDate.getDay() // 0 = Sunday, 1 = Monday, etc.
			
			// Check if this group lesson should be on this day of the week
			if (groupLesson.dayOfWeek === dayOfWeek) {
				// Create proper start and end times for this date
				const startDateTime = `${dateString}T${groupLesson.startTime}:00`
				const endDateTime = `${dateString}T${groupLesson.endTime}:00`
				
				// Check if group lesson conflicts with scheduled breaks
				const conflictingBreak = breakTimes.find(breakTime => {
					const breakStart = breakTime.start
					const breakEnd = breakTime.end
					return (groupLesson.startTime < breakEnd && groupLesson.endTime > breakStart)
				})
				
				if (!conflictingBreak) {
					dayLessons.push({
						id: groupLesson.id,
						start: startDateTime,
						end: endDateTime,
						student: groupLesson.name,
						teacher: groupLesson.teacher,
						room: groupLesson.room,
						studentGroups: groupLesson.studentGroups,
						maxStudents: groupLesson.maxStudents,
						type: 'group'
					})
				}
			}
		})
		
		// Create lessons for each student
		students.forEach((student, studentIndex) => {
				// Create lessons for each teacher preference
				Object.entries(student.teacherLessons || {}).forEach(([teacherName, lessonCount]) => {
					const teacher = teachers.find(t => t.name === teacherName)
					if (!teacher || lessonCount <= 0) return
					
					for (let i = 0; i < lessonCount; i++) {
						// Check if current time conflicts with scheduled breaks
						const conflictingBreak = breakTimes.find(breakTime => {
							const breakStart = breakTime.start
							const breakEnd = breakTime.end
							return currentTime >= breakStart && currentTime < breakEnd
						})
						
						if (conflictingBreak) {
							// Skip to after the break and reset consecutive lesson counter
							currentTime = conflictingBreak.end
							consecutiveLessonCount = 0 // Reset counter after default break
						}
						
						// Check if we need a student break (after every N consecutive lessons)
						if (consecutiveLessonCount > 0 && consecutiveLessonCount % breakConfig.studentBreakAfter === 0) {
							// Add student break
							dayLessons.push({
								id: `student-break-${Date.now()}-${Math.random()}`,
								start: `${dateString}T${currentTime}:00`,
								end: `${dateString}T${addMinutesToTime(currentTime, 15)}:00`,
								student: 'Break',
								teacher: 'Break',
								type: 'break'
							})
							currentTime = addMinutesToTime(currentTime, 15)
							consecutiveLessonCount = 0 // Reset counter after student break
						}
						
						// Create lesson
						let lessonEndTime = addMinutesToTime(currentTime, breakConfig.lessonDuration)
						
						// Check if lesson would go beyond day end
						if (lessonEndTime > breakConfig.defaultDayEnd) {
							break
						}
						
						// Check if lesson would conflict with any scheduled break
						const wouldConflict = breakTimes.some(breakTime => {
							const breakStart = breakTime.start
							const breakEnd = breakTime.end
							return (currentTime < breakEnd && lessonEndTime > breakStart)
						})
						
						if (wouldConflict) {
							// Find the next available time after all breaks
							const nextAvailableTime = breakTimes
								.filter(breakTime => breakTime.start > currentTime)
								.sort((a, b) => a.start.localeCompare(b.start))[0]
							
							if (nextAvailableTime) {
								currentTime = nextAvailableTime.end
								lessonEndTime = addMinutesToTime(currentTime, breakConfig.lessonDuration)
								consecutiveLessonCount = 0 // Reset counter when skipping to after break
							}
						}
						
						dayLessons.push({
							id: `lesson-${Date.now()}-${Math.random()}`,
							start: `${dateString}T${currentTime}:00`,
							end: `${dateString}T${lessonEndTime}:00`,
							student: student.name,
							teacher: teacher.name,
							room: teacher.room,
							type: 'lesson'
						})
						
						currentTime = lessonEndTime
						consecutiveLessonCount++
					}
				})
			})
			
			// Sort lessons by start time
			dayLessons.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
			
			days.push({
				date: dateString,
				lessons: dayLessons
			})
		}
		
		return {
			dateRange: { start: startDate, end: endDate },
			days: days,
			summary: {
				totalLessons: days.reduce((sum, day) => sum + day.lessons.filter(l => l.type === 'lesson').length, 0),
				studentsSatisfied: students.length,
				studentsUnmet: []
			}
		}
	}

	const handleGenerateTimetable = async () => {
		setIsLoading(true)
		setError(null)
		setCurrentWeekPage(1) // Reset to first page when generating new timetable
		
		try {
			if (currentMode === 'weekly') {
				// Generate weekly timetable using the same algorithm as multi-day
		const startDate = new Date(weeklySchedule.startDate)
		const endDate = new Date(weeklySchedule.endDate)
		const timetables: Record<string, any> = {}
		
		let currentDate = new Date(startDate)
		let weekNumber = 1
		
		while (currentDate <= endDate) {
			const weekStart = new Date(currentDate)
			const weekEnd = new Date(currentDate)
			weekEnd.setDate(weekEnd.getDate() + 6)
			
					// Generate timetable for this week using the same algorithm
					const weekResult = generateTimetableWithBreaks(
						weekStart.toISOString().split('T')[0], 
						weekEnd.toISOString().split('T')[0]
					)
			
			timetables[`week-${weekNumber}`] = {
				weekNumber,
				startDate: weekStart.toISOString().split('T')[0],
				endDate: weekEnd.toISOString().split('T')[0],
						programName: weeklySchedule.name,
						season: weeklySchedule.season,
						...weekResult
			}
			
			currentDate.setDate(currentDate.getDate() + 7)
			weekNumber++
		}
		
				setGeneratedTimetable(timetables)
			} else {
				// Generate multi-day timetable with proper breaks
				const result = generateTimetableWithBreaks(dateRange.start, dateRange.end)
				setGeneratedTimetable(result)
			}
			
			onTimetableChange(generatedTimetable)
		} catch (err) {
			setError("Failed to generate timetable")
			console.error("Error generating timetable:", err)
		} finally {
			setIsLoading(false)
		}
	}

	return (
		<div className="space-y-6">
			{/* Mode Selection */}
			<div className="card bg-base-100 shadow-lg">
				<div className="card-body">
					<div className="flex items-center gap-4 mb-4">
						<Calendar className="h-6 w-6 text-primary" />
						<h3 className="card-title">Timetable Configuration</h3>
				</div>

					<div className="flex gap-2 mb-6">
						<Button
							onClick={() => setCurrentMode('single-day')}
							className={`btn ${currentMode === 'single-day' ? 'btn-primary' : 'btn-outline'}`}
						>
							Single Day
						</Button>
						<Button
							onClick={() => setCurrentMode('multi-day')}
							className={`btn ${currentMode === 'multi-day' ? 'btn-primary' : 'btn-outline'}`}
						>
							Multi-Day
						</Button>
						<Button
							onClick={() => setCurrentMode('weekly')}
							className={`btn ${currentMode === 'weekly' ? 'btn-primary' : 'btn-outline'}`}
						>
							Weekly Program
						</Button>
				</div>

					{/* Date/Time Configuration */}
					{currentMode === 'weekly' ? (
						<div className="space-y-4">
							<div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
								<Input
									label="Program Name"
									value={weeklySchedule.name}
									onChange={(e) => setWeeklySchedule(prev => ({ ...prev, name: e.target.value }))}
								/>
								<Input
									label="Season"
									value={weeklySchedule.season}
									onChange={(e) => setWeeklySchedule(prev => ({ ...prev, season: e.target.value }))}
								/>
								<Input
									label="Start Date"
									type="date"
									value={weeklySchedule.startDate}
									onChange={(e) => setWeeklySchedule(prev => ({ ...prev, startDate: e.target.value }))}
								/>
								<Input
									label="End Date"
									type="date"
									value={weeklySchedule.endDate}
									onChange={(e) => setWeeklySchedule(prev => ({ ...prev, endDate: e.target.value }))}
								/>
							</div>
							<div className="flex justify-end">
								<Button
									onClick={handleGenerateTimetable}
									disabled={isLoading}
									className="btn-primary"
								>
									{isLoading ? (
										<>
											<span className="loading loading-spinner loading-sm mr-2"></span>
											Generating Weekly Program...
										</>
									) : (
										<>
											<RefreshCw className="h-4 w-4 mr-2" />
											Generate Weekly Program
										</>
									)}
								</Button>
					</div>
						</div>
					) : (
						<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
							<Input
								label="Start Date"
								type="date"
								value={dateRange.start}
								onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
							/>
							<Input
								label="End Date"
								type="date"
								value={dateRange.end}
								onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
							/>
							<Button
								onClick={handleGenerateTimetable}
								disabled={isLoading}
								className="btn-primary mt-auto"
							>
								{isLoading ? (
									<>
										<span className="loading loading-spinner loading-sm mr-2"></span>
										Generating...
									</>
								) : (
									<>
										<RefreshCw className="h-4 w-4 mr-2" />
										Generate Timetable
									</>
								)}
							</Button>
						</div>
					)}
					</div>
				</div>


			{/* Breaks & Scheduling Configuration */}
			<div className="card bg-base-100 shadow-lg">
				<div className="card-body">
					<div className="flex items-center gap-4 mb-6">
						<Clock className="h-6 w-6 text-primary" />
						<h3 className="card-title">Breaks & Scheduling</h3>
					</div>
					
					<div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
						<Input
							label="Lesson Duration (minutes)"
							type="number"
							min="15"
							max="120"
							value={breakConfig.lessonDuration}
							onChange={(e) => setBreakConfig(prev => ({ ...prev, lessonDuration: parseInt(e.target.value) || 45 }))}
						/>
						<Input
							label="Student Break After (lessons)"
							type="number"
							min="1"
							max="10"
							value={breakConfig.studentBreakAfter}
							onChange={(e) => setBreakConfig(prev => ({ ...prev, studentBreakAfter: parseInt(e.target.value) || 4 }))}
						/>
						<Input
							label="Teacher Break After (lessons)"
							type="number"
							min="1"
							max="10"
							value={breakConfig.teacherBreakAfter}
							onChange={(e) => setBreakConfig(prev => ({ ...prev, teacherBreakAfter: parseInt(e.target.value) || 4 }))}
						/>
						<Input
							label="Default Day Start"
							type="time"
							value={breakConfig.defaultDayStart}
							onChange={(e) => setBreakConfig(prev => ({ ...prev, defaultDayStart: e.target.value }))}
						/>
					</div>
					
					<div className="grid md:grid-cols-2 gap-4 mb-6">
						<Input
							label="Default Day End"
							type="time"
							value={breakConfig.defaultDayEnd}
							onChange={(e) => setBreakConfig(prev => ({ ...prev, defaultDayEnd: e.target.value }))}
						/>
						<Input
							label="Default Breaks (comma separated)"
							value={breakConfig.defaultBreaks}
							onChange={(e) => setBreakConfig(prev => ({ ...prev, defaultBreaks: e.target.value }))}
							placeholder="12:00-13:00, 15:00-15:15"
						/>
					</div>
					
					{/* Advanced Scheduling Options */}
					<div>
						<h4 className="font-semibold mb-4">Advanced Options</h4>
						<div className="grid md:grid-cols-3 gap-4">
							<div className="form-control">
								<label className="label cursor-pointer">
									<span className="label-text">Prefer Morning Lessons</span>
									<input 
										type="checkbox" 
										className="checkbox checkbox-primary" 
										checked={breakConfig.preferMorningLessons}
										onChange={(e) => setBreakConfig(prev => ({ ...prev, preferMorningLessons: e.target.checked }))}
									/>
								</label>
							</div>
							<div className="form-control">
								<label className="label cursor-pointer">
									<span className="label-text">Avoid Back-to-Back</span>
									<input 
										type="checkbox" 
										className="checkbox checkbox-primary" 
										checked={breakConfig.avoidBackToBack}
										onChange={(e) => setBreakConfig(prev => ({ ...prev, avoidBackToBack: e.target.checked }))}
									/>
								</label>
							</div>
							<div className="form-control">
								<label className="label cursor-pointer">
									<span className="label-text">Balance Teacher Load</span>
									<input 
										type="checkbox" 
										className="checkbox checkbox-primary" 
										checked={breakConfig.balanceTeacherLoad}
										onChange={(e) => setBreakConfig(prev => ({ ...prev, balanceTeacherLoad: e.target.checked }))}
									/>
								</label>
							</div>
						</div>
					</div>
				</div>
			</div>

			{/* Teachers, Students, and Groups Management */}
			<div className="grid lg:grid-cols-2 gap-6">
				{/* Teachers */}
				<div className="card bg-base-100 shadow-lg">
					<div className="card-body">
						<div className="flex items-center justify-between mb-4">
							<h3 className="card-title">Teachers</h3>
							<Button 
								onClick={() => onTeachersChange([...teachers, createDefaultTeacher(teachers.length)])}
								className="btn-outline btn-sm"
							>
								<Plus className="h-4 w-4" />
							</Button>
						</div>
						<div className="space-y-4">
							{teachers.map((teacher, index) => (
								<div key={index} className="p-4 border border-base-300 rounded-lg bg-gradient-to-br from-base-50 to-base-100 shadow-sm hover:shadow-md transition-shadow">
									<div className="flex items-center justify-between mb-4">
										<div className="flex items-center gap-4">
											<div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
												<span className="text-primary font-bold text-lg">
													{teacher.name.charAt(0).toUpperCase()}
												</span>
											</div>
											<div>
												<h4 className="font-bold text-xl text-base-content">{teacher.name}</h4>
												<div className="flex items-center gap-2 mt-1">
													<span className="badge badge-primary badge-sm">📍 {teacher.room}</span>
													<span className="badge badge-secondary badge-sm">📚 {teacher.maxLessonsPerDay} max/day</span>
												</div>
											</div>
										</div>
										<Button
											onClick={() => onTeachersChange(teachers.filter((_, i) => i !== index))}
											className="btn-ghost btn-sm text-error hover:bg-error/10"
										>
											<Trash2 className="h-4 w-4" />
										</Button>
									</div>

									{/* Teacher Configuration */}
									<div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
										<div>
											<label className="text-sm font-semibold text-base-content/80 mb-2 block">Name</label>
										<Input
											value={teacher.name}
												onChange={(e) => onTeachersChange(teachers.map((t, i) => i === index ? {...t, name: e.target.value} : t))}
												className="h-10"
										/>
										</div>
										<div>
											<label className="text-sm font-semibold text-base-content/80 mb-2 block">Room</label>
										<Input
											value={teacher.room}
												onChange={(e) => onTeachersChange(teachers.map((t, i) => i === index ? {...t, room: e.target.value} : t))}
												className="h-10"
											/>
										</div>
									</div>
									
									<div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
										<div>
											<label className="text-sm font-semibold text-base-content/80 mb-2 block">Max Lessons/Day</label>
										<Input
											type="number"
											min="1"
												max="20"
											value={teacher.maxLessonsPerDay}
												onChange={(e) => onTeachersChange(teachers.map((t, i) => i === index ? {...t, maxLessonsPerDay: Math.max(1, parseInt(e.target.value) || 1)} : t))}
												className="h-10"
										/>
										</div>
										<div>
											<label className="text-sm font-semibold text-base-content/80 mb-2 block">Availability</label>
										<Input
											value={teacher.availability.join(', ')}
											onChange={(e) => {
												const values = e.target.value.split(',').map(v => v.trim()).filter(Boolean)
													onTeachersChange(teachers.map((t, i) => i === index ? {...t, availability: values.length > 0 ? values : ['08:00-18:00']} : t))
												}}
												placeholder="08:00-12:00, 14:00-18:00"
												className="h-10"
											/>
										</div>
									</div>
									
									{/* Specializations */}
									<div>
										<label className="text-sm font-semibold text-base-content/80 mb-2 block">Specializations</label>
										<Input
											value=""
											onChange={(e) => {}}
											placeholder="Ballet, Contemporary, Jazz"
											className="h-10"
										/>
									</div>
								</div>
							))}
						</div>
					</div>
				</div>

				{/* Students */}
				<div className="card bg-base-100 shadow-lg">
					<div className="card-body">
						<div className="flex items-center justify-between mb-4">
							<h3 className="card-title">Students</h3>
							<Button 
								onClick={() => onStudentsChange([...students, createDefaultStudent(students.length, teachers)])}
								className="btn-outline btn-sm"
							>
								<Plus className="h-4 w-4" />
							</Button>
						</div>
						<div className="space-y-4">
							{students.map((student, index) => (
								<div key={index} className="p-4 border border-base-300 rounded-lg bg-gradient-to-br from-secondary/5 to-secondary/10 shadow-sm hover:shadow-md transition-shadow">
									<div className="flex items-center justify-between mb-4">
										<div className="flex items-center gap-4">
											<div className="w-12 h-12 bg-secondary/20 rounded-full flex items-center justify-center">
												<span className="text-secondary font-bold text-lg">
													{student.name.charAt(0).toUpperCase()}
												</span>
										</div>
											<div>
												<h4 className="font-bold text-xl text-base-content">{student.name}</h4>
												<div className="flex items-center gap-2 mt-1">
													<span className="badge badge-secondary badge-sm">⭐ Priority {student.priority}</span>
													<span className="badge badge-primary badge-sm">📚 {student.desiredLessons} lessons</span>
									</div>
									</div>
										</div>
										<Button
											onClick={() => onStudentsChange(students.filter((_, i) => i !== index))}
											className="btn-ghost btn-sm text-error hover:bg-error/10"
										>
											<Trash2 className="h-4 w-4" />
										</Button>
				</div>

									{/* Student Configuration */}
									<div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
										<div>
											<label className="text-sm font-semibold text-base-content/80 mb-2 block">Priority Level</label>
											<div className="flex items-center gap-3">
												<Button
													onClick={() => onStudentsChange(students.map((s, i) => i === index ? {...s, priority: Math.max(1, s.priority - 1)} : s))}
													className="btn-ghost btn-sm"
													disabled={student.priority <= 1}
												>
													-
												</Button>
												<span className="text-lg font-bold text-secondary">{student.priority}</span>
												<Button
													onClick={() => onStudentsChange(students.map((s, i) => i === index ? {...s, priority: Math.min(10, s.priority + 1)} : s))}
													className="btn-ghost btn-sm"
													disabled={student.priority >= 10}
												>
													+
												</Button>
					</div>
										</div>
										<div>
											<label className="text-sm font-semibold text-base-content/80 mb-2 block">Desired Lessons (Total)</label>
							<Input
								type="number"
												min="0"
												max="20"
												value={student.desiredLessons}
												onChange={(e) => onStudentsChange(students.map((s, i) => i === index ? {...s, desiredLessons: Math.max(0, parseInt(e.target.value) || 0)} : s))}
												className="h-10"
											/>
										</div>
										<div>
											<label className="text-sm font-semibold text-base-content/80 mb-2 block">Weekly Lessons</label>
							<Input
								type="number"
												min="0"
								max="10"
												value={student.weeklyLessons || 0}
												onChange={(e) => onStudentsChange(students.map((s, i) => i === index ? {...s, weeklyLessons: Math.max(0, parseInt(e.target.value) || 0)} : s))}
												className="h-10"
											/>
										</div>
									</div>
									
									{/* Teacher Preferences */}
									<div className="mb-4">
										<label className="text-sm font-semibold text-base-content/80 mb-3 block">Teacher Preferences</label>
										<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
											{teachers.map((teacher) => (
												<div key={teacher.name} className="flex items-center justify-between p-3 bg-base-200 rounded-lg border border-base-300">
													<span className="text-sm font-medium">{teacher.name}</span>
							<Input
								type="number"
														min="0"
								max="10"
														value={student.teacherLessons?.[teacher.name] || 0}
														onChange={(e) => {
															const newTeacherLessons = {...(student.teacherLessons || {})}
															newTeacherLessons[teacher.name] = Math.max(0, parseInt(e.target.value) || 0)
															onStudentsChange(students.map((s, i) => i === index ? {...s, teacherLessons: newTeacherLessons} : s))
														}}
														className="w-20 h-8 text-center"
													/>
												</div>
											))}
										</div>
						</div>
						
									{/* Availability */}
									<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
										<div>
											<label className="text-sm font-semibold text-base-content/80 mb-2 block">Available Times</label>
							<Input
												value={student.availability.join(', ')}
												onChange={(e) => {
													const values = e.target.value.split(',').map(v => v.trim()).filter(Boolean)
													onStudentsChange(students.map((s, i) => i === index ? {...s, availability: values.length > 0 ? values : ['08:00-18:00']} : s))
												}}
												placeholder="08:00-12:00, 14:00-18:00"
												className="h-10"
											/>
										</div>
										<div>
											<label className="text-sm font-semibold text-base-content/80 mb-2 block">Unavailable Dates</label>
											<Input
												value={(student.unavailableDates || []).join(', ')}
												onChange={(e) => {
								const values = e.target.value.split(',').map(v => v.trim()).filter(Boolean)
													onStudentsChange(students.map((s, i) => i === index ? {...s, unavailableDates: values} : s))
												}}
												placeholder="2025-01-15, 2025-01-20"
												className="h-10"
											/>
						</div>
									</div>
								</div>
							))}
						</div>
					</div>
				</div>

			</div>

			{/* Student Groups & Group Lessons */}
			<div className="card bg-base-100 shadow-lg">
					<div className="card-body">
					<div className="flex items-center justify-between mb-6">
						<h3 className="card-title">Student Groups & Group Lessons</h3>
						<div className="flex gap-2">
							<Button
								onClick={() => onStudentGroupsChange([...studentGroups, {
									id: `group-${Date.now()}`,
									name: 'New Group',
									students: [],
									level: 'Beginner',
									ageRange: '5-8 years'
								}])}
								className="btn-outline btn-sm"
							>
								<Plus className="h-4 w-4" />
								Add Group
							</Button>
							<Button
								onClick={() => {
									// Create a new group lesson from form data
									const groupLesson = {
										id: `group-lesson-${Date.now()}`,
										name: newGroupLesson.name || 'New Group Lesson',
										teacher: newGroupLesson.teacher || teachers[0]?.name || 'Teacher',
										room: newGroupLesson.room || 'Studio A',
										studentGroups: newGroupLesson.studentGroups,
										duration: newGroupLesson.duration,
										startTime: newGroupLesson.startTime,
										endTime: newGroupLesson.endTime,
										dayOfWeek: newGroupLesson.dayOfWeek,
										maxStudents: newGroupLesson.maxStudents,
										type: 'group'
									}
									setGroupLessons(prev => [...prev, groupLesson])
									// Reset form
									setNewGroupLesson({
										name: '',
										teacher: '',
										room: '',
										startTime: '09:00',
										endTime: '09:45',
										dayOfWeek: 1,
										studentGroups: [],
										duration: 45,
										maxStudents: 12
									})
								}}
								className="btn-primary btn-sm"
							>
								<Plus className="h-4 w-4" />
								Create Group Lesson
							</Button>
						</div>
					</div>
					
					{/* Created Group Lessons */}
					{groupLessons.length > 0 && (
						<div className="mb-6">
							<h4 className="font-semibold text-accent mb-4">Created Group Lessons</h4>
							<div className="space-y-3">
								{groupLessons.map((lesson, index) => (
									<div key={lesson.id} className="flex items-center justify-between p-4 bg-accent/10 rounded-lg border border-accent/30">
										<div className="flex items-center gap-4">
											<div className="w-3 h-3 bg-accent rounded-full"></div>
											<div>
												<div className="font-semibold text-accent">{lesson.name}</div>
												<div className="text-sm text-base-content/70">
													{lesson.teacher} • {lesson.room} • {lesson.startTime}-{lesson.endTime}
												</div>
											</div>
										</div>
							<Button
											onClick={() => setGroupLessons(prev => prev.filter(l => l.id !== lesson.id))}
											className="btn-sm btn-error btn-outline"
							>
											Remove
							</Button>
						</div>
								))}
					</div>
				</div>
					)}

					{/* Group Lesson Configuration */}
					<div className="mb-6 p-4 bg-accent/5 rounded-lg border border-accent/20">
						<h4 className="font-semibold text-accent mb-4">Group Lesson Settings</h4>
						<div className="grid md:grid-cols-3 gap-4 mb-4">
							<div>
								<label className="text-sm font-medium text-base-content/70 mb-2 block">Lesson Name</label>
								<Input
									placeholder="Ballet Fundamentals"
									value={newGroupLesson.name}
									onChange={(e) => setNewGroupLesson(prev => ({ ...prev, name: e.target.value }))}
									className="h-10"
								/>
							</div>
							<div>
								<label className="text-sm font-medium text-base-content/70 mb-2 block">Teacher</label>
								<select 
									className="select select-bordered w-full h-10"
									value={newGroupLesson.teacher}
									onChange={(e) => setNewGroupLesson(prev => ({ ...prev, teacher: e.target.value }))}
								>
									<option value="">Select Teacher</option>
									{teachers.map((teacher, index) => (
										<option key={index} value={teacher.name}>{teacher.name}</option>
									))}
								</select>
							</div>
							<div>
								<label className="text-sm font-medium text-base-content/70 mb-2 block">Room</label>
								<Input
									placeholder="Studio A"
									value={newGroupLesson.room}
									onChange={(e) => setNewGroupLesson(prev => ({ ...prev, room: e.target.value }))}
									className="h-10"
								/>
							</div>
						</div>
						<div className="grid md:grid-cols-2 gap-4 mb-4">
							<div>
								<label className="text-sm font-medium text-base-content/70 mb-2 block">Day of Week</label>
								<select 
									className="select select-bordered w-full h-10"
									value={newGroupLesson.dayOfWeek}
									onChange={(e) => setNewGroupLesson(prev => ({ ...prev, dayOfWeek: parseInt(e.target.value) }))}
								>
									<option value={0}>Sunday</option>
									<option value={1}>Monday</option>
									<option value={2}>Tuesday</option>
									<option value={3}>Wednesday</option>
									<option value={4}>Thursday</option>
									<option value={5}>Friday</option>
									<option value={6}>Saturday</option>
								</select>
							</div>
							<div>
								<label className="text-sm font-medium text-base-content/70 mb-2 block">Duration (minutes)</label>
								<Input
									type="number"
									min="15"
									max="120"
									value={newGroupLesson.duration}
									onChange={(e) => {
										const duration = parseInt(e.target.value)
										const startTime = newGroupLesson.startTime
										const [hours, minutes] = startTime.split(':').map(Number)
										const endMinutes = minutes + duration
										const endHours = hours + Math.floor(endMinutes / 60)
										const finalMinutes = endMinutes % 60
										const endTime = `${endHours.toString().padStart(2, '0')}:${finalMinutes.toString().padStart(2, '0')}`
										setNewGroupLesson(prev => ({ ...prev, duration, endTime }))
									}}
									className="h-10"
								/>
						</div>
					</div>
						<div className="grid md:grid-cols-2 gap-4 mb-4">
							<div>
								<label className="text-sm font-medium text-base-content/70 mb-2 block">Start Time</label>
								<Input
									type="time"
									value={newGroupLesson.startTime}
									onChange={(e) => {
										const startTime = e.target.value
										const [hours, minutes] = startTime.split(':').map(Number)
										const endMinutes = minutes + newGroupLesson.duration
										const endHours = hours + Math.floor(endMinutes / 60)
										const finalMinutes = endMinutes % 60
										const endTime = `${endHours.toString().padStart(2, '0')}:${finalMinutes.toString().padStart(2, '0')}`
										setNewGroupLesson(prev => ({ ...prev, startTime, endTime }))
									}}
									className="h-10"
								/>
				</div>
							<div>
								<label className="text-sm font-medium text-base-content/70 mb-2 block">End Time</label>
								<Input
									type="time"
									value={newGroupLesson.endTime}
									onChange={(e) => setNewGroupLesson(prev => ({ ...prev, endTime: e.target.value }))}
									className="h-10"
								/>
								</div>
						</div>
						<div className="grid md:grid-cols-2 gap-4">
							<div>
								<label className="text-sm font-medium text-base-content/70 mb-2 block">Student Groups</label>
								<div className="flex flex-wrap gap-2">
									{studentGroups.map((group, index) => (
										<label key={index} className="flex items-center gap-2 cursor-pointer p-2 bg-base-200 rounded border">
											<input 
												type="checkbox" 
												className="checkbox checkbox-accent checkbox-sm"
												checked={newGroupLesson.studentGroups.includes(group.name)}
												onChange={(e) => {
													if (e.target.checked) {
														setNewGroupLesson(prev => ({ 
															...prev, 
															studentGroups: [...prev.studentGroups, group.name] 
														}))
													} else {
														setNewGroupLesson(prev => ({ 
															...prev, 
															studentGroups: prev.studentGroups.filter(g => g !== group.name) 
														}))
													}
												}}
											/>
											<span className="text-sm">{group.name}</span>
										</label>
									))}
							</div>
						</div>
							<div>
								<label className="text-sm font-medium text-base-content/70 mb-2 block">Max Students</label>
								<Input
									type="number"
									min="1"
									max="50"
									value={newGroupLesson.maxStudents}
									onChange={(e) => setNewGroupLesson(prev => ({ ...prev, maxStudents: parseInt(e.target.value) }))}
									className="h-10"
								/>
					</div>
				</div>
						</div>
					
					<div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
						{studentGroups.map((group, index) => (
							<div key={index} className="p-4 border border-base-300 rounded-lg bg-gradient-to-br from-accent/5 to-accent/10 shadow-sm hover:shadow-md transition-shadow">
								<div className="flex items-center justify-between mb-3">
									<div className="flex items-center gap-3">
										<div className="w-10 h-10 bg-accent/20 rounded-full flex items-center justify-center">
											<span className="text-accent font-bold">
												{group.name.charAt(0).toUpperCase()}
											</span>
						</div>
										<div>
											<h4 className="font-bold text-lg text-base-content">{group.name}</h4>
											<div className="flex items-center gap-2 mt-1">
												<span className="badge badge-accent badge-sm">{group.level}</span>
												<span className="badge badge-outline badge-sm">{group.ageRange}</span>
											</div>
											</div>
										</div>
										<Button
										onClick={() => onStudentGroupsChange(studentGroups.filter((_, i) => i !== index))}
										className="btn-ghost btn-xs text-error hover:bg-error/10"
										>
										<Trash2 className="h-4 w-4" />
										</Button>
								</div>
								<div className="text-sm text-base-content/70 mb-3">
									👥 {group.students.length} students
								</div>
								<div className="space-y-2">
									<div>
										<label className="text-xs font-medium text-base-content/60">Group Name</label>
										<Input
											value={group.name}
											onChange={(e) => onStudentGroupsChange(studentGroups.map((g, i) => i === index ? {...g, name: e.target.value} : g))}
											className="h-8 text-sm"
										/>
									</div>
									<div className="grid grid-cols-2 gap-2">
										<div>
											<label className="text-xs font-medium text-base-content/60">Level</label>
											<select 
												value={group.level}
												onChange={(e) => onStudentGroupsChange(studentGroups.map((g, i) => i === index ? {...g, level: e.target.value} : g))}
												className="select select-bordered select-sm w-full"
											>
												<option value="Beginner">Beginner</option>
												<option value="Intermediate">Intermediate</option>
												<option value="Advanced">Advanced</option>
											</select>
										</div>
										<div>
											<label className="text-xs font-medium text-base-content/60">Age Range</label>
											<Input
												value={group.ageRange}
												onChange={(e) => onStudentGroupsChange(studentGroups.map((g, i) => i === index ? {...g, ageRange: e.target.value} : g))}
												className="h-8 text-sm"
											/>
										</div>
									</div>
								</div>
									</div>
								))}
							</div>
				</div>
			</div>

			{/* Generated Timetable Display */}
			{generatedTimetable && (
				<div className="card bg-base-100 shadow-lg">
					<div className="card-body">
						<div className="flex items-center gap-4 mb-6">
							<CheckCircle className="h-6 w-6 text-primary" />
							<h3 className="card-title">Generated Timetable</h3>
						</div>
						
						{currentMode === 'weekly' ? (
							<div className="space-y-6">
								{/* Pagination Controls */}
								{Object.keys(generatedTimetable).length > weeksPerPage && (
									<div className="flex items-center justify-between bg-base-100 p-4 rounded-lg border">
										<div className="flex items-center gap-2">
								<Button
												onClick={() => setCurrentWeekPage(prev => Math.max(1, prev - 1))}
												disabled={currentWeekPage === 1}
												className="btn-sm btn-outline"
											>
												Previous
											</Button>
											<span className="text-sm text-base-content/70">
												Page {currentWeekPage} of {Math.ceil(Object.keys(generatedTimetable).length / weeksPerPage)}
											</span>
											<Button
												onClick={() => setCurrentWeekPage(prev => Math.min(Math.ceil(Object.keys(generatedTimetable).length / weeksPerPage), prev + 1))}
												disabled={currentWeekPage >= Math.ceil(Object.keys(generatedTimetable).length / weeksPerPage)}
												className="btn-sm btn-outline"
											>
												Next
								</Button>
							</div>
										<div className="text-sm text-base-content/70">
											Showing {((currentWeekPage - 1) * weeksPerPage) + 1}-{Math.min(currentWeekPage * weeksPerPage, Object.keys(generatedTimetable).length)} of {Object.keys(generatedTimetable).length} weeks
						</div>
					</div>
				)}

								{Object.entries(generatedTimetable)
									.slice((currentWeekPage - 1) * weeksPerPage, currentWeekPage * weeksPerPage)
									.map(([weekKey, weekData]: [string, any]) => (
									<div key={weekKey} className="border border-base-300 rounded-xl overflow-hidden">
										<div className="bg-primary/10 px-6 py-4 border-b border-base-300">
											<div className="flex items-center justify-between">
												<h4 className="text-xl font-bold text-primary">Week {weekData.weekNumber}</h4>
												<div className="text-sm text-base-content/70">
													{new Date(weekData.startDate).toLocaleDateString('en-US', { 
														weekday: 'short', 
														month: 'short', 
														day: 'numeric' 
													})} - {new Date(weekData.endDate).toLocaleDateString('en-US', { 
														weekday: 'short', 
														month: 'short', 
														day: 'numeric' 
													})}
							</div>
								</div>
											<div className="mt-2 text-sm text-base-content/70">
												{weekData.days ? weekData.days.reduce((total: number, day: any) => total + (day.lessons?.length || 0), 0) : 0} lessons scheduled
									</div>
								</div>
										<div className="p-6">
											<div className="space-y-4">
												{weekData.days?.map((day: any, dayIndex: number) => (
													<div key={dayIndex} className="border border-base-300 rounded-lg overflow-hidden">
														<div className="bg-gradient-to-r from-primary/20 to-secondary/20 px-4 py-3 border-b border-base-300">
															<div className="flex items-center justify-between">
																<div className="font-semibold text-base-content">
																	{new Date(day.date).toLocaleDateString([], { 
																		weekday: 'long', 
																		year: 'numeric',
																		month: 'long', 
																		day: 'numeric' 
																	})}
									</div>
																<div className="text-sm text-base-content/70">
																	{day.lessons?.filter((l: any) => l.type !== 'break').length || 0} lessons
								</div>
							</div>
						</div>
														<div className="p-4">
															<div className="grid gap-2">
																{day.lessons?.map((lesson: any, lessonIndex: number) => {
																	const isBreak = lesson.type === 'break' || lesson.student === 'Break' || lesson.teacher === 'Break'
																	const isConsecutiveBreak = lesson.id && lesson.id.includes('student-break')
																	
																	return (
																		<div key={lessonIndex} className={`flex items-center justify-between p-3 rounded-lg border transition-all duration-200 ${
																			isBreak 
																				? isConsecutiveBreak
																					? 'bg-info/10 border-info/30'
																					: 'bg-warning/10 border-warning/30'
																				: 'bg-primary/5 border-primary/20'
																		}`}>
																			<div className="flex items-center gap-3">
																				<div className={`w-3 h-3 rounded-full ${
																					isBreak 
																						? isConsecutiveBreak 
																							? 'bg-info' 
																							: 'bg-warning'
																						: 'bg-primary'
																				}`}></div>
																				<div>
																					<div className={`font-semibold ${
																						isBreak 
																							? isConsecutiveBreak 
																								? 'text-info' 
																								: 'text-warning'
																							: 'text-base-content'
																					}`}>
																						{isBreak 
																							? isConsecutiveBreak 
																								? '🔄 Student Break' 
																								: '⏰ Scheduled Break'
																							: `${lesson.student} with ${lesson.teacher}`
																						}
						</div>
																					{!isBreak && (
																						<div className="text-sm text-base-content/70">
																							{lesson.room}
					</div>
				)}
																				</div>
																			</div>
																			<div className="text-right">
																				<div className="text-sm font-medium text-base-content">
																					{new Date(lesson.start).toLocaleTimeString([], { 
																						hour: '2-digit', 
																						minute: '2-digit' 
																					})} - {new Date(lesson.end).toLocaleTimeString([], { 
																						hour: '2-digit', 
																						minute: '2-digit' 
																					})}
																				</div>
																			</div>
																		</div>
																	)
																})}
															</div>
														</div>
													</div>
						))}
					</div>
										</div>
									</div>
								))}
							</div>
						) : (
							<div className="space-y-6">
								{generatedTimetable.days?.map((day: any) => (
									<div key={day.date} className="border border-base-300 rounded-xl overflow-hidden">
										<div className="bg-gradient-to-r from-primary/20 to-secondary/20 px-6 py-4 border-b border-base-300">
											<div className="flex items-center justify-between">
												<h4 className="text-xl font-bold">
													{new Date(day.date).toLocaleDateString('en-US', { 
														weekday: 'long', 
														year: 'numeric', 
														month: 'long', 
														day: 'numeric' 
													})}
												</h4>
												<div className="flex items-center gap-2">
													<span className="badge badge-primary badge-lg">
														{day.lessons.filter((lesson: any) => !(lesson.type === 'break' || lesson.student === 'Break' || lesson.teacher === 'Break')).length} lessons
													</span>
												</div>
											</div>
										</div>
										<div className="p-6">
											<div className="space-y-2">
												{day.lessons.map((lesson: any, index: number) => {
													const isBreak = lesson.type === 'break' || lesson.student === 'Break' || lesson.teacher === 'Break'
													const isGroupLesson = lesson.studentGroups && lesson.studentGroups.length > 0
													const isConsecutiveBreak = lesson.id && lesson.id.includes('student-break')
													const duration = Math.round((new Date(lesson.end).getTime() - new Date(lesson.start).getTime()) / (1000 * 60))
													
													return (
														<div key={index} className={`group flex items-center justify-between p-4 rounded-lg border transition-all duration-200 ${
															isBreak 
																? isConsecutiveBreak
																	? 'bg-info/10 border-info/30 hover:border-info/50 hover:shadow-info/20'
																	: 'bg-warning/10 border-warning/30 hover:border-warning/50 hover:shadow-warning/20'
																: isGroupLesson
																? 'bg-accent/10 border-accent/30 hover:border-accent/50 hover:shadow-accent/20'
																: 'bg-primary/5 border-primary/20 hover:border-primary/50 hover:shadow-primary/20'
														} hover:shadow-md`}>
															<div className="flex items-center gap-4">
																<div className={`w-4 h-4 rounded-full group-hover:scale-110 transition-transform ${
																	isBreak 
																		? isConsecutiveBreak 
																			? 'bg-info' 
																			: 'bg-warning'
																		: isGroupLesson 
																		? 'bg-accent' 
																		: 'bg-primary'
																}`}></div>
																<div className="flex-1">
																	{isBreak ? (
																		<div className={`font-semibold flex items-center gap-2 ${
																			isConsecutiveBreak ? 'text-info' : 'text-warning'
																		}`}>
																			{isConsecutiveBreak ? '🔄 Student Break' : '⏰ Scheduled Break'}
																			<span className={`text-sm font-normal ${
																				isConsecutiveBreak ? 'text-info/70' : 'text-warning/70'
																			}`}>
																				{lesson.teacher && `(${lesson.teacher})`}
																			</span>
						</div>
																	) : isGroupLesson ? (
																		<div className="font-semibold text-base-content flex items-center gap-2">
																			<span className="text-lg">👥 Group Lesson</span>
																			<span className="text-sm font-normal text-base-content/70">with</span>
																			<span className="text-accent font-medium">{lesson.teacher || 'Teacher'}</span>
																		</div>
																	) : (
																		<div className="font-semibold text-base-content flex items-center gap-2">
																			<span className="text-lg">{lesson.student || 'Student'}</span>
																			<span className="text-sm font-normal text-base-content/70">with</span>
																			<span className="text-primary font-medium">{lesson.teacher || 'Teacher'}</span>
					</div>
				)}
																	{lesson.room && !isBreak && (
																		<div className="text-sm text-base-content/70 mt-1 flex items-center gap-1">
																			📍 {lesson.room}
																		</div>
																	)}
																	{isGroupLesson && lesson.studentGroups && (
																		<div className="text-sm text-accent/70 mt-1 flex items-center gap-1">
																			👥 {lesson.studentGroups.map((group: any) => group.name).join(', ')}
								</div>
																	)}
																	{lesson.type && !isBreak && (
																		<div className="text-xs text-base-content/60 mt-1">
																			{lesson.type}
																		</div>
																	)}
																</div>
															</div>
															<div className="flex items-center gap-3">
																<div className="text-right">
																	<div className={`font-bold text-lg ${
																		isBreak ? 'text-warning' : isGroupLesson ? 'text-accent' : 'text-primary'
																	}`}>
																		{new Date(lesson.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(lesson.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
																	</div>
																	<div className={`text-sm ${
																		isBreak ? 'text-warning/70' : isGroupLesson ? 'text-accent/70' : 'text-base-content/70'
																	}`}>
																		{duration} min
																	</div>
																</div>
																{!isBreak && (
																	<div className="flex gap-1">
									<Button
																			onClick={() => setEditingLesson(lesson)}
																			className="btn-sm btn-outline btn-primary"
																			title="Edit lesson"
									>
																			✏️
									</Button>
									<Button
																			onClick={() => {
																				// Remove lesson logic would go here
																				console.log('Remove lesson:', lesson.id)
																			}}
																			className="btn-sm btn-outline btn-error"
																			title="Remove lesson"
																		>
																			🗑️
									</Button>
									</div>
								)}
							</div>
						</div>
													)
												})}
												
												{/* Unused Time Indicator */}
												{day.unusedTime && day.unusedTime.length > 0 && (
													<div className="mt-4 p-3 bg-base-300/50 rounded-lg border border-dashed border-base-400">
														<div className="flex items-center gap-2 text-base-content/60">
															<div className="w-2 h-2 bg-base-content/40 rounded-full"></div>
															<span className="text-sm font-medium">Unused Time Slots:</span>
									</div>
														<div className="mt-2 flex flex-wrap gap-2">
															{day.unusedTime.map((slot: any, slotIndex: number) => (
																<span key={slotIndex} className="text-xs bg-base-200 px-2 py-1 rounded border">
																	{new Date(slot.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(slot.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
																	<span className="text-base-content/50 ml-1">
																		({Math.round((new Date(slot.end).getTime() - new Date(slot.start).getTime()) / (1000 * 60))} min)
													</span>
																</span>
															))}
												</div>
													</div>
												)}
											</div>
												</div>
											</div>
										))}
											</div>
										)}
								</div>
							</div>
						)}

			{error && (
				<Alert variant="error">
					{error}
				</Alert>
				)}

			{/* Lesson Edit Modal */}
			{editingLesson && (
				<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
					<div className="bg-base-100 rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
						<div className="p-6">
							<div className="flex items-center justify-between mb-6">
								<h3 className="text-xl font-bold">Edit Lesson</h3>
								<Button
									onClick={() => setEditingLesson(null)}
									className="btn-sm btn-ghost"
								>
									✕
								</Button>
							</div>
							
							<div className="space-y-4">
								<div>
									<label className="text-sm font-semibold text-base-content/80 mb-2 block">Student/Group</label>
									<Input
										value={editingLesson.student}
										onChange={(e) => setEditingLesson((prev: any) => ({ ...prev, student: e.target.value }))}
										className="h-10"
									/>
								</div>
								
								<div>
									<label className="text-sm font-semibold text-base-content/80 mb-2 block">Teacher</label>
									<select 
										className="select select-bordered w-full h-10"
										value={editingLesson.teacher}
										onChange={(e) => setEditingLesson((prev: any) => ({ ...prev, teacher: e.target.value }))}
									>
										{teachers.map((teacher, index) => (
											<option key={index} value={teacher.name}>{teacher.name}</option>
										))}
									</select>
								</div>
								
								<div>
									<label className="text-sm font-semibold text-base-content/80 mb-2 block">Room</label>
									<Input
										value={editingLesson.room || ''}
										onChange={(e) => setEditingLesson((prev: any) => ({ ...prev, room: e.target.value }))}
										className="h-10"
									/>
								</div>
								
								<div className="grid grid-cols-2 gap-4">
									<div>
										<label className="text-sm font-semibold text-base-content/80 mb-2 block">Start Time</label>
										<Input
											type="time"
											value={new Date(editingLesson.start).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
											onChange={(e) => {
												const [hours, minutes] = e.target.value.split(':').map(Number)
												const newStart = new Date(editingLesson.start)
												newStart.setHours(hours, minutes, 0, 0)
												setEditingLesson((prev: any) => ({ ...prev, start: newStart.toISOString() }))
											}}
											className="h-10"
										/>
									</div>
									<div>
										<label className="text-sm font-semibold text-base-content/80 mb-2 block">End Time</label>
										<Input
											type="time"
											value={new Date(editingLesson.end).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
											onChange={(e) => {
												const [hours, minutes] = e.target.value.split(':').map(Number)
												const newEnd = new Date(editingLesson.end)
												newEnd.setHours(hours, minutes, 0, 0)
												setEditingLesson((prev: any) => ({ ...prev, end: newEnd.toISOString() }))
											}}
											className="h-10"
										/>
									</div>
								</div>
							</div>
							
							<div className="flex gap-3 mt-6">
								<Button
									onClick={() => {
										// Save lesson changes logic would go here
										console.log('Save lesson:', editingLesson)
										setEditingLesson(null)
									}}
									className="btn-primary flex-1"
								>
									Save Changes
								</Button>
								<Button
									onClick={() => setEditingLesson(null)}
									className="btn-outline flex-1"
								>
									Cancel
								</Button>
							</div>
						</div>
					</div>
				</div>
			)}
			</div>
		)
})

UnifiedTimetable.displayName = 'UnifiedTimetable'

WeeklyTimetable.displayName = 'WeeklyTimetable'

export default function Dashboard() {
	// Unified timetable state
	const [timetableMode, setTimetableMode] = useState<'single-day' | 'multi-day' | 'weekly'>('multi-day')
	const [teachers, setTeachers] = useState<Teacher[]>(initialTeachers)
	const [students, setStudents] = useState<Student[]>(initialStudents)
	const [studentGroups, setStudentGroups] = useState<StudentGroup[]>(initialStudentGroups)
	const [generatedTimetable, setGeneratedTimetable] = useState<any>(null)
	
	// Handler functions
	const handleTeachersChange = (newTeachers: Teacher[]) => {
		setTeachers(newTeachers)
	}

	const handleStudentsChange = (newStudents: Student[]) => {
		setStudents(newStudents)
	}

	const handleStudentGroupsChange = (newGroups: StudentGroup[]) => {
		setStudentGroups(newGroups)
	}

	const handleTimetableChange = (timetable: any) => {
		setGeneratedTimetable(timetable)
	}

	const handleGenerateTimetable = () => {
		// This will be handled by the UnifiedTimetable component
	}


	return (
		<div className="min-h-screen bg-base-200 p-4">
			<div className="max-w-7xl mx-auto">
				{/* Header */}
				<div className="mb-8">
					<h1 className="text-4xl font-bold text-base-content mb-2">
						Unified Timetable Generator
					</h1>
					<p className="text-base-content/70">
						Generate and manage dance lesson schedules for single days, multiple days, or weekly programs with automatic algorithm sorting and manual editing
					</p>
				</div>

				{/* Unified Timetable System */}
				<UnifiedTimetable
					mode={timetableMode}
					teachers={teachers}
					students={students}
					studentGroups={studentGroups}
					onTeachersChange={handleTeachersChange}
					onStudentsChange={handleStudentsChange}
					onStudentGroupsChange={handleStudentGroupsChange}
					onTimetableChange={handleTimetableChange}
					onGenerateTimetable={handleGenerateTimetable}
				/>
			</div>
		</div>
	)
}