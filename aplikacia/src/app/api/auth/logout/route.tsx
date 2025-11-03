import { NextResponse } from 'next/server'

interface SuccessResponse {
	status: 'success'
	message: string
	data?: object
}

export async function GET() {
	try {
		const successResponse: SuccessResponse = {
			status: 'success',
			message: 'Logged out successfully',
		}

		const response = NextResponse.json(successResponse, { status: 200 })
		response.cookies.delete('token')
		response.cookies.delete('onboardingStep')
		response.cookies.delete('role')

		return response
	} catch (error) {
		console.error('Error during logout', error)

		return NextResponse.json(
			{ message: 'Something went wrong' },
			{ status: 500 },
		)
	}
}
