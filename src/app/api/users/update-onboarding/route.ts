import { NextRequest, NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import User from '@/models/User'
import jwt, { JwtPayload } from 'jsonwebtoken'

interface OnboardingRequestBody {
	userId: string
	onboardingStep: number
}

interface DecodedToken extends JwtPayload {
	userId: string
	role?: 'student' | 'coach' | 'admin'
}

export async function PATCH(request: NextRequest) {
	await connectToDatabase()

	const token = request.cookies.get('token')?.value
	if (!token)
		return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

	let loggedInUser: DecodedToken

	try {
		loggedInUser = jwt.verify(
			token,
			process.env.JWT_SECRET!,
		) as DecodedToken
	} catch {
		return NextResponse.json({ message: 'Invalid token' }, { status: 401 })
	}

	const body = (await request.json()) as OnboardingRequestBody

	if (!body.userId || typeof body.onboardingStep !== 'number') {
		return NextResponse.json(
			{
				message:
					'Invalid request. Must include userId and onboardingStep.',
			},
			{ status: 400 },
		)
	}

	if (loggedInUser.userId !== body.userId) {
		return NextResponse.json(
			{ message: 'You are not allowed to update this user.' },
			{ status: 403 },
		)
	}

	const updatedUser = await User.findByIdAndUpdate(
		body.userId,
		{ onboardingStep: body.onboardingStep },
		{ new: true },
	)

	if (!updatedUser) {
		return NextResponse.json(
			{ message: 'User not found.' },
			{ status: 404 },
		)
	}

	return NextResponse.json(
		{
			message: 'Onboarding step updated successfully.',
			step: updatedUser.onboardingStep,
		},
		{ status: 200 },
	)
}
