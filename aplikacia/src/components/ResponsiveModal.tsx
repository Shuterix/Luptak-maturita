'use client'

import { X } from 'lucide-react'
import { useEffect } from 'react'

interface ResponsiveModalProps {
	isOpen: boolean
	onClose: () => void
	title: string
	children: React.ReactNode
	size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
	showCloseButton?: boolean
}

export default function ResponsiveModal({
	isOpen,
	onClose,
	title,
	children,
	size = 'md',
	showCloseButton = true,
}: ResponsiveModalProps) {
	// Prevent body scroll when modal is open
	useEffect(() => {
		if (isOpen) {
			document.body.style.overflow = 'hidden'
		} else {
			document.body.style.overflow = 'unset'
		}
		return () => {
			document.body.style.overflow = 'unset'
		}
	}, [isOpen])

	if (!isOpen) return null

	const sizeClasses = {
		sm: 'max-w-sm',
		md: 'max-w-md',
		lg: 'max-w-2xl',
		xl: 'max-w-4xl',
		full: 'max-w-full',
	}

	return (
		<div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
			{/* Backdrop */}
			<div
				className="absolute inset-0 bg-black/60 backdrop-blur-sm"
				onClick={onClose}
			/>

			{/* Modal */}
			<div
				className={`
					relative w-full bg-base-100 shadow-2xl
					/* Mobile: slide up from bottom, full width, rounded top */
					rounded-t-3xl sm:rounded-2xl
					max-h-[90vh] sm:max-h-[85vh]
					overflow-hidden
					/* Desktop: centered with max-width */
					sm:mx-4 ${sizeClasses[size]}
					/* Animation */
					animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:fade-in
					duration-200
				`}
			>
				{/* Header */}
				<div className="sticky top-0 z-10 bg-base-100 border-b border-base-300">
					{/* Mobile drag indicator */}
					<div className="flex justify-center pt-2 sm:hidden">
						<div className="w-12 h-1.5 bg-base-300 rounded-full" />
					</div>

					<div className="flex items-center justify-between p-4">
						<h2 className="text-lg font-semibold text-base-content">{title}</h2>
						{showCloseButton && (
							<button
								onClick={onClose}
								className="btn btn-circle btn-sm btn-ghost"
								aria-label="Close modal"
							>
								<X className="h-5 w-5" />
							</button>
						)}
					</div>
				</div>

				{/* Content */}
				<div className="overflow-y-auto max-h-[calc(90vh-80px)] sm:max-h-[calc(85vh-80px)] p-4 sm:p-6">
					{children}
				</div>
			</div>
		</div>
	)
}

