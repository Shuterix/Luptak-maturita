import { NextRequest, NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import Club from '@/models/Club'
import User from '@/models/User'
import jwt from 'jsonwebtoken'
import { cookies } from 'next/headers'

export async function POST() {
	try {
		await connectToDatabase()

		const cookieStore = await cookies()
		const tokenCookie = cookieStore.get('token')
		const token = tokenCookie?.value

		if (!token) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as any
		const user = await User.findById(decoded.userId)

		if (!user) {
			return NextResponse.json({ error: 'User not found' }, { status: 404 })
		}

		// Find clubs where this user is in the students or trainers array
		const clubs = await Club.find({
			$or: [
				{ students: user._id },
				{ trainers: user._id },
			],
		})

		if (clubs.length === 0) {
			return NextResponse.json({ message: 'User is not in any club', fixed: false })
		}

		// Use the first club found (or you could handle multiple clubs differently)
		const club = clubs[0]

		// Update user's clubId if it's not set or different
		if (!user.clubId || user.clubId.toString() !== club._id.toString()) {
			user.clubId = club._id
			await user.save()
			return NextResponse.json({
				message: 'User clubId updated successfully',
				clubId: club._id,
				clubName: club.name,
				fixed: true,
			})
		}

		return NextResponse.json({
			message: 'User already has correct clubId',
			clubId: user.clubId,
			fixed: false,
		})
	} catch (error: any) {
		console.error('Error fixing membership:', error)
		return NextResponse.json({ error: error.message || 'Failed to fix membership' }, { status: 500 })
	}
}

