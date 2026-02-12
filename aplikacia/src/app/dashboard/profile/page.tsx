'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { Button, Input, Alert } from '@/components'
import { showAlertToast } from '@/components/toast/Toast'
import ResponsiveModal from '@/components/ResponsiveModal'
import NotificationSettings from '@/components/NotificationSettings'
import { Clock, User, Save, ChevronDown, ChevronUp, Edit2, Calendar, Eye } from 'lucide-react'
import AvailabilityEditor from '@/components/AvailabilityEditor'

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
			loadTrainerData()
			setFirstName(user.firstName || '')
			setLastName(user.lastName || '')
			setPhoneNumber(user.profile?.phone || '')
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
		<div className="space-y-4 sm:space-y-6">
			{/* Header */}
			<div className="flex items-center justify-between">
				<h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
					<User className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
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
				<div className="card-body p-4 sm:p-6">
					<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 mb-2">
						<div>
							<h2 className="card-title text-base sm:text-lg flex items-center gap-2 mb-0.5 sm:mb-1">
								<Clock className="h-5 w-5" />
								Weekly Unavailability
							</h2>
							<p className="text-xs sm:text-sm text-base-content/70">
								Set the times when you <strong>CANNOT</strong> teach. The scheduler will respect these.
							</p>
						</div>
						<Button
							type="button"
							className="btn-primary btn-sm sm:btn-md"
							onClick={() => setIsAvailabilityModalOpen(true)}
						>
							<Clock className="h-4 w-4" />
							Edit Schedule
						</Button>
					</div>

					{/* Quick summary preview */}
					{(() => {
						const daysWithData = (Object.keys(DAY_LABELS) as DayOfWeek[]).filter(
							day => unavailability[day] && unavailability[day]!.length > 0
						)
						if (daysWithData.length === 0) {
							return (
								<div className="bg-success/5 border border-success/20 rounded-xl p-3 text-center mt-2">
									<p className="text-success text-sm font-medium">Available all week</p>
								</div>
							)
						}
						return (
							<div className="grid grid-cols-7 gap-1 mt-3">
								{(Object.keys(DAY_LABELS) as DayOfWeek[]).map((day) => {
									const windows = unavailability[day] || []
									return (
										<div
											key={day}
											className={`text-center py-1.5 rounded-lg text-[10px] sm:text-xs
												${windows.length > 0 ? 'bg-error/10 text-error/80' : 'bg-success/10 text-success/80'}
											`}
										>
											<div className="font-medium">{DAY_LABELS[day].slice(0, 3)}</div>
											<div className="mt-0.5">{windows.length > 0 ? `${windows.length}` : '✓'}</div>
										</div>
									)
								})}
							</div>
						)
					})()}
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
				size="lg"
			>
				<div className="space-y-4">
					<p className="text-sm text-base-content/70">
						Set the times when you <strong>CANNOT</strong> teach. 
						Leave empty if you're available anytime. Use presets for quick setup.
					</p>

					<AvailabilityEditor
						unavailability={unavailability}
						onChange={setUnavailability}
						activityLabel="teach"
					/>

					<div className="flex justify-end gap-3 pt-2 border-t border-base-300 sticky bottom-0 bg-base-100 py-3 -mx-4 sm:-mx-6 px-4 sm:px-6">
						<Button
							type="button"
							className="btn-ghost btn-sm sm:btn-md"
							onClick={() => {
								setIsAvailabilityModalOpen(false)
								setSelectedDay(null)
							}}
						>
							Cancel
						</Button>
						<Button
							type="button"
							className="btn-primary btn-sm sm:btn-md"
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
									Save
								</>
							)}
						</Button>
					</div>
				</div>
			</ResponsiveModal>

			{/* Profile Information Section */}
			<div className="card bg-base-100 shadow-sm border border-base-300 rounded-2xl">
				<div className="card-body p-4 sm:p-6">
					<h2 className="card-title text-base sm:text-lg flex items-center gap-2 mb-2 sm:mb-4">
						<User className="h-5 w-5" />
						Profile Information
					</h2>
					<p className="text-xs sm:text-sm text-base-content/70 mb-4 sm:mb-6">
						Your personal information.
					</p>

					<div className="space-y-3 sm:space-y-4">
						<div>
							<label className="label py-1">
								<span className="label-text text-xs sm:text-sm font-medium">Email</span>
							</label>
							<Input type="email" value={user.email || ''} disabled className="bg-base-200" />
							<p className="text-[11px] sm:text-xs text-base-content/50 mt-1">Email cannot be changed</p>
						</div>

						<div>
							<div className="flex items-center justify-between mb-1.5 sm:mb-2">
								<label className="label py-1">
									<span className="label-text text-xs sm:text-sm font-medium">Name</span>
								</label>
								{!editingName && (
									<Button
										type="button"
										className="btn-xs sm:btn-sm btn-ghost"
										onClick={() => setEditingName(true)}
									>
										<Edit2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
										Edit
									</Button>
								)}
							</div>
							{editingName ? (
								<div className="space-y-3">
									<div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
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
								<div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
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
							<label className="label py-1">
								<span className="label-text text-xs sm:text-sm font-medium">Phone Number</span>
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
									className="btn-sm sm:btn-md btn-primary"
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

