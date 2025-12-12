import { NextResponse } from 'next/server'

export async function GET() {
	const mockLessons = [
		{
			id: 'mock-lesson-1',
			kind: 'lesson',
			lessonType: 'group',
			teacherName: 'Teacher 1',
			roomLabel: 'Studio A',
			studentNames: ['Group Level 1'],
			date: '2025-03-03',
			start: '2025-03-03T15:00:00',
			end: '2025-03-03T15:45:00',
			durationMinutes: 45,
		},
		{
			id: 'mock-lesson-2',
			kind: 'lesson',
			lessonType: 'individual',
			teacherName: 'Teacher 2',
			roomLabel: 'Studio B',
			studentNames: ['Student A'],
			date: '2025-03-03',
			start: '2025-03-03T16:00:00',
			end: '2025-03-03T16:45:00',
			durationMinutes: 45,
		},
		{
			id: 'mock-break-1',
			kind: 'break',
			breakType: 'consecutive',
			date: '2025-03-03',
			start: '2025-03-03T16:45:00',
			end: '2025-03-03T17:00:00',
			durationMinutes: 15,
		},
	]

	return NextResponse.json({ lessons: mockLessons })
}

