'use client'

import { LogOut } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'

export function LogoutButton({ className = '' }: { className?: string }) {
	const { logout } = useAuth()

	const closeDrawer = () => {
		if (typeof window === 'undefined') return
		
		const drawer = document.getElementById('my-drawer') as HTMLInputElement
		if (drawer) {
			drawer.checked = false
			drawer.dispatchEvent(new Event('change', { bubbles: true }))
			drawer.dispatchEvent(new Event('input', { bubbles: true }))
		}
	}

	const handleLogout = async () => {
		closeDrawer()
		await logout()
	}

	return (
		<button
			onClick={handleLogout}
			className={`flex items-center w-full px-4 py-2 text-left hover:bg-base-200 ${className}`}
		>
			<LogOut className="h-5 w-5 mr-2" />
			<span>Logout</span>
		</button>
	)
}
