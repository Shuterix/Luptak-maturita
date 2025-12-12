import { NextResponse } from 'next/server'

export async function GET() {
	const mockData = {
		// Teachers with availability
		teachers: [
			{
				name: 'Anna Johnson',
				availability: ['08:00-12:00', '14:00-18:00'],
				maxLessonsPerDay: 6,
				room: 'Studio A',
			},
			{
				name: 'Mike Chen',
				availability: ['09:00-13:00', '15:00-19:00'],
				maxLessonsPerDay: 5,
				room: 'Studio B',
			},
			{
				name: 'Sarah Williams',
				availability: ['10:00-14:00', '16:00-20:00'],
				maxLessonsPerDay: 4,
				room: 'Studio C',
			},
		],

		// Students with base groups assigned
		students: [
			{
				name: 'Emma Thompson',
				availability: ['15:00-19:00'],
				desiredLessons: 8,
				priority: 8,
				baseGroup: 'juniors1',
			},
			{
				name: 'Lucas Garcia',
				availability: ['16:00-20:00'],
				desiredLessons: 8,
				priority: 7,
				baseGroup: 'juniors1',
			},
			{
				name: 'Sophie Patel',
				availability: ['15:30-19:30'],
				desiredLessons: 6,
				priority: 9,
				baseGroup: 'juniors2',
			},
			{
				name: 'Oliver Brown',
				availability: ['14:00-18:00'],
				desiredLessons: 6,
				priority: 8,
				baseGroup: 'juniors2',
			},
		],

		// Couples formed from students
		couples: [
			{
				name: 'Emma & Lucas',
				studentA: {
					name: 'Emma Thompson',
					availability: ['15:00-19:00'],
					desiredLessons: 8,
					priority: 8,
					baseGroup: 'juniors1',
				},
				studentB: {
					name: 'Lucas Garcia',
					availability: ['16:00-20:00'],
					desiredLessons: 8,
					priority: 7,
					baseGroup: 'juniors1',
				},
				availability: ['16:00-19:00'], // intersection of both availabilities
				desiredLessons: 12,
				priority: 8,
				preferredTeacher: 'Anna Johnson',
				baseGroup: 'juniors1',
			},
			{
				name: 'Sophie & Oliver',
				studentA: {
					name: 'Sophie Patel',
					availability: ['15:30-19:30'],
					desiredLessons: 6,
					priority: 9,
					baseGroup: 'juniors2',
				},
				studentB: {
					name: 'Oliver Brown',
					availability: ['14:00-18:00'],
					desiredLessons: 6,
					priority: 8,
					baseGroup: 'juniors2',
				},
				availability: ['15:30-18:00'], // intersection of both availabilities
				desiredLessons: 10,
				priority: 9,
				preferredTeacher: 'Mike Chen',
				baseGroup: 'juniors2',
			},
		],

		// Group lessons configuration
		groupLessons: [
			{
				groupName: 'juniors1',
				weeklyLessonsTarget: 3, // 3 group lessons per week
				teachers: ['Anna Johnson', 'Mike Chen'], // multiple teachers can lead
				participants: [
					{
						name: 'Emma & Lucas',
						studentA: {
							name: 'Emma Thompson',
							availability: ['15:00-19:00'],
							desiredLessons: 8,
							priority: 8,
							baseGroup: 'juniors1',
						},
						studentB: {
							name: 'Lucas Garcia',
							availability: ['16:00-20:00'],
							desiredLessons: 8,
							priority: 7,
							baseGroup: 'juniors1',
						},
						availability: ['16:00-19:00'],
						desiredLessons: 12,
						priority: 8,
						preferredTeacher: 'Anna Johnson',
						baseGroup: 'juniors1',
					},
				],
				staticTimeSlot: {
					dayOfWeek: 'monday',
					startTime: '17:00',
					duration: 60, // 60-minute group lesson
				},
				preferredRoom: 'Studio A',
				notes: 'Beginners group - focus on basic steps',
			},
			{
				groupName: 'juniors2',
				weeklyLessonsTarget: 2, // 2 group lessons per week
				teachers: ['Sarah Williams'], // single teacher for this group
				participants: [
					{
						name: 'Sophie & Oliver',
						studentA: {
							name: 'Sophie Patel',
							availability: ['15:30-19:30'],
							desiredLessons: 6,
							priority: 9,
							baseGroup: 'juniors2',
						},
						studentB: {
							name: 'Oliver Brown',
							availability: ['14:00-18:00'],
							desiredLessons: 6,
							priority: 8,
							baseGroup: 'juniors2',
						},
						availability: ['15:30-18:00'],
						desiredLessons: 10,
						priority: 9,
						preferredTeacher: 'Mike Chen',
						baseGroup: 'juniors2',
					},
				],
				// No static time slot - automatic scheduling
				preferredRoom: 'Studio B',
				notes: 'Intermediate group - working on turns and patterns',
			},
		],

		// Timetables with group lessons integrated
		timetables: [
			{
				_id: 'mock-timetable-1',
				clubId: 'mock-club-1',
				name: 'Sample After-School Week with Group Lessons',
				type: 'after_school',
				startDate: '2025-03-03',
				endDate: '2025-03-07',
				dayStart: '15:00',
				dayEnd: '20:00',
				defaultBreaks: [{ start: '17:00', end: '17:15' }],
				consecutiveLessonLimit: 4,
				slotMinutes: 15,
				defaultLessonDuration: 45,
				// Group lessons configuration
				groupLessons: [
					{
						groupName: 'juniors1',
						weeklyLessonsTarget: 3,
						teachers: ['Anna Johnson', 'Mike Chen'],
						participants: ['Emma & Lucas'],
						staticTimeSlot: {
							dayOfWeek: 'monday',
							startTime: '17:00',
							duration: 60,
						},
						preferredRoom: 'Studio A',
						notes: 'Beginners group - focus on basic steps',
					},
					{
						groupName: 'juniors2',
						weeklyLessonsTarget: 2,
						teachers: ['Sarah Williams'],
						participants: ['Sophie & Oliver'],
						preferredRoom: 'Studio B',
						notes: 'Intermediate group - working on turns and patterns',
					},
				],
				summary: {
					totalLessons: 25,
					studentsSatisfied: 8,
					studentsUnmet: [],
					groupLessonsScheduled: 5,
				},
				lessons: [
					// Group lesson for juniors1
					{
						id: 'mock-group-lesson-1',
						kind: 'lesson',
						lessonType: 'group',
						teacherName: 'Anna Johnson',
						teacherNames: ['Anna Johnson', 'Mike Chen'],
						roomLabel: 'Studio A',
						studentNames: ['Emma & Lucas'],
						date: '2025-03-03', // Monday
						start: '2025-03-03T17:00:00',
						end: '2025-03-03T18:00:00',
						durationMinutes: 60,
						locked: false,
						manualOverride: false,
						groupName: 'juniors1',
						notes: 'Beginners group - focus on basic steps',
					},
					// Group lesson for juniors2 (automatically scheduled)
					{
						id: 'mock-group-lesson-2',
						kind: 'lesson',
						lessonType: 'group',
						teacherName: 'Sarah Williams',
						teacherNames: ['Sarah Williams'],
						roomLabel: 'Studio B',
						studentNames: ['Sophie & Oliver'],
						date: '2025-03-04', // Tuesday
						start: '2025-03-04T15:30:00',
						end: '2025-03-04T16:15:00',
						durationMinutes: 45,
						locked: false,
						manualOverride: false,
						groupName: 'juniors2',
						notes: 'Intermediate group - working on turns and patterns',
					},
					// Individual lessons (after group lessons are scheduled)
					{
						id: 'mock-lesson-individual-1',
						kind: 'lesson',
						lessonType: 'individual',
						teacherName: 'Mike Chen',
						roomLabel: 'Studio B',
						studentNames: ['Emma Thompson'],
						date: '2025-03-03',
						start: '2025-03-03T15:00:00',
						end: '2025-03-03T15:45:00',
						durationMinutes: 45,
						locked: false,
						manualOverride: false,
					},
					// Couple lesson
					{
						id: 'mock-lesson-couple-1',
						kind: 'lesson',
						lessonType: 'couple',
						teacherName: 'Anna Johnson',
						roomLabel: 'Studio A',
						studentNames: ['Lucas Garcia'],
						couple: 'Emma & Lucas',
						date: '2025-03-04',
						start: '2025-03-04T18:00:00',
						end: '2025-03-04T18:45:00',
						durationMinutes: 45,
						locked: false,
						manualOverride: false,
					},
					// Default break
					{
						id: 'mock-break-1',
						kind: 'break',
						breakType: 'default',
						date: '2025-03-03',
						start: '2025-03-03T17:00:00',
						end: '2025-03-03T17:15:00',
						durationMinutes: 15,
					},
				],
			},
		],
	}

	return NextResponse.json(mockData)
}

