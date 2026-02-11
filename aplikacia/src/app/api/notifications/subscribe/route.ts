import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import PushSubscription from '@/models/PushSubscription'
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

// Subscribe to push notifications
export async function POST(request: NextRequest) {
	try {
		await connectDB()
		const userInfo = await getCurrentUserInfo()
		if (!userInfo) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		const body = await request.json()
		const { subscription } = body

		if (!subscription || !subscription.endpoint || !subscription.keys) {
			return NextResponse.json({ error: 'Invalid subscription object' }, { status: 400 })
		}

		// Upsert: update existing or create new
		const filter = { endpoint: subscription.endpoint }
		const update = {
			userId: userInfo.userId,
			externalTeacherId: userInfo.externalTeacherId,
			endpoint: subscription.endpoint,
			keys: {
				p256dh: subscription.keys.p256dh,
				auth: subscription.keys.auth,
			},
			userAgent: request.headers.get('user-agent') || undefined,
		}

		await PushSubscription.findOneAndUpdate(filter, update, { upsert: true, new: true })

		return NextResponse.json({ success: true })
	} catch (error: any) {
		console.error('Error saving push subscription:', error)
		return NextResponse.json({ error: 'Failed to save subscription' }, { status: 500 })
	}
}

// Unsubscribe from push notifications
export async function DELETE(request: NextRequest) {
	try {
		await connectDB()
		const userInfo = await getCurrentUserInfo()
		if (!userInfo) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		const body = await request.json()
		const { endpoint } = body

		if (!endpoint) {
			return NextResponse.json({ error: 'Endpoint is required' }, { status: 400 })
		}

		await PushSubscription.deleteOne({ endpoint })

		return NextResponse.json({ success: true })
	} catch (error: any) {
		console.error('Error removing push subscription:', error)
		return NextResponse.json({ error: 'Failed to remove subscription' }, { status: 500 })
	}
}

