'use client'

import { useEffect, useState } from 'react'
import { useOnboarding } from '@/context/OnboardingContext'
import { useAuth } from '@/context/AuthContext'
import Step1 from './Step1'
import Step2 from './Step2'
import { ComponentType } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import axios from 'axios'

interface StepDefinition {
	component: ComponentType<{ onDataChange: (data: Partial<User>) => void }>
	title: string
	subtitle?: string
}

export interface User {
	_id: string
	onboardingStep?: number
	clubCode?: string
	role?: 'student' | 'trainer'
}

const steps: StepDefinition[] = [
	{
		component: Step1,
		title: 'Welcome to Ballroom!',
		subtitle:
			'Let’s get started by walking you through some quick setup steps.',
	},
	{
		component: Step2,
		title: 'Your Club Code',
		subtitle:
			'Enter the code provided by your club to connect your profile.',
	},
]

export default function OnboardingSteps() {
	const { step, setStep, initialized } = useOnboarding()
	const { user } = useAuth() as { user: User | null }

	const [updatedUserData, setUpdatedUserData] = useState<Partial<User>>({})

	useEffect(() => {
		if (
			initialized &&
			user?.onboardingStep !== undefined &&
			typeof user.onboardingStep === 'number'
		) {
			if (
				user.onboardingStep >= 0 &&
				user.onboardingStep < steps.length &&
				user.onboardingStep !== step
			) {
				setStep(user.onboardingStep)
			}
			setUpdatedUserData(user)
		}
	}, [initialized, user, setStep, step])

	if (!initialized) return null

	const totalSteps = steps.length
	const progress = ((step + 1) / totalSteps) * 100
	const StepComponent = steps[step].component
	const { title, subtitle } = steps[step]

	const handleStepDataChange = (data: Partial<User>) => {
		setUpdatedUserData((prev) => {
			const merged = {
				...prev,
				...data,
				onboardingStep: step,
			}
			return merged
		})
	}

	const next = () => {
		setStep((s) => Math.min(s + 1, totalSteps - 1))
	}

	const back = () => {
		setStep((s) => Math.max(s - 1, 0))
	}

	const finish = async () => {
		try {
			await axios.patch('/api/users/update-onboarding', updatedUserData)
			// Redirect or show confirmation if needed
		} catch (error) {
			console.error('Failed to update onboarding data', error)
		}
	}

	return (
		<div className="min-h-screen bg-base-200 flex items-center justify-center px-4 sm:px-6">
			<div className="w-full max-w-screen-sm md:max-w-xl px-4 sm:px-8 py-10 rounded-2xl bg-base-100 shadow-xl">
				<div className="mb-6">
					<div className="text-sm font-semibold mb-3 text-primary">
						Step {step + 1} of {totalSteps}
					</div>
					<progress
						className="progress progress-primary w-full h-3 rounded-lg"
						value={progress}
						max="100"
					/>
				</div>

				<h2 className="text-3xl font-extrabold mb-3">{title}</h2>
				{subtitle && (
					<p className="text-base text-base-content/70 mb-8">{subtitle}</p>
				)}

				<div className="mb-8">
					<StepComponent onDataChange={handleStepDataChange} />
				</div>

				<div className="flex flex-col sm:flex-row gap-4">
					{step > 0 && (
						<button
							onClick={back}
							className="btn btn-outline flex items-center justify-center gap-2 w-full sm:w-28"
							aria-label="Go Back"
						>
							<ChevronLeft size={20} />
							Back
						</button>
					)}

					{step === totalSteps - 1 ? (
						<button
							onClick={finish}
							className="btn btn-primary w-full"
							aria-label="Finish onboarding"
						>
							Finish
						</button>
					) : (
						<button
							onClick={next}
							className="btn btn-primary flex items-center justify-center gap-2 w-full sm:w-32"
							aria-label="Continue to next step"
						>
							Continue
							<ChevronRight size={20} />
						</button>
					)}
				</div>
			</div>
		</div>
	)
}