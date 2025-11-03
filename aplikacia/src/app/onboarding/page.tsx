'use client'

import { OnboardingProvider } from '@/context/OnboardingContext'
import OnboardingSteps from './components/OnboardingSteps'

export default function OnboardingPage() {
	return (
		<OnboardingProvider>
			<OnboardingSteps />
		</OnboardingProvider>
	)
}
