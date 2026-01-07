'use client'

import { AuthProvider } from './AuthContext'
import { LoadingProvider } from './LoadingContext'
import { ErrorBoundary } from '@/components/ErrorBoundary'

export const AppProviders = ({ children }: { children: React.ReactNode }) => {
	return (
		<ErrorBoundary>
			<AuthProvider>
				<LoadingProvider>{children}</LoadingProvider>
			</AuthProvider>
		</ErrorBoundary>
	)
}
