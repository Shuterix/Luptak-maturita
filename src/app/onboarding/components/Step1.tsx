'use client'

import { useState } from 'react'
import type { User } from './OnboardingSteps'

interface Step1Props {
	onDataChange: (data: Partial<User>) => void
}

export default function Step1({ onDataChange }: Step1Props) {
	const [selectedRole, setSelectedRole] = useState<'student' | 'trainer' | null>(null)

	const handleSelect = (role: 'student' | 'trainer') => {
		setSelectedRole(role)
		onDataChange({ role })
	}

	return (
		<div className="space-y-6">
			<p className="text-sm text-base-content/80 text-center">
				Choose your role to personalize your experience:
			</p>

			<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
				{['student', 'trainer'].map((role) => {
					const isSelected = selectedRole === role
					const label = role === 'student' ? 'Student' : 'Trainer'
					const description =
						role === 'student'
							? 'Joining a club to learn.'
							: 'I manage or teach at a club.'

					return (
						<label
							key={role}
							className="cursor-pointer"
						>
							<input
								type="radio"
								name="role"
								className="peer hidden"
								checked={isSelected}
								onChange={() => handleSelect(role as 'student' | 'trainer')}
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