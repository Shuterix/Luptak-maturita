import { NextRequest, NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import ExternalTeacher from '@/models/ExternalTeacher'
import User from '@/models/User'
import jwt from 'jsonwebtoken'
import { cookies } from 'next/headers'

function generateCode(): string {
	return Math.random().toString(36).substring(2, 8).toUpperCase()
}

async function generateUniqueCode(): Promise<string> {
	let code = generateCode()
	let attempts = 0
	while (attempts < 10) {
		const existing = await ExternalTeacher.findOne({ code })
		if (!existing) return code
		code = generateCode()
		attempts++
	}
	// Fallback: longer code
	return Math.random().toString(36).substring(2, 10).toUpperCase()
}

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

// GET - List all external teachers for the user's club
export async function GET() {
	try {
		await connectToDatabase()
		const currentUser = await getCurrentUser()
		if (!currentUser) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}
		if (!currentUser.clubId) {
			return NextResponse.json({ error: 'User not in a club' }, { status: 403 })
		}

		const teachers = await ExternalTeacher.find({ clubId: currentUser.clubId })
			.sort({ name: 1 })
			.lean()

		return NextResponse.json({ teachers })
	} catch (error: any) {
		console.error('Error fetching external teachers:', error)
		return NextResponse.json({ error: error.message || 'Failed to fetch external teachers' }, { status: 500 })
	}
}

// POST - Create a new external teacher
export async function POST(request: NextRequest) {
	try {
		await connectToDatabase()
		const currentUser = await getCurrentUser()
		if (!currentUser) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}
		if (!currentUser.clubId) {
			return NextResponse.json({ error: 'User not in a club' }, { status: 403 })
		}
		if (currentUser.role !== 'trainer' && currentUser.role !== 'admin') {
			return NextResponse.json({ error: 'Only trainers can manage external teachers' }, { status: 403 })
		}

		const body = await request.json()
		const { name } = body

		if (!name || !name.trim()) {
			return NextResponse.json({ error: 'Name is required' }, { status: 400 })
		}

		const code = await generateUniqueCode()

		const teacher = await ExternalTeacher.create({
			name: name.trim(),
			code,
			clubId: currentUser.clubId,
		})

		return NextResponse.json({ teacher }, { status: 201 })
	} catch (error: any) {
		console.error('Error creating external teacher:', error)
		return NextResponse.json({ error: error.message || 'Failed to create external teacher' }, { status: 500 })
	}
}

