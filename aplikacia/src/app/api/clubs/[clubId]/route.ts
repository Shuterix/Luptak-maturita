import { NextRequest, NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
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
		await connectToDatabase()
		const { clubId } = await params
		const currentUser = await getCurrentUser()

		if (!currentUser) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		// Verify user is in the requested club
		if (currentUser.clubId?.toString() !== clubId) {
			return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
		}

		// Get couple count
		const coupleCount = await Pair.countDocuments({ clubId })

		// For trainers, include the club code; for students, exclude it
		const isTrainer = currentUser.role === 'trainer' || currentUser.role === 'admin'
		
		const club = await Club.findById(clubId).select(isTrainer ? 'name description code' : 'name description').lean()
		if (!club) {
			return NextResponse.json({ error: 'Club not found' }, { status: 404 })
		}

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

export async function PATCH(
	request: NextRequest,
	{ params }: { params: Promise<{ clubId: string }> }
) {
	try {
		await connectToDatabase()
		const { clubId } = await params
		const currentUser = await getCurrentUser()

		if (!currentUser) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		// Only trainers can regenerate club codes
		if (currentUser.role !== 'trainer' && currentUser.role !== 'admin') {
			return NextResponse.json({ error: 'Only trainers can regenerate club codes' }, { status: 403 })
		}

		// Verify user is in the requested club
		if (currentUser.clubId?.toString() !== clubId) {
			return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
		}

		const club = await Club.findById(clubId)
		if (!club) {
			return NextResponse.json({ error: 'Club not found' }, { status: 404 })
		}

		// Generate new club code
		let newCode: string
		let attempts = 0
		const maxAttempts = 10

		do {
			newCode = Math.random().toString(36).substring(2, 8).toUpperCase()
			attempts++
			
			// Check if code already exists
			const existingClub = await Club.findOne({ code: newCode, _id: { $ne: clubId } })
			if (!existingClub) break
		} while (attempts < maxAttempts)

		if (attempts >= maxAttempts) {
			return NextResponse.json({ error: 'Failed to generate unique club code' }, { status: 500 })
		}

		// Update club code
		club.code = newCode
		await club.save()

		return NextResponse.json({
			message: 'Club code regenerated successfully',
			code: newCode,
		})
	} catch (error: any) {
		console.error('Error regenerating club code:', error)
		return NextResponse.json({ error: error.message || 'Failed to regenerate club code' }, { status: 500 })
	}
}

