import { HTMLAttributes } from 'react'

interface FullPageLoaderProps extends HTMLAttributes<HTMLDivElement> {
	text?: string
	spinnerSize?: 'xs' | 'sm' | 'md' | 'lg'
}

export function FullPageLoader({
	text,
	spinnerSize = 'lg',
	className = '',
	...props
}: FullPageLoaderProps) {
	return (
		<div
			className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-base-100/90 ${className}`}
			{...props}
		>
			<span
				className={`loading loading-spinner text-primary loading-${spinnerSize}`}
			/>
			{text && (
				<p className="mt-4 text-lg font-medium text-base-content">
					{text}
				</p>
			)}
		</div>
	)
}
