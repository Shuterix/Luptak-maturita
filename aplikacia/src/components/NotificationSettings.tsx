'use client'

import { useState, useEffect } from 'react'
import { Bell, BellOff, BellRing, Smartphone, Clock, AlertTriangle } from 'lucide-react'
import { usePushNotifications } from '@/hooks/usePushNotifications'

interface NotificationPrefs {
	enabled: boolean
	reminderHoursBefore: number
	secondReminderHoursBefore: number
	pushEnabled: boolean
}

const REMINDER_OPTIONS = [
	{ value: 1, label: '1 hour before' },
	{ value: 2, label: '2 hours before' },
	{ value: 6, label: '6 hours before' },
	{ value: 12, label: '12 hours before' },
	{ value: 24, label: '1 day before' },
	{ value: 48, label: '2 days before' },
]

const SECOND_REMINDER_OPTIONS = [
	{ value: 0, label: 'Disabled' },
	{ value: 0.5, label: '30 minutes before' },
	{ value: 1, label: '1 hour before' },
	{ value: 2, label: '2 hours before' },
	{ value: 6, label: '6 hours before' },
]

export default function NotificationSettings() {
	const [prefs, setPrefs] = useState<NotificationPrefs>({
		enabled: true,
		reminderHoursBefore: 24,
		secondReminderHoursBefore: 0,
		pushEnabled: true,
	})
	const [loading, setLoading] = useState(true)
	const [saving, setSaving] = useState(false)
	const [saveSuccess, setSaveSuccess] = useState(false)

	const {
		isSupported: pushSupported,
		isSubscribed: pushSubscribed,
		permission: pushPermission,
		loading: pushLoading,
		error: pushError,
		subscribe: subscribePush,
		unsubscribe: unsubscribePush,
	} = usePushNotifications()

	useEffect(() => {
		fetchPrefs()
	}, [])

	const fetchPrefs = async () => {
		try {
			const res = await fetch('/api/notifications/preferences')
			if (res.ok) {
				const data = await res.json()
				setPrefs(data.preferences)
			}
		} catch {
			// Use defaults
		} finally {
			setLoading(false)
		}
	}

	const savePrefs = async (newPrefs: Partial<NotificationPrefs>) => {
		const updated = { ...prefs, ...newPrefs }
		setPrefs(updated)
		setSaving(true)
		setSaveSuccess(false)

		try {
			const res = await fetch('/api/notifications/preferences', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(updated),
			})
			if (res.ok) {
				setSaveSuccess(true)
				setTimeout(() => setSaveSuccess(false), 2000)
			}
		} catch {
			// Silently fail
		} finally {
			setSaving(false)
		}
	}

	const handleTogglePush = async () => {
		if (pushSubscribed) {
			await unsubscribePush()
			await savePrefs({ pushEnabled: false })
		} else {
			const success = await subscribePush()
			if (success) {
				await savePrefs({ pushEnabled: true })
			}
		}
	}

	if (loading) {
		return (
			<div className="card bg-base-100 border border-base-300">
				<div className="card-body">
					<div className="flex items-center gap-3">
						<span className="loading loading-spinner loading-sm" />
						<span className="text-sm text-base-content/60">Loading notification settings...</span>
					</div>
				</div>
			</div>
		)
	}

	return (
		<div className="card bg-base-100 border border-base-300 rounded-2xl">
			<div className="card-body p-4 sm:p-6 space-y-4 sm:space-y-5">
				{/* Header */}
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2 sm:gap-3">
						<Bell className="h-5 w-5 text-primary" />
						<h3 className="text-base sm:text-lg font-semibold">Notifications</h3>
					</div>
					{saveSuccess && (
						<span className="badge badge-success badge-xs sm:badge-sm gap-1">Saved</span>
					)}
				</div>

				{/* Master toggle */}
				<div className="flex items-center justify-between p-3 rounded-xl bg-base-200">
					<div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
						{prefs.enabled ? (
							<BellRing className="h-5 w-5 text-success flex-shrink-0" />
						) : (
							<BellOff className="h-5 w-5 text-base-content/40 flex-shrink-0" />
						)}
						<div className="min-w-0">
							<p className="font-medium text-xs sm:text-sm">Lesson Reminders</p>
							<p className="text-[11px] sm:text-xs text-base-content/50 truncate">
								Get notified about your upcoming lessons
							</p>
						</div>
					</div>
					<input
						type="checkbox"
						className="toggle toggle-primary toggle-sm sm:toggle-md flex-shrink-0 ml-2"
						checked={prefs.enabled}
						onChange={(e) => savePrefs({ enabled: e.target.checked })}
						disabled={saving}
					/>
				</div>

				{prefs.enabled && (
					<>
						{/* Push notifications */}
						<div className="flex items-center justify-between p-3 rounded-xl bg-base-200 gap-2">
							<div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
								<Smartphone className="h-5 w-5 text-info flex-shrink-0" />
								<div className="min-w-0">
									<p className="font-medium text-xs sm:text-sm">Push Notifications</p>
									<p className="text-[11px] sm:text-xs text-base-content/50">
										{!pushSupported
											? 'Not supported in this browser'
											: pushPermission === 'denied'
												? 'Blocked — enable in browser settings'
												: pushSubscribed
													? 'Active — you will receive push alerts'
													: 'Enable for alerts when app is closed'}
									</p>
								</div>
							</div>
							{pushSupported && pushPermission !== 'denied' && (
								<button
									className={`btn btn-xs sm:btn-sm flex-shrink-0 ${pushSubscribed ? 'btn-outline btn-error' : 'btn-primary'}`}
									onClick={handleTogglePush}
									disabled={pushLoading}
								>
									{pushLoading ? (
										<span className="loading loading-spinner loading-xs" />
									) : pushSubscribed ? (
										'Disable'
									) : (
										'Enable'
									)}
								</button>
							)}
						</div>

						{pushError && (
							<div className="flex items-center gap-2 text-warning text-[11px] sm:text-xs px-1">
								<AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
								<span>{pushError}</span>
							</div>
						)}

						{/* Reminder timing - pill-style selectors on mobile */}
						<div className="space-y-3">
							<div>
								<div className="flex items-center gap-2 mb-2">
									<Clock className="h-4 w-4 text-primary" />
									<span className="text-xs sm:text-sm font-medium">First Reminder</span>
								</div>
								<div className="flex flex-wrap gap-1.5">
									{REMINDER_OPTIONS.map((opt) => (
										<button
											key={opt.value}
											type="button"
											onClick={() => savePrefs({ reminderHoursBefore: opt.value })}
											disabled={saving}
											className={`btn btn-xs rounded-full ${
												prefs.reminderHoursBefore === opt.value
													? 'btn-primary'
													: 'btn-outline'
											}`}
										>
											{opt.label}
										</button>
									))}
								</div>
							</div>

							<div>
								<div className="flex items-center gap-2 mb-2">
									<Clock className="h-4 w-4 text-secondary" />
									<span className="text-xs sm:text-sm font-medium">Second Reminder</span>
								</div>
								<div className="flex flex-wrap gap-1.5">
									{SECOND_REMINDER_OPTIONS.map((opt) => (
										<button
											key={opt.value}
											type="button"
											onClick={() => savePrefs({ secondReminderHoursBefore: opt.value })}
											disabled={saving}
											className={`btn btn-xs rounded-full ${
												prefs.secondReminderHoursBefore === opt.value
													? 'btn-secondary'
													: 'btn-outline'
											}`}
										>
											{opt.label}
										</button>
									))}
								</div>
								<p className="text-[11px] sm:text-xs text-base-content/40 mt-1.5">
									Optional — get a second nudge closer to the lesson
								</p>
							</div>
						</div>
					</>
				)}
			</div>
		</div>
	)
}

