'use client'

import { useEffect, useState } from 'react'
import type { User } from './OnboardingSteps'

interface Step2Props {
	onDataChange: (data: Partial<User>) => void
	onValidityChange: (isValid: boolean) => void
	userData: Partial<User>
}

export default function Step2({ onDataChange, onValidityChange, userData }: Step2Props) {
	const [clubCode, setClubCode] = useState(userData.clubCode ?? '')

	useEffect(() => {
		onDataChange({ clubCode })
		onValidityChange(clubCode.trim().length > 0)
	}, [clubCode])

	return (
		<div className="space-y-4">
			<label className="form-control w-full">
				<span className="label-text text-sm">Club Code</span>
				<input
					type="text"
					placeholder="e.g. CLUB1234"
					value={clubCode}
					onChange={(e) => setClubCode(e.target.value)}
					className="input input-bordered w-full"
				/>
			</label>
		</div>
	)
}