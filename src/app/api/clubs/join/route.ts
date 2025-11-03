import { NextRequest, NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import Club from '@/models/Club'
import User from '@/models/User'
import jwt, { JwtPayload } from 'jsonwebtoken'
interface JoinRequestBody {
	userId: string
	clubCode: string
}

interface DecodedToken extends JwtPayload {
	userId: string
	role?: 'student' | 'trainer' | 'admin'
}

export async function POST(request: NextRequest) {
	await connectToDatabase()

	const token = request.cookies.get('token')?.value
	if (!token)
		return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

	let loggedInUser: DecodedToken
	try {
		loggedInUser = jwt.verify(token, process.env.JWT_SECRET!) as DecodedToken
	} catch {
		return NextResponse.json({ message: 'Invalid token' }, { status: 401 })
	}

	const body = (await request.json()) as JoinRequestBody
	if (!body.userId || !body.clubCode)
		return NextResponse.json({ message: 'Must provide userId and clubCode.' }, { status: 400 })

	if (loggedInUser.userId !== body.userId)
		return NextResponse.json({ message: 'You cannot join a club for another user.' }, { status: 403 })

	const user = await User.findById(body.userId)
	if (!user) return NextResponse.json({ message: 'User not found.' }, { status: 404 })

	if (user.role !== 'student')
		return NextResponse.json({ message: 'Only students can join clubs.' }, { status: 403 })

	const club = await Club.findOne({ code: body.clubCode })
	if (!club) return NextResponse.json({ message: 'Club not found.' }, { status: 404 })

	// Add student if not already in the students array
	if (!club.students.includes(user._id)) {
		club.students.push(user._id)
		await club.save()
	}

	// Update user's clubCode
	user.clubCode = club.code
	await user.save()

	return NextResponse.json({ message: 'Joined club successfully.', clubId: club._id })
}