import { NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import User from '@/models/User'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { cookies } from 'next/headers'

const MOCK_STUDENTS = [
	{ firstName: 'Anna', lastName: 'Kováčová', email: 'anna.kovacova@test.com' },
	{ firstName: 'Mark', lastName: 'Tóth', email: 'mark.toth@test.com' },
	{ firstName: 'Petra', lastName: 'Nováková', email: 'petra.novakova@test.com' },
	{ firstName: 'Tom', lastName: 'Horváth', email: 'tom.horvath@test.com' },
	{ firstName: 'Eva', lastName: 'Szabóová', email: 'eva.szaboova@test.com' },
	{ firstName: 'Lukáš', lastName: 'Varga', email: 'lukas.varga@test.com' },
	{ firstName: 'Sofia', lastName: 'Kissová', email: 'sofia.kissova@test.com' },
	{ firstName: 'Martin', lastName: 'Nagy', email: 'martin.nagy@test.com' },
	{ firstName: 'Zuzana', lastName: 'Farkasová', email: 'zuzana.farkasova@test.com' },
	{ firstName: 'Ján', lastName: 'Papp', email: 'jan.papp@test.com' },
]

export async function POST() {
	try {
		await connectToDatabase()

		// Get current user to find their club
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

		const currentUser = await User.findById(decoded.userId)
		if (!currentUser || !currentUser.clubId) {
			return NextResponse.json({ error: 'User not in a club' }, { status: 403 })
		}

		const clubId = currentUser.clubId

		// Check if students already exist
		const existingEmails = await User.find({
			email: { $in: MOCK_STUDENTS.map((s) => s.email) },
		}).select('email')

		const existingEmailSet = new Set(existingEmails.map((u) => u.email))
		const studentsToCreate = MOCK_STUDENTS.filter((s) => !existingEmailSet.has(s.email))

		if (studentsToCreate.length === 0) {
			return NextResponse.json({
				message: 'All mock students already exist',
				created: 0,
				total: MOCK_STUDENTS.length,
			})
		}

		// Hash password for all students (default password: "password123")
		const hashedPassword = await bcrypt.hash('password123', 10)

		// Mock unavailability patterns for students (times when they CANNOT train)
		// These represent when students are NOT available (e.g., school hours, other commitments)
		const unavailabilityPatterns = [
			{ // Pattern 1: Unavailable during school hours (Mon-Fri 08:00-15:00)
				monday: [{ start: '08:00', end: '15:00' }],
				tuesday: [{ start: '08:00', end: '15:00' }],
				wednesday: [{ start: '08:00', end: '15:00' }],
				thursday: [{ start: '08:00', end: '15:00' }],
				friday: [{ start: '08:00', end: '15:00' }],
			},
			{ // Pattern 2: Unavailable during school hours + late evenings
				monday: [{ start: '08:00', end: '15:00' }, { start: '19:00', end: '23:59' }],
				tuesday: [{ start: '08:00', end: '15:00' }, { start: '19:00', end: '23:59' }],
				wednesday: [{ start: '08:00', end: '15:00' }, { start: '19:00', end: '23:59' }],
				thursday: [{ start: '08:00', end: '15:00' }, { start: '19:00', end: '23:59' }],
				friday: [{ start: '08:00', end: '15:00' }, { start: '19:00', end: '23:59' }],
				sunday: [{ start: '14:00', end: '23:59' }],
			},
			{ // Pattern 3: Unavailable during mornings and late evenings (Mon-Fri)
				monday: [{ start: '08:00', end: '17:00' }, { start: '20:00', end: '23:59' }],
				tuesday: [{ start: '08:00', end: '17:00' }, { start: '20:00', end: '23:59' }],
				wednesday: [{ start: '08:00', end: '17:00' }, { start: '20:00', end: '23:59' }],
				thursday: [{ start: '08:00', end: '17:00' }, { start: '20:00', end: '23:59' }],
				friday: [{ start: '08:00', end: '17:00' }, { start: '20:00', end: '23:59' }],
			},
			{ // Pattern 4: Unavailable during weekdays (only available weekends)
				monday: [{ start: '00:00', end: '23:59' }],
				tuesday: [{ start: '00:00', end: '23:59' }],
				wednesday: [{ start: '00:00', end: '23:59' }],
				thursday: [{ start: '00:00', end: '23:59' }],
				friday: [{ start: '00:00', end: '23:59' }],
			},
			{ // Pattern 5: Unavailable during early mornings and late nights
				monday: [{ start: '00:00', end: '08:00' }, { start: '19:30', end: '23:59' }],
				tuesday: [{ start: '00:00', end: '08:00' }, { start: '19:30', end: '23:59' }],
				wednesday: [{ start: '00:00', end: '08:00' }, { start: '19:30', end: '23:59' }],
				thursday: [{ start: '00:00', end: '08:00' }, { start: '19:30', end: '23:59' }],
				friday: [{ start: '00:00', end: '08:00' }, { start: '19:30', end: '23:59' }],
				saturday: [{ start: '00:00', end: '08:00' }, { start: '19:30', end: '23:59' }],
				sunday: [{ start: '00:00', end: '08:00' }, { start: '19:30', end: '23:59' }],
			},
		]

		// Create students with mock unavailability
		const createdStudents = await User.insertMany(
			studentsToCreate.map((student, index) => ({
				...student,
				password: hashedPassword,
				role: 'student' as const,
				clubId: clubId,
				onboardingStep: 4, // Mark as completed onboarding
				unavailability: {
					timezone: 'UTC',
					...unavailabilityPatterns[index % unavailabilityPatterns.length],
				},
			}))
		)

		return NextResponse.json({
			message: `Created ${createdStudents.length} mock students`,
			created: createdStudents.length,
			total: MOCK_STUDENTS.length,
			students: createdStudents.map((s) => ({
				_id: s._id,
				firstName: s.firstName,
				lastName: s.lastName,
				email: s.email,
			})),
		})
	} catch (error: any) {
		console.error('Error seeding students:', error)
		return NextResponse.json({ error: error.message || 'Failed to seed students' }, { status: 500 })
	}
}

