import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import NotificationPreference from '@/models/NotificationPreference'
import jwt from 'jsonwebtoken'
import { cookies } from 'next/headers'

async function getCurrentUserInfo() {
	try {
		const cookieStore = await cookies()
		const token = cookieStore.get('token')?.value
		if (!token) return null
		const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any
		return {
			userId: decoded.userId || undefined,
			externalTeacherId: decoded.externalTeacherId || undefined,
		}
	} catch {
		return null
	}
}

// Get notification preferences
export async function GET() {
	try {
		await connectDB()
		const userInfo = await getCurrentUserInfo()
		if (!userInfo) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		const filter = userInfo.userId
			? { userId: userInfo.userId }
			: { externalTeacherId: userInfo.externalTeacherId }

		let prefs = await NotificationPreference.findOne(filter).lean()

		// Return defaults if no preferences saved yet
		if (!prefs) {
			prefs = {
				enabled: true,
				reminderHoursBefore: 24,
				secondReminderHoursBefore: 0,
				pushEnabled: true,
			} as any
		}

		return NextResponse.json({ preferences: prefs })
	} catch (error: any) {
		console.error('Error fetching notification preferences:', error)
		return NextResponse.json({ error: 'Failed to fetch preferences' }, { status: 500 })
	}
}

// Update notification preferences
export async function PUT(request: NextRequest) {
	try {
		await connectDB()
		const userInfo = await getCurrentUserInfo()
		if (!userInfo) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		const body = await request.json()
		const { enabled, reminderHoursBefore, secondReminderHoursBefore, pushEnabled } = body

		const filter = userInfo.userId
			? { userId: userInfo.userId }
			: { externalTeacherId: userInfo.externalTeacherId }

		const update: any = {}
		if (typeof enabled === 'boolean') update.enabled = enabled
		if (typeof reminderHoursBefore === 'number') update.reminderHoursBefore = reminderHoursBefore
		if (typeof secondReminderHoursBefore === 'number') update.secondReminderHoursBefore = secondReminderHoursBefore
		if (typeof pushEnabled === 'boolean') update.pushEnabled = pushEnabled

		// Also set the user/teacher ID
		if (userInfo.userId) update.userId = userInfo.userId
		if (userInfo.externalTeacherId) update.externalTeacherId = userInfo.externalTeacherId

		const prefs = await NotificationPreference.findOneAndUpdate(
			filter,
			{ $set: update },
			{ upsert: true, new: true },
		)

		return NextResponse.json({ preferences: prefs })
	} catch (error: any) {
		console.error('Error updating notification preferences:', error)
		return NextResponse.json({ error: 'Failed to update preferences' }, { status: 500 })
	}
}

