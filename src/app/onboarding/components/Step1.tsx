'use client'

import { useEffect, useState } from 'react'
import type { User } from '@/context/OnboardingContext'

interface Step1Props {
	onValidityChange: (isValid: boolean) => void,
	onDataChange?: (data: Partial<User>) => void,
	userData?: Partial<User>
}

export default function Step1({ onValidityChange, onDataChange, userData }: Step1Props) {
	const [selectedRole, setSelectedRole] = useState<'student' | 'trainer' | 'admin' | null>(null)
	
	const handleSelect = (role: 'student' | 'trainer' | 'admin') => {
		setSelectedRole(role)
		onDataChange?.({ role })
	}
	
	useEffect(() => {
		onValidityChange(!!selectedRole)
	}, [selectedRole])

	useEffect(() => {
		if(!userData) return
		setSelectedRole(userData.role ?? null)
	}, [userData])

	if (userData === undefined) return null

	return (
		<div className="space-y-6">
			<p className="text-sm text-base-content/80 text-center">
				Choose your role to personalize your experience:
			</p>

			<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
				{(['student', 'trainer'] as const).map(role => {
					const isSelected = selectedRole === role
					const label = role === 'student' ? 'Student' : 'Trainer'
					const description =
						role === 'student'
							? 'Joining a club to learn.'
							: 'I manage or teach at a club.'

					return (
						<label key={role} className="cursor-pointer">
							<input
								type="radio"
								name="role"
								className="peer hidden"
								checked={isSelected}
								onChange={() => handleSelect(role)}
							/>
							<div className="p-5 sm:p-6 h-full flex flex-col justify-center items-center rounded-xl border border-base-300 transition hover:border-primary hover:shadow-md peer-checked:border-primary peer-checked:bg-primary/10">
								<h3 className="font-semibold text-lg text-center peer-checked:text-primary">
									{label}
								</h3>
								<p className="text-sm text-base-content/70 text-center mt-1">
									{description}
								</p>
							</div>
						</label>
					)
				})}
			</div>
		</div>
	)
}