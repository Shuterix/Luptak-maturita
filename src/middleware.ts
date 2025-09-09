import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
	const token = request.cookies.get('token')?.value
	const onboardingStepStr = request.cookies.get('onboardingStep')?.value
	const onboardingStep = onboardingStepStr
		? parseInt(onboardingStepStr, 10)
		: 0

	const { pathname } = request.nextUrl

	const protectedRoutes = ['/dashboard', '/onboarding']
	const isProtected = protectedRoutes.some((route) =>
		pathname.startsWith(route),
	)

	if (pathname === '/') {
		if (!token)
			return NextResponse.redirect(new URL('/auth/login', request.url))
		if (onboardingStep < 2)
			return NextResponse.redirect(new URL('/onboarding', request.url))
		return NextResponse.redirect(new URL('/dashboard', request.url))
	}

	if (isProtected && !token) {
		return NextResponse.redirect(new URL('/auth/login', request.url))
	}

	if (token) {
		const role = request.cookies.get('role')?.value || 'user'
		const onboardingComplete = role === 'trainer' ? onboardingStep >= 2 : onboardingStep >= 1

		if (pathname.startsWith('/dashboard') && !onboardingComplete) {
			return NextResponse.redirect(new URL('/onboarding', request.url))
		}

		if (pathname.startsWith('/onboarding') && onboardingComplete) {
			return NextResponse.redirect(new URL('/dashboard', request.url))
		}

		if (pathname.startsWith('/auth')) {
			return NextResponse.redirect(new URL('/dashboard', request.url))
		}
	}

	return NextResponse.next()
}

export const config = {
	matcher: ['/', '/dashboard/:path*', '/onboarding/:path*', '/auth/:path*'],
}
