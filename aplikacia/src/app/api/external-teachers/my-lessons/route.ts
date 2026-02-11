import { NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import ExternalTeacher from '@/models/ExternalTeacher'
import Timetable from '@/models/Timetable'
import jwt from 'jsonwebtoken'
import { cookies } from 'next/headers'

export async function GET() {
	try {
		await connectToDatabase()

		const cookieStore = await cookies()
		const tokenCookie = cookieStore.get('token')
		const token = tokenCookie?.value

		if (!token) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		let decoded: any
		try {
			decoded = jwt.verify(token, process.env.JWT_SECRET as string)
		} catch {
			return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
		}

		if (decoded.role !== 'external_teacher' || !decoded.externalTeacherId) {
			return NextResponse.json({ error: 'Not an external teacher' }, { status: 403 })
		}

		const teacher = await ExternalTeacher.findById(decoded.externalTeacherId)
		if (!teacher) {
			return NextResponse.json({ error: 'External teacher not found' }, { status: 404 })
		}

		// Find all timetables for the club that have lessons assigned to this teacher
		const timetables = await Timetable.find({
			clubId: teacher.clubId,
		}).lean()

		// Get today's date string for comparison
		const today = new Date()
		const todayStr = today.toISOString().split('T')[0]

		// Find all upcoming lessons for this teacher across all timetables
		const upcomingLessons: any[] = []

		for (const timetable of timetables) {
			if (!timetable.lessons) continue

			for (const lesson of timetable.lessons) {
				// Match by teacher name
				if (
					lesson.teacherName === teacher.name &&
					lesson.kind === 'lesson' &&
					lesson.status !== 'cancelled' &&
					lesson.date >= todayStr
				) {
					upcomingLessons.push({
						_id: lesson._id,
						timetableName: timetable.name,
						timetableId: timetable._id,
						date: lesson.date,
						start: lesson.start,
						end: lesson.end,
						lessonType: lesson.lessonType,
						roomLabel: lesson.roomLabel,
						studentNames: lesson.studentNames || [],
						pairLabel: lesson.pairLabel,
						notes: lesson.notes,
						status: lesson.status,
					})
				}
			}
		}

		// Sort by date and start time
		upcomingLessons.sort((a, b) => {
			const dateCompare = a.date.localeCompare(b.date)
			if (dateCompare !== 0) return dateCompare
			return a.start.localeCompare(b.start)
		})

		return NextResponse.json({
			teacher: { name: teacher.name },
			lessons: upcomingLessons,
		})
	} catch (error: any) {
		console.error('Error fetching external teacher lessons:', error)
		return NextResponse.json({ error: 'Server error' }, { status: 500 })
	}
}

