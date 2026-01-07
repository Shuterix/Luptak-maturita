'use client'

import Link from 'next/link'
import { ReactNode, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface ActionButtonProps {
	children: ReactNode
	icon: ReactNode
	className?: string
	href?: string
	onClick?: () => void
}

export function ActionButton({
	children,
	icon,
	className = '',
	href,
	onClick,
}: ActionButtonProps) {
	const router = useRouter()
	const baseClasses =
		'flex items-center w-full px-4 py-2 text-left hover:bg-base-200'

	const closeDrawer = useCallback(() => {
		if (typeof window === 'undefined') return
		
		const drawer = document.getElementById('my-drawer') as HTMLInputElement
		if (drawer) {
			drawer.checked = false
			// Dispatch both change and input events for better compatibility
			drawer.dispatchEvent(new Event('change', { bubbles: true }))
			drawer.dispatchEvent(new Event('input', { bubbles: true }))
		}
	}, [])

	const handleLinkClick = useCallback((e: React.MouseEvent<HTMLAnchorElement>) => {
		// Close drawer immediately
		closeDrawer()
	}, [closeDrawer])

	if (href) {
		return (
			<Link 
				href={href} 
				className={`${baseClasses} ${className}`}
				onClick={handleLinkClick}
				onMouseEnter={() => router.prefetch(href)}
			>
				{icon}
				<span className="ml-2">{children}</span>
			</Link>
		)
	}

	return (
		<button onClick={onClick} className={`${baseClasses} ${className}`}>
			{icon}
			<span className="ml-2">{children}</span>
		</button>
	)
}
