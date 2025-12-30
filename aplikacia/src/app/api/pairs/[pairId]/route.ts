import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import Pair from '@/models/Pair'
import User, { IWeeklyAvailability, ITimeWindow } from '@/models/User'
import jwt from 'jsonwebtoken'
import { cookies } from 'next/headers'

// Merge two time window arrays (union) - combine all windows
const mergeTimeWindows = (a: ITimeWindow[], b: ITimeWindow[]): ITimeWindow[] => {
	const allWindows = [...a, ...b]
	// Sort by start time
	allWindows.sort((w1, w2) => {
		const toMinutes = (time: string) => {
			const [h, m] = time.split(':').map(Number)
			return h * 60 + m
		}
		return toMinutes(w1.start) - toMinutes(w2.start)
	})
	
	// Merge overlapping windows
	const merged: ITimeWindow[] = []
	for (const window of allWindows) {
		if (merged.length === 0) {
			merged.push({ ...window })
		} else {
			const last = merged[merged.length - 1]
			const toMinutes = (time: string) => {
				const [h, m] = time.split(':').map(Number)
				return h * 60 + m
			}
			const lastEnd = toMinutes(last.end)
			const currentStart = toMinutes(window.start)
			
			if (currentStart <= lastEnd) {
				// Overlapping or adjacent, merge
				const currentEnd = toMinutes(window.end)
				const toTimeString = (minutes: number) => {
					const h = Math.floor(minutes / 60)
					const m = minutes % 60
					return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
				}
				last.end = toTimeString(Math.max(lastEnd, currentEnd))
			} else {
				merged.push({ ...window })
			}
		}
	}
	return merged
}

// Calculate couple unavailability as union of both partners' unavailability
// (times when EITHER partner cannot train)
const calculateCoupleUnavailability = (
	studentA: any,
	studentB: any
): IWeeklyAvailability | undefined => {
	const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const
	const result: IWeeklyAvailability = {
		timezone: studentA?.unavailability?.timezone || studentB?.unavailability?.timezone || 'UTC',
	}

	let hasUnavailability = false
	for (const day of days) {
		const aWindows = studentA?.unavailability?.[day] || []
		const bWindows = studentB?.unavailability?.[day] || []
		
		if (aWindows.length > 0 || bWindows.length > 0) {
			const merged = mergeTimeWindows(aWindows, bWindows)
			if (merged.length > 0) {
				result[day] = merged
				hasUnavailability = true
			}
		}
	}

	return hasUnavailability ? result : undefined
}

async function getCurrentUser() {
	const cookieStore = await cookies()
	const tokenCookie = cookieStore.get('token')
	const token = tokenCookie?.value

	if (!token) return null

	try {
		const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as any
		const user = await User.findById(decoded.userId)
		return user
	} catch {
		return null
	}
}

export async function PUT(
	request: NextRequest,
	{ params }: { params: Promise<{ pairId: string }> }
) {
	try {
		await connectDB()
		const { pairId } = await params
		const user = await getCurrentUser()
		if (!user) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}
		if (!user.clubId) {
			return NextResponse.json({ error: 'User not in a club' }, { status: 403 })
		}

		const pair = await Pair.findById(pairId)
		if (!pair) {
			return NextResponse.json({ error: 'Pair not found' }, { status: 404 })
		}

		if (pair.clubId.toString() !== user.clubId.toString()) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
		}

		const body = await request.json()
		const { studentAId, studentBId, baseGroup, preferredTeacherId } = body

		// If students are being changed, validate them
		if (studentAId || studentBId) {
			const newStudentAId = studentAId || pair.studentAId
			const newStudentBId = studentBId || pair.studentBId

			if (newStudentAId === newStudentBId) {
				return NextResponse.json({ error: 'A student cannot be paired with themselves' }, { status: 400 })
			}

			const studentA = await User.findById(newStudentAId)
			const studentB = await User.findById(newStudentBId)

			if (!studentA || !studentB) {
				return NextResponse.json({ error: 'One or both students not found' }, { status: 404 })
			}

			if (studentA.role !== 'student' || studentB.role !== 'student') {
				return NextResponse.json({ error: 'Both users must be students' }, { status: 400 })
			}

			if (studentA.clubId?.toString() !== user.clubId.toString() || studentB.clubId?.toString() !== user.clubId.toString()) {
				return NextResponse.json({ error: 'Both students must be in the same club' }, { status: 400 })
			}

			// Check if either student is already in another pair
			const existingPairA = await Pair.findOne({
				clubId: user.clubId,
				_id: { $ne: pairId },
				$or: [{ studentAId: newStudentAId }, { studentBId: newStudentAId }],
			})

			const existingPairB = await Pair.findOne({
				clubId: user.clubId,
				_id: { $ne: pairId },
				$or: [{ studentAId: newStudentBId }, { studentBId: newStudentBId }],
			})

			if (existingPairA || existingPairB) {
				return NextResponse.json({ error: 'One or both students are already in another pair' }, { status: 400 })
			}

			pair.studentAId = newStudentAId
			pair.studentBId = newStudentBId
			
			// Recalculate couple unavailability when students change
			const coupleUnavailability = calculateCoupleUnavailability(studentA, studentB)
			pair.unavailability = coupleUnavailability
		}

		// Update other fields
		if (baseGroup !== undefined) {
			pair.baseGroup = baseGroup || undefined
		}

		if (preferredTeacherId !== undefined) {
			if (preferredTeacherId) {
				const teacher = await User.findById(preferredTeacherId)
				if (!teacher || teacher.role !== 'trainer' || teacher.clubId?.toString() !== user.clubId.toString()) {
					return NextResponse.json({ error: 'Invalid preferred teacher' }, { status: 400 })
				}
			}
			pair.preferredTeacherId = preferredTeacherId || undefined
		}

		await pair.save()
		await pair.populate('studentAId', 'firstName lastName email')
		await pair.populate('studentBId', 'firstName lastName email')
		await pair.populate('preferredTeacherId', 'firstName lastName')

		return NextResponse.json({ pair })
	} catch (error: any) {
		console.error('Error updating pair:', error)
		return NextResponse.json({ error: error.message || 'Failed to update pair' }, { status: 500 })
	}
}

export async function DELETE(
	request: NextRequest,
	{ params }: { params: Promise<{ pairId: string }> }
) {
	try {
		await connectDB()
		const { pairId } = await params
		const user = await getCurrentUser()
		if (!user) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}
		if (!user.clubId) {
			return NextResponse.json({ error: 'User not in a club' }, { status: 403 })
		}

		const pair = await Pair.findById(pairId)
		if (!pair) {
			return NextResponse.json({ error: 'Pair not found' }, { status: 404 })
		}

		if (pair.clubId.toString() !== user.clubId.toString()) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
		}

		await Pair.findByIdAndDelete(pairId)

		return NextResponse.json({ message: 'Pair deleted successfully' })
	} catch (error: any) {
		console.error('Error deleting pair:', error)
		return NextResponse.json({ error: error.message || 'Failed to delete pair' }, { status: 500 })
	}
}

