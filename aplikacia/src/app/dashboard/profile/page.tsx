'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { Button, Input, Alert } from '@/components'
import { showAlertToast } from '@/components/toast/Toast'
import { Clock, User, Save } from 'lucide-react'

type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'

interface TimeWindow {
	start: string // HH:mm
	end: string // HH:mm
}

interface WeeklyAvailability {
	timezone?: string
	monday?: TimeWindow[]
	tuesday?: TimeWindow[]
	wednesday?: TimeWindow[]
	thursday?: TimeWindow[]
	friday?: TimeWindow[]
	saturday?: TimeWindow[]
	sunday?: TimeWindow[]
	exceptions?: {
		date: string // yyyy-MM-dd
		windows: TimeWindow[]
	}[]
}

const DAY_LABELS: Record<DayOfWeek, string> = {
	monday: 'Monday',
	tuesday: 'Tuesday',
	wednesday: 'Wednesday',
	thursday: 'Thursday',
	friday: 'Friday',
	saturday: 'Saturday',
	sunday: 'Sunday',
}

export default function TrainerProfilePage() {
	const { user, refreshUser } = useAuth()
	const [loading, setLoading] = useState(false)
	const [saving, setSaving] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [success, setSuccess] = useState<string | null>(null)

	// Unavailability state (times when trainer CANNOT teach)
	const [unavailability, setUnavailability] = useState<WeeklyAvailability>({})

	// Load user data and availability
	useEffect(() => {
		if (user) {
			loadTrainerData()
		}
	}, [user])

	const loadTrainerData = async () => {
		if (!user?._id) return

		setLoading(true)
		setError(null)

		try {
			// Load user availability
			const userRes = await fetch(`/api/users/${user._id}`, { cache: 'no-store' })
			if (userRes.ok) {
				const userData = await userRes.json()
				if (userData.user?.unavailability) {
					setUnavailability(userData.user.unavailability || {})
				}
			}
		} catch (err: any) {
			console.error('Error loading trainer data:', err)
			setError(err.message || 'Failed to load trainer data')
		} finally {
			setLoading(false)
		}
	}

	const addTimeWindow = (day: DayOfWeek) => {
		setUnavailability((prev) => ({
			...prev,
			[day]: [...(prev[day] || []), { start: '08:00', end: '15:00' }],
		}))
	}

	const removeTimeWindow = (day: DayOfWeek, index: number) => {
		setUnavailability((prev) => ({
			...prev,
			[day]: (prev[day] || []).filter((_, i) => i !== index),
		}))
	}

	const updateTimeWindow = (day: DayOfWeek, index: number, field: 'start' | 'end', value: string) => {
		setUnavailability((prev) => ({
			...prev,
			[day]: (prev[day] || []).map((window, i) =>
				i === index ? { ...window, [field]: value } : window
			),
		}))
	}

	const handleSaveUnavailability = async () => {
		if (!user?._id) {
			setError('User not found')
			return
		}

		setSaving(true)
		setError(null)
		setSuccess(null)

		try {
			// Save unavailability (times when trainer CANNOT teach)
			const res = await fetch(`/api/users/${user._id}/availability`, {
				method: 'PATCH',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					availability: unavailability, // The API stores this in the unavailability field
				}),
			})

			if (!res.ok) {
				const data = await res.json()
				throw new Error(data.message || 'Failed to save unavailability')
			}

			setSuccess('Unavailability saved successfully!')
			showAlertToast('Unavailability saved successfully!', {
				variant: 'success',
				duration: 3000,
			})
			await refreshUser()
		} catch (err: any) {
			console.error('Error saving unavailability:', err)
			setError(err.message || 'Failed to save unavailability')
		} finally {
			setSaving(false)
		}
	}


	if (!user || (user.role !== 'trainer' && user.role !== 'admin')) {
		return (
			<div className="flex items-center justify-center h-64">
				<Alert variant="error">This page is only available for trainers and admins.</Alert>
			</div>
		)
	}

	if (loading) {
		return (
			<div className="flex items-center justify-center h-64">
				<span className="loading loading-spinner loading-lg"></span>
			</div>
		)
	}

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex items-center justify-between">
				<h1 className="text-3xl font-bold flex items-center gap-2">
					<User className="h-8 w-8 text-primary" />
					Trainer Profile
				</h1>
			</div>

			{error && (
				<Alert variant="error" className="mb-4">
					{error}
				</Alert>
			)}

			{success && (
				<Alert variant="success" className="mb-4">
					{success}
				</Alert>
			)}

			{/* Weekly Unavailability Section */}
			<div className="card bg-base-100 shadow-sm border border-base-300 rounded-2xl">
				<div className="card-body">
					<h2 className="card-title flex items-center gap-2 mb-4">
						<Clock className="h-5 w-5" />
						Weekly Unavailability
					</h2>
					<p className="text-sm text-base-content/70 mb-6">
						Set the times when you <strong>CANNOT</strong> teach (e.g., other commitments, personal time). 
						Leave empty if you're available anytime. The scheduler will respect these times when generating timetables.
					</p>

					<div className="space-y-6">
						{(Object.keys(DAY_LABELS) as DayOfWeek[]).map((day) => (
							<div key={day} className="border-b border-base-300 pb-4 last:border-b-0">
								<div className="flex items-center justify-between mb-3">
									<h3 className="font-semibold text-base-content">{DAY_LABELS[day]}</h3>
									<Button
										type="button"
										className="btn-sm btn-outline"
										onClick={() => addTimeWindow(day)}
									>
										+ Add Unavailable Time
									</Button>
								</div>

								{(!unavailability[day] || unavailability[day]!.length === 0) && (
									<p className="text-sm text-success/70 italic">
										✓ Available all day
									</p>
								)}

								<div className="space-y-3">
									{unavailability[day]?.map((window, index) => (
										<div key={index} className="flex items-center gap-3 flex-wrap bg-error/5 p-2 rounded-lg border border-error/20">
											<span className="text-error/70 text-sm">Cannot teach:</span>
											<Input
												type="time"
												label="From"
												value={window.start}
												onChange={(e) => updateTimeWindow(day, index, 'start', e.target.value)}
												className="flex-1 min-w-[120px]"
											/>
											<span className="text-base-content/60">to</span>
											<Input
												type="time"
												label="Until"
												value={window.end}
												onChange={(e) => updateTimeWindow(day, index, 'end', e.target.value)}
												className="flex-1 min-w-[120px]"
											/>
											<Button
												type="button"
												className="btn-sm btn-ghost text-error"
												onClick={() => removeTimeWindow(day, index)}
											>
												Remove
											</Button>
										</div>
									))}
								</div>
							</div>
						))}
					</div>

					<div className="mt-6 flex justify-end">
						<Button
							type="button"
							className="btn-primary"
							onClick={handleSaveUnavailability}
							disabled={saving}
						>
							{saving ? (
								<>
									<span className="loading loading-spinner loading-sm"></span>
									Saving...
								</>
							) : (
								<>
									<Save className="h-4 w-4" />
									Save Unavailability
								</>
							)}
						</Button>
					</div>
				</div>
			</div>

			{/* Profile Information Section */}
			<div className="card bg-base-100 shadow-sm border border-base-300 rounded-2xl">
				<div className="card-body">
					<h2 className="card-title flex items-center gap-2 mb-4">
						<User className="h-5 w-5" />
						Profile Information
					</h2>
					<p className="text-sm text-base-content/70 mb-6">
						Your personal information.
					</p>

					<div className="space-y-4">
						<div>
							<label className="label">
								<span className="label-text font-medium">Email</span>
							</label>
							<Input type="email" value={user.email || ''} disabled className="bg-base-200" />
							<p className="text-xs text-base-content/50 mt-1">Email cannot be changed</p>
						</div>

						<div>
							<label className="label">
								<span className="label-text font-medium">Name</span>
							</label>
							<div className="grid grid-cols-2 gap-3">
								<Input
									type="text"
									value={user.firstName || ''}
									disabled
									className="bg-base-200"
									placeholder="First Name"
								/>
								<Input
									type="text"
									value={user.lastName || ''}
									disabled
									className="bg-base-200"
									placeholder="Last Name"
								/>
							</div>
							<p className="text-xs text-base-content/50 mt-1">
								Name changes require administrator approval
							</p>
						</div>

						<div>
							<label className="label">
								<span className="label-text font-medium">Phone Number</span>
							</label>
							<Input
								type="tel"
								defaultValue={user.profile?.phone || ''}
								placeholder="+1 (555) 123-4567"
								className="w-full"
								onBlur={async (e) => {
									if (!user?._id) return
									try {
										const res = await fetch(`/api/users/${user._id}`, {
											method: 'PATCH',
											headers: {
												'Content-Type': 'application/json',
											},
											body: JSON.stringify({
												profile: {
													phone: e.target.value,
												},
											}),
										})
										if (res.ok) {
											showAlertToast('Phone number updated', { variant: 'success' })
											await refreshUser()
										}
									} catch (err) {
										console.error('Error updating phone:', err)
									}
								}}
							/>
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}

