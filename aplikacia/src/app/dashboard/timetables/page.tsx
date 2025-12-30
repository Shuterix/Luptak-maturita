
'use client'

import { useEffect, useMemo, useState, useRef } from 'react'
import { useAuth } from '@/context/AuthContext'
import { Button, Input, Alert } from '@/components'
import { showAlertToast } from '@/components/toast/Toast'
import { nanoid } from 'nanoid'
import { isWeekend, parseISO } from 'date-fns'
import {
	generateMultiDayTimetable,
	Teacher,
	Student,
	TimetableLesson,
	DayScheduleMap,
	GroupLesson,
	Couple,
} from '../_utils/timetableAlgorithm'
import { TimetableEditorModal } from './components/TimetableEditorModal'
import { TimetableConfigModal } from './components/TimetableConfigModal'
import { SchedulerConfigModal } from './components/SchedulerConfigModal'
import { CreateTimetableModal } from './components/CreateTimetableModal'
import { AddStaticLessonModal } from './components/AddStaticLessonModal'
import MobileDaySelector from './components/MobileDaySelector'
import { useIsMobile } from '@/hooks/useMediaQuery'

type TimetableType = 'weekly' | 'yearly' | 'after_school' | 'camp' | 'custom'
type LessonType = 'group' | 'individual' | 'couple'
type LessonKind = 'lesson' | 'break' | 'unused'

type LessonStatus = 'scheduled' | 'cancelled' | 'completed' | 'no_show' | 'rescheduled'

interface LessonCancellation {
	byUserId?: string
	reason?: string
	at?: string
}

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
	status?: LessonStatus
	cancellation?: LessonCancellation
}

export default TimetableManager

interface TimetableRecord {
	_id: string
	name: string
	type: TimetableType
	startDate: string
	endDate: string
	dayStart?: string
	dayEnd?: string
	defaultLessonDuration?: number
	slotMinutes?: number
	lessons?: any[]
	createdAt?: string
	settings?: {
		daySchedules?: Record<string, { start: string; end: string }>
		ruleEnforcedDuringGeneration?: boolean
		metadata?: Record<string, unknown>
	}
}

type TimetableFormState = {
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



const timetableTypes: { label: string; value: TimetableType }[] = [
	{ label: 'After School', value: 'after_school' },
	{ label: 'Weekly', value: 'weekly' },
	{ label: 'Camp', value: 'camp' },
	{ label: 'Yearly', value: 'yearly' },
	{ label: 'Custom', value: 'custom' },
]

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

const SLOT_MINUTES = [5, 10, 15, 30] as const

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

const splitCommaSeparated = (value: string) =>
	value
		.replace(/\n/g, ',')
		.split(',')
		.map((entry) => entry.trim())
		.filter(Boolean)

const parseTeacherLessons = (value: string): Record<string, number> | undefined => {
	if (!value.trim()) return undefined
	return value.split(',').reduce<Record<string, number>>((acc, segment) => {
		const [teacherName, countStr] = segment.split(':').map((part) => part.trim())
		if (!teacherName || !countStr) return acc
		const count = Number(countStr)
		if (Number.isFinite(count) && count > 0) {
			acc[teacherName] = count
		}
		return acc
	}, {})
}

const createTeacherForm = (overrides: Partial<TeacherForm> = {}): TeacherForm => ({
	id: nanoid(),
	name: '',
	availability: '',
	maxLessonsPerDay: 4,
	room: '',
	unavailableDates: '',
	...overrides,
})

const createCoupleForm = (overrides: Partial<CoupleForm> = {}): CoupleForm => ({
	id: nanoid(),
	name: '',
	availability: '',
	desiredLessons: 2,
	priority: 5,
	teacherLessons: '',
	unavailableDates: '',
	...overrides,
})

const DEFAULT_AUTO_TEACHERS: TeacherForm[] = [
	createTeacherForm({
		name: 'Ms. Adams',
		availability: '08:00-12:00,13:00-16:00',
		room: 'Room A',
	}),
	createTeacherForm({
		name: 'Mr. Brown',
		availability: '09:00-12:00,14:00-17:00',
		room: 'Room B',
	}),
]

const DEFAULT_AUTO_COUPLES: CoupleForm[] = [
	createCoupleForm({
		name: 'Alice',
		availability: '08:00-10:30,13:00-15:00',
	}),
	createCoupleForm({
		name: 'Ben',
		availability: '09:30-12:00,14:30-16:30',
	}),
	createCoupleForm({
		name: 'Cara',
		availability: '08:00-11:00,15:00-17:00',
	}),
	createCoupleForm({
		name: 'David',
		availability: '10:00-12:30,13:30-16:00',
	}),
]

const DEFAULT_AUTO_BREAKS = '12:00-12:30'

const DEFAULT_AUTO_CONFIG = {
	lessonDuration: 45,
	studentBreakAfter: 3,
	teacherBreakAfter: 4,
}

const toMinutes = (time: string) => {
	const [hours, minutes] = time.split(':').map(Number)
	return hours * 60 + minutes
}

const toTimeString = (minutes: number) => {
	const hrs = Math.floor(minutes / 60)
	const mins = minutes % 60
	return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`
}

const addDuration = (time: string, duration: number) => {
	return toTimeString(toMinutes(time) + duration)
}

const overlap = (aStart: number, aEnd: number, bStart: number, bEnd: number) => aStart < bEnd && bStart < aEnd

const shareResources = (a: LessonForm, b: LessonForm) => {
	if (a.kind !== 'lesson' || b.kind !== 'lesson') return false
	if (a.teacherName && b.teacherName && a.teacherName === b.teacherName) return true
	if (a.roomLabel && b.roomLabel && a.roomLabel === b.roomLabel) return true
	if (a.studentNames.length && b.studentNames.length) {
		return a.studentNames.some((name) => b.studentNames.includes(name))
	}
	return false
}

const cascadeInsertLesson = (lessons: LessonForm[], incoming: LessonForm): LessonForm[] => {
	let candidate = { ...incoming }
	let placed = false
	const result = [...lessons]

	while (!placed) {
		const sameDay = result
			.filter((lesson) => lesson.date === candidate.date)
			.sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime))

		let conflictFound = false

		for (const lesson of sameDay) {
			const aStart = toMinutes(candidate.startTime)
			const aEnd = toMinutes(candidate.endTime)
			const bStart = toMinutes(lesson.startTime)
			const bEnd = toMinutes(lesson.endTime)

			if (!shareResources(candidate, lesson)) continue
			if (!overlap(aStart, aEnd, bStart, bEnd)) continue

			conflictFound = true
			if (lesson.locked) {
				// Place candidate after locked lesson
				candidate.startTime = lesson.endTime
				candidate.endTime = addDuration(candidate.startTime, candidate.duration)
				break
			}

			// Shift the existing (non-locked) lesson and any downstream
			const delta = candidate.duration
			const queue: LessonForm[] = [lesson]
			const visited = new Set<string>()

			while (queue.length) {
				const current = queue.shift()!
				if (visited.has(current.id)) continue
				visited.add(current.id)

				if (current.locked) continue

				const shiftedStart = addDuration(current.startTime, delta)
				const shiftedEnd = addDuration(current.endTime, delta)
				current.startTime = shiftedStart
				current.endTime = shiftedEnd

				// Push downstream lessons that now overlap
				for (const possible of sameDay) {
					if (possible.id === current.id) continue
					if (possible.locked) continue
					if (!shareResources(current, possible)) continue
					const currentStart = toMinutes(current.startTime)
					const currentEnd = toMinutes(current.endTime)
					const possibleStart = toMinutes(possible.startTime)
					const possibleEnd = toMinutes(possible.endTime)
					if (overlap(currentStart, currentEnd, possibleStart, possibleEnd)) {
						queue.push(possible)
					}
				}
			}

			// After shifting, ensure candidate still doesn't overlap the same lesson (rare) by restarting
			candidate = { ...candidate }
			break
		}

		if (!conflictFound) {
			placed = true
		}
	}

	return [...result, candidate]
}

const convertToApiLesson = (lesson: LessonForm, fallbackDuration: number) => {
	if (!lesson.date) throw new Error('Lesson date is required')
	const startIso = new Date(`${lesson.date}T${lesson.startTime}:00`).toISOString()
	const endIso = new Date(`${lesson.date}T${lesson.endTime}:00`).toISOString()
	const computedDuration = Math.max(1, toMinutes(lesson.endTime) - toMinutes(lesson.startTime))
	const durationMinutes = computedDuration || lesson.duration || fallbackDuration

	return {
		kind: lesson.kind,
		lessonType: lesson.lessonType,
		teacherName: lesson.teacherName,
		roomLabel: lesson.roomLabel,
		studentNames: lesson.studentNames,
		date: lesson.date,
		start: startIso,
		end: endIso,
		durationMinutes,
		locked: lesson.locked,
		manualOverride: lesson.manualOverride,
		notes: lesson.notes,
		breakType: lesson.breakType,
	}
}

const isoToLocalTime = (iso: string) => {
	const date = new Date(iso)
	if (Number.isNaN(date.getTime())) return '00:00'
	const hours = date.getHours().toString().padStart(2, '0')
	const minutes = date.getMinutes().toString().padStart(2, '0')
	return `${hours}:${minutes}`
}

const convertFromApiLesson = (lesson: any): LessonForm => {
	const isoStart = lesson.start ?? lesson.startTime ?? lesson.start_time
	const isoEnd = lesson.end ?? lesson.endTime ?? lesson.end_time
	const startTime = isoStart ? isoToLocalTime(isoStart) : '00:00'
	const endTime = isoEnd ? isoToLocalTime(isoEnd) : addDuration(startTime, lesson.durationMinutes ?? 45)

	return {
		id: lesson._id?.toString?.() ?? nanoid(),
		kind: lesson.kind ?? 'lesson',
		lessonType: lesson.lessonType ?? undefined,
		date: lesson.date ?? (isoStart ? isoStart.slice(0, 10) : ''),
		startTime,
		endTime,
		duration: lesson.durationMinutes ?? toMinutes(endTime) - toMinutes(startTime),
		teacherName: lesson.teacherName ?? undefined,
		roomLabel: lesson.roomLabel ?? undefined,
		studentNames: lesson.studentNames ?? [],
		locked: Boolean(lesson.locked),
		manualOverride: lesson.manualOverride ?? true,
		notes: lesson.notes ?? '',
		breakType: lesson.breakType,
		status: lesson.status ?? 'scheduled',
		cancellation: lesson.cancellation,
	}
}

const convertFromTimetableLesson = (lesson: TimetableLesson): LessonForm => {
	const startIso = lesson.start
	const endIso = lesson.end
	const startTime = isoToLocalTime(startIso)
	const endTime = isoToLocalTime(endIso)
	const studentNamesFromString = lesson.student ? lesson.student.split(',').map((s) => s.trim()).filter(Boolean) : []
	const participantNames =
		lesson.students && lesson.students.length
			? lesson.students
			: lesson.couples && lesson.couples.length
				? lesson.couples
				: studentNamesFromString
	// Prioritize lessonType from algorithm, then infer from participant count
	const inferredLessonType =
		lesson.lessonType ??
		(lesson.type === 'lesson'
			? participantNames.length > 1
				? 'group'
				: 'individual'
			: undefined)
	return {
		id: nanoid(),
		kind: lesson.type ?? 'lesson',
		lessonType: inferredLessonType,
		date: lesson.start.slice(0, 10),
		startTime,
		endTime,
		duration: Math.max(1, toMinutes(endTime) - toMinutes(startTime)),
		teacherName: lesson.teacher ?? undefined,
		roomLabel: lesson.room ?? undefined,
		studentNames: participantNames,
		locked: false,
		manualOverride: false,
		notes: lesson.groupName ? `Group: ${lesson.groupName}` : '', // Add group name as note for group lessons
		breakType: (lesson as any).breakType,
	}
}

export function TimetableManager() {
	const { user, refreshUser } = useAuth()
	const [loadingUser, setLoadingUser] = useState(false)
	const [timetables, setTimetables] = useState<TimetableRecord[]>([])
	const [selectedTimetableId, setSelectedTimetableId] = useState<string | null>(null)
	const [lessons, setLessons] = useState<LessonForm[]>([])
	const [lessonModalForm, setLessonModalForm] = useState<LessonForm | null>(null)
const [form, setForm] = useState<TimetableFormState>({ ...defaultFormState })
	const [loadingTimetables, setLoadingTimetables] = useState(false)
	const [saving, setSaving] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [info, setInfo] = useState<string | null>(null)
	const [viewingTimetableId, setViewingTimetableId] = useState<string | null>(null)
	const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
const [autoTeachers, setAutoTeachers] = useState<TeacherForm[]>(DEFAULT_AUTO_TEACHERS)
const [autoCouples, setAutoCouples] = useState<CoupleForm[]>(DEFAULT_AUTO_COUPLES)
const [savedCoupleConfigs, setSavedCoupleConfigs] = useState<Array<{ coupleId: string; desiredLessons: number; priority: number; teacherLessons: Record<string, number> }>>([])
const [autoBreaksInput, setAutoBreaksInput] = useState(DEFAULT_AUTO_BREAKS)
const [autoLessonDuration, setAutoLessonDuration] = useState(DEFAULT_AUTO_CONFIG.lessonDuration)
	const [autoStudentBreakAfter, setAutoStudentBreakAfter] = useState(DEFAULT_AUTO_CONFIG.studentBreakAfter)
	const [autoTeacherBreakAfter, setAutoTeacherBreakAfter] = useState(DEFAULT_AUTO_CONFIG.teacherBreakAfter)
	const [autoDayStart, setAutoDayStart] = useState('15:00')
	const [autoDayEnd, setAutoDayEnd] = useState('20:00')
	const [autoIncludeWeekends, setAutoIncludeWeekends] = useState(true)
	const [autoDistributeLessons, setAutoDistributeLessons] = useState(true)
	const [autoError, setAutoError] = useState<string | null>(null)
const [groupLessons, setGroupLessons] = useState<GroupLesson[]>([])
	const groupLessonsRef = useRef<GroupLesson[]>([])
	const [dbCouples, setDbCouples] = useState<any[]>([])
	const [loadingCouples, setLoadingCouples] = useState(false)
	const [dbTeachers, setDbTeachers] = useState<any[]>([])
	const [loadingTeachers, setLoadingTeachers] = useState(false)
const [isEditorModalOpen, setIsEditorModalOpen] = useState(false)
	const [isConfigModalOpen, setIsConfigModalOpen] = useState(false)
	const [isSchedulerModalOpen, setIsSchedulerModalOpen] = useState(false)
	const [isAddStaticLessonModalOpen, setIsAddStaticLessonModalOpen] = useState(false)
	const [showTimetableFullscreen, setShowTimetableFullscreen] = useState(false)
	const [deleteConfirmTimetable, setDeleteConfirmTimetable] = useState<TimetableRecord | null>(null)
	const [deletingTimetableId, setDeletingTimetableId] = useState<string | null>(null)
	
	// Overwrite confirmation states
	const [overwriteConfirmTimetable, setOverwriteConfirmTimetable] = useState<TimetableRecord | null>(null)
	const [showNewNameInput, setShowNewNameInput] = useState(false)
	const [newTimetableName, setNewTimetableName] = useState('')

	// Mobile responsive states
	const [mobileSelectedDate, setMobileSelectedDate] = useState<string | null>(null)
	const isMobile = useIsMobile()

	const canSubmit = useMemo(() => {
		// Basic validation: user must be logged in and have club, and name must be provided
		if (!user?.clubId || !user?._id || !form.name.trim()) {
			return false
		}

		// For weekly timetables, dates are optional (universal template)
		if (form.type === 'weekly') {
			// If dates are provided, they must be valid (start <= end)
			// But dates can be empty for weekly templates
			if (form.startDate && form.endDate) {
				return new Date(form.startDate) <= new Date(form.endDate)
			}
			// Allow saving with empty dates for weekly timetables
			return true
		}

		// For other types, dates are required
		if (!form.startDate || !form.endDate) {
			return false
		}

		// Dates must be valid (start <= end)
		return new Date(form.startDate) <= new Date(form.endDate)
	}, [user, form])

	useEffect(() => {
		if (!user) {
			setLoadingUser(true)
			refreshUser().finally(() => setLoadingUser(false))
		}
	}, [user, refreshUser])

	const fetchTimetables = async (clubId: string) => {
		setLoadingTimetables(true)
		setError(null)
		try {
			const res = await fetch(`/api/timetables?clubId=${clubId}&includeLessons=false`, { cache: 'no-store' })
			if (!res.ok) throw new Error('Failed to load timetables')
			const data = await res.json()
			const payload: TimetableRecord[] = data.timetables || []
			setTimetables(payload)
		} catch (err: any) {
			console.error(err)
			setError(err.message ?? 'Unable to load timetables')
		} finally {
			setLoadingTimetables(false)
		}
	}

	const loadTimetableForEditing = async (timetableId: string) => {
		setLoadingTimetables(true)
		setError(null)
		try {
			const res = await fetch(`/api/timetables?clubId=${user?.clubId}&includeLessons=true`, { cache: 'no-store' })
			if (!res.ok) throw new Error('Failed to load timetable')
			const data = await res.json()
			const timetable = data.timetables?.find((t: TimetableRecord) => t._id === timetableId)
			if (timetable) {
				setSelectedTimetableId(timetable._id)
				setViewingTimetableId(timetable._id)
				setLessons((timetable.lessons ?? []).map(convertFromApiLesson))
				const loadedDayStart = timetable.dayStart || '15:00'
				const loadedDayEnd = timetable.dayEnd || '20:00'
				setForm({
					name: timetable.name,
					type: timetable.type,
					startDate: timetable.startDate,
					endDate: timetable.endDate,
					dayStart: loadedDayStart,
					dayEnd: loadedDayEnd,
					defaultLessonDuration: timetable.defaultLessonDuration || 45,
					slotMinutes: (timetable.slotMinutes || 15) as (typeof SLOT_MINUTES)[number],
				})

				// Restore saved configurations from settings.metadata
				const metadata = timetable.settings?.metadata
				if (metadata) {
					// Restore scheduler configuration
					const schedulerConfig = metadata.schedulerConfig as any
					if (schedulerConfig) {
						// Restore teachers - ensure we restore all properties
						if (schedulerConfig.teachers && Array.isArray(schedulerConfig.teachers)) {
							setAutoTeachers(schedulerConfig.teachers)
						}
						// Restore couples - ensure we restore all properties including desiredLessons, priority, teacherLessons
						if (schedulerConfig.couples && Array.isArray(schedulerConfig.couples)) {
							setAutoCouples(schedulerConfig.couples)
						}
						if (schedulerConfig.breaks !== undefined) setAutoBreaksInput(schedulerConfig.breaks)
						if (schedulerConfig.lessonDuration !== undefined) setAutoLessonDuration(schedulerConfig.lessonDuration)
						if (schedulerConfig.studentBreakAfter !== undefined) setAutoStudentBreakAfter(schedulerConfig.studentBreakAfter)
						if (schedulerConfig.teacherBreakAfter !== undefined) setAutoTeacherBreakAfter(schedulerConfig.teacherBreakAfter)
						if (schedulerConfig.dayStart) setAutoDayStart(schedulerConfig.dayStart)
						if (schedulerConfig.dayEnd) setAutoDayEnd(schedulerConfig.dayEnd)
						if (schedulerConfig.includeWeekends !== undefined) setAutoIncludeWeekends(schedulerConfig.includeWeekends)
						if (schedulerConfig.distributeLessons !== undefined) setAutoDistributeLessons(schedulerConfig.distributeLessons)
						// Restore couple configs (desired lessons, priority, teacher assignments for database couples)
						if (schedulerConfig.coupleConfigs && Array.isArray(schedulerConfig.coupleConfigs)) {
							setSavedCoupleConfigs(schedulerConfig.coupleConfigs)
							// Also sync to localStorage for use in handleGenerateAutomaticSchedule
							if (typeof window !== 'undefined') {
								window.localStorage.setItem('coupleConfigs', JSON.stringify(schedulerConfig.coupleConfigs))
							}
						} else {
							setSavedCoupleConfigs([])
						}
					} else {
						// No scheduler config saved, use timetable day start/end and reset to empty arrays
						setAutoDayStart(loadedDayStart)
						setAutoDayEnd(loadedDayEnd)
						setAutoTeachers([])
						setAutoCouples([])
						setAutoBreaksInput(DEFAULT_AUTO_BREAKS)
						setAutoLessonDuration(DEFAULT_AUTO_CONFIG.lessonDuration)
						setAutoStudentBreakAfter(DEFAULT_AUTO_CONFIG.studentBreakAfter)
						setAutoTeacherBreakAfter(DEFAULT_AUTO_CONFIG.teacherBreakAfter)
						setAutoIncludeWeekends(true)
						// Clear couple configs
						setSavedCoupleConfigs([])
						if (typeof window !== 'undefined') {
							window.localStorage.removeItem('coupleConfigs')
						}
					}

					// Restore group lessons configuration
					const savedGroupLessons = metadata.groupLessons as GroupLesson[] | undefined
					if (savedGroupLessons && Array.isArray(savedGroupLessons)) {
						setGroupLessons(savedGroupLessons)
						groupLessonsRef.current = savedGroupLessons
					} else {
						// If no saved group lessons, clear them
						setGroupLessons([])
						groupLessonsRef.current = []
					}
				} else {
					// No saved metadata, use timetable day start/end and reset to empty arrays (not defaults)
					setAutoDayStart(loadedDayStart)
					setAutoDayEnd(loadedDayEnd)
					setAutoTeachers([])
					setAutoCouples([])
					setAutoBreaksInput(DEFAULT_AUTO_BREAKS)
					setAutoLessonDuration(DEFAULT_AUTO_CONFIG.lessonDuration)
					setAutoStudentBreakAfter(DEFAULT_AUTO_CONFIG.studentBreakAfter)
					setAutoTeacherBreakAfter(DEFAULT_AUTO_CONFIG.teacherBreakAfter)
					setAutoIncludeWeekends(true)
					setGroupLessons([])
					groupLessonsRef.current = []
					// Clear couple configs
					setSavedCoupleConfigs([])
					if (typeof window !== 'undefined') {
						window.localStorage.removeItem('coupleConfigs')
					}
				}
			}
		} catch (err: any) {
			console.error(err)
			setError(err.message ?? 'Unable to load timetable')
		} finally {
			setLoadingTimetables(false)
		}
	}

	useEffect(() => {
		if (user?.clubId && !viewingTimetableId) {
			fetchTimetables(user.clubId)
			fetchDbCouples()
			fetchDbTeachers()
		}
	}, [user?.clubId, viewingTimetableId])

	// Keep ref in sync with state
	useEffect(() => {
		groupLessonsRef.current = groupLessons
	}, [groupLessons])

	const fetchDbCouples = async () => {
		if (!user?.clubId) return
		setLoadingCouples(true)
		try {
			const res = await fetch('/api/pairs', { cache: 'no-store' })
			if (res.ok) {
		const data = await res.json()
				setDbCouples(data.pairs || [])
			}
		} catch (err) {
			console.error('Error fetching couples:', err)
	} finally {
			setLoadingCouples(false)
		}
	}

	const fetchDbTeachers = async () => {
		if (!user?.clubId) return
		setLoadingTeachers(true)
		try {
			const res = await fetch(`/api/users?clubId=${user.clubId}&role=trainer`, { cache: 'no-store' })
			if (res.ok) {
				const data = await res.json()
				setDbTeachers(data.users || [])
			}
		} catch (err) {
			console.error('Error fetching teachers:', err)
		} finally {
			setLoadingTeachers(false)
		}
	}

	// Convert unavailability to availability for the algorithm
	// The algorithm expects availability (times when CAN train), but we store unavailability (times when CANNOT train)
	// For a day with hours dayStart-dayEnd, if unavailability is empty, availability is the full day
	// If unavailability exists, we calculate the inverse (available times = day hours minus unavailability)
	// 
	// IMPORTANT: Since different days may have different unavailability, we calculate the BEST case availability
	// (i.e., availability windows that exist on at least one day). The actual scheduling will respect
	// day-specific unavailability when checking if a student is available on a specific date.
	const convertUnavailabilityToAvailability = (
		unavailability: any,
		dayStart: string,
		dayEnd: string
	): string[] => {
		// If no unavailability, available for the entire day
		if (!unavailability) {
			return [`${dayStart}-${dayEnd}`]
		}
		
		const dayStartMinutes = toMinutes(dayStart)
		const dayEndMinutes = toMinutes(dayEnd)
		
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
		
		// Calculate availability for EACH day separately, then find the union of all available times
		// This way, if someone is available 15:00-20:00 on Monday but only 18:00-20:00 on Tuesday,
		// we return 15:00-20:00 (the best case) and let the day-specific logic handle restrictions
		const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const
		const allAvailableWindows: Array<{ start: number; end: number }> = []
		
		for (const day of days) {
			const dayUnavailWindows = getWindowsForDay(day)
			
			// Convert to minute ranges and clip to day schedule
			const unavailRanges: Array<{ start: number; end: number }> = []
			for (const window of dayUnavailWindows) {
				if (window.start && window.end) {
					const startMinutes = toMinutes(window.start)
					const endMinutes = toMinutes(window.end)
					// Only include windows that overlap with the day schedule
					if (startMinutes < dayEndMinutes && endMinutes > dayStartMinutes) {
						unavailRanges.push({
							start: Math.max(startMinutes, dayStartMinutes),
							end: Math.min(endMinutes, dayEndMinutes),
						})
					}
				}
			}
			
			// Calculate available windows for this day (invert unavailability)
			unavailRanges.sort((a, b) => a.start - b.start)
			let currentStart = dayStartMinutes
			
			for (const unavail of unavailRanges) {
				if (currentStart < unavail.start) {
					allAvailableWindows.push({ start: currentStart, end: unavail.start })
				}
				currentStart = Math.max(currentStart, unavail.end)
			}
			
			if (currentStart < dayEndMinutes) {
				allAvailableWindows.push({ start: currentStart, end: dayEndMinutes })
			}
		}
		
		// If no available windows on any day, return empty (will cause validation error)
		if (allAvailableWindows.length === 0) {
			return []
		}
		
		// Merge overlapping available windows to get unique availability ranges
		allAvailableWindows.sort((a, b) => a.start - b.start)
		const mergedWindows: Array<{ start: number; end: number }> = []
		
		for (const window of allAvailableWindows) {
			if (mergedWindows.length === 0) {
				mergedWindows.push({ ...window })
			} else {
				const last = mergedWindows[mergedWindows.length - 1]
				if (window.start <= last.end) {
					// Overlapping or adjacent, merge
					last.end = Math.max(last.end, window.end)
				} else {
					mergedWindows.push({ ...window })
				}
			}
		}
		
		// Convert back to time strings
		return mergedWindows.map(w => `${toTimeString(w.start)}-${toTimeString(w.end)}`)
	}

const handleAddAutoTeacher = () => {
	setAutoTeachers((prev) => [...prev, createTeacherForm()])
}

const handleRemoveAutoTeacher = (id: string) => {
	setAutoTeachers((prev) => (prev.length > 1 ? prev.filter((teacher) => teacher.id !== id) : prev))
}

const handleUpdateAutoTeacher = <K extends keyof TeacherForm>(id: string, key: K, value: TeacherForm[K]) => {
	setAutoTeachers((prev) => prev.map((teacher) => (teacher.id === id ? { ...teacher, [key]: value } : teacher)))
}

const handleAddAutoCouple = () => {
	setAutoCouples((prev) => [...prev, createCoupleForm()])
}

const handleRemoveAutoCouple = (id: string) => {
	setAutoCouples((prev) => (prev.length > 1 ? prev.filter((couple) => couple.id !== id) : prev))
}

const handleUpdateAutoCouple = <K extends keyof CoupleForm>(id: string, key: K, value: CoupleForm[K]) => {
	setAutoCouples((prev) => prev.map((couple) => (couple.id === id ? { ...couple, [key]: value } : couple)))
}

const handleGenerateAutomaticSchedule = () => {
	setAutoError(null)

	// Use ref to get the latest group lessons (state might be stale due to async updates)
	const currentGroupLessons = groupLessonsRef.current.length > 0 ? groupLessonsRef.current : groupLessons
	
	// Log the groupLessons state at the very start of the function
	console.log('page.tsx: handleGenerateAutomaticSchedule START - groupLessons state:', JSON.stringify(groupLessons.map(gl => ({
		groupName: gl.groupName,
		teachers: gl.teachers,
		participantsCount: gl.participants?.length || 0,
	})), null, 2))
	console.log('page.tsx: handleGenerateAutomaticSchedule START - groupLessonsRef.current:', JSON.stringify(currentGroupLessons.map(gl => ({
		groupName: gl.groupName,
		teachers: gl.teachers,
		participantsCount: gl.participants?.length || 0,
	})), null, 2))

	// For weekly timetables without dates, use current week as default
	// For other types or if dates are provided, use the specified dates
	let startDate = form.startDate
	let endDate = form.endDate
	
	if (!startDate || !endDate || startDate === '' || endDate === '') {
		if (form.type === 'weekly') {
			// Use current week (Monday to Sunday) as default
			const today = new Date()
			const dayOfWeek = today.getDay()
			const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek // Get to Monday
			const monday = new Date(today)
			monday.setDate(today.getDate() + diff)
			const sunday = new Date(monday)
			sunday.setDate(monday.getDate() + 6)
			
			startDate = monday.toISOString().split('T')[0]
			endDate = sunday.toISOString().split('T')[0]
		} else {
			setAutoError('Please provide a date range before generating the timetable.')
			return
		}
	}

		// Use database teachers - convert their unavailability to availability for the algorithm
		if (dbTeachers.length === 0) {
			setAutoError('No teachers found in database. Please ensure trainers are registered in the club.')
			return
		}

		// Get teacher configs from localStorage if available
		const storedTeacherConfigsStr = typeof window !== 'undefined' ? window.localStorage.getItem('teacherConfigs') : null
		const teacherConfigsMap: Record<string, { maxLessonsPerDay: number; room: string }> = {}
		if (storedTeacherConfigsStr) {
			try {
				const configs = JSON.parse(storedTeacherConfigsStr)
				configs.forEach((config: any) => {
					teacherConfigsMap[config.teacherId] = {
						maxLessonsPerDay: config.maxLessonsPerDay ?? 4,
						room: config.room || '',
					}
				})
			} catch (e) {
				console.warn('Failed to parse teacher configs from localStorage')
			}
		}

		const teacherPayload: Teacher[] = dbTeachers.map((teacher, index) => {
			const teacherName = `${teacher.firstName} ${teacher.lastName}`
			const config = teacherConfigsMap[teacher._id] || { maxLessonsPerDay: 4, room: '' }
			
			// Convert teacher unavailability to availability for the algorithm
			const availability = convertUnavailabilityToAvailability(
				teacher.unavailability,
				autoDayStart,
				autoDayEnd
			)
			
			return {
				name: teacherName,
				availability,
				maxLessonsPerDay: Math.max(1, config.maxLessonsPerDay || 4),
				room: config.room || `Room ${index + 1}`,
				unavailableDates: [], // TODO: Add support for teacher unavailable dates
			}
		})

		// Use only database couples - no fallback to manual input
		if (dbCouples.length === 0) {
			setAutoError('No couples found in database. Please create couples in the Couples management page first.')
			return
		}

		// Get couple configs from localStorage if available
		const storedConfigsStr = typeof window !== 'undefined' ? window.localStorage.getItem('coupleConfigs') : null
		const coupleConfigsMap: Record<string, { desiredLessons: number; priority: number; teacherLessons: Record<string, number> }> = {}
		if (storedConfigsStr) {
			try {
				const configs = JSON.parse(storedConfigsStr)
				configs.forEach((config: any) => {
					coupleConfigsMap[config.coupleId] = {
						desiredLessons: config.desiredLessons ?? 2, // Use ?? instead of || to allow 0
						priority: config.priority ?? 5,
						teacherLessons: config.teacherLessons || {},
					}
				})
			} catch (e) {
				// Failed to parse couple configs - will use defaults
			}
		}

		const couplePayload: Student[] = dbCouples
			.filter((pair) => {
				const studentA = pair.studentAId
				const studentB = pair.studentBId
				return studentA && studentB
			})
			.map((pair) => {
				const studentA = pair.studentAId
				const studentB = pair.studentBId
				const coupleName = `${studentA.firstName} ${studentA.lastName} & ${studentB.firstName} ${studentB.lastName}`
				// Convert couple unavailability to availability for the algorithm
				const availability = convertUnavailabilityToAvailability(
					pair.unavailability,
					autoDayStart,
					autoDayEnd
				)
				
				// Use configured values or defaults
				const config = coupleConfigsMap[pair._id] || {
					desiredLessons: 2,
					priority: 5,
					teacherLessons: pair.preferredTeacherId ? {
						[`${pair.preferredTeacherId.firstName} ${pair.preferredTeacherId.lastName}`]: 2
					} : {},
				}
				
				// Filter out teacherLessons that reference non-existent teachers
				const validTeacherLessons: Record<string, number> = {}
				if (config.teacherLessons && Object.keys(config.teacherLessons).length > 0) {
					Object.entries(config.teacherLessons).forEach(([teacherName, count]) => {
						// Only include teachers that actually exist in the teacherPayload
						if (teacherPayload.find(t => t.name === teacherName)) {
							validTeacherLessons[teacherName] = count
						}
					})
				}
				
				// Calculate desiredLessons from valid teacherLessons
				let finalDesiredLessons = config.desiredLessons
				if (Object.keys(validTeacherLessons).length > 0) {
					const totalTeacherLessons = Object.values(validTeacherLessons).reduce((sum, count) => sum + count, 0)
					// If desiredLessons is 0 or less than sum of teacherLessons, use the sum of teacherLessons
					if (finalDesiredLessons === 0 || finalDesiredLessons < totalTeacherLessons) {
						finalDesiredLessons = totalTeacherLessons
					}
				}
				
				// If no valid teacherLessons remain, clear teacherLessons
				const finalTeacherLessons = Object.keys(validTeacherLessons).length > 0 ? validTeacherLessons : undefined
				
				return {
					name: coupleName,
					availability,
					desiredLessons: finalDesiredLessons,
					priority: config.priority,
					teacherLessons: finalTeacherLessons,
					unavailableDates: [],
					baseGroup: pair.baseGroup,
				}
			})
			.filter((couple) => {
				// Only include couples that actually want lessons (desiredLessons > 0)
				return couple.desiredLessons > 0
			})

	if (!teacherPayload || teacherPayload.length === 0) {
		setAutoError('Add at least one teacher with availability to generate the timetable.')
		return
	}

	// Use ref to get the latest group lessons (state might be stale due to async updates)
	const latestGroupLessons = groupLessonsRef.current.length > 0 ? groupLessonsRef.current : groupLessons
	const hasGroupLessons = latestGroupLessons && latestGroupLessons.length > 0

	// Allow generation to proceed even if no couples have desired lessons
	// The algorithm will simply not schedule individual lessons, only group lessons if configured
	// No validation needed here - let the algorithm handle empty couplePayload

	const breaks = splitCommaSeparated(autoBreaksInput)

	const autoDaySchedules: DayScheduleMap = {}
	// Use the calculated startDate and endDate (which may be default week for weekly timetables)
	if (startDate && endDate) {
		const start = new Date(startDate)
		const end = new Date(endDate)
		if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && start <= end) {
			for (let cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
				const key = cursor.toISOString().split('T')[0]
				autoDaySchedules[key] = {
					start: autoDayStart,
					end: autoDayEnd,
				}
			}
		}
	}

	try {
		const config = {
			lessonDuration: Math.max(5, Number(autoLessonDuration) || DEFAULT_AUTO_CONFIG.lessonDuration),
			studentBreakAfter: Math.max(1, Number(autoStudentBreakAfter) || DEFAULT_AUTO_CONFIG.studentBreakAfter),
			teacherBreakAfter: Math.max(1, Number(autoTeacherBreakAfter) || DEFAULT_AUTO_CONFIG.teacherBreakAfter),
			distributeLessons: autoDistributeLessons,
		}

		// Use ref to get the latest group lessons (state might be stale due to async updates)
		const latestGroupLessons = groupLessonsRef.current.length > 0 ? groupLessonsRef.current : groupLessons
		
		// Log the groupLessons state before filtering
		console.log('page.tsx: groupLessons state before filtering:', JSON.stringify(latestGroupLessons.map(gl => ({
			groupName: gl.groupName,
			teachers: gl.teachers,
			participantsCount: gl.participants?.length || 0,
			staticTimeSlot: gl.staticTimeSlot,
		})), null, 2))

		// Filter out invalid group lessons (must have groupName, teachers, and participants)
		const validGroupLessons = latestGroupLessons.filter(gl => {
			const isValid = gl && gl.groupName && gl.teachers && gl.teachers.length > 0 && gl.participants && gl.participants.length > 0
			if (!isValid) {
				console.log('page.tsx: Filtered out invalid group lesson:', {
					groupName: gl?.groupName,
					hasTeachers: !!(gl?.teachers && gl.teachers.length > 0),
					hasParticipants: !!(gl?.participants && gl.participants.length > 0),
				})
			}
			return isValid
		})

		// Create a list of all couples for validation (even with 0 desired lessons)
		// This is needed to validate group lesson participants
		const allCouplesForValidation = dbCouples.map(pair => {
			const studentA = pair.studentAId
			const studentB = pair.studentBId
			const coupleName = `${studentA.firstName} ${studentA.lastName} & ${studentB.firstName} ${studentB.lastName}`
			const availability = convertUnavailabilityToAvailability(
				pair.unavailability,
				autoDayStart,
				autoDayEnd
			)
			return {
				name: coupleName,
				availability,
				desiredLessons: 0,
				priority: 5,
				unavailableDates: [],
				baseGroup: pair.baseGroup,
			}
		})

		// Convert group lessons participants to algorithm format (with availability)
		const convertedGroupLessons = validGroupLessons.map(gl => {
			// Convert participants to have availability from dbCouples
			const participantsWithAvailability = gl.participants.map(participant => {
				// Find the corresponding couple in dbCouples
				const dbCouple = dbCouples.find(pair => {
					const studentA = pair.studentAId
					const studentB = pair.studentBId
					const coupleName = `${studentA.firstName} ${studentA.lastName} & ${studentB.firstName} ${studentB.lastName}`
					return coupleName === participant.name
				})
				
				if (!dbCouple) {
					console.warn(`Group lesson ${gl.groupName}: Participant couple "${participant.name}" not found in database. Using default availability.`)
				}
				
				// Convert unavailability to availability for the algorithm
				const availability = dbCouple 
					? convertUnavailabilityToAvailability(
						dbCouple.unavailability,
						autoDayStart,
						autoDayEnd
					)
					: [`${autoDayStart}-${autoDayEnd}`] // Default: available anytime
				
				// Return in the format expected by the algorithm (Couple interface)
				// The algorithm only uses name and availability for group lessons, but we need to satisfy the type
				return {
					name: participant.name,
					availability,
					desiredLessons: 0, // Not used for group lessons
					priority: 5, // Default priority
					unavailableDates: [],
					baseGroup: participant.baseGroup,
					// Create minimal Student objects for type compatibility
					studentA: {
						name: participant.studentA.name,
						availability: availability, // Use couple availability
						desiredLessons: 0,
						priority: 5,
						unavailableDates: [],
					},
					studentB: {
						name: participant.studentB.name,
						availability: availability, // Use couple availability
						desiredLessons: 0,
						priority: 5,
						unavailableDates: [],
					},
				} as Couple
			})
			
			return {
				...gl,
				participants: participantsWithAvailability,
			}
		})

		const result = generateMultiDayTimetable(
			startDate,
			endDate,
			teacherPayload,
				couplePayload,
			breaks,
			autoDaySchedules,
			config,
			convertedGroupLessons,
		)

		// Filter out weekends if includeWeekends is false
		let filteredDays = result?.days || []
		if (!autoIncludeWeekends && result?.days) {
			filteredDays = result.days.filter((day) => {
				const date = parseISO(day.date)
				return !isWeekend(date)
			})
		}

		// Update result to use filtered days
		const filteredResult = result ? { ...result, days: filteredDays } : result

		const generatedLessons = filteredDays.flatMap((day) => day.lessons.map((lesson) => convertFromTimetableLesson(lesson)))

		// Single comprehensive log with all input and output
		console.log(JSON.stringify({
			input: {
				timetable: {
					name: form.name,
					type: form.type,
					startDate: startDate,
					endDate: endDate,
					originalStartDate: form.startDate || null,
					originalEndDate: form.endDate || null,
					dayStart: form.dayStart,
					dayEnd: form.dayEnd,
					defaultLessonDuration: form.defaultLessonDuration,
					slotMinutes: form.slotMinutes,
				},
				scheduler: {
					dayStart: autoDayStart,
					dayEnd: autoDayEnd,
					breaks: autoBreaksInput,
					lessonDuration: autoLessonDuration,
					studentBreakAfter: autoStudentBreakAfter,
					teacherBreakAfter: autoTeacherBreakAfter,
				},
				teachers: autoTeachers.map(t => ({
					name: t.name,
					unavailability: t.availability,
					maxLessonsPerDay: t.maxLessonsPerDay,
					room: t.room,
					unavailableDates: t.unavailableDates,
				})),
				teachersPayload: teacherPayload,
				couples: dbCouples.map(pair => {
					const studentA = pair.studentAId
					const studentB = pair.studentBId
					const coupleName = `${studentA.firstName} ${studentA.lastName} & ${studentB.firstName} ${studentB.lastName}`
					const config = coupleConfigsMap[pair._id] || {
						desiredLessons: 2,
						priority: 5,
						teacherLessons: pair.preferredTeacherId ? {
							[`${pair.preferredTeacherId.firstName} ${pair.preferredTeacherId.lastName}`]: 2
						} : {},
					}
					return {
						coupleId: pair._id,
						coupleName,
						unavailability: pair.unavailability,
						config,
					}
				}),
				couplesPayload: couplePayload,
				groupLessons: latestGroupLessons.map(gl => ({
					groupName: gl.groupName,
					lessonsTarget: gl.lessonsTarget,
					teachers: gl.teachers,
					participants: gl.participants.map(p => ({
						name: p.name,
						baseGroup: p.baseGroup,
					})),
					staticTimeSlot: gl.staticTimeSlot ? {
						dayOfWeek: gl.staticTimeSlot.dayOfWeek,
						startTime: gl.staticTimeSlot.startTime,
						duration: gl.staticTimeSlot.duration,
					} : null,
					preferredRoom: gl.preferredRoom,
					notes: gl.notes,
				})),
				validGroupLessons: validGroupLessons.map(gl => ({
					groupName: gl.groupName,
					lessonsTarget: gl.lessonsTarget,
					teachers: gl.teachers,
					participants: gl.participants.map(p => ({
						name: p.name,
						baseGroup: p.baseGroup,
					})),
					staticTimeSlot: gl.staticTimeSlot ? {
						dayOfWeek: gl.staticTimeSlot.dayOfWeek,
						startTime: gl.staticTimeSlot.startTime,
						duration: gl.staticTimeSlot.duration,
					} : null,
					preferredRoom: gl.preferredRoom,
					notes: gl.notes,
				})),
				convertedGroupLessons: convertedGroupLessons.map(gl => ({
					groupName: gl.groupName,
					lessonsTarget: gl.lessonsTarget,
					teachers: gl.teachers,
					participants: gl.participants.map(p => ({
						name: p.name,
						availability: p.availability,
						baseGroup: p.baseGroup,
					})),
					staticTimeSlot: gl.staticTimeSlot ? {
						dayOfWeek: gl.staticTimeSlot.dayOfWeek,
						startTime: gl.staticTimeSlot.startTime,
						duration: gl.staticTimeSlot.duration,
					} : null,
					preferredRoom: gl.preferredRoom,
					notes: gl.notes,
				})),
				breaks: breaks,
				daySchedules: autoDaySchedules,
				algorithmConfig: config,
			},
			output: result?.error ? {
				error: result.error,
				summary: result.summary,
				debug: {
					teachersCount: teacherPayload.length,
					teachersAvailability: teacherPayload.map(t => ({ name: t.name, availability: t.availability })),
					couplesCount: couplePayload.length,
					couplesWithRequirements: couplePayload.filter(c => c.desiredLessons > 0).map(c => ({
						name: c.name,
						desiredLessons: c.desiredLessons,
						teacherLessons: c.teacherLessons,
						availability: c.availability,
					})),
					resultDays: filteredResult.days?.length || 0,
					resultLessonsPerDay: filteredResult.days?.map(d => d.lessons?.length || 0) || [],
				},
			} : !filteredResult || !filteredResult.days || filteredResult.days.length === 0 ? {
				error: !result ? 'No result returned from algorithm' : 'No days generated',
				debug: {
					teachersCount: teacherPayload.length,
					teachersAvailability: teacherPayload.map(t => ({ name: t.name, availability: t.availability })),
					couplesCount: couplePayload.length,
					couplesWithRequirements: couplePayload.filter(c => c.desiredLessons > 0).map(c => ({
						name: c.name,
						desiredLessons: c.desiredLessons,
						teacherLessons: c.teacherLessons,
						availability: c.availability,
					})),
					resultDays: filteredResult?.days?.length || 0,
					resultLessonsPerDay: filteredResult?.days?.map(d => d.lessons?.length || 0) || [],
				},
			} : generatedLessons.length === 0 ? {
				error: 'No lessons generated',
				summary: result.summary,
				debug: {
					teachersCount: teacherPayload.length,
					teachersAvailability: teacherPayload.map(t => ({ name: t.name, availability: t.availability })),
					couplesCount: couplePayload.length,
					couplesWithRequirements: couplePayload.filter(c => c.desiredLessons > 0).map(c => ({
						name: c.name,
						desiredLessons: c.desiredLessons,
						teacherLessons: c.teacherLessons,
						availability: c.availability,
					})),
					resultDays: filteredResult.days?.length || 0,
					resultLessonsPerDay: filteredResult.days?.map(d => d.lessons?.length || 0) || [],
				},
			} : {
				summary: {
					totalLessons: generatedLessons.length,
					studentsUnmet: result.summary.studentsUnmet || [],
					studentsUnmetCount: result.summary.studentsUnmet?.length || 0,
				},
				lessons: generatedLessons.map(l => ({
					id: l.id,
					date: l.date,
					startTime: l.startTime,
					endTime: l.endTime,
					duration: l.duration,
					kind: l.kind,
					lessonType: l.lessonType,
					teacherName: l.teacherName,
					roomLabel: l.roomLabel,
					studentNames: l.studentNames,
					notes: l.notes,
					locked: l.locked,
					manualOverride: l.manualOverride,
				})),
				lessonsByType: {
					group: generatedLessons.filter(l => l.lessonType === 'group').length,
					couple: generatedLessons.filter(l => l.lessonType === 'couple').length,
					individual: generatedLessons.filter(l => l.lessonType === 'individual').length,
					break: generatedLessons.filter(l => l.kind === 'break').length,
				},
			}
		}, null, 2))

		if (!result) {
			setAutoError('Generation failed: No result returned from algorithm')
			return
		}

		// Check for validation errors
		if (result.error) {
			setAutoError(result.error)
			setLessons([])
			return
		}

		if (!filteredResult || !filteredResult.days || filteredResult.days.length === 0) {
			setAutoError('Generation failed: No days returned from algorithm')
			setLessons([])
			return
		}

		if (generatedLessons.length === 0) {
			setAutoError('No lessons were generated. Please check your configuration: ensure teachers and couples have overlapping availability within the timetable date range and daily hours.')
			setLessons([])
			return
		}

		// Single comprehensive log with all input and output
		console.log(JSON.stringify({
			input: {
				timetable: {
					name: form.name,
					type: form.type,
					startDate: form.startDate,
					endDate: form.endDate,
					dayStart: form.dayStart,
					dayEnd: form.dayEnd,
					defaultLessonDuration: form.defaultLessonDuration,
					slotMinutes: form.slotMinutes,
				},
				scheduler: {
					dayStart: autoDayStart,
					dayEnd: autoDayEnd,
					breaks: autoBreaksInput,
					lessonDuration: autoLessonDuration,
					studentBreakAfter: autoStudentBreakAfter,
					teacherBreakAfter: autoTeacherBreakAfter,
				},
				teachers: autoTeachers.map(t => ({
					name: t.name,
					unavailability: t.availability,
					maxLessonsPerDay: t.maxLessonsPerDay,
					room: t.room,
					unavailableDates: t.unavailableDates,
				})),
				teachersPayload: teacherPayload,
				couples: dbCouples.map(pair => {
					const studentA = pair.studentAId
					const studentB = pair.studentBId
					const coupleName = `${studentA.firstName} ${studentA.lastName} & ${studentB.firstName} ${studentB.lastName}`
					const config = coupleConfigsMap[pair._id] || {
						desiredLessons: 2,
						priority: 5,
						teacherLessons: pair.preferredTeacherId ? {
							[`${pair.preferredTeacherId.firstName} ${pair.preferredTeacherId.lastName}`]: 2
						} : {},
					}
					return {
						coupleId: pair._id,
						coupleName,
						unavailability: pair.unavailability,
						config,
					}
				}),
				couplesPayload: couplePayload,
				groupLessons: latestGroupLessons.map(gl => ({
					groupName: gl.groupName,
					lessonsTarget: gl.lessonsTarget,
					teachers: gl.teachers,
					participants: gl.participants.map(p => ({
						name: p.name,
						baseGroup: p.baseGroup,
					})),
					staticTimeSlot: gl.staticTimeSlot ? {
						dayOfWeek: gl.staticTimeSlot.dayOfWeek,
						startTime: gl.staticTimeSlot.startTime,
						duration: gl.staticTimeSlot.duration,
					} : null,
					preferredRoom: gl.preferredRoom,
					notes: gl.notes,
				})),
				validGroupLessons: validGroupLessons.map(gl => ({
					groupName: gl.groupName,
					lessonsTarget: gl.lessonsTarget,
					teachers: gl.teachers,
					participants: gl.participants.map(p => ({
						name: p.name,
						baseGroup: p.baseGroup,
					})),
					staticTimeSlot: gl.staticTimeSlot ? {
						dayOfWeek: gl.staticTimeSlot.dayOfWeek,
						startTime: gl.staticTimeSlot.startTime,
						duration: gl.staticTimeSlot.duration,
					} : null,
					preferredRoom: gl.preferredRoom,
					notes: gl.notes,
				})),
				convertedGroupLessons: convertedGroupLessons.map(gl => ({
					groupName: gl.groupName,
					lessonsTarget: gl.lessonsTarget,
					teachers: gl.teachers,
					participants: gl.participants.map(p => ({
						name: p.name,
						availability: p.availability,
						baseGroup: p.baseGroup,
					})),
					staticTimeSlot: gl.staticTimeSlot ? {
						dayOfWeek: gl.staticTimeSlot.dayOfWeek,
						startTime: gl.staticTimeSlot.startTime,
						duration: gl.staticTimeSlot.duration,
					} : null,
					preferredRoom: gl.preferredRoom,
					notes: gl.notes,
				})),
				breaks: breaks,
				daySchedules: autoDaySchedules,
				algorithmConfig: config,
			},
			output: {
				summary: {
					totalLessons: generatedLessons.length,
					studentsUnmet: result.summary.studentsUnmet || [],
					studentsUnmetCount: result.summary.studentsUnmet?.length || 0,
				},
				lessons: generatedLessons.map(l => ({
					id: l.id,
					date: l.date,
					startTime: l.startTime,
					endTime: l.endTime,
					duration: l.duration,
					kind: l.kind,
					lessonType: l.lessonType,
					teacherName: l.teacherName,
					roomLabel: l.roomLabel,
					studentNames: l.studentNames,
					notes: l.notes,
					locked: l.locked,
					manualOverride: l.manualOverride,
				})),
				lessonsByType: {
					group: generatedLessons.filter(l => l.lessonType === 'group').length,
					couple: generatedLessons.filter(l => l.lessonType === 'couple').length,
					individual: generatedLessons.filter(l => l.lessonType === 'individual').length,
					break: generatedLessons.filter(l => l.kind === 'break').length,
				},
			},
		}, null, 2))

		setLessons(generatedLessons)
		setInfo(`Generated ${generatedLessons.length} lessons automatically.`)
		// Only show unmet students as a warning, not an error, since some lessons were generated
		if (result.summary.studentsUnmet && result.summary.studentsUnmet.length > 0) {
			setInfo(`Generated ${generatedLessons.length} lessons. Note: ${result.summary.studentsUnmet.length} couple(s) could not be fully satisfied: ${result.summary.studentsUnmet.join(', ')}`)
			setAutoError(null)
		} else {
			setAutoError(null)
		}
	} catch (err: any) {
		console.error(err)
		setAutoError(err.message ?? 'Failed to generate timetable automatically.')
	}
}

	const handleAddStaticLesson = (newLesson: LessonForm) => {
		setError(null)
		
		// Check for conflicts
		const conflicts = lessons.filter((lesson) => {
			if (!lessonsOverlap(newLesson, lesson)) return false
			return shareResources(newLesson, lesson)
		})

		if (conflicts.length > 0) {
			const conflictDetails = conflicts
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
				`This lesson will override ${conflicts.length} conflicting lesson${conflicts.length === 1 ? '' : 's'}:\n\n${conflictDetails}\n\nAre you sure you want to continue?`
			)

			if (!confirmed) {
			return
		}

			// Remove conflicting lessons
			const conflictIds = new Set(conflicts.map((lesson) => lesson.id))
			setLessons((prev) => prev.filter((lesson) => !conflictIds.has(lesson.id)))
			showAlertToast('Conflicting lessons removed', { variant: 'warning', title: 'Timetable' })
		}

		setLessons((prev) => [...prev, newLesson])
		showAlertToast('Static lesson added', { variant: 'success', title: 'Timetable' })
	}

	const handleDeleteLesson = (id: string) => {
		setLessons((prev) => prev.filter((lesson) => lesson.id !== id))
	}

	const lessonsOverlap = (a: LessonForm, b: LessonForm) => {
		if (a.date !== b.date) return false
		const aStart = toMinutes(a.startTime)
		const aEnd = toMinutes(a.endTime)
		const bStart = toMinutes(b.startTime)
		const bEnd = toMinutes(b.endTime)
		return aStart < bEnd && bStart < aEnd
	}

	const formatFriendlyDate = (dateStr: string) => {
		const safeDate = new Date(`${dateStr}T00:00:00`)
		return safeDate.toLocaleDateString(undefined, {
			weekday: 'short',
			month: 'short',
			day: 'numeric',
		})
	}

	// Calculate height multiplier based on duration (45 min = 1x, 90 min = 2x, etc.)
	const getDurationHeightMultiplier = (durationMinutes: number): number => {
		// Base duration is 45 minutes = 1x height
		const baseDuration = 45
		return Math.max(0.5, durationMinutes / baseDuration) // Minimum 0.5x height
	}

	const handleLessonCardClick = (lesson: LessonForm) => {
		setLessonModalForm({ ...lesson, studentNames: lesson.studentNames ?? [] })
	}

	const closeLessonModal = () => {
		setLessonModalForm(null)
	}

	const lessonsByDate = useMemo(() => {
		const dayMap = new Map<string, LessonForm[]>()
		lessons.forEach((lesson) => {
			if (!lesson.date) return
			if (!dayMap.has(lesson.date)) {
				dayMap.set(lesson.date, [])
			}
			dayMap.get(lesson.date)!.push(lesson)
		})

		return Array.from(dayMap.entries())
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([date, dayLessons]) => {
				const sortedDayLessons = dayLessons
					.slice()
					.sort((a, b) => {
						if (a.startTime === b.startTime) {
							// If same start time, sort by end time, then by id to ensure consistent ordering
							if (a.endTime === b.endTime) {
								return a.id.localeCompare(b.id)
							}
							return toMinutes(a.endTime) - toMinutes(b.endTime)
						}
						return toMinutes(a.startTime) - toMinutes(b.startTime)
					})
				// Group lessons by start time - this will show all lessons with same start time together
				const uniqueSlots = Array.from(new Set(sortedDayLessons.map((lesson) => lesson.startTime))).sort(
					(a, b) => toMinutes(a) - toMinutes(b),
				)
				const rows = uniqueSlots.map((startTime) => ({
					startTime,
					lessons: sortedDayLessons.filter((lesson) => lesson.startTime === startTime),
				}))
				return {
					date,
					rows,
				}
			})
	}, [lessons])

	// Available dates for mobile day selector
	const availableDates = useMemo(() => {
		return lessonsByDate.map(({ date }) => date)
	}, [lessonsByDate])

	// Set initial mobile selected date when lessons change
	useEffect(() => {
		if (availableDates.length > 0 && !mobileSelectedDate) {
			setMobileSelectedDate(availableDates[0])
		} else if (availableDates.length > 0 && mobileSelectedDate && !availableDates.includes(mobileSelectedDate)) {
			setMobileSelectedDate(availableDates[0])
		}
	}, [availableDates, mobileSelectedDate])

	// Filtered lessons for mobile (only selected date)
	const mobileLessonsByDate = useMemo(() => {
		if (!mobileSelectedDate) return lessonsByDate
		return lessonsByDate.filter(({ date }) => date === mobileSelectedDate)
	}, [lessonsByDate, mobileSelectedDate])

	// Helper to convert unavailability to display string
	const convertUnavailabilityToString = (unavailability: any): string => {
		if (!unavailability) return 'Available anytime'
		
		const getWindowsForDay = (day: string): Array<{ start: string; end: string }> => {
			if (unavailability[day] && Array.isArray(unavailability[day])) {
				return unavailability[day]
			}
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
		
		const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const
		const result: string[] = []
		
		for (const day of days) {
			const windows = getWindowsForDay(day)
			for (const window of windows) {
				if (window.start && window.end) {
					result.push(`${window.start}-${window.end}`)
				}
			}
		}
		
		return result.length > 0 ? result.join(', ') : 'Available anytime'
	}

	const editorTeachers = useMemo<Teacher[]>(() => {
		// Use database teachers instead of autoTeachers
		if (dbTeachers.length === 0) return []
		
		// Get teacher configs from localStorage if available
		const storedTeacherConfigsStr = typeof window !== 'undefined' ? window.localStorage.getItem('teacherConfigs') : null
		const teacherConfigsMap: Record<string, { maxLessonsPerDay: number; room: string }> = {}
		if (storedTeacherConfigsStr) {
			try {
				const configs = JSON.parse(storedTeacherConfigsStr)
				configs.forEach((config: any) => {
					teacherConfigsMap[config.teacherId] = {
						maxLessonsPerDay: config.maxLessonsPerDay ?? 4,
						room: config.room || '',
					}
				})
			} catch (err) {
				console.error('Error parsing teacher configs:', err)
			}
		}
		
		return dbTeachers.map((teacher, index) => {
			const teacherName = `${teacher.firstName} ${teacher.lastName}`
			const config = teacherConfigsMap[teacher._id] || { maxLessonsPerDay: 4, room: '' }
			const unavailabilityStr = convertUnavailabilityToString(teacher.unavailability)
			
			return {
				name: teacherName,
				// For display: show unavailability as a string (times when CANNOT train)
				// Empty array means available anytime
				availability: unavailabilityStr === 'Available anytime' ? [] : [unavailabilityStr],
				maxLessonsPerDay: Math.max(1, config.maxLessonsPerDay || 4),
				room: config.room || `Room ${index + 1}`,
			}
		})
	}, [dbTeachers])

	// Editor couples for the group lesson modal (simpler interface)
	const editorCouples = useMemo(() => {
		// Use database couples instead of autoCouples
		return dbCouples
			.filter((pair) => {
				const studentA = pair.studentAId
				const studentB = pair.studentBId
				return studentA && studentB
			})
			.map((pair) => {
				const studentA = pair.studentAId
				const studentB = pair.studentBId
				const coupleName = `${studentA.firstName} ${studentA.lastName} & ${studentB.firstName} ${studentB.lastName}`
				
				return {
					name: coupleName,
					studentA: {
						name: `${studentA.firstName} ${studentA.lastName}`,
						baseGroup: pair.baseGroup,
					},
					studentB: {
						name: `${studentB.firstName} ${studentB.lastName}`,
						baseGroup: pair.baseGroup,
					},
					baseGroup: pair.baseGroup,
				}
			})
	}, [dbCouples])

	const updateLessonModal = (updates: Partial<LessonForm>) => {
		setLessonModalForm((prev) => (prev ? { ...prev, ...updates } : prev))
	}

	const handleLessonModalStudentsChange = (value: string) => {
		updateLessonModal({
			studentNames: value.split(',').map((entry) => entry.trim()).filter(Boolean),
		})
	}

	const handleLessonModalStartTimeChange = (value: string) => {
		setLessonModalForm((prev) => {
			if (!prev) return prev
			if (prev.kind === 'lesson') {
				const duration = Math.max(1, prev.duration || 0)
				return {
					...prev,
					startTime: value,
					endTime: addDuration(value, duration),
				}
			}
			return { ...prev, startTime: value }
		})
	}

	const handleLessonModalDurationChange = (minutesValue: number) => {
		setLessonModalForm((prev) => {
			if (!prev) return prev
			const parsed = Number(minutesValue)
			const safeDuration = Number.isFinite(parsed) && parsed > 0 ? parsed : 1
			return {
				...prev,
				duration: safeDuration,
				endTime: addDuration(prev.startTime, safeDuration),
			}
		})
	}

	const handleLessonModalEndTimeChange = (value: string) => {
		setLessonModalForm((prev) => {
			if (!prev) return prev
			const targetMinutes = toMinutes(value)
			if (Number.isNaN(targetMinutes)) {
				return prev
			}
			const computedDuration = Math.max(1, targetMinutes - toMinutes(prev.startTime))
			return {
				...prev,
				endTime: value,
				duration: computedDuration,
			}
		})
	}

	const handleLessonModalDelete = (id: string) => {
		const confirmed = window.confirm('Are you sure you want to delete this lesson? This action cannot be undone.')
		if (confirmed) {
			handleDeleteLesson(id)
			showAlertToast('Lesson deleted', { variant: 'warning', title: 'Timetable' })
			setLessonModalForm(null)
		}
	}

	const handleDeleteLessonFromCard = (e: React.MouseEvent, lessonId: string) => {
		e.stopPropagation() // Prevent triggering the card click
		const confirmed = window.confirm('Are you sure you want to delete this lesson? This action cannot be undone.')
		if (confirmed) {
			handleDeleteLesson(lessonId)
			showAlertToast('Lesson deleted', { variant: 'warning', title: 'Timetable' })
		}
	}

	const handleLessonModalSave = () => {
		if (!lessonModalForm) return

		const cleanedStudentNames = lessonModalForm.studentNames?.filter(Boolean) ?? []
		const calculatedDuration = Math.max(1, toMinutes(lessonModalForm.endTime) - toMinutes(lessonModalForm.startTime))

		if (calculatedDuration <= 0) {
			showAlertToast('End time must be after start time', { variant: 'error', title: 'Invalid time' })
			return
		}

		const normalizedLesson: LessonForm = {
			...lessonModalForm,
			duration: calculatedDuration,
			studentNames: cleanedStudentNames,
		}

		const conflicts = lessons.filter(
			(lesson) => lesson.id !== normalizedLesson.id && lessonsOverlap(normalizedLesson, lesson),
		)

		if (conflicts.length > 0) {
			const confirmation = window.confirm(
				`This change overlaps with ${conflicts.length} other lesson${conflicts.length === 1 ? '' : 's'}. Overwrite them?`,
			)
			if (!confirmation) {
				return
			}
			const conflictIds = new Set(conflicts.map((lesson) => lesson.id))
			setLessons((prev) => {
				const withoutConflicts = prev.filter(
					(lesson) => lesson.id === normalizedLesson.id || !conflictIds.has(lesson.id),
				)
				const withoutOriginal = withoutConflicts.filter((lesson) => lesson.id !== normalizedLesson.id)
				return [...withoutOriginal, normalizedLesson]
			})
			showAlertToast('Conflicting lessons overwritten', { variant: 'warning', title: 'Timetable' })
		} else {
			setLessons((prev) =>
				prev.map((lesson) => (lesson.id === normalizedLesson.id ? normalizedLesson : lesson)),
			)
			showAlertToast('Lesson updated', { variant: 'success', title: 'Timetable' })
		}

		setLessonModalForm(null)
	}

	const handleSaveTimetable = async () => {
		if (!user?.clubId || !user?._id) {
			setError('Missing club or user information. Ensure you are logged in and assigned to a club.')
			return
		}

		// Check if a timetable with the same name already exists
		const existingTimetable = timetables.find(
			(t) => t.name.toLowerCase() === form.name.toLowerCase()
		)

		if (existingTimetable) {
			// Show overwrite confirmation dialog
			setOverwriteConfirmTimetable(existingTimetable)
			return
		}

		// No duplicate, proceed with saving as new
		await saveTimetableAsNew(form.name)
	}

	const saveTimetableAsNew = async (name: string) => {
		if (!user?.clubId || !user?._id) {
			setError('Missing club or user information. Ensure you are logged in and assigned to a club.')
			return
		}

		try {
			setSaving(true)
			setError(null)

			// For weekly timetables, dates are optional (universal template)
			// Use saved couple configs from state (which includes desired lessons, priority, teacher assignments)
			const payload = {
				clubId: user.clubId,
				createdBy: user._id,
				name: name,
				type: form.type,
				startDate: form.type === 'weekly' ? (form.startDate || '') : form.startDate,
				endDate: form.type === 'weekly' ? (form.endDate || '') : form.endDate,
				dayStart: form.dayStart,
				dayEnd: form.dayEnd,
				defaultLessonDuration: form.defaultLessonDuration,
				slotMinutes: form.slotMinutes,
				lessons: lessons.map((lesson) => convertToApiLesson(lesson, form.slotMinutes)),
				settings: {
					ruleEnforcedDuringGeneration: false,
					metadata: {
						savedFrom: 'dashboard/timetables',
						// Save scheduler configuration - includes couples with all their properties (desiredLessons, priority, teacherLessons)
						schedulerConfig: {
							teachers: autoTeachers,
							couples: autoCouples, // This includes desiredLessons, priority, teacherLessons (as string) for each couple
							breaks: autoBreaksInput,
							lessonDuration: autoLessonDuration,
							studentBreakAfter: autoStudentBreakAfter,
							teacherBreakAfter: autoTeacherBreakAfter,
							dayStart: autoDayStart,
							dayEnd: autoDayEnd,
							includeWeekends: autoIncludeWeekends,
							distributeLessons: autoDistributeLessons,
							coupleConfigs: savedCoupleConfigs, // This includes desiredLessons, priority, teacherLessons (as Record) for database couples
						},
						// Save group lessons configuration
						groupLessons: groupLessons,
					},
				},
			}

			const res = await fetch('/api/timetables', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(payload),
			})

			if (!res.ok) {
				const data = await res.json().catch(() => ({}))
				throw new Error(data.message ?? 'Failed to save timetable')
			}

			const data = await res.json()
			const saved = data.timetable as TimetableRecord
			setTimetables((prev) => [saved, ...prev])
			setSelectedTimetableId(saved._id)
			showAlertToast('Timetable saved', { variant: 'success', title: 'Saved' })
			
			// Update form name if we saved with a new name
			if (name !== form.name) {
				setForm((prev) => ({ ...prev, name }))
			}
		} catch (err: any) {
			console.error(err)
			setError(err.message ?? 'Unable to save timetable')
		} finally {
			setSaving(false)
		}
	}

	const handleOverwriteTimetable = async (timetableId: string) => {
		if (!user?.clubId || !user?._id) {
			setError('Missing club or user information. Ensure you are logged in and assigned to a club.')
			return
		}

		try {
			setSaving(true)
			setError(null)

			const payload = {
				clubId: user.clubId,
				createdBy: user._id,
				name: form.name,
				type: form.type,
				startDate: form.type === 'weekly' ? (form.startDate || '') : form.startDate,
				endDate: form.type === 'weekly' ? (form.endDate || '') : form.endDate,
				dayStart: form.dayStart,
				dayEnd: form.dayEnd,
				defaultLessonDuration: form.defaultLessonDuration,
				slotMinutes: form.slotMinutes,
				lessons: lessons.map((lesson) => convertToApiLesson(lesson, form.slotMinutes)),
				settings: {
					ruleEnforcedDuringGeneration: false,
					metadata: {
						savedFrom: 'dashboard/timetables',
						schedulerConfig: {
							teachers: autoTeachers,
							couples: autoCouples,
							breaks: autoBreaksInput,
							lessonDuration: autoLessonDuration,
							studentBreakAfter: autoStudentBreakAfter,
							teacherBreakAfter: autoTeacherBreakAfter,
							dayStart: autoDayStart,
							dayEnd: autoDayEnd,
							includeWeekends: autoIncludeWeekends,
							distributeLessons: autoDistributeLessons,
							coupleConfigs: savedCoupleConfigs,
						},
						groupLessons: groupLessons,
					},
				},
			}

			const res = await fetch(`/api/timetables/${timetableId}`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(payload),
			})

			if (!res.ok) {
				const data = await res.json().catch(() => ({}))
				throw new Error(data.message ?? 'Failed to update timetable')
			}

			const data = await res.json()
			const updated = data.timetable as TimetableRecord
			
			// Replace the old timetable with the updated one
			setTimetables((prev) => prev.map((t) => (t._id === timetableId ? updated : t)))
			setSelectedTimetableId(updated._id)
			setOverwriteConfirmTimetable(null)
			showAlertToast('Timetable updated', { variant: 'success', title: 'Updated' })
		} catch (err: any) {
			console.error(err)
			setError(err.message ?? 'Unable to update timetable')
		} finally {
			setSaving(false)
		}
	}

	const handleSaveWithNewName = async () => {
		const trimmedName = newTimetableName.trim()
		if (!trimmedName) {
			setError('Please enter a valid name')
			return
		}

		// Check if this new name also exists
		const existsWithNewName = timetables.find(
			(t) => t.name.toLowerCase() === trimmedName.toLowerCase()
		)

		if (existsWithNewName) {
			setError(`A timetable with the name "${trimmedName}" already exists. Please choose a different name.`)
			return
		}

		setOverwriteConfirmTimetable(null)
		setShowNewNameInput(false)
		setNewTimetableName('')
		await saveTimetableAsNew(trimmedName)
	}


	const handleCreateTimetable = async (newForm: TimetableFormState) => {
		if (!user?.clubId || !user?._id) {
			setError('Missing club or user information.')
			return
		}

		try {
			setSaving(true)
			setError(null)

			// For weekly timetables, dates are optional (universal template)
			// Always include dates - use empty strings for weekly timetables without dates
			// Use saved couple configs from state (which includes desired lessons, priority, teacher assignments)
			const payload: any = {
				clubId: user.clubId,
				createdBy: user._id,
				name: newForm.name,
				type: newForm.type,
				startDate: newForm.type === 'weekly' ? (newForm.startDate || '') : newForm.startDate,
				endDate: newForm.type === 'weekly' ? (newForm.endDate || '') : newForm.endDate,
				dayStart: newForm.dayStart,
				dayEnd: newForm.dayEnd,
				defaultLessonDuration: newForm.defaultLessonDuration,
				slotMinutes: newForm.slotMinutes,
				lessons: [],
				settings: {
					ruleEnforcedDuringGeneration: false,
					metadata: {
						savedFrom: 'dashboard/timetables',
						// Save scheduler configuration - includes couples with all their properties (desiredLessons, priority, teacherLessons)
						schedulerConfig: {
							teachers: autoTeachers,
							couples: autoCouples, // This includes desiredLessons, priority, teacherLessons (as string) for each couple
							breaks: autoBreaksInput,
							lessonDuration: autoLessonDuration,
							studentBreakAfter: autoStudentBreakAfter,
							teacherBreakAfter: autoTeacherBreakAfter,
							dayStart: autoDayStart,
							dayEnd: autoDayEnd,
							includeWeekends: autoIncludeWeekends,
							distributeLessons: autoDistributeLessons,
							coupleConfigs: savedCoupleConfigs, // This includes desiredLessons, priority, teacherLessons (as Record) for database couples
						},
						// Save group lessons configuration
						groupLessons: groupLessons,
					},
				},
			}

			console.log('Creating timetable with payload:', JSON.stringify(payload, null, 2))
			
			const res = await fetch('/api/timetables', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(payload),
			})

			if (!res.ok) {
				const data = await res.json().catch(() => ({}))
				const errorMessage = data.message ?? `Failed to create timetable (${res.status})`
				console.error('Failed to create timetable:', { 
					status: res.status, 
					data, 
					payload,
					errorDetails: data.details,
					error: data.error
				})
				throw new Error(errorMessage + (data.details ? `: ${data.details}` : ''))
			}

			const data = await res.json()
			const saved = data.timetable as TimetableRecord
			setTimetables((prev) => [saved, ...prev])
			showAlertToast('Timetable created!', { variant: 'success', title: 'Created' })
			// Clear group lessons for new timetable
			setGroupLessons([])
			groupLessonsRef.current = []
			// Load the new timetable for editing
			await loadTimetableForEditing(saved._id)
		} catch (err: any) {
			console.error(err)
			setError(err.message ?? 'Unable to create timetable')
		} finally {
			setSaving(false)
		}
	}

	const handleLoadTimetable = (record: TimetableRecord) => {
		loadTimetableForEditing(record._id)
		setInfo(`Loaded timetable "${record.name}"`)
		setTimeout(() => setInfo(null), 2500)
	}

	const handleBackToList = () => {
		setViewingTimetableId(null)
		setSelectedTimetableId(null)
		setLessons([])
		setForm({ ...defaultFormState })
		// Clear group lessons when going back to list
		setGroupLessons([])
		groupLessonsRef.current = []
		if (user?.clubId) {
			fetchTimetables(user.clubId)
		}
	}

	const handleDeleteTimetable = async (timetableId: string) => {
		if (!user?.clubId) {
			setError('Missing club information')
			return
		}

		try {
			setDeletingTimetableId(timetableId)
			setError(null)

			const res = await fetch(`/api/timetables/${timetableId}`, {
				method: 'DELETE',
			})

			if (!res.ok) {
				const data = await res.json().catch(() => ({}))
				throw new Error(data.message ?? 'Failed to delete timetable')
			}

			setTimetables((prev) => prev.filter((t) => t._id !== timetableId))
			showAlertToast('Timetable deleted successfully', { variant: 'success', title: 'Deleted' })
			
			// If we were viewing this timetable, go back to list
			if (viewingTimetableId === timetableId) {
				handleBackToList()
			}
		} catch (err: any) {
			console.error(err)
			setError(err.message ?? 'Unable to delete timetable')
			showAlertToast('Failed to delete timetable', { variant: 'error', title: 'Error' })
		} finally {
			setDeletingTimetableId(null)
			setDeleteConfirmTimetable(null)
		}
	}

	const handleDeleteClick = (e: React.MouseEvent, timetable: TimetableRecord) => {
		e.stopPropagation() // Prevent triggering the card click
		setDeleteConfirmTimetable(timetable)
	}

	// Show list view if not viewing a specific timetable
	if (!viewingTimetableId) {
return (
	<div className="max-w-6xl mx-auto px-6 py-10 space-y-10">
	<header className="flex flex-wrap items-center justify-between gap-4">
				<div>
					<h1 className="text-3xl font-semibold">Timetable Manager</h1>
						<p className="text-base-content/60">Create and manage your timetables.</p>
				</div>
				<div className="flex items-center gap-3">
						<Button onClick={() => setIsCreateModalOpen(true)} className="btn-primary">
							Create Timetable
						</Button>
					<Button onClick={() => user?.clubId && fetchTimetables(user.clubId)} className="btn-outline">
						Refresh
					</Button>
				</div>
	</header>

				{error && (
					<Alert variant="error" className="max-w-3xl">
						{error}
					</Alert>
				)}
				{info && (
					<Alert variant="success" className="max-w-3xl">
						{info}
					</Alert>
				)}

				<section className="card bg-base-100 shadow-sm border border-base-300 rounded-2xl">
					<div className="card-body">
						<div className="flex items-center justify-between mb-4">
							<h2 className="card-title">Your Timetables</h2>
							<span className="text-sm text-base-content/60">
								{loadingTimetables ? 'Loading…' : `${timetables.length} total`}
							</span>
			</div>
						{loadingTimetables ? (
							<div className="flex justify-center py-8">
								<span className="loading loading-spinner text-primary"></span>
			</div>
						) : timetables.length === 0 ? (
							<div className="text-center py-12">
								<p className="text-base-content/60 mb-4">No timetables yet. Create your first one!</p>
								<Button onClick={() => setIsCreateModalOpen(true)} className="btn-primary">
									Create Timetable
				</Button>
			</div>
						) : (
							<div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
								{timetables.map((timetable) => (
									<div
										onClick={() => handleLoadTimetable(timetable)}
										key={timetable._id}
										className="border rounded-xl p-4 space-y-2 hover:border-primary transition relative group cursor-pointer"
									>
										<div
										>
											<div className="flex items-center justify-between">
												<span className="font-semibold truncate max-w-[200px]" title={timetable.name}>
													{timetable.name}
												</span>
											</div>
											<div className="text-sm text-base-content/70">
												{!timetable.startDate || !timetable.endDate || timetable.startDate === '' || timetable.endDate === ''
													? timetable.type === 'weekly' 
														? 'Universal Weekly Template (Date not specified)'
														: 'Date not specified'
													: `${formatFriendlyDate(timetable.startDate)} – ${formatFriendlyDate(timetable.endDate)}`
												}
											</div>
											{timetable.startDate && timetable.endDate && timetable.startDate !== '' && timetable.endDate !== '' && (
												<div className="text-xs text-base-content/50">
													{new Date(timetable.startDate).toLocaleDateString()} – {new Date(timetable.endDate).toLocaleDateString()}
												</div>
											)}
										</div>
										<button
											type="button"
											onClick={(e) => handleDeleteClick(e, timetable)}
											disabled={deletingTimetableId === timetable._id}
											className="absolute top-2 right-2 btn btn-ghost btn-sm btn-circle opacity-0 group-hover:opacity-100 transition-opacity text-error hover:bg-error/20"
											title="Delete timetable"
										>
											{deletingTimetableId === timetable._id ? (
												<span className="loading loading-spinner loading-xs"></span>
											) : (
												'✕'
											)}
										</button>
									</div>
								))}
		</div>
	)}
					</div>
				</section>

				<CreateTimetableModal
					isOpen={isCreateModalOpen}
					onClose={() => setIsCreateModalOpen(false)}
					onCreate={handleCreateTimetable}
				/>

				{/* Delete Confirmation Modal */}
				{deleteConfirmTimetable && (
					<div className="fixed inset-0 z-50 flex items-center justify-center bg-base-content/60 p-4">
						<div className="w-full max-w-md rounded-2xl bg-base-200 shadow-2xl border border-base-300">
							<div className="p-6 space-y-4">
								<h3 className="text-lg font-semibold text-base-content">Delete Timetable</h3>
								<p className="text-sm text-base-content/70">
									Are you sure you want to delete <span className="font-medium">"{deleteConfirmTimetable.name}"</span>? This action cannot be undone.
								</p>
								<div className="flex items-center gap-3 pt-4">
									<Button
										className="btn-ghost flex-1"
										onClick={() => setDeleteConfirmTimetable(null)}
										disabled={deletingTimetableId === deleteConfirmTimetable._id}
									>
										Cancel
									</Button>
									<Button
										className="btn-error flex-1"
										onClick={() => handleDeleteTimetable(deleteConfirmTimetable._id)}
										disabled={deletingTimetableId === deleteConfirmTimetable._id}
									>
										{deletingTimetableId === deleteConfirmTimetable._id ? (
											<span className="loading loading-spinner loading-sm"></span>
										) : (
											'Delete'
										)}
									</Button>
								</div>
							</div>
						</div>
					</div>
				)}

				{/* Overwrite Confirmation Modal */}
				{overwriteConfirmTimetable && (
					<div className="fixed inset-0 z-50 flex items-center justify-center bg-base-content/60 p-4">
						<div className="w-full max-w-md rounded-2xl bg-base-200 shadow-2xl border border-base-300">
							<div className="p-6 space-y-4">
								<h3 className="text-lg font-semibold text-base-content">Timetable Already Exists</h3>
								
								{!showNewNameInput ? (
									<>
										<p className="text-sm text-base-content/70">
											A timetable named <span className="font-medium">"{overwriteConfirmTimetable.name}"</span> already exists. 
											Would you like to overwrite it or save with a different name?
										</p>
										<div className="flex flex-col gap-2 pt-4">
											<Button
												className="btn-primary w-full"
												onClick={() => handleOverwriteTimetable(overwriteConfirmTimetable._id)}
												disabled={saving}
											>
												{saving ? (
													<span className="loading loading-spinner loading-sm"></span>
												) : (
													'Overwrite Existing'
												)}
											</Button>
											<Button
												className="btn-outline w-full"
												onClick={() => {
													setShowNewNameInput(true)
													setNewTimetableName(form.name + ' (copy)')
												}}
												disabled={saving}
											>
												Save with Different Name
											</Button>
											<Button
												className="btn-ghost w-full"
												onClick={() => {
													setOverwriteConfirmTimetable(null)
													setShowNewNameInput(false)
													setNewTimetableName('')
												}}
												disabled={saving}
											>
												Cancel
											</Button>
										</div>
									</>
								) : (
									<>
										<p className="text-sm text-base-content/70">
											Enter a new name for the timetable:
										</p>
										<input
											type="text"
											className="input input-bordered w-full"
											value={newTimetableName}
											onChange={(e) => setNewTimetableName(e.target.value)}
											placeholder="New timetable name"
											autoFocus
											onKeyDown={(e) => {
												if (e.key === 'Enter') {
													handleSaveWithNewName()
												}
											}}
										/>
										<div className="flex items-center gap-3 pt-2">
											<Button
												className="btn-ghost flex-1"
												onClick={() => {
													setShowNewNameInput(false)
													setNewTimetableName('')
												}}
												disabled={saving}
											>
												Back
											</Button>
											<Button
												className="btn-primary flex-1"
												onClick={handleSaveWithNewName}
												disabled={saving || !newTimetableName.trim()}
											>
												{saving ? (
													<span className="loading loading-spinner loading-sm"></span>
												) : (
													'Save'
												)}
											</Button>
										</div>
									</>
								)}
							</div>
						</div>
					</div>
				)}
			</div>
		)
	}

	// Show editor view when viewing a specific timetable
	return (
		<div className="max-w-6xl mx-auto px-6 py-10 space-y-10">
			<header className="flex flex-wrap items-center justify-between gap-4">
				<div>
					<h1 className="text-3xl font-semibold">Timetable Manager</h1>
					<p className="text-base-content/60">Create, adjust, and save timetables with manual overrides and cascading shifts.</p>
				</div>
				<div className="flex items-center gap-3">
					<Button onClick={handleBackToList} className="btn-outline">
						← Back to List
					</Button>
					<Button onClick={() => user?.clubId && fetchTimetables(user.clubId)} className="btn-outline">
						Refresh
					</Button>
				</div>
			</header>

	{error && (
				<Alert variant="error" className="max-w-3xl">
					{error}
				</Alert>
			)}
			{info && (
				<Alert variant="success" className="max-w-3xl">
					{info}
				</Alert>
			)}

		<section className="card bg-base-100 shadow-sm border border-base-300 rounded-2xl">
			<div className="card-body space-y-6">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<div>
						<h2 className="card-title">Automatic Scheduler</h2>
						<p className="text-sm text-base-content/60">
							Configure teachers, couples, and breaks, then generate a timetable instantly. Make sure the timetable date range is set first.
						</p>
					</div>
					<div className="flex gap-2">
						<Button className="btn-outline" onClick={() => setIsEditorModalOpen(true)}>
							Configure Group Lessons
						</Button>
						<Button className="btn-primary" onClick={() => setIsSchedulerModalOpen(true)}>
							Configure Scheduler
						</Button>
						<Button className="btn-secondary" onClick={handleGenerateAutomaticSchedule}>
							Generate Timetable
						</Button>
					</div>
				</div>

				{autoError && (
					<Alert variant="warning" className="max-w-3xl">
						{autoError}
					</Alert>
				)}
			</div>
		</section>

		<section className="card bg-base-100 shadow-sm border border-base-300 rounded-2xl">
			<div className="card-body">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<div>
						<h2 className="card-title">Timetable Configuration</h2>
						<p className="text-sm text-base-content/60">
							Configure timetable name, type, dates, and schedule settings.
						</p>
						</div>
					<Button className="btn-primary" onClick={() => setIsConfigModalOpen(true)}>
						Configure Timetable
										</Button>
								</div>
				{form.name && (
					<div className="mt-4 p-4 bg-base-200 rounded-xl">
						<div className="grid grid-cols-2 gap-4 text-sm">
							<div>
								<span className="text-base-content/60">Name:</span> <span className="font-medium">{form.name}</span>
							</div>
							<div>
								<span className="text-base-content/60">Date Range:</span> <span className="font-medium">
									{form.startDate && form.endDate 
										? `${new Date(form.startDate).toLocaleDateString()} to ${new Date(form.endDate).toLocaleDateString()}`
										: form.type === 'weekly'
											? 'Date not specified (universal template)'
											: 'Not set'
									}
								</span>
							</div>
							<div>
								<span className="text-base-content/60">Daily Hours:</span> <span className="font-medium">{form.dayStart && form.dayEnd ? `${form.dayStart} - ${form.dayEnd}` : 'Not set'}</span>
							</div>
						</div>
						<div className="mt-4">
							<Button
								disabled={!canSubmit || saving}
								onClick={handleSaveTimetable}
								className="btn-primary"
							>
								{saving ? 'Saving…' : 'Save timetable'}
										</Button>
								</div>
								</div>
				)}
							</div>
		</section>

		<section className="card bg-base-100 shadow-sm border border-base-300 rounded-2xl">
			<div className="card-body space-y-6">
				<div className="flex items-center justify-between">
					<h2 className="card-title">Timetable</h2>
					<div className="flex items-center gap-3">
						<span className="badge badge-outline">{lessons.length} lessons</span>
						<Button className="btn-outline" onClick={() => setShowTimetableFullscreen(true)}>
							Show Timetable
						</Button>
						<Button className="btn-primary" onClick={() => setIsAddStaticLessonModalOpen(true)}>
							Add Static Lesson
						</Button>
					</div>
				</div>

				{!showTimetableFullscreen && (
					<div className="space-y-4">
						{/* Mobile Day Selector */}
						{isMobile && availableDates.length > 1 && mobileSelectedDate && (
							<MobileDaySelector
								dates={availableDates}
								selectedDate={mobileSelectedDate}
								onDateChange={setMobileSelectedDate}
							/>
						)}
						
						{lessonsByDate.length === 0 ? (
							<p className="text-sm text-base-content/60">No lessons scheduled yet.</p>
						) : (
							(isMobile ? mobileLessonsByDate : lessonsByDate).map(({ date, rows }) => {
									const totalForDay = rows.reduce((acc, row) => acc + row.lessons.length, 0)
									return (
										<div key={date} className="rounded-xl border border-base-300 bg-base-200/70 shadow-sm">
											<div className="flex items-center justify-between gap-2 border-b border-base-300 px-4 py-3 bg-base-300/50">
												<div>
													<p className="text-sm font-semibold text-base-content">{formatFriendlyDate(date)}</p>
													<p className="text-xs text-base-content/70 hidden sm:block">{date}</p>
					</div>
												<span className="badge badge-sm badge-outline badge-primary">
													{totalForDay} lesson{totalForDay === 1 ? '' : 's'}
												</span>
				</div>
											<div className="divide-y divide-base-200">
												{rows.map((row) => (
													<div
														key={`${date}-${row.startTime}`}
														className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-start"
													>
														<div className="flex items-center gap-3 font-mono text-sm text-base-content/70 sm:w-28 sm:flex-col sm:items-start sm:gap-1">
															<span>{row.startTime}</span>
			</div>
														<div className="flex flex-1 flex-wrap gap-3">
															{row.lessons.map((lesson) => {
																const isLesson = lesson.kind === 'lesson'
																const isCancelled = lesson.status === 'cancelled'
																const badgeLabel = isLesson ? (lesson.lessonType ?? 'lesson') : lesson.kind
																
																// Extract group name from notes if it's a group lesson
																const groupName = isLesson && lesson.lessonType === 'group' && lesson.notes
																	? lesson.notes.replace(/^Group:\s*/i, '').trim()
																	: null
																
																// For individual lessons, show participant name; for group lessons, show group name
																const displayName = isLesson
																	? lesson.lessonType === 'group' && groupName
																		? groupName
																		: lesson.lessonType === 'individual' && lesson.studentNames.length > 0
																			? lesson.studentNames[0]
																			: lesson.teacherName || 'Unassigned teacher'
																	: 'Break'
																
																const participantLabel = isLesson
																	? lesson.studentNames.length
																		? `${lesson.studentNames.length} participant${lesson.studentNames.length === 1 ? '' : 's'}`
																		: 'No participants'
																	: ''
																const detailsLine = isLesson
																	? `${lesson.roomLabel || 'No room'} · ${participantLabel}`
																	: lesson.notes || lesson.roomLabel || 'Break period'
																	// Different colors for different lesson types
																	let backgroundClass = 'bg-neutral/20 border-neutral/40 text-base-content'
																	if (isCancelled) {
																		// Cancelled lesson styling - greyed out with strikethrough effect
																		backgroundClass = 'bg-error/10 border-error/30 text-base-content/50 opacity-60'
																	} else if (isLesson) {
																		if (lesson.lessonType === 'group') {
																			backgroundClass = 'bg-gradient-to-br from-purple-500/40 via-purple-600/35 to-purple-700/40 border-purple-500/60 text-white shadow-md shadow-purple-500/20'
																		} else if (lesson.lessonType === 'couple') {
																			backgroundClass = 'bg-secondary/30 border-secondary/50 text-secondary-content'
																		} else {
																			backgroundClass = 'bg-primary/30 border-primary/50 text-primary-content'
																		}
																	}
																	// Text classes based on lesson type
																	let pillTextClass = 'text-[11px] uppercase tracking-wide text-base-content/70'
																	let timeTextClass = 'text-xs font-mono text-base-content/70'
																	let headerTextClass = 'text-sm font-semibold text-base-content'
																	let subTextClass = 'text-xs text-base-content/60'
																	let hoverClass = 'hover:border-primary hover:bg-primary/40 hover:text-primary-content'
																	
																	if (isCancelled) {
																		// Cancelled styling
																		pillTextClass = 'text-[11px] uppercase tracking-wide text-error/70'
																		timeTextClass = 'text-xs font-mono text-base-content/50 line-through'
																		headerTextClass = 'text-sm font-semibold text-base-content/50 line-through'
																		subTextClass = 'text-xs text-base-content/40'
																		hoverClass = 'hover:border-error/50'
																	} else if (isLesson) {
																		if (lesson.lessonType === 'group') {
																			pillTextClass = 'text-[11px] uppercase tracking-wide text-white/90 font-semibold'
																			timeTextClass = 'text-xs font-mono text-white/90'
																			headerTextClass = 'text-sm font-semibold text-white'
																			subTextClass = 'text-xs text-white/85'
																			hoverClass = 'hover:border-purple-400 hover:shadow-lg hover:shadow-purple-500/30 hover:scale-[1.02] transition-all'
																		} else if (lesson.lessonType === 'couple') {
																			pillTextClass = 'text-[11px] uppercase tracking-wide text-secondary-content/80'
																			timeTextClass = 'text-xs font-mono text-secondary-content/80'
																			headerTextClass = 'text-sm font-semibold text-secondary-content'
																			subTextClass = 'text-xs text-secondary-content/80'
																			hoverClass = 'hover:border-secondary hover:bg-secondary/40 hover:text-secondary-content'
																		} else {
																			pillTextClass = 'text-[11px] uppercase tracking-wide text-primary-content/80'
																			timeTextClass = 'text-xs font-mono text-primary-content/80'
																			headerTextClass = 'text-sm font-semibold text-primary-content'
																			subTextClass = 'text-xs text-primary-content/80'
																			hoverClass = 'hover:border-primary hover:bg-primary/40 hover:text-primary-content'
																		}
																	}
																const heightMultiplier = getDurationHeightMultiplier(lesson.duration)
																const minHeight = `${Math.max(80, 80 * heightMultiplier)}px`
																return (
																	<div
																		key={lesson.id}
																		className="relative group"
																	>
																		<button
																			type="button"
																			style={{ minHeight }}
																			className={`min-w-[200px] cursor-pointer rounded-xl border px-3 py-2 text-left transition ${backgroundClass} ${hoverClass}`}
																			onClick={() => handleLessonCardClick(lesson)}
																			title={isCancelled && lesson.cancellation?.reason ? `Cancelled: ${lesson.cancellation.reason}` : undefined}
																		>
																			<div className={`mb-1 flex items-center justify-between ${pillTextClass}`}>
																				<span>{badgeLabel}</span>
																				<div className="flex items-center gap-1">
																					{isCancelled && <span className="badge badge-error badge-xs">Cancelled</span>}
																					{lesson.locked && <span className="badge badge-ghost badge-xs">Locked</span>}
																				</div>
																			</div>
																			<div className={timeTextClass}>
																				{lesson.startTime} – {lesson.endTime}
																			</div>
																			<div className={headerTextClass}>
																				{displayName}
																			</div>
																			<div className={subTextClass}>{detailsLine}</div>
																			{isCancelled && lesson.cancellation?.reason && (
																				<div className="mt-1 text-[10px] text-error/70 bg-error/10 rounded px-1.5 py-0.5 truncate">
																					Reason: {lesson.cancellation.reason}
																				</div>
																			)}
																		</button>
																		<button
																			type="button"
																			onClick={(e) => handleDeleteLessonFromCard(e, lesson.id)}
																			className="absolute -top-2 -right-2 btn btn-circle btn-xs btn-error opacity-0 group-hover:opacity-100 transition-opacity z-10"
																			title="Delete lesson"
																		>
																			✕
																		</button>
																	</div>
																)
															})}
														</div>
													</div>
												))}
							</div>
						</div>
									)
								})
							)}
					</div>
				)}

				{showTimetableFullscreen && (
					<div className="fixed inset-0 z-50 bg-base-100 overflow-y-auto">
						<div className="max-w-7xl mx-auto px-6 py-8">
							<div className="flex items-center justify-between mb-6">
								<h2 className="text-2xl font-semibold">{form.name || 'Timetable'}</h2>
								<Button className="btn-ghost" onClick={() => setShowTimetableFullscreen(false)}>
									✕ Close
								</Button>
							</div>
							<div className="space-y-4">
								{lessonsByDate.length === 0 ? (
									<p className="text-sm text-base-content/60">No lessons scheduled yet.</p>
								) : (
									lessonsByDate.map(({ date, rows }) => {
										const totalForDay = rows.reduce((acc, row) => acc + row.lessons.length, 0)
										return (
											<div key={date} className="rounded-xl border border-base-300 bg-base-200/70 shadow-sm">
												<div className="flex items-center justify-between gap-2 border-b border-base-300 px-4 py-3 bg-base-300/50">
													<div>
														<p className="text-sm font-semibold text-base-content">{formatFriendlyDate(date)}</p>
														<p className="text-xs text-base-content/70">{date}</p>
													</div>
													<span className="badge badge-sm badge-outline badge-primary">
														{totalForDay} lesson{totalForDay === 1 ? '' : 's'}
													</span>
												</div>
												<div className="divide-y divide-base-200">
													{rows.map((row) => (
														<div
															key={`${date}-${row.startTime}`}
															className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-start"
														>
															<div className="flex items-center gap-3 font-mono text-sm text-base-content/70 sm:w-28 sm:flex-col sm:items-start sm:gap-1">
																<span>{row.startTime}</span>
															</div>
															<div className="flex flex-1 flex-wrap gap-3">
																{row.lessons.map((lesson) => {
																	const isLesson = lesson.kind === 'lesson'
																	const isCancelled = lesson.status === 'cancelled'
																	const badgeLabel = isLesson ? (lesson.lessonType ?? 'lesson') : lesson.kind
																	
																	// Extract group name from notes if it's a group lesson
																	const groupName = isLesson && lesson.lessonType === 'group' && lesson.notes
																		? lesson.notes.replace(/^Group:\s*/i, '').trim()
																		: null
																	
																	// For individual lessons, show participant name; for group lessons, show group name
																	const displayName = isLesson
																		? lesson.lessonType === 'group' && groupName
																			? groupName
																			: lesson.lessonType === 'individual' && lesson.studentNames.length > 0
																				? lesson.studentNames[0]
																				: lesson.teacherName || 'Unassigned teacher'
																		: 'Break'
																	
																	const participantLabel = isLesson
																		? lesson.studentNames.length
																			? `${lesson.studentNames.length} participant${lesson.studentNames.length === 1 ? '' : 's'}`
																			: 'No participants'
																		: ''
																	const detailsLine = isLesson
																		? `${lesson.roomLabel || 'No room'} · ${participantLabel}`
																		: lesson.notes || lesson.roomLabel || 'Break period'
																	// Different colors for different lesson types
																	let backgroundClass = 'bg-neutral/20 border-neutral/40 text-base-content'
																	if (isCancelled) {
																		backgroundClass = 'bg-error/10 border-error/30 text-base-content/50 opacity-60'
																	} else if (isLesson) {
																		if (lesson.lessonType === 'group') {
																			backgroundClass = 'bg-gradient-to-br from-purple-500/40 via-purple-600/35 to-purple-700/40 border-purple-500/60 text-white shadow-md shadow-purple-500/20'
																		} else if (lesson.lessonType === 'couple') {
																			backgroundClass = 'bg-secondary/30 border-secondary/50 text-secondary-content'
																		} else {
																			backgroundClass = 'bg-primary/30 border-primary/50 text-primary-content'
																		}
																	}
																	// Text classes based on lesson type
																	let pillTextClass = 'text-[11px] uppercase tracking-wide text-base-content/70'
																	let timeTextClass = 'text-xs font-mono text-base-content/70'
																	let headerTextClass = 'text-sm font-semibold text-base-content'
																	let subTextClass = 'text-xs text-base-content/60'
																	let hoverClass = 'hover:border-primary hover:bg-primary/40 hover:text-primary-content'
																	
																	if (isCancelled) {
																		pillTextClass = 'text-[11px] uppercase tracking-wide text-error/70'
																		timeTextClass = 'text-xs font-mono text-base-content/50 line-through'
																		headerTextClass = 'text-sm font-semibold text-base-content/50 line-through'
																		subTextClass = 'text-xs text-base-content/40'
																		hoverClass = 'hover:border-error/50'
																	} else if (isLesson) {
																		if (lesson.lessonType === 'group') {
																			pillTextClass = 'text-[11px] uppercase tracking-wide text-white/90 font-semibold'
																			timeTextClass = 'text-xs font-mono text-white/90'
																			headerTextClass = 'text-sm font-semibold text-white'
																			subTextClass = 'text-xs text-white/85'
																			hoverClass = 'hover:border-purple-400 hover:shadow-lg hover:shadow-purple-500/30 hover:scale-[1.02] transition-all'
																		} else if (lesson.lessonType === 'couple') {
																			pillTextClass = 'text-[11px] uppercase tracking-wide text-secondary-content/80'
																			timeTextClass = 'text-xs font-mono text-secondary-content/80'
																			headerTextClass = 'text-sm font-semibold text-secondary-content'
																			subTextClass = 'text-xs text-secondary-content/80'
																			hoverClass = 'hover:border-secondary hover:bg-secondary/40 hover:text-secondary-content'
																		} else {
																			pillTextClass = 'text-[11px] uppercase tracking-wide text-primary-content/80'
																			timeTextClass = 'text-xs font-mono text-primary-content/80'
																			headerTextClass = 'text-sm font-semibold text-primary-content'
																			subTextClass = 'text-xs text-primary-content/80'
																			hoverClass = 'hover:border-primary hover:bg-primary/40 hover:text-primary-content'
																		}
																	}
																	const heightMultiplier = getDurationHeightMultiplier(lesson.duration)
																	const minHeight = `${Math.max(80, 80 * heightMultiplier)}px`
																	return (
																		<div
																			key={lesson.id}
																			className="relative group"
																		>
																			<button
																				type="button"
																				style={{ minHeight }}
																				className={`min-w-[200px] cursor-pointer rounded-xl border px-3 py-2 text-left transition ${backgroundClass} ${hoverClass}`}
																				onClick={() => handleLessonCardClick(lesson)}
																				title={isCancelled && lesson.cancellation?.reason ? `Cancelled: ${lesson.cancellation.reason}` : undefined}
																			>
																				<div className={`mb-1 flex items-center justify-between ${pillTextClass}`}>
																					<span>{badgeLabel}</span>
																					<div className="flex items-center gap-1">
																						{isCancelled && <span className="badge badge-error badge-xs">Cancelled</span>}
																						{lesson.locked && <span className="badge badge-ghost badge-xs">Locked</span>}
																					</div>
																				</div>
																				<div className={timeTextClass}>
																					{lesson.startTime} – {lesson.endTime}
																				</div>
																				<div className={headerTextClass}>
																					{displayName}
																				</div>
																				<div className={subTextClass}>{detailsLine}</div>
																				{isCancelled && lesson.cancellation?.reason && (
																					<div className="mt-1 text-[10px] text-error/70 bg-error/10 rounded px-1.5 py-0.5 truncate">
																						Reason: {lesson.cancellation.reason}
																					</div>
																				)}
																			</button>
																			<button
																				type="button"
																				onClick={(e) => handleDeleteLessonFromCard(e, lesson.id)}
																				className="absolute -top-2 -right-2 btn btn-circle btn-xs btn-error opacity-0 group-hover:opacity-100 transition-opacity z-10"
																				title="Delete lesson"
																			>
																				✕
																			</button>
																		</div>
																	)
																})}
															</div>
														</div>
													))}
												</div>
											</div>
										)
									})
								)}
							</div>
						</div>
					</div>
				)}
			</div>
		</section>

		{lessonModalForm && (
			<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
				<div className="w-full max-w-lg rounded-2xl bg-base-100 shadow-2xl">
					<div className="flex items-center justify-between border-b border-base-200 px-4 py-3">
						<div>
							<h3 className="text-lg font-semibold text-base-content">
								{lessonModalForm.kind === 'lesson' ? 'Edit lesson' : 'Edit time slot'}
							</h3>
							<p className="text-xs text-base-content/60">{lessonModalForm.date}</p>
						</div>
						<button type="button" className="btn btn-ghost btn-sm" onClick={closeLessonModal}>
							✕
						</button>
					</div>

					<div className="space-y-4 px-4 py-5">
							<label className="form-control">
								<span className="label-text">Date</span>
								<Input
									type="date"
								value={lessonModalForm.date}
								onChange={(event) => updateLessonModal({ date: event.target.value })}
								/>
							</label>

						<div className="grid gap-4 sm:grid-cols-2">
							<label className="form-control">
								<span className="label-text">Start time</span>
								<Input
									type="time"
									value={lessonModalForm.startTime}
									onChange={(event) => handleLessonModalStartTimeChange(event.target.value)}
								/>
							</label>
							{lessonModalForm.kind === 'lesson' ? (
								<label className="form-control">
									<span className="label-text">Duration (minutes)</span>
									<Input
										type="number"
										min={form.slotMinutes}
										step={form.slotMinutes}
										value={lessonModalForm.duration}
										onChange={(event) => handleLessonModalDurationChange(Number(event.target.value))}
								/>
								</label>
							) : (
								<label className="form-control">
									<span className="label-text">End time</span>
									<Input
										type="time"
										value={lessonModalForm.endTime}
										onChange={(event) => handleLessonModalEndTimeChange(event.target.value)}
									/>
								</label>
							)}
						</div>

						{lessonModalForm.kind === 'lesson' && (
							<>
								<p className="text-xs text-base-content/50">
									Ends at <span className="font-mono">{lessonModalForm.endTime}</span>
								</p>
								<label className="form-control">
									<span className="label-text">Lesson type</span>
									<select
										className="select select-bordered"
										value={lessonModalForm.lessonType ?? 'group'}
										onChange={(event) =>
											updateLessonModal({ lessonType: event.target.value as LessonType })
										}
									>
										{lessonTypeOptions.map((option) => (
											<option key={option.value} value={option.value}>
												{option.label}
											</option>
										))}
									</select>
								</label>
								<div className="grid gap-4 sm:grid-cols-2">
									<label className="form-control">
										<span className="label-text">Teacher</span>
										<Input
											value={lessonModalForm.teacherName ?? ''}
											onChange={(event) => updateLessonModal({ teacherName: event.target.value })}
											placeholder="Teacher"
										/>
									</label>
									<label className="form-control">
										<span className="label-text">Room</span>
										<Input
											value={lessonModalForm.roomLabel ?? ''}
											onChange={(event) => updateLessonModal({ roomLabel: event.target.value })}
											placeholder="Room"
										/>
									</label>
									<label className="form-control sm:col-span-2">
										<span className="label-text">Participants (comma separated)</span>
										<textarea
											className="textarea textarea-bordered"
											rows={2}
											value={lessonModalForm.studentNames.join(', ')}
											onChange={(event) => handleLessonModalStudentsChange(event.target.value)}
										></textarea>
									</label>
								</div>
								</>
							)}

						<div className="flex flex-col gap-4">
							<label className="form-control">
								<span className="label-text">Notes</span>
								<textarea
									className="textarea textarea-bordered"
									rows={3}
									value={lessonModalForm.notes ?? ''}
									onChange={(event) => updateLessonModal({ notes: event.target.value })}
								></textarea>
							</label>
							<div className="flex flex-wrap items-center gap-4">
								<label className="label cursor-pointer gap-2">
									<span className="label-text">Locked</span>
									<input
										type="checkbox"
										className="toggle"
										checked={lessonModalForm.locked}
										onChange={(event) => updateLessonModal({ locked: event.target.checked })}
									/>
								</label>
								{lessonModalForm.kind === 'lesson' && (
									<label className="label cursor-pointer gap-2">
										<span className="label-text">Manual override</span>
										<input
											type="checkbox"
											className="toggle"
											checked={lessonModalForm.manualOverride}
											onChange={(event) => updateLessonModal({ manualOverride: event.target.checked })}
										/>
									</label>
								)}
							</div>
						</div>
						</div>

					<div className="flex items-center justify-between gap-3 border-t border-base-200 px-4 py-3">
						<button
							type="button"
							className="btn btn-error btn-sm"
							onClick={() => handleLessonModalDelete(lessonModalForm.id)}
						>
														Delete
						</button>
						<div className="flex items-center gap-2">
							<button type="button" className="btn btn-ghost btn-sm" onClick={closeLessonModal}>
								Cancel
							</button>
							<button type="button" className="btn btn-primary btn-sm" onClick={handleLessonModalSave}>
								Save changes
							</button>
						</div>
					</div>
				</div>
					</div>
		)}

		{/* Timetable Configuration Modal */}
		<TimetableConfigModal
			isOpen={isConfigModalOpen}
			onClose={() => setIsConfigModalOpen(false)}
			form={form}
			onSave={(newForm) => {
				setForm(newForm)
				// Update scheduler day start/end to match timetable settings
				setAutoDayStart(newForm.dayStart)
				setAutoDayEnd(newForm.dayEnd)
				showAlertToast('Timetable configuration saved!', {
					variant: 'success',
					duration: 3000,
					dismissible: true,
				})
			}}
		/>

		{/* Scheduler Configuration Modal */}
		<SchedulerConfigModal
			isOpen={isSchedulerModalOpen}
			onClose={() => setIsSchedulerModalOpen(false)}
			teachers={autoTeachers}
			couples={autoCouples}
			dbCouples={dbCouples}
			dbTeachers={dbTeachers}
			breaks={autoBreaksInput}
			lessonDuration={autoLessonDuration}
			studentBreakAfter={autoStudentBreakAfter}
			teacherBreakAfter={autoTeacherBreakAfter}
			dayStart={autoDayStart}
			dayEnd={autoDayEnd}
			includeWeekends={autoIncludeWeekends}
			distributeLessons={autoDistributeLessons}
			onSave={(config) => {
				setAutoTeachers(config.teachers)
				setAutoCouples(config.couples)
				setAutoBreaksInput(config.breaks)
				setAutoLessonDuration(config.lessonDuration)
				setAutoStudentBreakAfter(config.studentBreakAfter)
				setAutoTeacherBreakAfter(config.teacherBreakAfter)
				setAutoDayStart(config.dayStart)
				setAutoDayEnd(config.dayEnd)
				setAutoIncludeWeekends(config.includeWeekends)
				setAutoDistributeLessons(config.distributeLessons)
				// Store couple configs in state and localStorage for use in generation
				if (config.coupleConfigs && Array.isArray(config.coupleConfigs)) {
					setSavedCoupleConfigs(config.coupleConfigs)
					// Also store in localStorage for use in handleGenerateAutomaticSchedule
					if (typeof window !== 'undefined') {
						window.localStorage.setItem('coupleConfigs', JSON.stringify(config.coupleConfigs))
					}
				} else {
					setSavedCoupleConfigs([])
				}
				showAlertToast('Scheduler configuration saved!', {
					variant: 'success',
					duration: 3000,
					dismissible: true,
				})
			}}
			onAddTeacher={handleAddAutoTeacher}
			onRemoveTeacher={handleRemoveAutoTeacher}
			onUpdateTeacher={handleUpdateAutoTeacher}
			onAddCouple={handleAddAutoCouple}
			onRemoveCouple={handleRemoveAutoCouple}
			onUpdateCouple={handleUpdateAutoCouple}
		/>

		{/* Group Lesson Configuration Modal */}
		<TimetableEditorModal
			isOpen={isEditorModalOpen}
			onClose={() => setIsEditorModalOpen(false)}
			teachers={editorTeachers}
			couples={editorCouples}
			onSave={(newGroupLessons) => {
				console.log('page.tsx: Received group lessons from modal:', JSON.stringify(newGroupLessons.map(gl => ({
					groupName: gl.groupName,
					teachers: gl.teachers,
					teachersCount: gl.teachers?.length || 0,
					participantsCount: gl.participants?.length || 0,
					staticTimeSlot: gl.staticTimeSlot,
					hasStaticTimeSlot: !!gl.staticTimeSlot,
				})), null, 2))
				console.log('page.tsx: Previous groupLessons state:', groupLessons.map(gl => gl.groupName))
				console.log('page.tsx: Setting new groupLessons state with', newGroupLessons.length, 'groups')
				// Update both state and ref to ensure algorithm always has latest value
				const newGroups = newGroupLessons as GroupLesson[]
				console.log('page.tsx: Updating ref with groups:', newGroups.map(gl => gl.groupName))
				groupLessonsRef.current = newGroups
				setGroupLessons(newGroups)
				// Verify ref was updated
				console.log('page.tsx: Ref after update:', groupLessonsRef.current.map(gl => gl.groupName))
				showAlertToast('Group lessons configured successfully!', {
					variant: 'success',
					duration: 3000,
					dismissible: true,
				})
			}}
			initialGroupLessons={groupLessons}
			startDate={form.startDate}
			endDate={form.endDate}
		/>

		{/* Add Static Lesson Modal */}
		<AddStaticLessonModal
			isOpen={isAddStaticLessonModalOpen}
			onClose={() => setIsAddStaticLessonModalOpen(false)}
			onAdd={handleAddStaticLesson}
			existingLessons={lessons}
			slotMinutes={form.slotMinutes}
		/>

		{/* Overwrite Confirmation Modal */}
		{overwriteConfirmTimetable && (
			<div className="fixed inset-0 z-50 flex items-center justify-center bg-base-content/60 p-4">
				<div className="w-full max-w-md rounded-2xl bg-base-200 shadow-2xl border border-base-300">
					<div className="p-6 space-y-4">
						<h3 className="text-lg font-semibold text-base-content">Timetable Already Exists</h3>
						
						{!showNewNameInput ? (
							<>
								<p className="text-sm text-base-content/70">
									A timetable named <span className="font-medium">"{overwriteConfirmTimetable.name}"</span> already exists. 
									Would you like to overwrite it or save with a different name?
								</p>
								<div className="flex flex-col gap-2 pt-4">
									<Button
										className="btn-primary w-full"
										onClick={() => handleOverwriteTimetable(overwriteConfirmTimetable._id)}
										disabled={saving}
									>
										{saving ? (
											<span className="loading loading-spinner loading-sm"></span>
										) : (
											'Overwrite Existing'
										)}
									</Button>
									<Button
										className="btn-outline w-full"
										onClick={() => {
											setShowNewNameInput(true)
											setNewTimetableName(form.name + ' (copy)')
										}}
										disabled={saving}
									>
										Save with Different Name
									</Button>
									<Button
										className="btn-ghost w-full"
										onClick={() => {
											setOverwriteConfirmTimetable(null)
											setShowNewNameInput(false)
											setNewTimetableName('')
										}}
										disabled={saving}
									>
										Cancel
									</Button>
								</div>
							</>
						) : (
							<>
								<p className="text-sm text-base-content/70">
									Enter a new name for the timetable:
								</p>
								<input
									type="text"
									className="input input-bordered w-full"
									value={newTimetableName}
									onChange={(e) => setNewTimetableName(e.target.value)}
									placeholder="New timetable name"
									autoFocus
									onKeyDown={(e) => {
										if (e.key === 'Enter') {
											handleSaveWithNewName()
										}
									}}
								/>
								<div className="flex items-center gap-3 pt-2">
									<Button
										className="btn-ghost flex-1"
										onClick={() => {
											setShowNewNameInput(false)
											setNewTimetableName('')
										}}
										disabled={saving}
									>
										Back
									</Button>
									<Button
										className="btn-primary flex-1"
										onClick={handleSaveWithNewName}
										disabled={saving || !newTimetableName.trim()}
									>
										{saving ? (
											<span className="loading loading-spinner loading-sm"></span>
										) : (
											'Save'
										)}
									</Button>
								</div>
							</>
						)}
					</div>
				</div>
			</div>
		)}
	</div>
)
}

