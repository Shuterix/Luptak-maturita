'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { Calendar, Clock, MapPin, Users, LogOut, BookOpen, Settings } from 'lucide-react'
import NotificationSettings from '@/components/NotificationSettings'
import { format, parseISO, isToday, isTomorrow, formatDistanceToNow } from 'date-fns'

interface UpcomingLesson {
	_id: string
	timetableName: string
	timetableId: string
	date: string
	start: string
	end: string
	lessonType: string
	roomLabel?: string
	studentNames: string[]
	pairLabel?: string
	notes?: string
	status: string
}

export default function MyLessonsPage() {
	const { user, logout } = useAuth()
	const [lessons, setLessons] = useState<UpcomingLesson[]>([])
	const [teacherName, setTeacherName] = useState('')
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [showSettings, setShowSettings] = useState(false)

	useEffect(() => {
		fetchMyLessons()
	}, [])

	const fetchMyLessons = async () => {
		try {
			setLoading(true)
			setError(null)

			const res = await fetch('/api/external-teachers/my-lessons', { cache: 'no-store' })

			if (!res.ok) {
				const data = await res.json()
				throw new Error(data.error || 'Failed to fetch lessons')
			}

			const data = await res.json()
			setLessons(data.lessons || [])
			setTeacherName(data.teacher?.name || '')
		} catch (err: any) {
			console.error('Error fetching lessons:', err)
			setError(err.message || 'Failed to load lessons')
		} finally {
			setLoading(false)
		}
	}

	const parseDate = (dateStr: string) => {
		// Handle both "2026-02-17" and "2026-02-17T16:00:00.000Z" formats
		const clean = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr
		return parseISO(clean)
	}

	const formatDateLabel = (dateStr: string) => {
		const date = parseDate(dateStr)
		if (isToday(date)) return 'Today'
		if (isTomorrow(date)) return 'Tomorrow'
		return format(date, 'EEEE, MMM d')
	}

	const formatDateSubtitle = (dateStr: string) => {
		const date = parseDate(dateStr)
		if (isToday(date) || isTomorrow(date)) return format(date, 'MMM d, yyyy')
		return formatDistanceToNow(date, { addSuffix: true })
	}

	const formatTime = (time: string) => {
		// Handle ISO datetime strings (e.g. "2026-02-17T16:00:00.000Z") or plain "HH:mm"
		if (!time) return ''
		// Try parsing as ISO date first
		if (time.includes('T')) {
			const date = new Date(time)
			if (!isNaN(date.getTime())) {
				return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
			}
		}
		// Fallback: plain "HH:mm" format
		const parts = time.split(':')
		if (parts.length < 2) return time
		return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`
	}

	const getMinutesFromTime = (time: string): number | null => {
		if (!time) return null
		// ISO datetime
		if (time.includes('T')) {
			const date = new Date(time)
			if (!isNaN(date.getTime())) {
				return date.getHours() * 60 + date.getMinutes()
			}
		}
		// Plain "HH:mm"
		const parts = time.split(':').map(Number)
		if (parts.length < 2 || isNaN(parts[0]) || isNaN(parts[1])) return null
		return parts[0] * 60 + parts[1]
	}

	const getDuration = (start: string, end: string) => {
		const startMins = getMinutesFromTime(start)
		const endMins = getMinutesFromTime(end)
		if (startMins === null || endMins === null) return null
		const mins = endMins - startMins
		if (mins <= 0) return null
		if (mins >= 60) {
			const h = Math.floor(mins / 60)
			const m = mins % 60
			return m > 0 ? `${h}h ${m}min` : `${h}h`
		}
		return `${mins} min`
	}

	const getLessonTypeBadge = (type: string) => {
		switch (type) {
			case 'group':
				return 'badge-info'
			case 'couple':
				return 'badge-secondary'
			case 'individual':
				return 'badge-accent'
			default:
				return 'badge-ghost'
		}
	}

	const formatLessonType = (type: string) => {
		return type.charAt(0).toUpperCase() + type.slice(1)
	}

	// Group lessons by date
	const lessonsByDate = lessons.reduce<Record<string, UpcomingLesson[]>>((acc, lesson) => {
		if (!acc[lesson.date]) acc[lesson.date] = []
		acc[lesson.date].push(lesson)
		return acc
	}, {})

	if (loading) {
		return (
			<div className="flex items-center justify-center min-h-screen">
				<span className="loading loading-spinner loading-lg"></span>
			</div>
		)
	}

	return (
		<div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6">
			{/* Header */}
			<header className="flex items-center justify-between">
				<div>
					<div className="flex items-center gap-3 mb-1">
						<BookOpen className="h-7 w-7 text-warning" />
						<h1 className="text-2xl sm:text-3xl font-semibold">My Lessons</h1>
					</div>
					{teacherName && (
						<p className="text-base-content/60 text-sm">
							Welcome, <span className="font-medium text-base-content">{teacherName}</span>
						</p>
					)}
				</div>
				<div className="flex items-center gap-1">
					<button
						onClick={() => setShowSettings(!showSettings)}
						className={`btn btn-ghost btn-sm gap-2 ${showSettings ? 'btn-active' : ''}`}
					>
						<Settings className="h-4 w-4" />
					</button>
					<button onClick={logout} className="btn btn-ghost btn-sm gap-2">
						<LogOut className="h-4 w-4" />
						Sign out
					</button>
				</div>
			</header>

			{showSettings && <NotificationSettings />}

			{error && (
				<div className="alert alert-error">
					<span>{error}</span>
					<button className="btn btn-sm btn-ghost" onClick={fetchMyLessons}>
						Retry
					</button>
				</div>
			)}

			{/* Lessons */}
			{lessons.length === 0 ? (
				<div className="card bg-base-100 border border-base-300">
					<div className="card-body text-center py-12">
						<Calendar className="h-12 w-12 text-base-content/30 mx-auto mb-3" />
						<h2 className="text-lg font-semibold text-base-content/60">No upcoming lessons</h2>
						<p className="text-sm text-base-content/40">
							You don&apos;t have any scheduled lessons yet. Your trainer will assign you to timetables.
						</p>
					</div>
				</div>
			) : (
				<div className="space-y-6">
					{Object.entries(lessonsByDate).map(([date, dayLessons]) => (
						<div key={date}>
							<div className="flex items-baseline gap-2 mb-3">
								<Calendar className="h-5 w-5 text-primary self-center" />
								<h2 className="text-lg font-semibold">{formatDateLabel(date)}</h2>
								<span className="text-xs text-base-content/40">{formatDateSubtitle(date)}</span>
							</div>
							<div className="space-y-3">
								{dayLessons.map((lesson) => (
									<div
										key={lesson._id}
										className="card bg-base-100 shadow-md border border-base-300 hover:shadow-lg transition-shadow"
									>
										<div className="card-body p-4">
											<div className="flex items-start justify-between gap-3">
												<div className="flex-1 min-w-0 space-y-2">
													<div className="flex items-center gap-2 flex-wrap">
														<div className="flex items-center gap-2 text-base font-medium">
															<Clock className="h-4 w-4 text-primary flex-shrink-0" />
															{formatTime(lesson.start)} – {formatTime(lesson.end)}
														</div>
														{getDuration(lesson.start, lesson.end) && (
															<span className="text-xs text-base-content/40">
																({getDuration(lesson.start, lesson.end)})
															</span>
														)}
														<span className={`badge badge-sm ${getLessonTypeBadge(lesson.lessonType)}`}>
															{formatLessonType(lesson.lessonType)}
														</span>
													</div>

													{lesson.roomLabel && (
														<div className="flex items-center gap-2 text-sm text-base-content/70">
															<MapPin className="h-3.5 w-3.5 flex-shrink-0" />
															<span>{lesson.roomLabel}</span>
														</div>
													)}

													{(lesson.pairLabel || lesson.studentNames.length > 0) && (
														<div className="flex items-center gap-2 text-sm text-base-content/70">
															<Users className="h-3.5 w-3.5 flex-shrink-0" />
															<span>
																{lesson.pairLabel || lesson.studentNames.join(', ')}
															</span>
														</div>
													)}

													{lesson.notes && (
														<p className="text-xs text-base-content/50 border-t border-base-200 pt-2 mt-2">
															{lesson.notes}
														</p>
													)}
												</div>

												<div className="text-right flex-shrink-0">
													<span className="text-xs text-base-content/40">
														{lesson.timetableName}
													</span>
												</div>
											</div>
										</div>
									</div>
								))}
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	)
}

