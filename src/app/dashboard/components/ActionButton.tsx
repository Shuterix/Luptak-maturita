'use client'

import Link from 'next/link'
import { ReactNode } from 'react'

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
	const baseClasses =
		'flex items-center w-full px-4 py-2 text-left hover:bg-base-200'

	if (href) {
		return (
			<Link href={href} className={`${baseClasses} ${className}`}>
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
