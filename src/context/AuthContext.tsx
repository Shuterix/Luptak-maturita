'use client'

import { createContext, useContext, useState, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import axios from 'axios'
import { isAxiosError } from 'axios'
import { showAlertToast } from '@/components/toast/Toast'

interface AuthContextType {
	user: object | null
	login: (email: string, password: string) => Promise<void>
	logout: () => Promise<void>
	isLoading: boolean
	error: string | null
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider = ({ children }: { children: ReactNode }) => {
	const [user, setUser] = useState<object | null>(null)
	const [isLoading, setIsLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const router = useRouter()

	const login = async (email: string, password: string) => {
		setIsLoading(true)
		setError(null)

		try {
			const { data } = await axios.post('/api/login', { email, password })
			setUser(data.data)

			router.push('/dashboard')

			showAlertToast('Login successful!', {
				variant: 'success',
				title: 'Success',
			})
		} catch (error) {
			let errorMessage = 'An unexpected error occurred'

			if (isAxiosError(error) && error.response) {
				errorMessage = error.response.data.message || errorMessage
			}

			setError(errorMessage)
			showAlertToast(errorMessage, {
				variant: 'error',
				title: 'Login Failed',
			})
		} finally {
			setIsLoading(false)
		}
	}

	const logout = async () => {
		try {
			await axios.get('/api/logout')
			setUser(null)
			router.push('/auth/login')
			setUser(null)
			showAlertToast('Logged out successfully', {
				variant: 'success',
				title: 'Success',
			})
		} catch (error) {
			console.error(error)

			showAlertToast('Logout failed', {
				variant: 'error',
				title: 'Error',
			})
		}
	}

	return (
		<AuthContext.Provider value={{ user, login, logout, isLoading, error }}>
			{children}
		</AuthContext.Provider>
	)
}

export const useAuth = () => {
	const context = useContext(AuthContext)
	if (!context) throw new Error('useAuth must be used within AuthProvider')
	return context
}
