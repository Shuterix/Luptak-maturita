'use client'

import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react'
import axios from 'axios'
import { useRouter } from 'next/navigation'
import { showAlertToast } from '@/components/toast/Toast'

interface User {
	_id: string
	firstName?: string
	lastName?: string
	email?: string
	role?: 'student' | 'trainer' | 'admin' | 'external_teacher'
	clubId?: string
	onboardingStep?: number
}

interface AuthContextType {
	user: User | null
	login: (email: string, password: string) => Promise<void>
	logout: () => Promise<void>
	refreshUser: () => Promise<void>
	isLoading: boolean
	error: string | null
	isLoggingOut: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider = ({ children }: { children: ReactNode }) => {
	const [user, setUser] = useState<User | null>(null)
	const [isLoading, setIsLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [isLoggingOut, setIsLoggingOut] = useState(false)
	const isLoggingOutRef = useRef(false)
	const router = useRouter()

	const refreshUser = async () => {
		// Don't try to refresh if we're in the process of logging out
		if (isLoggingOutRef.current) {
			return
		}
		
		// Don't try to refresh if there's no stored session (user explicitly logged out)
		const storedUser = localStorage.getItem('dancehub_USER')
		if (!storedUser || storedUser === 'undefined') {
			return
		}
		
		try {
			const { data } = await axios.get('/api/users/me')
			const normalizedUser: User | null = data.user
				? {
					...data.user,
					clubId: data.user.clubId ? data.user.clubId.toString() : undefined,
				}
				: null
			setUser(normalizedUser)
			localStorage.setItem('dancehub_USER', JSON.stringify(normalizedUser))
		} catch (err: any) {
			// Only log error if it's not a 401 (expected when session expires or user logged out)
			if (err?.response?.status !== 401) {
				console.error('Failed to fetch user', err)
			}
			setUser(null)
			localStorage.removeItem('dancehub_USER')
		}
	}

	useEffect(() => {
		const storedUser = localStorage.getItem('dancehub_USER')
		if (storedUser && storedUser !== 'undefined') {
			try {
				const parsed = JSON.parse(storedUser)
				setUser(parsed)
				// Refresh user in background to ensure data is up to date
				refreshUser().catch(() => {
					// Silent fail - keep cached user if refresh fails
				})
			} catch {
				// Invalid stored user, try to refresh
				refreshUser().catch(() => {
					// Silent fail - user is not logged in
				})
			}
		}
		// Don't call refreshUser if no stored user - they're not logged in
	}, [])

	const login = async (email: string, password: string) => {
		setIsLoading(true)
		setError(null)

		try {
			const { data } = await axios.post('/api/auth/login', { email, password })

			if (data.status === 'success' && data.user) {
				const normalizedUser: User = {
					...data.user,
					clubId: data.user.clubId ? data.user.clubId.toString() : undefined,
				}
				setUser(normalizedUser)
				localStorage.setItem('dancehub_USER', JSON.stringify(normalizedUser))
				
				// Check if onboarding is complete based on role
				// Trainers: onboardingStep >= 2, Students: onboardingStep >= 1
				const onboardingComplete = data.user.role === 'trainer' 
					? (data.user.onboardingStep ?? 0) >= 2 
					: (data.user.onboardingStep ?? 0) >= 1
				
				// Prefetch destination route before redirect
				const destination = onboardingComplete ? '/dashboard' : '/onboarding'
				router.prefetch(destination)
				
				// Use replace instead of push to avoid adding to history
				router.replace(destination)
				
				// Show toast after navigation starts (non-blocking)
				setTimeout(() => {
					showAlertToast('Login successful!', { variant: 'success', title: 'Success' })
				}, 100)
			}
		} catch (err: any) {
			const message = err.response?.data?.message || 'Unexpected login error'
			setError(message)
			showAlertToast(message, { variant: 'error', title: 'Login Failed' })
		} finally {
			setIsLoading(false)
		}
	}

	const logout = async () => {
		try {
			// Set logging out flag to prevent any refresh attempts
			isLoggingOutRef.current = true
			setIsLoggingOut(true)
			
			// Clear state immediately for faster UI response
			setUser(null)
			localStorage.removeItem('dancehub_USER')
			
			// Also manually delete cookies on client side as backup
			if (typeof document !== 'undefined') {
				document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
				document.cookie = 'onboardingStep=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
				document.cookie = 'role=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
			}
			
			// Wait for logout API call to clear cookies on server side
			try {
				await axios.get('/api/auth/logout')
			} catch (err) {
				// Silently ignore logout API errors, but still proceed with redirect
				console.warn('Logout API call failed, proceeding anyway:', err)
			}
			
			// Use window.location.replace for a hard redirect that clears history
			// This ensures we navigate away and cookies are cleared
			// The replace method doesn't add to history, so back button won't work
			if (typeof window !== 'undefined') {
				// Small delay to ensure cookies are processed by the browser
				setTimeout(() => {
					window.location.replace('/auth/login')
				}, 100)
			}
		} catch (err) {
			console.error(err)
			showAlertToast('Logout failed', { variant: 'error', title: 'Error' })
			// Still try to redirect even if there's an error
			if (typeof window !== 'undefined') {
				window.location.replace('/auth/login')
			}
		}
	}

	return (
		<AuthContext.Provider value={{ user, login, logout, refreshUser, isLoading, error, isLoggingOut }}>
			{children}
		</AuthContext.Provider>
	)
}

export const useAuth = () => {
	const context = useContext(AuthContext)
	if (!context) throw new Error('useAuth must be used within AuthProvider')
	return context
}