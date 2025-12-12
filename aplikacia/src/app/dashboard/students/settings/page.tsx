'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { Button, Input, Alert } from '@/components'
import { showAlertToast } from '@/components/toast/Toast'
import { Clock, User, Users, Calendar, Save } from 'lucide-react'

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

interface StudentPair {
	_id: string
	studentAId: {
		_id: string
		firstName: string
		lastName: string
		email: string
	}
	studentBId: {
		_id: string
		firstName: string
		lastName: string
		email: string
	}
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

export default function StudentSettingsPage() {
	const { user, refreshUser } = useAuth()
	const [loading, setLoading] = useState(false)
	const [saving, setSaving] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [success, setSuccess] = useState<string | null>(null)

	// Availability state
	const [availability, setAvailability] = useState<WeeklyAvailability>({})
	const [pairs, setPairs] = useState<StudentPair[]>([])
	const [currentPairId, setCurrentPairId] = useState<string | null>(null)

	// Load user data and availability
	useEffect(() => {
		if (user) {
			loadStudentData()
		}
	}, [user])

	const loadStudentData = async () => {
		if (!user?._id || !user?.clubId) return

		setLoading(true)
		setError(null)

		try {
			// Load user availability
			const userRes = await fetch(`/api/users/${user._id}`, { cache: 'no-store' })
			if (userRes.ok) {
				const userData = await userRes.json()
				if (userData.user?.unavailability) {
					// Convert unavailability to availability (inverse logic if needed)
					// For now, we'll work with availability directly
					setAvailability(userData.user.unavailability || {})
				}
				setCurrentPairId(userData.user?.partnerId || null)
			}

			// Load pairs for partner selection
			const pairsRes = await fetch(`/api/pairs?clubId=${user.clubId}`, { cache: 'no-store' })
			if (pairsRes.ok) {
				const pairsData = await pairsRes.json()
				setPairs(pairsData.pairs || [])

				// Find current user's pair
				const userPair = pairsData.pairs?.find(
					(p: StudentPair) =>
						p.studentAId._id === user._id || p.studentBId._id === user._id
				)
				if (userPair) {
					setCurrentPairId(userPair._id)
				}
			}

		} catch (err: any) {
			console.error('Error loading student data:', err)
			setError(err.message || 'Failed to load student data')
		} finally {
			setLoading(false)
		}
	}

	const addTimeWindow = (day: DayOfWeek) => {
		setAvailability((prev) => ({
			...prev,
			[day]: [...(prev[day] || []), { start: '09:00', end: '17:00' }],
		}))
	}

	const removeTimeWindow = (day: DayOfWeek, index: number) => {
		setAvailability((prev) => ({
			...prev,
			[day]: (prev[day] || []).filter((_, i) => i !== index),
		}))
	}

	const updateTimeWindow = (day: DayOfWeek, index: number, field: 'start' | 'end', value: string) => {
		setAvailability((prev) => ({
			...prev,
			[day]: (prev[day] || []).map((window, i) =>
				i === index ? { ...window, [field]: value } : window
			),
		}))
	}

	const handleSaveAvailability = async () => {
		if (!user?._id) {
			setError('User not found')
			return
		}

		setSaving(true)
		setError(null)
		setSuccess(null)

		try {
			// Save availability as unavailability (inverse) or directly
			// For now, we'll save it directly - the API should handle the conversion if needed
			const res = await fetch(`/api/users/${user._id}/availability`, {
				method: 'PATCH',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					availability: availability,
				}),
			})

			if (!res.ok) {
				const data = await res.json()
				throw new Error(data.message || 'Failed to save availability')
			}

			setSuccess('Availability saved successfully!')
			showAlertToast('Availability saved successfully!', {
				variant: 'success',
				duration: 3000,
			})
			await refreshUser()
		} catch (err: any) {
			console.error('Error saving availability:', err)
			setError(err.message || 'Failed to save availability')
		} finally {
			setSaving(false)
		}
	}


	if (!user || user.role !== 'student') {
		return (
			<div className="flex items-center justify-center h-64">
				<Alert variant="error">This page is only available for students.</Alert>
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
					Profile
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

			{/* Weekly Availability Section */}
			<div className="card bg-base-100 shadow-sm border border-base-300 rounded-2xl">
				<div className="card-body">
					<h2 className="card-title flex items-center gap-2 mb-4">
						<Clock className="h-5 w-5" />
						Weekly Availability
					</h2>
					<p className="text-sm text-base-content/70 mb-6">
						Set your available time windows for each day of the week. Teachers will use this information when scheduling your lessons.
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
										+ Add Time Window
									</Button>
								</div>

								{(!availability[day] || availability[day]!.length === 0) && (
									<p className="text-sm text-base-content/50 italic">
										No availability set for this day
									</p>
								)}

								<div className="space-y-3">
									{availability[day]?.map((window, index) => (
										<div key={index} className="flex items-center gap-3 flex-wrap">
											<Input
												type="time"
												label="Start"
												value={window.start}
												onChange={(e) => updateTimeWindow(day, index, 'start', e.target.value)}
												className="flex-1 min-w-[120px]"
											/>
											<span className="text-base-content/60">to</span>
											<Input
												type="time"
												label="End"
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
							onClick={handleSaveAvailability}
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
									Save Availability
								</>
							)}
						</Button>
					</div>
				</div>
			</div>

			{/* Partner Status Section */}
			<div className="card bg-base-100 shadow-sm border border-base-300 rounded-2xl">
				<div className="card-body">
					<h2 className="card-title flex items-center gap-2 mb-4">
						<Users className="h-5 w-5" />
						Couple Status
					</h2>
					<p className="text-sm text-base-content/70 mb-6">
						Your dance partner pairing status. Trainers will pair you with a partner to enable couple lessons.
					</p>

					{currentPairId && pairs.find((p) => p._id === currentPairId) ? (
						<div className="alert alert-success">
							<Users className="h-5 w-5" />
							<div className="flex-1">
								<p className="font-medium">You have a dance partner!</p>
								<p className="text-sm mt-1">
									Partner:{' '}
									<span className="font-semibold">
										{pairs
											.find((p) => p._id === currentPairId)
											?.[user._id === pairs.find((p) => p._id === currentPairId)?.studentAId._id
												? 'studentBId'
												: 'studentAId'].firstName}{' '}
										{pairs
											.find((p) => p._id === currentPairId)
											?.[user._id === pairs.find((p) => p._id === currentPairId)?.studentAId._id
												? 'studentBId'
												: 'studentAId'].lastName}
									</span>
								</p>
							</div>
						</div>
					) : (
						<div className="alert alert-warning">
							<Users className="h-5 w-5" />
							<div className="flex-1">
								<p className="font-medium">No partner assigned yet</p>
								<p className="text-sm mt-1">
									You don't have a partner yet. Please wait for a trainer to pair you with a dance partner.
								</p>
								{/* Future: Add button to notify trainer */}
							</div>
						</div>
					)}
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
						Update your personal information. Teachers may use this to contact you.
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

