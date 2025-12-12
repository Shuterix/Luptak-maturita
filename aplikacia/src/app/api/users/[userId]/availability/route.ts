import { NextRequest, NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import User from '@/models/User'
import jwt from 'jsonwebtoken'
import { cookies } from 'next/headers'

async function getCurrentUser() {
	const cookieStore = await cookies()
	const tokenCookie = cookieStore.get('token')
	const token = tokenCookie?.value

	if (!token) return null

	try {
		const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as any
		const user = await User.findById(decoded.userId)
		return user
	} catch {
		return null
	}
}

export async function GET(
	request: NextRequest,
	{ params }: { params: { userId: string } }
) {
	try {
		await connectToDatabase()

		const currentUser = await getCurrentUser()
		if (!currentUser) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		// Users can only view their own availability unless they're admin/trainer
		if (currentUser._id.toString() !== params.userId && currentUser.role !== 'admin' && currentUser.role !== 'trainer') {
			return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
		}

		const user = await User.findById(params.userId).select('unavailability').lean()
		if (!user) {
			return NextResponse.json({ error: 'User not found' }, { status: 404 })
		}

		return NextResponse.json({ availability: user.unavailability || {} }, { status: 200 })
	} catch (error: any) {
		console.error('Error fetching availability:', error)
		return NextResponse.json({ error: error.message || 'Failed to fetch availability' }, { status: 500 })
	}
}

export async function PATCH(
	request: NextRequest,
	{ params }: { params: { userId: string } }
) {
	try {
		await connectToDatabase()

		const currentUser = await getCurrentUser()
		if (!currentUser) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		// Users can only update their own availability unless they're admin
		if (currentUser._id.toString() !== params.userId && currentUser.role !== 'admin') {
			return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
		}

		const body = await request.json()
		const { availability } = body

		if (!availability) {
			return NextResponse.json({ error: 'Availability data is required' }, { status: 400 })
		}

		// Validate availability structure
		const validDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
		for (const day of validDays) {
			if (availability[day] && Array.isArray(availability[day])) {
				for (const window of availability[day]) {
					if (!window.start || !window.end) {
						return NextResponse.json(
							{ error: `Invalid time window for ${day}: start and end are required` },
							{ status: 400 }
						)
					}
					// Validate time format (HH:mm)
					if (!/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(window.start) || !/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(window.end)) {
						return NextResponse.json(
							{ error: `Invalid time format for ${day}: must be HH:mm` },
							{ status: 400 }
						)
					}
					// Validate start < end
					const [startH, startM] = window.start.split(':').map(Number)
					const [endH, endM] = window.end.split(':').map(Number)
					const startMinutes = startH * 60 + startM
					const endMinutes = endH * 60 + endM
					if (startMinutes >= endMinutes) {
						return NextResponse.json(
							{ error: `Invalid time window for ${day}: start time must be before end time` },
							{ status: 400 }
						)
					}
				}
			}
		}

		// Save as unavailability - we're storing when they CAN train (availability)
		// For now, we'll store it directly as unavailability structure
		// Note: The model uses "unavailability" but we're treating it as availability windows
		const user = await User.findByIdAndUpdate(
			params.userId,
			{ 
				$set: { 
					unavailability: {
						...availability,
						timezone: availability.timezone || 'UTC'
					}
				} 
			},
			{ new: true, runValidators: true }
		).lean()

		if (!user) {
			return NextResponse.json({ error: 'User not found' }, { status: 404 })
		}

		return NextResponse.json({ 
			message: 'Availability updated successfully',
			availability: user.unavailability 
		}, { status: 200 })
	} catch (error: any) {
		console.error('Error updating availability:', error)
		return NextResponse.json({ error: error.message || 'Failed to update availability' }, { status: 500 })
	}
}

