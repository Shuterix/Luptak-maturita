import { NextRequest, NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import ExternalTeacher from '@/models/ExternalTeacher'
import jwt from 'jsonwebtoken'

export async function POST(request: NextRequest) {
	try {
		await connectToDatabase()

		const body = await request.json()
		const { code } = body

		if (!code || !code.trim()) {
			return NextResponse.json({ error: 'Login code is required' }, { status: 400 })
		}

		const teacher = await ExternalTeacher.findOne({ code: code.trim().toUpperCase() }).populate('clubId')
		if (!teacher) {
			return NextResponse.json(
				{ error: 'Invalid code. Please check with your trainer.' },
				{ status: 404 },
			)
		}

		const jwtSecret = process.env.JWT_SECRET
		if (!jwtSecret) {
			throw new Error('Missing JWT_SECRET')
		}

		// Create a JWT token for the external teacher
		const token = jwt.sign(
			{
				externalTeacherId: teacher._id,
				clubId: teacher.clubId,
				role: 'external_teacher',
				name: teacher.name,
			},
			jwtSecret,
			{ expiresIn: '7d' },
		)

		const response = NextResponse.json({
			status: 'success',
			message: 'Logged in successfully',
			teacher: {
				_id: teacher._id,
				name: teacher.name,
				clubId: teacher.clubId,
			},
		})

		response.cookies.set('token', token, {
			httpOnly: true,
			path: '/',
			secure: process.env.NODE_ENV === 'production',
			sameSite: 'lax',
			maxAge: 60 * 60 * 24 * 7,
		})

		response.cookies.set('role', 'external_teacher', {
			httpOnly: false,
			path: '/',
			secure: process.env.NODE_ENV === 'production',
			sameSite: 'lax',
			maxAge: 60 * 60 * 24 * 7,
		})

		// Set onboarding step to 2 so middleware won't redirect to onboarding
		response.cookies.set('onboardingStep', '2', {
			httpOnly: false,
			path: '/',
			secure: process.env.NODE_ENV === 'production',
			sameSite: 'lax',
			maxAge: 60 * 60 * 24 * 7,
		})

		return response
	} catch (error: any) {
		console.error('Error during external teacher login:', error)
		return NextResponse.json(
			{ error: 'Something went wrong' },
			{ status: 500 },
		)
	}
}

