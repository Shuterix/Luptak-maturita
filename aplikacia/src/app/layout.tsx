import './globals.css'
import { AppProviders } from '@/context/Providers'
import { Toaster } from 'sonner'
import type { Viewport } from 'next'

export const viewport: Viewport = {
	width: 'device-width',
	initialScale: 1,
	maximumScale: 1,
	userScalable: false,
	viewportFit: 'cover',
}

export const metadata = {
	title: 'DanceHub',
	description: 'Comprehensive dance studio management system.',
}

export default function RootLayout({
	children,
}: {
	children: React.ReactNode
}) {
	return (
		<html lang="en" data-theme="dark">
			<body>
				<AppProviders>
					{children}
					<Toaster position="bottom-right" />
				</AppProviders>
			</body>
		</html>
	)
}
