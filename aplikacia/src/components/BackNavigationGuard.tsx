'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'

/**
 * Prevents the mobile browser back swipe from leaving the app.
 * Instead, it navigates to the previous in-app route or falls back to /dashboard.
 */
export default function BackNavigationGuard() {
	const pathname = usePathname()
	const router = useRouter()
	const routeHistory = useRef<string[]>([])
	const skipNextPathChange = useRef(false)

	// Track in-app route history
	useEffect(() => {
		if (skipNextPathChange.current) {
			skipNextPathChange.current = false
			return
		}
		const history = routeHistory.current
		// Don't add consecutive duplicates
		if (history[history.length - 1] !== pathname) {
			history.push(pathname)
		}
	}, [pathname])

	useEffect(() => {
		// Push a guard entry so there's always something to "go back" to
		// instead of leaving the app
		window.history.pushState({ __appGuard: true }, '', window.location.href)

		const handlePopState = () => {
			// Re-push guard immediately so the user can never swipe past it
			window.history.pushState({ __appGuard: true }, '', window.location.href)

			const history = routeHistory.current

			if (history.length > 1) {
				// Pop current route, navigate to the previous one
				history.pop()
				const prevRoute = history[history.length - 1]
				skipNextPathChange.current = true
				router.replace(prevRoute)
			} else {
				// No previous in-app route — go to (or stay on) dashboard
				if (pathname !== '/dashboard') {
					routeHistory.current = ['/dashboard']
					skipNextPathChange.current = true
					router.replace('/dashboard')
				}
				// Already on dashboard → do nothing, user stays put
			}
		}

		window.addEventListener('popstate', handlePopState)
		return () => window.removeEventListener('popstate', handlePopState)
	}, [router, pathname])

	return null
}

