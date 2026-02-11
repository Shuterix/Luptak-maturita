import { NextRequest, NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import ExternalTeacher from '@/models/ExternalTeacher'
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

// DELETE - Remove an external teacher
export async function DELETE(
	request: NextRequest,
	{ params }: { params: Promise<{ teacherId: string }> },
) {
	try {
		await connectToDatabase()
		const currentUser = await getCurrentUser()
		if (!currentUser) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}
		if (currentUser.role !== 'trainer' && currentUser.role !== 'admin') {
			return NextResponse.json({ error: 'Only trainers can manage external teachers' }, { status: 403 })
		}

		const { teacherId } = await params

		const teacher = await ExternalTeacher.findOneAndDelete({
			_id: teacherId,
			clubId: currentUser.clubId,
		})

		if (!teacher) {
			return NextResponse.json({ error: 'External teacher not found' }, { status: 404 })
		}

		return NextResponse.json({ message: 'External teacher deleted' })
	} catch (error: any) {
		console.error('Error deleting external teacher:', error)
		return NextResponse.json({ error: error.message || 'Failed to delete external teacher' }, { status: 500 })
	}
}

// PATCH - Update an external teacher name
export async function PATCH(
	request: NextRequest,
	{ params }: { params: Promise<{ teacherId: string }> },
) {
	try {
		await connectToDatabase()
		const currentUser = await getCurrentUser()
		if (!currentUser) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}
		if (currentUser.role !== 'trainer' && currentUser.role !== 'admin') {
			return NextResponse.json({ error: 'Only trainers can manage external teachers' }, { status: 403 })
		}

		const { teacherId } = await params
		const body = await request.json()
		const { name } = body

		if (!name || !name.trim()) {
			return NextResponse.json({ error: 'Name is required' }, { status: 400 })
		}

		const teacher = await ExternalTeacher.findOneAndUpdate(
			{ _id: teacherId, clubId: currentUser.clubId },
			{ name: name.trim() },
			{ new: true },
		)

		if (!teacher) {
			return NextResponse.json({ error: 'External teacher not found' }, { status: 404 })
		}

		return NextResponse.json({ teacher })
	} catch (error: any) {
		console.error('Error updating external teacher:', error)
		return NextResponse.json({ error: error.message || 'Failed to update external teacher' }, { status: 500 })
	}
}

