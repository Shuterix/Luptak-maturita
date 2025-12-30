import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { Types } from 'mongoose'
import connectToDatabase from '@/lib/mongodb'
import Timetable from '@/models/Timetable'
import User from '@/models/User'
import jwt from 'jsonwebtoken'

async function getCurrentUser() {
	const cookieStore = await cookies()
	const tokenCookie = cookieStore.get('token')
	const token = tokenCookie?.value

	if (!token) return null

	try {
		const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as any
		const user = await User.findById(decoded.userId).lean()
		return user
	} catch {
		return null
	}
}

export async function POST(
	request: NextRequest,
	{ params }: { params: Promise<{ lessonId: string }> }
) {
	try {
		await connectToDatabase()
		const { lessonId } = await params

		const currentUser = await getCurrentUser()
		if (!currentUser) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		const body = await request.json()
		const { timetableId, reason } = body

		if (!reason || reason.trim().length === 0) {
			return NextResponse.json({ error: 'Cancellation reason is required' }, { status: 400 })
		}

		if (!timetableId) {
			return NextResponse.json({ error: 'Timetable ID is required' }, { status: 400 })
		}

		const studentName = `${(currentUser as any).firstName} ${(currentUser as any).lastName}`

		// Find the timetable
		const timetable = await Timetable.findById(timetableId)
		if (!timetable) {
			return NextResponse.json({ error: 'Timetable not found' }, { status: 404 })
		}

		// Find the lesson in the timetable
		const lessonIndex = timetable.lessons?.findIndex((l: any) => {
			const id = l._id?.toString() || `${timetable._id}-${l.date}-${l.start}`
			return id === lessonId
		})

		if (lessonIndex === undefined || lessonIndex === -1) {
			return NextResponse.json({ error: 'Lesson not found' }, { status: 404 })
		}

		const lesson = timetable.lessons![lessonIndex]

		// Verify the student is a participant in this lesson
		const isParticipant =
			(lesson.studentName && lesson.studentName === studentName) ||
			(lesson.studentNames && lesson.studentNames.includes(studentName)) ||
			(lesson.pairLabel && lesson.pairLabel.includes(studentName))

		// Students can only cancel their own lessons, trainers/admins can cancel any
		if ((currentUser as any).role === 'student' && !isParticipant) {
			return NextResponse.json({ error: 'You can only cancel your own lessons' }, { status: 403 })
		}

		// Update the lesson status
		timetable.lessons![lessonIndex] = {
			...lesson,
			status: 'cancelled',
			cancellation: {
				byUserId: new Types.ObjectId((currentUser as any)._id.toString()),
				reason: reason.trim(),
				at: new Date(),
			},
		}

		await timetable.save()

		return NextResponse.json({
			message: 'Lesson cancelled successfully',
			lesson: timetable.lessons![lessonIndex],
		}, { status: 200 })
	} catch (error: any) {
		console.error('Error cancelling lesson:', error)
		return NextResponse.json({ error: error.message || 'Failed to cancel lesson' }, { status: 500 })
	}
}

