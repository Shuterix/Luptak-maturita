import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
	const token = request.cookies.get('token')?.value
	const pathname = request.nextUrl.pathname

	if (pathname == '/' || (pathname.startsWith('/dashboard') && !token))
		return NextResponse.redirect(new URL('/auth/login', request.url))

	if (pathname === '/' && token)
		return NextResponse.redirect(new URL('/dashboard', request.url))

	return NextResponse.next()
}

export const config = {
	matcher: ['/', '/dashboard/:path*'],
}
