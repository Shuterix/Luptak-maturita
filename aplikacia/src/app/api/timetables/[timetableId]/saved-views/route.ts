import { NextRequest, NextResponse } from 'next/server'
import { Types } from 'mongoose'
import connectToDatabase from '@/lib/mongodb'
import SavedTimetable from '@/models/SavedTimetable'

export async function GET(_: NextRequest, { params }: { params: Promise<{ timetableId: string }> }) {
	try {
		await connectToDatabase()
		const { timetableId } = await params
		if (!Types.ObjectId.isValid(timetableId)) {
			return NextResponse.json({ message: 'Invalid timetableId' }, { status: 400 })
		}

		const savedViews = await SavedTimetable.find({ timetableId }).sort({ createdAt: -1 }).lean()
		return NextResponse.json({ savedViews })
	} catch (error) {
		console.error('[GET_SAVED_VIEWS]', error)
		return NextResponse.json({ message: 'Failed to load saved timetables' }, { status: 500 })
	}
}

interface CreateSavedViewRequest {
	name: string
	description?: string
	isDefault?: boolean
	createdBy: string
	snapshot: Record<string, unknown>
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ timetableId: string }> }) {
	try {
		await connectToDatabase()
		const { timetableId } = await params
		if (!Types.ObjectId.isValid(timetableId)) {
			return NextResponse.json({ message: 'Invalid timetableId' }, { status: 400 })
		}

		const body = (await request.json()) as CreateSavedViewRequest
		if (!body.name || !body.snapshot || !body.createdBy) {
			return NextResponse.json({ message: 'name, snapshot, createdBy are required' }, { status: 400 })
		}
		if (!Types.ObjectId.isValid(body.createdBy)) {
			return NextResponse.json({ message: 'Invalid createdBy' }, { status: 400 })
		}

		if (typeof body.snapshot !== 'object') {
			return NextResponse.json({ message: 'snapshot must be an object' }, { status: 400 })
		}

		if (body.isDefault) {
			await SavedTimetable.updateMany({ timetableId }, { $set: { isDefault: false } })
		}

		const saved = await SavedTimetable.create({
			timetableId: new Types.ObjectId(timetableId),
			name: body.name,
			description: body.description,
			isDefault: body.isDefault ?? false,
			createdBy: new Types.ObjectId(body.createdBy),
			snapshot: body.snapshot,
		})

		return NextResponse.json({ savedView: saved })
	} catch (error) {
		console.error('[CREATE_SAVED_VIEW]', error)
		return NextResponse.json({ message: 'Failed to save timetable view' }, { status: 500 })
	}
}

