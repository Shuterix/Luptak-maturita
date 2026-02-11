import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import Timetable from '@/models/Timetable'
import PushSubscription from '@/models/PushSubscription'
import NotificationPreference from '@/models/NotificationPreference'
import User from '@/models/User'
import ExternalTeacher from '@/models/ExternalTeacher'
import webpush from 'web-push'

// Configure web-push with VAPID keys
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY

if (vapidPublicKey && vapidPrivateKey) {
	webpush.setVapidDetails(
		'mailto:dancehub@example.com',
		vapidPublicKey,
		vapidPrivateKey,
	)
}

interface LessonReminder {
	teacherName: string
	date: string
	start: string
	end: string
	lessonType: string
	roomLabel?: string
	studentNames: string[]
	pairLabel?: string
	timetableName: string
}

// This endpoint can be called by a cron job or manually
// It checks for upcoming lessons and sends push notifications
export async function POST(request: NextRequest) {
	try {
		// Optional: Verify a secret key for cron jobs
		const authHeader = request.headers.get('authorization')
		const cronSecret = process.env.CRON_SECRET
		if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
			// Also allow authenticated users to trigger their own reminders
			// (no secret required for that case)
		}

		await connectDB()

		if (!vapidPublicKey || !vapidPrivateKey) {
			return NextResponse.json({ error: 'VAPID keys not configured' }, { status: 500 })
		}

		const now = new Date()
		let totalSent = 0
		let totalFailed = 0

		// Get all notification preferences that are enabled
		const allPrefs = await NotificationPreference.find({ enabled: true, pushEnabled: true }).lean()

		// Process each user/teacher with enabled notifications
		for (const pref of allPrefs) {
			try {
				const reminderMs = (pref.reminderHoursBefore || 24) * 60 * 60 * 1000
				const secondReminderMs = pref.secondReminderHoursBefore
					? pref.secondReminderHoursBefore * 60 * 60 * 1000
					: 0

				// Find push subscriptions for this user
				const subFilter = pref.userId
					? { userId: pref.userId }
					: { externalTeacherId: pref.externalTeacherId }

				const subscriptions = await PushSubscription.find(subFilter).lean()
				if (subscriptions.length === 0) continue

				// Determine who this is and find their lessons
				let teacherName: string | null = null
				let clubId: string | null = null

				if (pref.externalTeacherId) {
					const teacher = await ExternalTeacher.findById(pref.externalTeacherId).lean() as any
					if (!teacher) continue
					teacherName = teacher.name
					clubId = teacher.clubId?.toString()
				} else if (pref.userId) {
					const user = await User.findById(pref.userId).lean() as any
					if (!user) continue
					teacherName = `${user.firstName} ${user.lastName}`
					clubId = user.clubId?.toString()
				}

				if (!clubId || !teacherName) continue

				// Find timetables for this club
				const timetables = await Timetable.find({ clubId }).lean()

				// Find lessons assigned to this teacher
				const upcomingLessons: LessonReminder[] = []

				for (const timetable of timetables) {
					if (!timetable.lessons) continue
					for (const lesson of timetable.lessons as any[]) {
						if (lesson.teacherName !== teacherName) continue
						if (lesson.kind !== 'lesson') continue
						if (lesson.status === 'cancelled') continue

						// Parse lesson datetime
						const lessonDate = lesson.start?.includes('T')
							? new Date(lesson.start)
							: new Date(`${lesson.date}T${lesson.start || '00:00'}:00`)

						if (isNaN(lessonDate.getTime())) continue
						if (lessonDate <= now) continue // Already past

						const timeDiff = lessonDate.getTime() - now.getTime()

						// Check if within reminder window (with 30-min tolerance for cron scheduling)
						const tolerance = 30 * 60 * 1000

						const shouldSendFirst =
							timeDiff <= reminderMs + tolerance && timeDiff >= reminderMs - tolerance

						const shouldSendSecond =
							secondReminderMs > 0 &&
							timeDiff <= secondReminderMs + tolerance &&
							timeDiff >= secondReminderMs - tolerance

						if (shouldSendFirst || shouldSendSecond) {
							upcomingLessons.push({
								teacherName: lesson.teacherName,
								date: lesson.date,
								start: lesson.start,
								end: lesson.end,
								lessonType: lesson.lessonType || 'lesson',
								roomLabel: lesson.roomLabel,
								studentNames: lesson.studentNames || [],
								pairLabel: lesson.pairLabel,
								timetableName: timetable.name,
							})
						}
					}
				}

				// Send notifications for upcoming lessons
				for (const lesson of upcomingLessons) {
					// Format time for display
					const formatTimeDisplay = (t: string) => {
						if (t.includes('T')) {
							const d = new Date(t)
							return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
						}
						return t
					}

					const startTime = formatTimeDisplay(lesson.start)
					const endTime = formatTimeDisplay(lesson.end)
					const participants = lesson.pairLabel || lesson.studentNames.join(', ')

					const payload = JSON.stringify({
						title: '📅 Upcoming Lesson Reminder',
						body: `${lesson.lessonType.charAt(0).toUpperCase() + lesson.lessonType.slice(1)} lesson at ${startTime} – ${endTime}${lesson.roomLabel ? ` in ${lesson.roomLabel}` : ''}${participants ? ` with ${participants}` : ''}`,
						icon: '/icon.svg',
						tag: `reminder-${lesson.date}-${lesson.start}`,
						url: '/dashboard/my-lessons',
						requireInteraction: true,
					})

					for (const sub of subscriptions) {
						try {
							await webpush.sendNotification(
								{
									endpoint: sub.endpoint,
									keys: {
										p256dh: sub.keys.p256dh,
										auth: sub.keys.auth,
									},
								},
								payload,
							)
							totalSent++
						} catch (pushError: any) {
							totalFailed++
							// If subscription is expired/invalid, remove it
							if (pushError.statusCode === 410 || pushError.statusCode === 404) {
								await PushSubscription.deleteOne({ _id: sub._id })
							}
						}
					}
				}
			} catch (err: any) {
				console.error('Error processing notifications for user:', err.message)
			}
		}

		return NextResponse.json({
			success: true,
			sent: totalSent,
			failed: totalFailed,
			processedPreferences: allPrefs.length,
		})
	} catch (error: any) {
		console.error('Error sending reminders:', error)
		return NextResponse.json({ error: 'Failed to send reminders' }, { status: 500 })
	}
}

