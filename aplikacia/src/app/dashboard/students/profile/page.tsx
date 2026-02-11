'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { Button, Input, Alert } from '@/components'
import { showAlertToast } from '@/components/toast/Toast'
import ResponsiveModal from '@/components/ResponsiveModal'
import NotificationSettings from '@/components/NotificationSettings'
import { Clock, User, Users, Calendar, Save, ChevronDown, ChevronUp, Edit2 } from 'lucide-react'

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

	// Unavailability state (times when student CANNOT train)
	const [unavailability, setUnavailability] = useState<WeeklyAvailability>({})
	const [pairs, setPairs] = useState<StudentPair[]>([])
	const [currentPairId, setCurrentPairId] = useState<string | null>(null)
	
	// Modal and UI state
	const [isAvailabilityModalOpen, setIsAvailabilityModalOpen] = useState(false)
	const [selectedDay, setSelectedDay] = useState<DayOfWeek | null>(null)
	
	// Profile editing state
	const [editingName, setEditingName] = useState(false)
	const [firstName, setFirstName] = useState('')
	const [lastName, setLastName] = useState('')
	const [phoneNumber, setPhoneNumber] = useState('')
	const [savingProfile, setSavingProfile] = useState(false)

	// Load user data and availability
	useEffect(() => {
		if (user) {
			loadStudentData()
			setFirstName(user.firstName || '')
			setLastName(user.lastName || '')
			setPhoneNumber(user.profile?.phone || '')
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
					setUnavailability(userData.user.unavailability || {})
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
			// Save unavailability (times when student CANNOT train)
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

	// When modal opens, select first day with unavailability or Monday
	useEffect(() => {
		if (isAvailabilityModalOpen && !selectedDay) {
			const daysWithUnavailability = (Object.keys(DAY_LABELS) as DayOfWeek[]).find(
				day => unavailability[day] && unavailability[day]!.length > 0
			)
			setSelectedDay(daysWithUnavailability || 'monday')
		}
	}, [isAvailabilityModalOpen, selectedDay, unavailability])

	const handleSaveProfile = async (saveName = false, savePhone = false) => {
		if (!user?._id) return

		setSavingProfile(true)
		try {
			const updateData: any = {}
			
			if (saveName) {
				updateData.firstName = firstName.trim()
				updateData.lastName = lastName.trim()
			}
			
			if (savePhone) {
				updateData.profile = {
					phone: phoneNumber.trim(),
				}
			}

			const res = await fetch(`/api/users/${user._id}`, {
				method: 'PATCH',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(updateData),
			})

			if (res.ok) {
				showAlertToast('Profile updated successfully', { variant: 'success' })
				await refreshUser()
				if (saveName) {
					setEditingName(false)
				}
			} else {
				const data = await res.json()
				showAlertToast(data.error || 'Failed to update profile', { variant: 'error' })
			}
		} catch (err) {
			console.error('Error updating profile:', err)
			showAlertToast('Failed to update profile', { variant: 'error' })
		} finally {
			setSavingProfile(false)
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

			{/* Weekly Unavailability Section - Button to open modal */}
			<div className="card bg-base-100 shadow-sm border border-base-300 rounded-2xl">
				<div className="card-body">
					<div className="flex items-center justify-between">
						<div>
							<h2 className="card-title flex items-center gap-2 mb-2">
								<Clock className="h-5 w-5" />
								Weekly Unavailability
							</h2>
							<p className="text-sm text-base-content/70">
								Set the times when you <strong>CANNOT</strong> train (e.g., school hours, work).
							</p>
						</div>
						<Button
							type="button"
							className="btn-primary"
							onClick={() => setIsAvailabilityModalOpen(true)}
						>
							<Clock className="h-4 w-4" />
							Edit Availability
						</Button>
					</div>
				</div>
			</div>

			{/* Availability Modal */}
			<ResponsiveModal
				isOpen={isAvailabilityModalOpen}
				onClose={() => {
					setIsAvailabilityModalOpen(false)
					setSelectedDay(null)
				}}
				title="Weekly Unavailability"
				size="xl"
			>
				<div className="space-y-4">
					<p className="text-sm text-base-content/70 mb-4">
						Set the times when you <strong>CANNOT</strong> train (e.g., school hours, work). 
						Leave empty if you're available anytime. Teachers will schedule your lessons outside these times.
					</p>

					{/* Day Selector Dropdown */}
					<div>
						<label className="label">
							<span className="label-text font-medium flex items-center gap-2">
								<Calendar className="h-4 w-4" />
								Select Day to Edit
							</span>
						</label>
						<select
							value={selectedDay || ''}
							onChange={(e) => setSelectedDay(e.target.value as DayOfWeek)}
							className="select select-bordered w-full"
						>
							<option value="">Choose a day...</option>
							{(Object.keys(DAY_LABELS) as DayOfWeek[]).map((day) => (
								<option key={day} value={day}>
									{DAY_LABELS[day]}
									{unavailability[day] && unavailability[day]!.length > 0 && (
										` (${unavailability[day]!.length} time${unavailability[day]!.length !== 1 ? 's' : ''})`
									)}
								</option>
							))}
						</select>
					</div>

					{/* Selected Day's Time Windows */}
					{selectedDay && (
						<div className="border border-base-300 rounded-lg p-4 bg-base-200">
							<div className="flex items-center justify-between mb-4">
								<h3 className="font-semibold text-lg text-base-content">
									{DAY_LABELS[selectedDay]}
								</h3>
								<Button
									type="button"
									className="btn-sm btn-primary"
									onClick={() => addTimeWindow(selectedDay)}
								>
									+ Add Time Window
								</Button>
							</div>

							{(!unavailability[selectedDay] || unavailability[selectedDay]!.length === 0) && (
								<p className="text-sm text-success/70 italic mb-4">
									✓ Available all day
								</p>
							)}

							<div className="space-y-3">
								{unavailability[selectedDay]?.map((window, index) => (
									<div key={index} className="flex items-center gap-3 flex-wrap bg-error/5 p-3 rounded-lg border border-error/20">
										<span className="text-error/70 text-sm font-medium">Cannot train:</span>
										<Input
											type="time"
											label="From"
											value={window.start}
											onChange={(e) => updateTimeWindow(selectedDay, index, 'start', e.target.value)}
											className="flex-1 min-w-[120px]"
										/>
										<span className="text-base-content/60">to</span>
										<Input
											type="time"
											label="Until"
											value={window.end}
											onChange={(e) => updateTimeWindow(selectedDay, index, 'end', e.target.value)}
											className="flex-1 min-w-[120px]"
										/>
										<Button
											type="button"
											className="btn-sm btn-ghost text-error"
											onClick={() => removeTimeWindow(selectedDay, index)}
										>
											Remove
										</Button>
									</div>
								))}
							</div>
						</div>
					)}

					{!selectedDay && (
						<div className="alert alert-info">
							<Calendar className="h-5 w-5" />
							<span>Please select a day from the dropdown above to edit its availability.</span>
						</div>
					)}

					<div className="mt-6 flex justify-end gap-3">
						<Button
							type="button"
							className="btn-ghost"
							onClick={() => setIsAvailabilityModalOpen(false)}
						>
							Cancel
						</Button>
						<Button
							type="button"
							className="btn-primary"
							onClick={async () => {
								await handleSaveUnavailability()
								setIsAvailabilityModalOpen(false)
								setSelectedDay(null)
							}}
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
			</ResponsiveModal>

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
							<div className="flex items-center justify-between mb-2">
								<label className="label">
									<span className="label-text font-medium">Name</span>
								</label>
								{!editingName && (
									<Button
										type="button"
										className="btn-sm btn-ghost"
										onClick={() => setEditingName(true)}
									>
										<Edit2 className="h-4 w-4" />
										Edit
									</Button>
								)}
							</div>
							{editingName ? (
								<div className="space-y-3">
									<div className="grid grid-cols-2 gap-3">
										<Input
											type="text"
											value={firstName}
											onChange={(e) => setFirstName(e.target.value)}
											placeholder="First Name"
										/>
										<Input
											type="text"
											value={lastName}
											onChange={(e) => setLastName(e.target.value)}
											placeholder="Last Name"
										/>
									</div>
									<div className="flex gap-2">
										<Button
											type="button"
											className="btn-sm btn-primary"
											onClick={() => handleSaveProfile(true, false)}
											disabled={savingProfile}
										>
											{savingProfile ? (
												<span className="loading loading-spinner loading-sm"></span>
											) : (
												'Save'
											)}
										</Button>
										<Button
											type="button"
											className="btn-sm btn-ghost"
											onClick={() => {
												setEditingName(false)
												setFirstName(user.firstName || '')
												setLastName(user.lastName || '')
											}}
											disabled={savingProfile}
										>
											Cancel
										</Button>
									</div>
								</div>
							) : (
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
							)}
						</div>

						<div>
							<label className="label">
								<span className="label-text font-medium">Phone Number</span>
							</label>
							<div className="flex gap-2">
								<Input
									type="tel"
									value={phoneNumber}
									onChange={(e) => setPhoneNumber(e.target.value)}
									placeholder="+1 (555) 123-4567"
									className="flex-1"
								/>
								<Button
									type="button"
									className="btn-primary"
									onClick={() => handleSaveProfile(false, true)}
									disabled={savingProfile || phoneNumber === (user.profile?.phone || '')}
								>
									{savingProfile ? (
										<span className="loading loading-spinner loading-sm"></span>
									) : (
										'Save'
									)}
								</Button>
							</div>
						</div>
					</div>
				</div>
			</div>

			{/* Notification Settings */}
			<NotificationSettings />
		</div>
	)
}

