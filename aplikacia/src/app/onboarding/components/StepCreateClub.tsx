'use client'

import { useEffect, useState } from 'react'
import { User } from './OnboardingSteps'

interface Props {
	onDataChange: (data: Partial<User>) => void
	onValidityChange: (isValid: boolean) => void
	userData: Partial<User>
}

export default function StepCreateClub({ onDataChange, onValidityChange }: Props) {
	const [clubName, setClubName] = useState('')
	const [clubDescription, setClubDescription] = useState('')

	useEffect(() => {
		const isValid = clubName.trim().length > 0
		onValidityChange(isValid)
		onDataChange({ clubName: clubName, clubDescription: clubDescription })
	}, [clubName, clubDescription])
	
	return (
		<form
			className="flex flex-col gap-4"
			onSubmit={(e) => e.preventDefault()}
		>
			<input
				type="text"
				placeholder="Club Name"
				className="input input-bordered w-full"
				value={clubName}
				onChange={(e) => setClubName(e.target.value)}
			/>
			<textarea
				placeholder="Club Description (optional)"
				className="textarea textarea-bordered w-full"
				value={clubDescription}
				onChange={(e) => setClubDescription(e.target.value)}
			/>
		</form>
	)
}