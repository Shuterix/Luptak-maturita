import { NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import User from '@/models/User'
import bcrypt from 'bcryptjs'

interface NewUser {
	firstName: string
	lastName: string
	email: string
	password: string
}

interface SuccessResponse {
	status: 'success'
	message: string
}

interface ErrorResponse {
	status: 'error'
	errorType: 'VALIDATION' | 'EMAIL_TAKEN' | 'SERVER_ERROR'
	message: string
}

export async function POST(request: Request) {
	try {
		await connectToDatabase()

		const data: NewUser = await request.json()

		if (!data.email || !data.lastName || !data.email || !data.password) {
			const errorResponse: ErrorResponse = {
				status: 'error',
				errorType: 'VALIDATION',
				message: 'All fields must be filled.',
			}
			return NextResponse.json(errorResponse, { status: 400 })
		}

		const existingUser = await User.findOne({ email: data.email })
		if (existingUser) {
			const errorResponse: ErrorResponse = {
				status: 'error',
				errorType: 'EMAIL_TAKEN',
				message: 'Email has already been registered',
			}
			return NextResponse.json(errorResponse, { status: 409 })
		}

		const hashedPassword = await bcrypt.hash(data.password, 10)

		const newUser = new User({
			firstName: data.firstName,
			lastName: data.lastName,
			email: data.email,
			password: hashedPassword,
		})

		await newUser.save()

		const successResponse: SuccessResponse = {
			status: 'success',
			message: 'User registered successfully, please login',
		}

		return NextResponse.json(successResponse, { status: 201 })
	} catch (error) {
		console.error('Error during registration:', error)

		return NextResponse.json(
			{ message: 'Something went wrong' },
			{ status: 500 },
		)
	}
}
