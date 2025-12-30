import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import Pair from '@/models/Pair'
import jwt from 'jsonwebtoken'
import { cookies } from 'next/headers'

async function getCurrentUser() {
	try {
		const cookieStore = await cookies()
		const token = cookieStore.get('token')?.value
		if (!token) return null
		const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string }
		const User = (await import('@/models/User')).default
		return await User.findById(decoded.userId)
	} catch {
		return null
	}
}

export async function GET(request: NextRequest) {
	try {
		await connectDB()
		const user = await getCurrentUser()
		if (!user) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}
		if (!user.clubId) {
			return NextResponse.json({ error: 'User not in a club' }, { status: 403 })
		}

		// Fetch all unique baseGroup values from pairs in this club
		const pairs = await Pair.find({ 
			clubId: user.clubId,
			baseGroup: { $exists: true, $ne: null, $ne: '' }
		}).select('baseGroup')

		// Extract unique group names
		const uniqueGroups = Array.from(new Set(
			pairs
				.map(pair => pair.baseGroup)
				.filter((group): group is string => typeof group === 'string' && group.trim() !== '')
		)).sort()

		return NextResponse.json({ groups: uniqueGroups })
	} catch (error: any) {
		console.error('Error fetching groups:', error)
		return NextResponse.json({ error: error.message || 'Failed to fetch groups' }, { status: 500 })
	}
}

