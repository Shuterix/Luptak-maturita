import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import Club from '@/models/Club'
import Pair from '@/models/Pair'
import jwt from 'jsonwebtoken'
import { cookies } from 'next/headers'

async function getCurrentUser() {
	const cookieStore = await cookies()
	const tokenCookie = cookieStore.get('token')
	const token = tokenCookie?.value

	if (!token) return null

	try {
		const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as any
		const User = (await import('@/models/User')).default
		const user = await User.findById(decoded.userId)
		return user
	} catch {
		return null
	}
}

export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ clubId: string }> }
) {
	try {
		await connectDB()
		const { clubId } = await params
		const currentUser = await getCurrentUser()

		if (!currentUser) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		// Verify user is in the requested club
		if (currentUser.clubId?.toString() !== clubId) {
			return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
		}

		const club = await Club.findById(clubId).select('name description').lean()
		if (!club) {
			return NextResponse.json({ error: 'Club not found' }, { status: 404 })
		}

		// Get couple count
		const coupleCount = await Pair.countDocuments({ clubId })

		return NextResponse.json({
			club: {
				...club,
				coupleCount,
			},
		})
	} catch (error: any) {
		console.error('Error fetching club:', error)
		return NextResponse.json({ error: error.message || 'Failed to fetch club' }, { status: 500 })
	}
}

