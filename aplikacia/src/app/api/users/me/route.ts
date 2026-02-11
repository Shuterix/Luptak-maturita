import { NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import User from '@/models/User'
import ExternalTeacher from '@/models/ExternalTeacher'
import jwt from 'jsonwebtoken'
import { cookies } from 'next/headers'

export async function GET() {
	try {
		await connectToDatabase()

		const cookieStore = await cookies() // <-- await here
		const tokenCookie = cookieStore.get('token')
		const token = tokenCookie?.value

		if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

		let decoded: any
		try {
			decoded = jwt.verify(token, process.env.JWT_SECRET as string)
		} catch {
			return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
		}

		// Handle external teacher tokens
		if (decoded.role === 'external_teacher' && decoded.externalTeacherId) {
			const teacher = await ExternalTeacher.findById(decoded.externalTeacherId).lean() as any
			if (!teacher) return NextResponse.json({ error: 'External teacher not found' }, { status: 404 })

			return NextResponse.json({
				user: {
					_id: teacher._id,
					firstName: teacher.name,
					lastName: '',
					role: 'external_teacher',
					clubId: teacher.clubId,
					onboardingStep: 2,
				},
			}, { status: 200 })
		}

		const user = await User.findById(decoded.userId).lean()
		if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

		const { password, ...userWithoutPassword } = user as { password?: string; [key: string]: any }

		return NextResponse.json({ user: userWithoutPassword }, { status: 200 })
	} catch (error) {
		console.error('Error fetching user data:', error)
		return NextResponse.json({ error: 'Server error' }, { status: 500 })
	}
}