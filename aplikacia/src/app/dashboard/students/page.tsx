'use client'

import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/context/AuthContext'
import { Button, Alert } from '@/components'
import { showAlertToast } from '@/components/toast/Toast'
import {
	Calendar,
	Clock,
	User,
	Users,
	MapPin,
	X,
	ChevronLeft,
	ChevronRight,
	RefreshCw,
	AlertCircle,
} from 'lucide-react'
import { format, parseISO, startOfWeek, endOfWeek, addWeeks, subWeeks, isToday, isSameDay, addDays } from 'date-fns'

interface StudentLesson {
	_id: string
	timetableId: string
	timetableName: string
	timetableType: string
	date: string
	start: string
	end: string
	lessonType: 'group' | 'individual' | 'couple'
	teacherName?: string
	roomLabel?: string
	studentNames: string[]
	pairLabel?: string
	status: 'scheduled' | 'cancelled' | 'completed' | 'no_show' | 'rescheduled'
	cancellation?: {
		byUserId?: string
		reason?: string
		at?: string
	}
	notes?: string
	durationMinutes?: number
}

const LESSON_TYPE_COLORS = {
	group: 'bg-purple-100 border-purple-300 text-purple-800',
	individual: 'bg-blue-100 border-blue-300 text-blue-800',
	couple: 'bg-pink-100 border-pink-300 text-pink-800',
}

const LESSON_TYPE_LABELS = {
	group: 'Group',
	individual: 'Individual',
	couple: 'Couple',
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const FULL_DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export default function StudentDashboard() {
	const { user, refreshUser } = useAuth()
	const [lessons, setLessons] = useState<StudentLesson[]>([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [currentWeekStart, setCurrentWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }))

	// Cancel modal state
	const [cancelModalOpen, setCancelModalOpen] = useState(false)
	const [cancellingLesson, setCancellingLesson] = useState<StudentLesson | null>(null)
	const [cancelReason, setCancelReason] = useState('')
	const [cancelling, setCancelling] = useState(false)

	// Fetch lessons
	const fetchLessons = async () => {
		setLoading(true)
		setError(null)
		try {
			const res = await fetch('/api/students/lessons', { cache: 'no-store' })
			if (!res.ok) {
				const data = await res.json()
				throw new Error(data.error || 'Failed to load lessons')
			}
			const data = await res.json()
			setLessons(data.lessons || [])
		} catch (err: any) {
			console.error('Error fetching lessons:', err)
			setError(err.message || 'Unable to load lessons')
		} finally {
			setLoading(false)
		}
	}

	useEffect(() => {
		if (user && user.role === 'student') {
			fetchLessons()
		}
	}, [user])

	// Get lessons for the current week
	const weekLessons = useMemo(() => {
		const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 1 })

		return lessons.filter((lesson) => {
			const lessonDate = parseISO(lesson.date)
			return lessonDate >= currentWeekStart && lessonDate <= weekEnd
		})
	}, [lessons, currentWeekStart])

	// Group lessons by day
	const lessonsByDay = useMemo(() => {
		const byDay: Record<string, StudentLesson[]> = {}

		// Initialize all 7 days of the week
		for (let i = 0; i < 7; i++) {
			const day = addDays(currentWeekStart, i)
			const dateKey = format(day, 'yyyy-MM-dd')
			byDay[dateKey] = []
		}

		// Add lessons to their respective days
		weekLessons.forEach((lesson) => {
			if (byDay[lesson.date]) {
				byDay[lesson.date].push(lesson)
			}
		})

		// Sort each day's lessons by time
		Object.keys(byDay).forEach((date) => {
			byDay[date].sort((a, b) => a.start.localeCompare(b.start))
		})

		return byDay
	}, [weekLessons, currentWeekStart])

	// Navigation
	const goToPreviousWeek = () => setCurrentWeekStart((prev) => subWeeks(prev, 1))
	const goToNextWeek = () => setCurrentWeekStart((prev) => addWeeks(prev, 1))
	const goToCurrentWeek = () => setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))

	// Cancel lesson
	const handleCancelClick = (lesson: StudentLesson) => {
		setCancellingLesson(lesson)
		setCancelReason('')
		setCancelModalOpen(true)
	}

	const handleCancelConfirm = async () => {
		if (!cancellingLesson || !cancelReason.trim()) {
			showAlertToast('Please provide a reason for cancellation', { variant: 'error' })
			return
		}

		setCancelling(true)
		try {
			const res = await fetch(`/api/lessons/${cancellingLesson._id}/cancel`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					timetableId: cancellingLesson.timetableId,
					reason: cancelReason.trim(),
				}),
			})

			if (!res.ok) {
				const data = await res.json()
				throw new Error(data.error || 'Failed to cancel lesson')
			}

			showAlertToast('Lesson cancelled successfully', { variant: 'success' })
			setCancelModalOpen(false)
			setCancellingLesson(null)
			setCancelReason('')

			// Refresh lessons
			await fetchLessons()
		} catch (err: any) {
			console.error('Error cancelling lesson:', err)
			showAlertToast(err.message || 'Failed to cancel lesson', { variant: 'error' })
		} finally {
			setCancelling(false)
		}
	}

	// Upcoming lessons count (scheduled only, from today onwards)
	const upcomingCount = useMemo(() => {
		const today = new Date()
		today.setHours(0, 0, 0, 0)
		return lessons.filter(
			(l) => l.status === 'scheduled' && parseISO(l.date) >= today
		).length
	}, [lessons])

	if (!user || user.role !== 'student') {
		return (
			<div className="flex items-center justify-center h-64">
				<Alert variant="error">This page is only available for students.</Alert>
			</div>
		)
	}

	return (
		<div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
			{/* Header */}
			<header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
				<div>
					<h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
						<Calendar className="h-7 w-7 text-primary" />
						My Schedule
					</h1>
					<p className="text-base-content/60 mt-1">
						{upcomingCount} upcoming lesson{upcomingCount !== 1 ? 's' : ''}
					</p>
				</div>
				<Button onClick={fetchLessons} className="btn-outline btn-sm gap-2" disabled={loading}>
					<RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
					Refresh
				</Button>
			</header>

			{error && (
				<Alert variant="error">{error}</Alert>
			)}

			{/* Week Navigation */}
			<div className="flex items-center justify-between bg-base-100 border border-base-300 rounded-xl p-3">
				<Button onClick={goToPreviousWeek} className="btn-ghost btn-sm">
					<ChevronLeft className="h-5 w-5" />
				</Button>

				<div className="flex items-center gap-3">
					<h2 className="text-lg font-semibold">
						{format(currentWeekStart, 'MMM d')} - {format(endOfWeek(currentWeekStart, { weekStartsOn: 1 }), 'MMM d, yyyy')}
					</h2>
					{!isSameDay(currentWeekStart, startOfWeek(new Date(), { weekStartsOn: 1 })) && (
						<Button onClick={goToCurrentWeek} className="btn-ghost btn-xs">
							Today
						</Button>
					)}
				</div>

				<Button onClick={goToNextWeek} className="btn-ghost btn-sm">
					<ChevronRight className="h-5 w-5" />
				</Button>
			</div>

			{/* Timetable Grid */}
			{loading ? (
				<div className="flex justify-center py-16">
					<span className="loading loading-spinner loading-lg text-primary"></span>
				</div>
			) : (
				<div className="bg-base-100 border border-base-300 rounded-2xl overflow-hidden shadow-sm">
					{/* Desktop: Grid View */}
					<div className="hidden md:grid md:grid-cols-7 divide-x divide-base-300">
						{Object.entries(lessonsByDay).map(([dateStr, dayLessons], idx) => {
							const date = parseISO(dateStr)
							const isCurrentDay = isToday(date)

							return (
								<div key={dateStr} className={`min-h-[300px] ${isCurrentDay ? 'bg-primary/5' : ''}`}>
									{/* Day Header */}
									<div className={`sticky top-0 p-3 border-b border-base-300 text-center ${isCurrentDay ? 'bg-primary/10' : 'bg-base-200/50'}`}>
										<div className="text-xs text-base-content/60 uppercase tracking-wide">
											{DAY_NAMES[date.getDay()]}
										</div>
										<div className={`text-xl font-bold ${isCurrentDay ? 'text-primary' : ''}`}>
											{format(date, 'd')}
										</div>
									</div>

									{/* Lessons */}
									<div className="p-2 space-y-2">
										{dayLessons.length === 0 ? (
											<div className="text-center py-8 text-base-content/40 text-sm">
												No lessons
											</div>
										) : (
											dayLessons.map((lesson) => (
												<LessonCard
													key={lesson._id}
													lesson={lesson}
													onCancel={() => handleCancelClick(lesson)}
													compact
												/>
											))
										)}
									</div>
								</div>
							)
						})}
					</div>

					{/* Mobile: List View */}
					<div className="md:hidden divide-y divide-base-300">
						{Object.entries(lessonsByDay).map(([dateStr, dayLessons]) => {
							const date = parseISO(dateStr)
							const isCurrentDay = isToday(date)

							if (dayLessons.length === 0) return null

							return (
								<div key={dateStr} className={isCurrentDay ? 'bg-primary/5' : ''}>
									{/* Day Header */}
									<div className={`p-3 border-b border-base-300 ${isCurrentDay ? 'bg-primary/10' : 'bg-base-200/50'}`}>
										<span className={`font-semibold ${isCurrentDay ? 'text-primary' : ''}`}>
											{FULL_DAY_NAMES[date.getDay()]}, {format(date, 'MMMM d')}
										</span>
										{isCurrentDay && (
											<span className="ml-2 badge badge-primary badge-sm">Today</span>
										)}
									</div>

									{/* Lessons */}
									<div className="p-3 space-y-3">
										{dayLessons.map((lesson) => (
											<LessonCard
												key={lesson._id}
												lesson={lesson}
												onCancel={() => handleCancelClick(lesson)}
											/>
										))}
									</div>
								</div>
							)
						})}

						{weekLessons.length === 0 && (
							<div className="text-center py-12 text-base-content/50">
								<Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
								<p>No lessons scheduled for this week</p>
							</div>
						)}
					</div>
				</div>
			)}

			{/* Cancel Modal */}
			{cancelModalOpen && cancellingLesson && (
				<div className="modal modal-open">
					<div className="modal-box">
						<button
							className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
							onClick={() => {
								setCancelModalOpen(false)
								setCancellingLesson(null)
								setCancelReason('')
							}}
						>
							<X className="h-4 w-4" />
						</button>

						<h3 className="font-bold text-lg flex items-center gap-2">
							<AlertCircle className="h-5 w-5 text-warning" />
							Cancel Lesson
						</h3>

						<div className="mt-4 space-y-4">
							<div className="bg-base-200 rounded-lg p-3">
								<p className="font-medium">{cancellingLesson.timetableName}</p>
								<p className="text-sm text-base-content/70">
									{format(parseISO(cancellingLesson.date), 'EEEE, MMMM d, yyyy')}
								</p>
								<p className="text-sm text-base-content/70">
									{cancellingLesson.start} - {cancellingLesson.end}
								</p>
								{cancellingLesson.teacherName && (
									<p className="text-sm text-base-content/70">
										Teacher: {cancellingLesson.teacherName}
									</p>
								)}
							</div>

							<div>
								<label className="label">
									<span className="label-text font-medium">
										Reason for cancellation <span className="text-error">*</span>
									</span>
								</label>
								<textarea
									className="textarea textarea-bordered w-full h-24"
									placeholder="Please explain why you need to cancel this lesson..."
									value={cancelReason}
									onChange={(e) => setCancelReason(e.target.value)}
								/>
								<p className="text-xs text-base-content/50 mt-1">
									Your teacher will be notified of this cancellation.
								</p>
							</div>
						</div>

						<div className="modal-action">
							<Button
								className="btn-ghost"
								onClick={() => {
									setCancelModalOpen(false)
									setCancellingLesson(null)
									setCancelReason('')
								}}
							>
								Keep Lesson
							</Button>
							<Button
								className="btn-error"
								onClick={handleCancelConfirm}
								disabled={cancelling || !cancelReason.trim()}
							>
								{cancelling ? (
									<>
										<span className="loading loading-spinner loading-sm"></span>
										Cancelling...
									</>
								) : (
									'Cancel Lesson'
								)}
							</Button>
						</div>
					</div>
					<div className="modal-backdrop bg-black/50" onClick={() => setCancelModalOpen(false)} />
				</div>
			)}
		</div>
	)
}

// Lesson Card Component
function LessonCard({
	lesson,
	onCancel,
	compact = false,
}: {
	lesson: StudentLesson
	onCancel: () => void
	compact?: boolean
}) {
	const isCancelled = lesson.status === 'cancelled'
	const isPast = parseISO(lesson.date) < new Date()

	return (
		<div
			className={`
				border rounded-lg p-2.5 transition-all
				${isCancelled ? 'bg-base-200/50 border-base-300 opacity-60' : LESSON_TYPE_COLORS[lesson.lessonType]}
				${!isCancelled && !isPast ? 'hover:shadow-md' : ''}
			`}
		>
			{/* Time */}
			<div className="flex items-center gap-1.5 text-sm font-semibold">
				<Clock className="h-3.5 w-3.5" />
				{lesson.start} - {lesson.end}
			</div>

			{/* Lesson Type Badge */}
			<div className="mt-1.5">
				<span className={`badge badge-sm ${isCancelled ? 'badge-ghost' : ''}`}>
					{LESSON_TYPE_LABELS[lesson.lessonType]}
				</span>
				{isCancelled && (
					<span className="badge badge-error badge-sm ml-1">Cancelled</span>
				)}
			</div>

			{/* Details */}
			{!compact && (
				<div className="mt-2 space-y-1 text-xs text-base-content/70">
					{lesson.teacherName && (
						<div className="flex items-center gap-1">
							<User className="h-3 w-3" />
							{lesson.teacherName}
						</div>
					)}
					{lesson.roomLabel && (
						<div className="flex items-center gap-1">
							<MapPin className="h-3 w-3" />
							{lesson.roomLabel}
						</div>
					)}
					{lesson.pairLabel && (
						<div className="flex items-center gap-1">
							<Users className="h-3 w-3" />
							{lesson.pairLabel}
						</div>
					)}
				</div>
			)}

			{/* Cancel Reason (if cancelled) */}
			{isCancelled && lesson.cancellation?.reason && (
				<div className="mt-2 text-xs text-error/80 bg-error/10 rounded p-1.5">
					<strong>Reason:</strong> {lesson.cancellation.reason}
				</div>
			)}

			{/* Cancel Button */}
			{!isCancelled && !isPast && (
				<div className="mt-2">
					<button
						onClick={(e) => {
							e.stopPropagation()
							onCancel()
						}}
						className="btn btn-ghost btn-xs text-error hover:bg-error/10 w-full"
					>
						Cancel
					</button>
				</div>
			)}
		</div>
	)
}

