import { ReactNode } from 'react'
import { Info, CheckCircle2, AlertTriangle, XCircle, X } from 'lucide-react'

export type AlertVariant =
	| 'info'
	| 'success'
	| 'warning'
	| 'error'
	| 'neutral'
	| 'ghost'

interface AlertProps {
	children: ReactNode
	className?: string
	icon?: ReactNode
	variant?: AlertVariant
	dismissible?: boolean
	onDismiss?: () => void
	title?: string
}

const defaultIcons: Record<AlertVariant, ReactNode> = {
	info: <Info className="h-6 w-6" />,
	success: <CheckCircle2 className="h-6 w-6" />,
	warning: <AlertTriangle className="h-6 w-6" />,
	error: <XCircle className="h-6 w-6" />,
	neutral: <Info className="h-6 w-6" />,
	ghost: null,
}

const variantClasses: Record<AlertVariant, string> = {
	info: 'alert-info',
	success: 'alert-success',
	warning: 'alert-warning',
	error: 'alert-error',
	neutral: '',
	ghost: 'alert-ghost',
}

export default function Alert({
	children,
	className = '',
	icon,
	variant = 'neutral',
	dismissible = false,
	onDismiss,
	title,
}: AlertProps) {
	const alertClasses = ['alert', variantClasses[variant], className]
		.filter(Boolean)
		.join(' ')

	const renderIcon = icon || defaultIcons[variant]

	return (
		<div className={alertClasses}>
			<div className="flex items-start">
				{renderIcon && (
					<div className="flex-shrink-0">{renderIcon}</div>
				)}

				<div className="flex-1 ml-3">
					{title && <h3 className="font-bold">{title}</h3>}
					<div className={title ? 'mt-1' : ''}>{children}</div>
				</div>

				{dismissible && (
					<button
						type="button"
						className="ml-auto -mx-1.5 -my-1.5 btn btn-ghost btn-sm"
						onClick={onDismiss}
						aria-label="Dismiss"
					>
						<X className="h-5 w-5" />
					</button>
				)}
			</div>
		</div>
	)
}
