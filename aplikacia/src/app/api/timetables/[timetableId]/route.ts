import { NextRequest, NextResponse } from 'next/server'
import { Types } from 'mongoose'
import connectToDatabase from '@/lib/mongodb'
import Timetable from '@/models/Timetable'

type LessonPayload = Parameters<typeof Timetable.create>[0]['lessons'] extends (infer T)[] ? T : never

const ensureObjectId = (value?: string | null) => {
	if (!value) return undefined
	if (!Types.ObjectId.isValid(value)) return undefined
	return new Types.ObjectId(value)
}

const mapLessonPayload = (lesson: any): LessonPayload => ({
	kind: lesson.kind ?? 'lesson',
	lessonType: lesson.lessonType,
	teacherId: ensureObjectId(lesson.teacherId),
	teacherName: lesson.teacherName,
	roomId: ensureObjectId(lesson.roomId),
	roomLabel: lesson.roomLabel,
	studentIds: lesson.studentIds?.map((id: string) => ensureObjectId(id)).filter(Boolean),
	studentNames: lesson.studentNames,
	studentId: ensureObjectId(lesson.studentId),
	studentName: lesson.studentName,
	pairId: ensureObjectId(lesson.pairId),
	pairLabel: lesson.pairLabel,
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
})

export async function GET(request: NextRequest, { params }: { params: Promise<{ timetableId: string }> }) {
	try {
		await connectToDatabase()
		const { timetableId } = await params
		if (!Types.ObjectId.isValid(timetableId)) {
			return NextResponse.json({ message: 'Invalid timetableId' }, { status: 400 })
		}

		const { searchParams } = new URL(request.url)
		const includeLessons = searchParams.get('includeLessons') !== 'false'

		const projection = includeLessons ? undefined : { lessons: 0 }
		const timetable = await Timetable.findById(timetableId, projection).lean()
		if (!timetable) {
			return NextResponse.json({ message: 'Timetable not found' }, { status: 404 })
		}

		return NextResponse.json({ timetable })
	} catch (error) {
		console.error('[GET_TIMETABLE_BY_ID]', error)
		return NextResponse.json({ message: 'Failed to load timetable' }, { status: 500 })
	}
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ timetableId: string }> }) {
	try {
		await connectToDatabase()
		const { timetableId } = await params
		if (!Types.ObjectId.isValid(timetableId)) {
			return NextResponse.json({ message: 'Invalid timetableId' }, { status: 400 })
		}

		const body = await request.json()

		// Validate required fields
		if (!body.name || !body.clubId) {
			return NextResponse.json({ message: 'Missing required fields: name and clubId' }, { status: 400 })
		}

		// Build the update object for full replacement
		const updateData: Record<string, unknown> = {
			name: body.name,
			type: body.type || 'camp',
			clubId: ensureObjectId(body.clubId),
			startDate: body.startDate || '',
			endDate: body.endDate || '',
			dayStart: body.dayStart || '08:00',
			dayEnd: body.dayEnd || '20:00',
			defaultLessonDuration: body.defaultLessonDuration || 45,
			slotMinutes: body.slotMinutes || 15,
			settings: body.settings || {},
			updatedAt: new Date(),
		}

		// Map lessons if provided
		if (Array.isArray(body.lessons)) {
			updateData.lessons = body.lessons.map(mapLessonPayload)
		}

		const updated = await Timetable.findByIdAndUpdate(
			timetableId,
			{ $set: updateData },
			{ new: true }
		).lean()

		if (!updated) {
			return NextResponse.json({ message: 'Timetable not found' }, { status: 404 })
		}

		return NextResponse.json({ timetable: updated })
	} catch (error) {
		console.error('[PUT_TIMETABLE]', error)
		return NextResponse.json({ message: 'Failed to update timetable' }, { status: 500 })
	}
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ timetableId: string }> }) {
	try {
		await connectToDatabase()
		const { timetableId } = await params
		if (!Types.ObjectId.isValid(timetableId)) {
			return NextResponse.json({ message: 'Invalid timetableId' }, { status: 400 })
		}

		const updates = await request.json()
		const set: Record<string, unknown> = {}
		const unset: Record<string, unknown> = {}

		if (typeof updates.name === 'string') set.name = updates.name
		if (typeof updates.type === 'string') set.type = updates.type
		if (typeof updates.startDate === 'string') set.startDate = updates.startDate
		if (typeof updates.endDate === 'string') set.endDate = updates.endDate
		if (typeof updates.dayStart === 'string') set.dayStart = updates.dayStart
		if (typeof updates.dayEnd === 'string') set.dayEnd = updates.dayEnd
		if (Array.isArray(updates.defaultBreaks)) set.defaultBreaks = updates.defaultBreaks
		if (typeof updates.consecutiveLessonLimit === 'number') set.consecutiveLessonLimit = updates.consecutiveLessonLimit
		if ([5, 10, 15, 30].includes(updates.slotMinutes)) set.slotMinutes = updates.slotMinutes
		if (typeof updates.defaultLessonDuration === 'number') set.defaultLessonDuration = updates.defaultLessonDuration
		if (Array.isArray(updates.lockedLessonIds)) {
			set.lockedLessonIds = updates.lockedLessonIds
				.map((id: string) => ensureObjectId(id))
				.filter(Boolean)
		}

		if (updates.settings) {
			set.settings = {
				daySchedules: updates.settings.daySchedules,
				ruleEnforcedDuringGeneration: updates.settings.ruleEnforcedDuringGeneration,
				metadata: updates.settings.metadata,
			}
		}

		if (updates.lessons) {
			if (!Array.isArray(updates.lessons)) {
				return NextResponse.json({ message: 'lessons must be an array' }, { status: 400 })
			}
			set.lessons = updates.lessons.map(mapLessonPayload)
		}

		if (updates.clearLockedLessonIds) {
			unset.lockedLessonIds = ''
		}

		const updatePayload: Record<string, unknown> = {}
		if (Object.keys(set).length) updatePayload.$set = set
		if (Object.keys(unset).length) updatePayload.$unset = unset

		if (!Object.keys(updatePayload).length) {
			return NextResponse.json({ message: 'No valid fields to update' }, { status: 400 })
		}

		const updated = await Timetable.findByIdAndUpdate(timetableId, updatePayload, { new: true }).lean()
		if (!updated) {
			return NextResponse.json({ message: 'Timetable not found' }, { status: 404 })
		}

		return NextResponse.json({ timetable: updated })
	} catch (error) {
		console.error('[PATCH_TIMETABLE]', error)
		return NextResponse.json({ message: 'Failed to update timetable' }, { status: 500 })
	}
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ timetableId: string }> }) {
	try {
		await connectToDatabase()
		const { timetableId } = await params
		if (!Types.ObjectId.isValid(timetableId)) {
			return NextResponse.json({ message: 'Invalid timetableId' }, { status: 400 })
		}

		const deleted = await Timetable.findByIdAndDelete(timetableId).lean()
		if (!deleted) {
			return NextResponse.json({ message: 'Timetable not found' }, { status: 404 })
		}

		return NextResponse.json({ message: 'Timetable deleted successfully' })
	} catch (error) {
		console.error('[DELETE_TIMETABLE]', error)
		return NextResponse.json({ message: 'Failed to delete timetable' }, { status: 500 })
	}
}

