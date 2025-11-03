'use client'

import { useEffect, useState } from 'react'
import { User } from './OnboardingSteps'

interface StepTrainerChoiceProps {
	onDataChange?: (data: Partial<User>) => void
	onValidityChange: (isValid: boolean) => void
}

export default function StepTrainerChoice({ onValidityChange, onDataChange }: StepTrainerChoiceProps) {
	const [createNewClub, setCreateNewClub] = useState<boolean | null>(null)

	const handleSelect = (choice: boolean) => {
		setCreateNewClub(choice)
		onDataChange?.({createNewClub: choice })
	}

	useEffect(() => {
		onValidityChange(createNewClub !== null)
	}, [createNewClub])

	return (
		<div className="space-y-6">
			<p className="text-sm text-base-content/80 text-center">
				Do you want to create a new club or join an existing one?
			</p>

			<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
				{([
					{ label: 'Create New Club', value: true },
					{ label: 'Join Existing Club', value: false }
				] as const).map(option => {
					const isSelected = createNewClub === option.value
					return (
						<label key={option.label} className="cursor-pointer">
							<input
								type="radio"
								name="trainerChoice"
								className="peer hidden"
								checked={isSelected}
								onChange={() => handleSelect(option.value)}
							/>
							<div className="p-5 sm:p-6 h-full flex flex-col justify-center items-center rounded-xl border border-base-300 transition hover:border-primary hover:shadow-md peer-checked:border-primary peer-checked:bg-primary/10">
								<h3 className="font-semibold text-lg text-center peer-checked:text-primary">
									{option.label}
								</h3>
								<p className="text-sm text-base-content/70 text-center mt-1">
									{option.value
										? 'Set up a brand new club for your members.'
										: 'Enter the code of an existing club to join.'}
								</p>
							</div>
						</label>
					)
				})}
			</div>
		</div>
	)
}