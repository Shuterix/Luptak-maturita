import { NextRequest, NextResponse } from 'next/server'
import { Types } from 'mongoose'
import connectToDatabase from '@/lib/mongodb'
import Timetable from '@/models/Timetable'
import Club from '@/models/Club'

type LessonPayload = {
	kind?: 'lesson' | 'break' | 'unused'
	lessonType?: 'group' | 'individual' | 'couple'
	teacherId?: string | null
	teacherName?: string | null
	roomId?: string | null
	roomLabel?: string | null
	studentIds?: string[]
	studentNames?: string[]
	studentId?: string | null
	studentName?: string | null
	pairId?: string | null
	pairLabel?: string | null
	date: string
	start: string
	end: string
	durationMinutes?: number
	status?: 'scheduled' | 'cancelled' | 'completed' | 'no_show' | 'rescheduled'
	cancellation?: {
		byUserId?: string
		reason?: string
		at?: string
	} | null
	locked?: boolean
	manualOverride?: boolean
	notes?: string
	metadata?: Record<string, unknown>
	breakType?: 'consecutive' | 'default'
}

interface CreateTimetableRequest {
	clubId: string
	name: string
	type: 'weekly' | 'yearly' | 'after_school' | 'camp' | 'custom'
	startDate?: string // Optional for weekly timetables (universal templates)
	endDate?: string // Optional for weekly timetables (universal templates)
	dayStart?: string
	dayEnd?: string
	defaultBreaks?: { start: string; end: string }[]
	consecutiveLessonLimit?: number
	slotMinutes?: 5 | 10 | 15 | 30
	defaultLessonDuration?: number
	lockedLessonIds?: string[]
	createdBy: string
	lessons?: LessonPayload[]
	settings?: {
		daySchedules?: Record<string, { start: string; end: string }>
		ruleEnforcedDuringGeneration?: boolean
		metadata?: Record<string, unknown>
	}
}

const ensureObjectId = (value?: string | null) => {
	if (!value) return undefined
	if (!Types.ObjectId.isValid(value)) return undefined
	return new Types.ObjectId(value)
}

const mapLessonPayload = (lesson: LessonPayload) => {
	return {
		kind: lesson.kind ?? 'lesson',
		lessonType: lesson.lessonType,
		teacherId: ensureObjectId(lesson.teacherId ?? undefined),
		teacherName: lesson.teacherName ?? undefined,
		roomId: ensureObjectId(lesson.roomId ?? undefined),
		roomLabel: lesson.roomLabel ?? undefined,
		studentIds: lesson.studentIds?.map((id) => ensureObjectId(id)).filter(Boolean),
		studentNames: lesson.studentNames,
		studentId: ensureObjectId(lesson.studentId ?? undefined),
		studentName: lesson.studentName ?? undefined,
		pairId: ensureObjectId(lesson.pairId ?? undefined),
		pairLabel: lesson.pairLabel ?? undefined,
		date: lesson.date,
		start: lesson.start,
		end: lesson.end,
		durationMinutes: lesson.durationMinutes,
		status: lesson.status ?? 'scheduled',
		cancellation: lesson.cancellation
			? {
				byUserId: ensureObjectId(lesson.cancellation.byUserId),
				reason: lesson.cancellation.reason,
				at: lesson.cancellation.at ? new Date(lesson.cancellation.at) : undefined,
			}
			: undefined,
		locked: lesson.locked ?? false,
		manualOverride: lesson.manualOverride ?? false,
		notes: lesson.notes,
		metadata: lesson.metadata,
		breakType: lesson.breakType,
	}
}

export async function GET(request: NextRequest) {
	try {
		await connectToDatabase()
		const { searchParams } = new URL(request.url)
		const clubId = searchParams.get('clubId')
		const createdBy = searchParams.get('createdBy')
		const includeLessons = searchParams.get('includeLessons') === 'true'

		// Get current user for role-based filtering
		const cookieStore = await cookies()
		const tokenCookie = cookieStore.get('token')
		let userRole: string | null = null
		if (tokenCookie) {
			try {
				const jwt = await import('jsonwebtoken')
				const decoded = jwt.verify(tokenCookie.value, process.env.JWT_SECRET as string) as any
				const User = (await import('@/models/User')).default
				const user = await User.findById(decoded.userId).select('role').lean()
				if (user) {
					userRole = (user as any).role
				}
			} catch {
				// Token invalid or user not found, continue without role filtering
			}
		}

		const filter: Record<string, unknown> = {}
		if (clubId) {
			if (!Types.ObjectId.isValid(clubId)) {
				return NextResponse.json({ message: 'Invalid clubId' }, { status: 400 })
			}
			filter.clubId = new Types.ObjectId(clubId)
		}
		if (createdBy) {
			if (!Types.ObjectId.isValid(createdBy)) {
				return NextResponse.json({ message: 'Invalid createdBy' }, { status: 400 })
			}
			filter.createdBy = new Types.ObjectId(createdBy)
		}

		// For students: only show timetables created by trainers with lessons
		if (userRole === 'student') {
			// Add filter for timetables with at least one lesson (locked/published timetables)
			filter['lessons.0'] = { $exists: true }
		}

		const projection = includeLessons ? undefined : { lessons: 0 }
		let timetables = await Timetable.find(filter, projection).sort({ createdAt: -1 }).lean()

		// For students: filter to only timetables created by trainers/admin
		if (userRole === 'student') {
			const User = (await import('@/models/User')).default
			// Filter to only timetables that were created by trainers (not students)
			const filterResults = await Promise.all(
				timetables.map(async (timetable: any) => {
					const creator = await User.findById(timetable.createdBy).select('role').lean()
					return creator && (creator as any).role !== 'student'
				})
			)
			timetables = timetables.filter((_, index) => filterResults[index])
		}

		return NextResponse.json({ timetables })
	} catch (error) {
		console.error('[GET_TIMETABLES]', error)
		return NextResponse.json({ message: 'Failed to load timetables' }, { status: 500 })
	}
}

export async function POST(request: NextRequest) {
	try {
		await connectToDatabase()
		const body = (await request.json()) as CreateTimetableRequest

		if (!body.clubId || !body.name || !body.type || !body.createdBy) {
			return NextResponse.json({ message: 'clubId, name, type, createdBy are required.' }, { status: 400 })
		}

		// For weekly timetables, dates are optional (universal template)
		// For other types, dates are required
		if (body.type !== 'weekly' && (!body.startDate || !body.endDate)) {
			return NextResponse.json({ message: 'startDate and endDate are required for non-weekly timetables.' }, { status: 400 })
		}

		if (!Types.ObjectId.isValid(body.clubId) || !Types.ObjectId.isValid(body.createdBy)) {
			return NextResponse.json({ message: 'Invalid clubId or createdBy.' }, { status: 400 })
		}

		const lessons = body.lessons?.map(mapLessonPayload) ?? []

		// For weekly timetables without dates, use empty strings (will be set at generation time)
		// For other types, dates should already be provided (validated above)
		// Ensure we always have a string value (empty string for weekly without dates, or the provided date)
		const startDate = (body.startDate && body.startDate.trim() !== '') 
			? body.startDate 
			: (body.type === 'weekly' ? '' : body.startDate || '')
		const endDate = (body.endDate && body.endDate.trim() !== '') 
			? body.endDate 
			: (body.type === 'weekly' ? '' : body.endDate || '')

		const timetable = await Timetable.create({
			clubId: new Types.ObjectId(body.clubId),
			name: body.name,
			type: body.type,
			startDate: startDate,
			endDate: endDate,
			dayStart: body.dayStart,
			dayEnd: body.dayEnd,
			defaultBreaks: body.defaultBreaks,
			consecutiveLessonLimit: body.consecutiveLessonLimit,
			slotMinutes: body.slotMinutes,
			defaultLessonDuration: body.defaultLessonDuration,
			lockedLessonIds: body.lockedLessonIds?.map((id) => ensureObjectId(id)).filter(Boolean),
			createdBy: new Types.ObjectId(body.createdBy),
			lessons,
			settings: body.settings,
		})

		// Attach to club
		await Club.findByIdAndUpdate(body.clubId, {
			$addToSet: { timetableIds: timetable._id },
		})

		return NextResponse.json({ timetable })
	} catch (error: any) {
		console.error('[CREATE_TIMETABLE]', error)
		const errorMessage = error?.message || 'Failed to create timetable'
		const errorDetails = error?.errors ? Object.keys(error.errors).map(key => `${key}: ${error.errors[key].message}`).join(', ') : null
		return NextResponse.json({ 
			message: errorMessage,
			details: errorDetails,
			error: error?.toString()
		}, { status: 500 })
	}
}

