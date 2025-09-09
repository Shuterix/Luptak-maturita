import { NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import User from '@/models/User'
import jwt from 'jsonwebtoken'
import { cookies } from 'next/headers'

export async function GET() {
	try {
		await connectToDatabase()

		const cookieStore = await cookies() // <-- await here
		const tokenCookie = cookieStore.get('token')
		const token = tokenCookie?.value

		if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

		let decoded: any
		try {
			decoded = jwt.verify(token, process.env.JWT_SECRET as string)
		} catch {
			return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
		}

		const user = await User.findById(decoded.userId).lean()
		if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

		const { password, ...userWithoutPassword } = user as { password?: string; [key: string]: any }

		return NextResponse.json({ user: userWithoutPassword }, { status: 200 })
	} catch (error) {
		console.error('Error fetching user data:', error)
		return NextResponse.json({ error: 'Server error' }, { status: 500 })
	}
}