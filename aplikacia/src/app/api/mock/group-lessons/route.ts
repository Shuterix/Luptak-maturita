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

		// Sample generated timetable with group lessons
		sampleTimetable: {
			date: '2025-03-03', // Monday
			lessons: [
				{
					start: '2025-03-03T17:00:00',
					end: '2025-03-03T18:00:00',
					teachers: ['Anna Johnson', 'Mike Chen'],
					teacher: 'Anna Johnson',
					couples: ['Emma & Lucas'],
					room: 'Studio A',
					type: 'lesson',
					lessonType: 'group',
					duration: 60,
					groupName: 'juniors1',
				},
				// Additional individual/couple lessons would be scheduled after group lessons
			],
		},
	}

	return NextResponse.json(mockData)
}
