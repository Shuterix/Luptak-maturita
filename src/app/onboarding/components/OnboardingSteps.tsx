'use client'

import { useEffect, useState, ComponentType } from 'react'
import { useOnboarding } from '@/context/OnboardingContext'
import { useLoading } from '@/context/LoadingContext'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import axios from 'axios'
import { showAlertToast } from '@/components/toast/Toast'
import { useRouter } from 'next/navigation'

import Step1 from './Step1'
import Step2 from './Step2'
import StepTrainerChoice from './StepTrainerChoice'
import StepCreateClub from './StepCreateClub'

export interface User {
	_id: string
	onboardingStep?: number
	clubCode?: string
	role?: 'student' | 'trainer' | 'admin'
	createNewClub?: boolean | null
	clubName?: string
	clubDescription?: string
}

interface StepDefinition {
	key: string
	component: ComponentType<{
		onDataChange: (data: Partial<User>) => void
		onValidityChange: (isValid: boolean) => void
		userData: Partial<User>
	}>
	title: string
	subtitle?: string
	condition?: (user: Partial<User>) => boolean
}

const stepDefinitions: StepDefinition[] = [
	{
		key: 'role',
		component: Step1,
		title: 'Welcome to Ballroom!',
		subtitle: 'Choose your role to get started.',
	},
	{
		key: 'studentJoin',
		component: Step2,
		title: 'Your Club Code',
		subtitle: 'Enter the code provided by your club.',
		condition: (user) => user.role === 'student',
	},
	{
		key: 'trainerChoice',
		title: 'Club Setup',
		subtitle: 'Do you want to create a new club or join an existing one?',
		component: StepTrainerChoice,
		condition: (user) => user.role === 'trainer',
	},
	{
		key: 'trainerCreate',
		title: 'Create Your Club',
		subtitle: 'Set up your new club details.',
		component: StepCreateClub,
		condition: (user) => user.role === 'trainer' && user.createNewClub === true,
	},
	{
		key: 'trainerJoin',
		title: 'Join a Club',
		component: Step2,
		condition: (user) =>
			user.role === 'trainer' && (user.createNewClub === false || user.createNewClub === null),
	},
]

export default function OnboardingSteps() {
	const { step, setStep, initialized, userData, saveUserDataToDB } = useOnboarding()
	const { isLoading, showLoader, hideLoader } = useLoading()
	const router = useRouter()

	const [isStepValid, setIsStepValid] = useState(false)
	const [newUserData, setNewUserData] = useState<Partial<User>>({})

	useEffect(() => {
		if (initialized && userData && Object.keys(userData).length > 0) {
			const updated = { ...userData, createNewClub: null }
			setNewUserData(updated)
		}
	}, [initialized, userData])

	useEffect(() => {
		const handleUnload = () => {
			saveUserDataToDB(newUserData)
		}
		window.addEventListener('beforeunload', handleUnload)
		return () => window.removeEventListener('beforeunload', handleUnload)
	}, [newUserData])

	if (!initialized || !userData || isLoading || Object.keys(newUserData).length === 0) {
		return (
			<div className="min-h-screen flex items-center justify-center">
				<span className="loading loading-spinner text-primary"></span>
			</div>
		)
	}

	const filteredSteps = stepDefinitions.filter(
		(def) => def.key === 'role' || !def.condition || def.condition(newUserData)
	)

	const progressBarSteps = stepDefinitions.filter(
		(def) => def.key === 'role' || !def.condition || def.condition(newUserData)
	)

	const totalSteps = newUserData.role ? progressBarSteps.length : 2
	const currentStep = userData.role ? filteredSteps[step] : step === 0 ? filteredSteps[0] : filteredSteps[1]

	if(!currentStep) return null

	const StepComponent = currentStep.component
	const progress = ((step + 1) / totalSteps) * 100

	const handleStepDataChange = (data: Partial<User>) => {
		setNewUserData({
			...newUserData,
			...data,
			onboardingStep: step,
		})
	}

	const next = () => {
		setStep((s) => Math.min(s + 1, filteredSteps.length - 1))
	}

	const back = () => setStep((s) => Math.max(s - 1, 0))

	const isActualFinalStep = () => {
		if (newUserData.role === 'student') return currentStep.key === 'studentJoin'
		if (newUserData.role === 'trainer') {
			if (newUserData.createNewClub === true) return currentStep.key === 'trainerCreate'
			if (newUserData.createNewClub === false || newUserData.createNewClub === null)
				return currentStep.key === 'trainerJoin'
			return false
		}
		return step === 0 ? false : step === totalSteps - 1
	}

	const finish = async () => {
		try {
			showLoader()
			await axios.patch('/api/users/update-onboarding', {
				userId: userData._id,
				onboardingStep: step,
				role: newUserData.role,
			})

			if (newUserData.role === 'student' && newUserData.clubCode) {
				await axios.post('/api/clubs/join', {
					clubCode: newUserData.clubCode,
					userId: userData._id,
				})
			} else if (newUserData.role === 'trainer') {

				if (newUserData.createNewClub) {
					await axios.post('/api/clubs/create', {
						userId: userData._id,
						clubName: newUserData.clubName,
						description: newUserData.clubDescription,
					})

				} else if (newUserData.clubCode) {
					await axios.post('/api/clubs/join', {
						clubCode: newUserData.clubCode,
						userId: userData._id,
					})
				}
			}

			showAlertToast('Onboarding completed!', {
				variant: 'success',
				title: 'Success',
			})
			router.push('/dashboard')
		} catch (error) {
			console.error('Failed to finish onboarding', error)
			showAlertToast('Something went wrong. Try again.', {
				variant: 'error',
				title: 'Error',
			})
		} finally {
			hideLoader()
		}
	}

	return (
		<div className="min-h-screen bg-base-200 flex items-center justify-center px-4 sm:px-6">
			<div className="w-full max-w-screen-sm md:max-w-xl sm:p-8 p-6 rounded-2xl bg-base-100 shadow-xl">
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

				<h2 className="text-3xl font-extrabold mb-3">{currentStep.title}</h2>
				{currentStep.subtitle && (
					<p className="text-base text-base-content/70 mb-8">{currentStep.subtitle}</p>
				)}

				<div className="mb-8">
					<StepComponent
						onDataChange={handleStepDataChange}
						onValidityChange={setIsStepValid}
						userData={newUserData}
					/>
				</div>

				<div className="flex flex-col sm:flex-row gap-4">
					{step > 0 && (
						<button
							onClick={back}
							className="btn btn-outline flex items-center justify-center gap-2 w-full sm:w-28"
						>
							<ChevronLeft size={20} /> Back
						</button>
					)}

					{isActualFinalStep() ? (
						<button
							onClick={finish}
							className="btn btn-primary w-full sm:flex-1"
							disabled={!isStepValid}
						>
							Finish
						</button>
					) : (
						<button
							onClick={next}
							className="btn btn-primary flex items-center justify-center gap-2 w-full sm:w-32"
							disabled={!isStepValid}
						>
							Continue <ChevronRight size={20} />
						</button>
					)}
				</div>
			</div>
		</div>
	)
}