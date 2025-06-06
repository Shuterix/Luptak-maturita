import './globals.css'
import { AppProviders } from '@/context/Providers'
import { Toaster } from 'sonner'

export const metadata = {
	title: 'Project V1',
	description: 'React testing project v1.',
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
