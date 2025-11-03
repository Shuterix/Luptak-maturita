'use client'

import { AuthProvider } from './AuthContext'
import { LoadingProvider } from './LoadingContext'

export const AppProviders = ({ children }: { children: React.ReactNode }) => {
	return (
		<AuthProvider>
			<LoadingProvider>{children}</LoadingProvider>
		</AuthProvider>
	)
}
