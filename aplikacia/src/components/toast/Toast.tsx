// lib/toast.ts
'use client'

import { toast } from 'sonner'
import Alert, { AlertVariant } from '../alert/Alert'

export function showAlertToast(
	message: React.ReactNode,
	options?: {
		variant?: AlertVariant
		duration?: number
		title?: string
		dismissible?: boolean
	},
) {
	return toast.custom(
		(t) => (
			<Alert
				variant={options?.variant || 'neutral'}
				className="shadow-lg"
				title={options?.title}
				dismissible={options?.dismissible ?? true}
				onDismiss={() => toast.dismiss(t)}
			>
				{message}
			</Alert>
		),
		{
			duration: options?.duration || 5000,
		},
	)
}
