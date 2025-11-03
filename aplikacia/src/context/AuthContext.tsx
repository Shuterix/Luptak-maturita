'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import axios from 'axios'
import { useRouter } from 'next/navigation'
import { showAlertToast } from '@/components/toast/Toast'

interface User {
	_id: string
	firstName?: string
	lastName?: string
	email?: string
	role?: 'student' | 'trainer' | 'admin'
	onboardingStep?: number
}

interface AuthContextType {
	user: User | null
	login: (email: string, password: string) => Promise<void>
	logout: () => Promise<void>
	refreshUser: () => Promise<void>
	isLoading: boolean
	error: string | null
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider = ({ children }: { children: ReactNode }) => {
	const [user, setUser] = useState<User | null>(null)
	const [isLoading, setIsLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const router = useRouter()

	const refreshUser = async () => {
		try {
			const { data } = await axios.get('/api/users/me')
			setUser(data.user)
			localStorage.setItem('dancehub_USER', JSON.stringify(data.user))
		} catch (err) {
			console.error('Failed to fetch user', err)
			setUser(null)
			localStorage.removeItem('dancehub_USER')
		}
	}

	useEffect(() => {
		const storedUser = localStorage.getItem('dancehub_USER')
		if (storedUser && storedUser !== 'undefined') {
			refreshUser()
		}
	}, [])

	const login = async (email: string, password: string) => {
		setIsLoading(true)
		setError(null)

		try {
			const { data } = await axios.post('/api/auth/login', { email, password })

			if (data.status === 'success' && data.user) {
				setUser(data.user)
				localStorage.setItem('dancehub_USER', JSON.stringify(data.user))
				showAlertToast('Login successful!', { variant: 'success', title: 'Success' })

				if (data.user.onboardingStep === 4) {
					router.push('/dashboard')
				} else {
					router.push('/onboarding')
				}
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
			await axios.get('/api/auth/logout')
			setUser(null)
			localStorage.removeItem('dancehub_USER')
			router.push('/auth/login')
			showAlertToast('Logged out successfully', { variant: 'success', title: 'Success' })
		} catch (err) {
			console.error(err)
			showAlertToast('Logout failed', { variant: 'error', title: 'Error' })
		}
	}

	return (
		<AuthContext.Provider value={{ user, login, logout, refreshUser, isLoading, error }}>
			{children}
		</AuthContext.Provider>
	)
}

export const useAuth = () => {
	const context = useContext(AuthContext)
	if (!context) throw new Error('useAuth must be used within AuthProvider')
	return context
}