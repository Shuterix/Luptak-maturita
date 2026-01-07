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

export async function GET(request: NextRequest) {
	try {
		await connectToDatabase()

		const currentUser = await getCurrentUser()
		if (!currentUser) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		if ((currentUser as any).role !== 'trainer' && (currentUser as any).role !== 'admin') {
			return NextResponse.json({ error: 'This endpoint is for trainers and admins only' }, { status: 403 })
		}

		const clubId = (currentUser as any).clubId
		if (!clubId) {
			return NextResponse.json({ error: 'Trainer not associated with a club' }, { status: 400 })
		}

		const trainerName = `${(currentUser as any).firstName} ${(currentUser as any).lastName}`

		// Get all timetables for this club that have lessons
		const timetables = await Timetable.find({
			clubId: new Types.ObjectId(clubId.toString()),
			'lessons.0': { $exists: true }
		}).lean()

		// Filter lessons where this trainer is teaching
		const trainerLessons: any[] = []

		for (const timetable of timetables) {
			if (!timetable.lessons) continue

			for (const lesson of timetable.lessons) {
				// Check if trainer is teaching this lesson
				const isTeaching = lesson.teacherName && lesson.teacherName === trainerName

				if (isTeaching && lesson.kind === 'lesson') {
					trainerLessons.push({
						_id: lesson._id?.toString() || `${timetable._id}-${lesson.date}-${lesson.start}`,
						timetableId: timetable._id.toString(),
						timetableName: timetable.name,
						timetableType: timetable.type,
						date: lesson.date,
						start: lesson.start,
						end: lesson.end,
						lessonType: lesson.lessonType || 'individual',
						teacherName: lesson.teacherName,
						roomLabel: lesson.roomLabel,
						studentNames: lesson.studentNames || (lesson.studentName ? [lesson.studentName] : []),
						pairLabel: lesson.pairLabel,
						status: lesson.status || 'scheduled',
						cancellation: lesson.cancellation,
						notes: lesson.notes,
						durationMinutes: lesson.durationMinutes,
					})
				}
			}
		}

		// Sort by date and time
		trainerLessons.sort((a, b) => {
			const dateCompare = a.date.localeCompare(b.date)
			if (dateCompare !== 0) return dateCompare
			return a.start.localeCompare(b.start)
		})

		return NextResponse.json({ lessons: trainerLessons }, { status: 200 })
	} catch (error: any) {
		console.error('Error fetching trainer lessons:', error)
		return NextResponse.json({ error: error.message || 'Failed to fetch lessons' }, { status: 500 })
	}
}

