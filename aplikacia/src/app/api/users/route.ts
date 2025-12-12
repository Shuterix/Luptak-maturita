import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
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

export async function GET(request: NextRequest) {
	try {
		await connectDB()
		const currentUser = await getCurrentUser()
		if (!currentUser) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}
		if (!currentUser.clubId) {
			return NextResponse.json({ error: 'User not in a club' }, { status: 403 })
		}

		const { searchParams } = new URL(request.url)
		const clubId = searchParams.get('clubId')
		const role = searchParams.get('role')

		// Verify the requested clubId matches the user's club
		if (clubId && clubId !== currentUser.clubId.toString()) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
		}

		const query: any = { clubId: currentUser.clubId }
		if (role) {
			query.role = role
		}

		const users = await User.find(query)
			.select('firstName lastName email role')
			.sort({ lastName: 1, firstName: 1 })
			.lean()

		return NextResponse.json({ users })
	} catch (error: any) {
		console.error('Error fetching users:', error)
		return NextResponse.json({ error: error.message || 'Failed to fetch users' }, { status: 500 })
	}
}

