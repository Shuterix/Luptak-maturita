'use client'

import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { useAuth } from './AuthContext'
import axios from 'axios'
import { showAlertToast } from '@/components/toast/Toast'
import { Dispatch, SetStateAction } from 'react'

interface OnboardingContextType {
	step: number
	setStep: Dispatch<SetStateAction<number>>
	saveStepToDB: () => Promise<void>
	initialized: boolean
}

interface User {
	_id: string
	onboardingStep?: number
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(
	undefined,
)

export const OnboardingProvider = ({
	children,
}: {
	children: React.ReactNode
}) => {
	const { user } = useAuth() as { user: User | null }
	const [step, setStep] = useState<number>(0)
	const hasSavedRef = useRef(false)
	const [initialized, setInitialized] = useState(false)

	useEffect(() => {
		if (user?.onboardingStep !== undefined) {
			setStep(user.onboardingStep)
		}
		setInitialized(true)
	}, [user])

	const saveStepToDB = async () => {
		if (!user || hasSavedRef.current) return
		hasSavedRef.current = true

		try {
			await axios.patch('/api/users/update-onboarding', {
				userId: user._id,
				onboardingStep: step,
			})
		} catch (err) {
			console.error('Failed to save onboarding step:', err)
			showAlertToast('Onboarding progress not saved.', {
				variant: 'error',
				title: 'Error',
			})
		}
	}

	useEffect(() => {
		const handleUnload = () => {
			if (user && hasSavedRef.current === false) {
				saveStepToDB()
			}
		}

		window.addEventListener('beforeunload', handleUnload)

		return () => {
			window.removeEventListener('beforeunload', handleUnload)
		}
	}, [user, step])

	return (
		<OnboardingContext.Provider
			value={{ step, setStep, saveStepToDB, initialized }}
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
