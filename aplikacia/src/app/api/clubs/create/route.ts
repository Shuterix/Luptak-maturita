import { NextRequest, NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import Club from '@/models/Club'
import User from '@/models/User'
import jwt, { JwtPayload } from 'jsonwebtoken'

interface CreateRequestBody {
	userId: string
	clubName: string
	description?: string
	logoUrl?: string
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

	const body = (await request.json()) as CreateRequestBody
	if (!body.userId || !body.clubName)
		return NextResponse.json({ message: 'Must provide userId and clubName.' }, { status: 400 })

	if (loggedInUser.userId !== body.userId)
		return NextResponse.json({ message: 'You cannot create a club for another user.' }, { status: 403 })

	const user = await User.findById(body.userId)
	if (!user) return NextResponse.json({ message: 'User not found.' }, { status: 404 })

	if (user.role !== 'trainer')
		return NextResponse.json({ message: 'Only trainers can create clubs.' }, { status: 403 })

	const clubCode = Math.random().toString(36).substring(2, 8).toUpperCase()

	const newClub = new Club({
		name: body.clubName,
		description: body.description,
		logoUrl: body.logoUrl,
		code: clubCode,
		trainers: [user._id],
		students: [],
		pairIds: [],
		scheduleIds: [],
	})

	await newClub.save()

	user.clubCode = clubCode
	await user.save()

	return NextResponse.json({ message: 'Club created successfully.', clubId: newClub._id, code: clubCode })
}