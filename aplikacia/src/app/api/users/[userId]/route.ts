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
	{ params }: { params: Promise<{ userId: string }> }
) {
	try {
		await connectToDatabase()
		const { userId } = await params

		const currentUser = await getCurrentUser()
		if (!currentUser) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		// Users can only view their own data unless they're admin/trainer
		if (currentUser._id.toString() !== userId && currentUser.role !== 'admin' && currentUser.role !== 'trainer') {
			return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
		}

		const user = await User.findById(userId).lean()
		if (!user) {
			return NextResponse.json({ error: 'User not found' }, { status: 404 })
		}

		const { password, ...userWithoutPassword } = user as { password?: string; [key: string]: any }

		return NextResponse.json({ user: userWithoutPassword }, { status: 200 })
	} catch (error: any) {
		console.error('Error fetching user:', error)
		return NextResponse.json({ error: error.message || 'Failed to fetch user' }, { status: 500 })
	}
}

export async function PATCH(
	request: NextRequest,
	{ params }: { params: Promise<{ userId: string }> }
) {
	try {
		await connectToDatabase()
		const { userId } = await params

		const currentUser = await getCurrentUser()
		if (!currentUser) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		// Users can only update their own data unless they're admin
		if (currentUser._id.toString() !== userId && currentUser.role !== 'admin') {
			return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
		}

		const body = await request.json()
		const { partnerId, profile, firstName, lastName, ...otherFields } = body

		// Only allow specific fields to be updated
		const updateData: any = {}
		
		if (partnerId !== undefined) {
			updateData.partnerId = partnerId
		}

		if (profile !== undefined) {
			updateData.profile = profile
		}

		if (firstName !== undefined) {
			updateData.firstName = firstName
		}

		if (lastName !== undefined) {
			updateData.lastName = lastName
		}

		// Prevent updating sensitive fields via this endpoint
		const allowedFields = ['profile', 'partnerId', 'firstName', 'lastName']
		for (const key of Object.keys(otherFields)) {
			if (allowedFields.includes(key)) {
				updateData[key] = otherFields[key]
			}
		}

		const user = await User.findByIdAndUpdate(
			userId,
			{ $set: updateData },
			{ new: true, runValidators: true }
		).lean()

		if (!user) {
			return NextResponse.json({ error: 'User not found' }, { status: 404 })
		}

		const { password, ...userWithoutPassword } = user as { password?: string; [key: string]: any }

		return NextResponse.json({ user: userWithoutPassword }, { status: 200 })
	} catch (error: any) {
		console.error('Error updating user:', error)
		return NextResponse.json({ error: error.message || 'Failed to update user' }, { status: 500 })
	}
}

