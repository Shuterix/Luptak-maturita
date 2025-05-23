import { NextResponse } from "next/server"
import connectToDatabase from "@/lib/mongodb"
import User from "@/models/User"
import bcrypt from "bcryptjs"
import jwt from 'jsonwebtoken'
import { IUser } from "@/models/User"

interface Credentials {
	email: string,
	password: string
}

interface SuccessResponse {
	status: 'success',
	message: string,
	data?: object
}

interface ErrorResponse {
	status: 'error',
	errorType: 'WRONG_PASSWORD' | 'NONEXISTING_EMAIL' | 'VALIDATION'
	message: string
}

const afterSuccessfullLogin = (user: IUser) => {
	const successResponse: SuccessResponse = {
		status: 'success',
		message: 'Logged in successfully',
		data: user
	}

	const token = jwt.sign(
		{ userId: user._id, email: user.email},
		process.env.JWT_SECRET as string,
		{ expiresIn: '7d' }
	)

	const response = NextResponse.json(successResponse, { status: 200 })
	response.cookies.set('token', token, {
		name: 'token',
		value: token,
		httpOnly: true,
		path: '/',
		secure: process.env.NODE_ENV === 'production',
		sameSite: 'lax',
		maxAge: 60 * 60 * 24 * 7,
	})

	return response
}

export async function POST(request: Request) {
	try {
		await connectToDatabase()

		const data: Credentials = await request.json()
		if(!data.email || !data.password) {
			const errorResponse: ErrorResponse = {
				status: 'error',
				errorType: 'VALIDATION',
				message: 'All fields must filled.'
			}
			return NextResponse.json(errorResponse, { status: 400 })
		}

		const user = await User.findOne({email: data.email})
		if(!user) {
			const errorResponse: ErrorResponse = {
				status: 'error',
				errorType: 'NONEXISTING_EMAIL',
				message: 'This email has not been registered'
			}
			return NextResponse.json(errorResponse, { status: 404})
		}

		const isMatch = await bcrypt.compare(data.password, user.password)
		if(!isMatch) {
			const errorResponse: ErrorResponse = {
				status: 'error',
				errorType: 'WRONG_PASSWORD',
				message: 'Wrong password'
			}
			return NextResponse.json(errorResponse, { status: 401 })
		}

		return afterSuccessfullLogin(user)
	} catch (error) {
		console.error('Error during login', error)

		return NextResponse.json({ message: 'Something went wrong' }, { status: 500 })
	}
}