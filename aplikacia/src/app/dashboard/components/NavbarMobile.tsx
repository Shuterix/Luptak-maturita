'use client'

import Link from 'next/link'
import { Menu, X } from 'lucide-react'
import { useState, useEffect, useMemo } from 'react'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'

const getPageTitle = (pathname: string, userRole?: string): string => {
	// Exact matches first
	if (pathname === '/dashboard') {
		return 'Dashboard'
	}
	if (pathname === '/dashboard/club-overview') {
		return 'Club Overview'
	}
	if (pathname === '/dashboard/couples') {
		return 'Couples'
	}
	if (pathname === '/dashboard/profile') {
		return 'Profile & Availability'
	}
	if (pathname === '/dashboard/timetables') {
		return 'Timetables'
	}
	if (pathname === '/dashboard/users') {
		return 'Users'
	}
	if (pathname === '/dashboard/settings') {
		return 'Settings'
	}
	if (pathname === '/dashboard/help') {
		return 'Help & Support'
	}
	
	// Path-based matches
	if (pathname === '/dashboard/students') {
		return 'My Schedule'
	}
	if (pathname === '/dashboard/students/profile') {
		return 'Profile & Availability'
	}
	if (pathname === '/dashboard/students/settings') {
		return 'Settings'
	}
	
	// Default fallback
	return 'Dashboard'
}

export default function NavbarMobile() {
	const [drawerOpen, setDrawerOpen] = useState(false)
	const pathname = usePathname()
	const { user } = useAuth()
	
	// Compute page title from pathname - this will automatically update when pathname changes
	const pageTitle = useMemo(() => {
		const currentPath = pathname || (typeof window !== 'undefined' ? window.location.pathname : '/dashboard')
		return getPageTitle(currentPath, user?.role)
	}, [pathname, user?.role])

	// Close drawer when pathname changes
	useEffect(() => {
		if (typeof window === 'undefined') return
		
		const drawer = document.getElementById('my-drawer') as HTMLInputElement
		if (drawer) {
			drawer.checked = false
			setDrawerOpen(false)
			drawer.dispatchEvent(new Event('change', { bubbles: true }))
			drawer.dispatchEvent(new Event('input', { bubbles: true }))
		}
	}, [pathname])

	// Sync with drawer checkbox state
	useEffect(() => {
		const drawer = document.getElementById('my-drawer') as HTMLInputElement
		if (drawer) {
			const handleChange = () => {
				setDrawerOpen(drawer.checked)
			}
			drawer.addEventListener('change', handleChange)
			setDrawerOpen(drawer.checked)
			return () => drawer.removeEventListener('change', handleChange)
		}
	}, [])

	const closeDrawer = () => {
		if (typeof window === 'undefined') return
		
		const drawer = document.getElementById('my-drawer') as HTMLInputElement
		if (drawer) {
			drawer.checked = false
			setDrawerOpen(false)
			drawer.dispatchEvent(new Event('change', { bubbles: true }))
			drawer.dispatchEvent(new Event('input', { bubbles: true }))
		}
	}

	return (
		<header className="navbar bg-base-100 lg:hidden">
			<div className="flex-none">
				<label htmlFor="my-drawer" className="btn btn-square btn-ghost">
					{drawerOpen ? (
						<X className="h-5 w-5" />
					) : (
						<Menu className="h-5 w-5" />
					)}
				</label>
			</div>
			<div className="flex-1">
				<Link
					key={pathname}
					href={pathname || '/dashboard'}
					className="btn btn-ghost normal-case text-xl"
					onClick={closeDrawer}
				>
					{pageTitle}
				</Link>
			</div>
		</header>
	)
}
