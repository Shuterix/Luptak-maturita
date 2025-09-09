'use client'

import {
	createContext,
	useContext,
	useEffect,
	useRef,
	useState,
	ReactNode,
	Dispatch,
	SetStateAction,
} from 'react'
import { useAuth } from './AuthContext'
import axios from 'axios'
import { showAlertToast } from '@/components/toast/Toast'

interface OnboardingContextType {
	step: number
	setStep: Dispatch<SetStateAction<number>>
	initialized: boolean
	userData: Partial<User>
	setUserData: Dispatch<SetStateAction<Partial<User>>>
	saveUserDataToDB: (data: Partial<User>) => Promise<void>
}

export interface User {
	_id: string
	onboardingStep?: number
	role?: 'student' | 'trainer' | 'admin'
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(
	undefined,
)

export const OnboardingProvider = ({ children }: { children: ReactNode }) => {
	const { user } = useAuth() as { user: User | null }

	const [step, setStep] = useState<number>(0)
	const [userData, setUserData] = useState<Partial<User>>(user ?? {})
	const [initialized, setInitialized] = useState(false)
	const hasSavedRef = useRef(false)

	// Initialize onboarding
	useEffect(() => {
		if (user) {
			setUserData(user)
			if (
				typeof user.onboardingStep === 'number' &&
				user.onboardingStep >= 0
			) {
				setStep(user.onboardingStep)
			}
			setInitialized(true)
		}
	}, [user])

	// Save user data to backend
	const saveUserDataToDB = async (data: Partial<User>) => {
		if (!data || hasSavedRef.current) return
		hasSavedRef.current = true
		try {
			await axios.patch('/api/users/update-onboarding', {
				userId: data._id,
				onboardingStep: step === 2 ? step -1 : step,
				role: data.role,
			})
		} catch (err) {
			console.error('Failed to save user data:', err)
			showAlertToast('Onboarding progress not saved.', {
				variant: 'error',
				title: 'Error',
			})
		}
	}

	return (
		<OnboardingContext.Provider
			value={{
				step,
				setStep,
				initialized,
				userData,
				setUserData,
				saveUserDataToDB,
			}}
		>
			{children}
		</OnboardingContext.Provider>
	)
}

export const useOnboarding = () => {
	const context = useContext(OnboardingContext)
	if (!context)
		throw new Error('useOnboarding must be used within OnboardingProvider')
	return context
}