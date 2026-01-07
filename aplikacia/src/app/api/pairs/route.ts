import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import Pair from '@/models/Pair'
import User, { IWeeklyAvailability, ITimeWindow } from '@/models/User'
import jwt from 'jsonwebtoken'
import { cookies } from 'next/headers'

// Merge two time window arrays (union) - combine all windows
const mergeTimeWindows = (a: ITimeWindow[], b: ITimeWindow[]): ITimeWindow[] => {
	// Filter out invalid windows (missing start or end)
	const validWindows = [...a, ...b].filter(w => w && w.start && w.end)
	
	if (validWindows.length === 0) return []
	
	const toMinutes = (time: string): number => {
		if (!time || typeof time !== 'string') return 0
		const parts = time.split(':')
		if (parts.length < 2) return 0
		const [h, m] = parts.map(Number)
		return (h || 0) * 60 + (m || 0)
	}
	
	const toTimeString = (minutes: number): string => {
		const h = Math.floor(minutes / 60)
		const m = minutes % 60
		return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
	}
	
	// Sort by start time
	validWindows.sort((w1, w2) => toMinutes(w1.start) - toMinutes(w2.start))
	
	// Merge overlapping windows
	const merged: ITimeWindow[] = []
	for (const window of validWindows) {
		if (merged.length === 0) {
			merged.push({ start: window.start, end: window.end })
		} else {
			const last = merged[merged.length - 1]
			const lastEnd = toMinutes(last.end)
			const currentStart = toMinutes(window.start)
			
			if (currentStart <= lastEnd) {
				// Overlapping or adjacent, merge
				const currentEnd = toMinutes(window.end)
				last.end = toTimeString(Math.max(lastEnd, currentEnd))
			} else {
				merged.push({ start: window.start, end: window.end })
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

	// Helper to get windows from either format (direct day props or nested days Map)
	const getWindows = (unavail: any, day: string): ITimeWindow[] => {
		if (!unavail) return []
		// Try direct day property first (new format)
		if (unavail[day] && Array.isArray(unavail[day])) {
			return unavail[day]
		}
		// Try nested days Map format (old format)
		if (unavail.days) {
			// Handle Map-like object
			if (unavail.days.get && typeof unavail.days.get === 'function') {
				return unavail.days.get(day) || []
			}
			// Handle plain object
			if (unavail.days[day] && Array.isArray(unavail.days[day])) {
				return unavail.days[day]
			}
		}
		return []
	}

	let hasUnavailability = false
	for (const day of days) {
		const aWindows = getWindows(studentA?.unavailability, day)
		const bWindows = getWindows(studentB?.unavailability, day)
		
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

export async function GET(request: NextRequest) {
	try {
		await connectDB()
		const user = await getCurrentUser()
		if (!user) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}
		if (!user.clubId) {
			return NextResponse.json({ error: 'User not in a club' }, { status: 403 })
		}

		const pairs = await Pair.find({ clubId: user.clubId })
			.select('+baseGroups +baseGroup') // Explicitly include baseGroups and baseGroup
			.populate('studentAId', 'firstName lastName email unavailability')
			.populate('studentBId', 'firstName lastName email unavailability')
			.populate('preferredTeacherId', 'firstName lastName')
			.sort({ createdAt: -1 })

		// Calculate couple unavailability for each pair using the populated student data
		const pairsWithUnavailability = await Promise.all(
			pairs.map(async (pair) => {
				// Get baseGroups directly from the mongoose document (before toObject)
				// This ensures we get the actual database value
				const baseGroupsRaw = (pair as any).baseGroups
				const baseGroupRaw = (pair as any).baseGroup
				
				// Convert the pair to a plain object to properly access nested properties
				const pairObj = pair.toObject()
				const studentA = pairObj.studentAId as any
				const studentB = pairObj.studentBId as any
				
				let calculatedUnavailability = pairObj.unavailability
				
				if (studentA && studentB && studentA.firstName && studentB.firstName) {
					// Calculate couple unavailability from populated student data
					calculatedUnavailability = calculateCoupleUnavailability(studentA, studentB)
					
					// Update the pair in the database with calculated unavailability
					// Use $set to only update unavailability without affecting other fields
					if (calculatedUnavailability) {
						await Pair.findByIdAndUpdate(
							pair._id, 
							{ $set: { unavailability: calculatedUnavailability } },
							{ new: false } // Don't return updated doc, just update
						)
					}
				}
				
				// Process baseGroups - convert to array of strings
				let baseGroupsValue: string[] | undefined = undefined
				if (baseGroupsRaw !== undefined && baseGroupsRaw !== null) {
					if (Array.isArray(baseGroupsRaw)) {
						baseGroupsValue = baseGroupsRaw.map((g: any) => String(g)).filter(Boolean)
					} else if (baseGroupsRaw) {
						baseGroupsValue = [String(baseGroupsRaw)]
					}
				}
				
				// If still undefined, check pairObj as fallback
				if (baseGroupsValue === undefined && pairObj.baseGroups !== undefined && pairObj.baseGroups !== null) {
					if (Array.isArray(pairObj.baseGroups)) {
						baseGroupsValue = pairObj.baseGroups.map((g: any) => String(g)).filter(Boolean)
					} else if (pairObj.baseGroups) {
						baseGroupsValue = [String(pairObj.baseGroups)]
					}
				}
				
				const baseGroupValue = baseGroupRaw || pairObj.baseGroup || undefined
				
				// Log for debugging (only first 3 to avoid spam)
				if (pairs.indexOf(pair) < 3) {
					console.log(`[PAIRS API] Pair ${pair._id}:`, {
						baseGroupsRaw: baseGroupsRaw,
						baseGroupsFromObj: pairObj.baseGroups,
						baseGroupsFinal: baseGroupsValue,
						baseGroupRaw: baseGroupRaw,
						baseGroupFinal: baseGroupValue
					})
				}
				
				// Build response object, explicitly including baseGroups
				const responseObj: any = {
					...pairObj,
					unavailability: calculatedUnavailability
				}
				
				// Always include baseGroups (even if undefined) so frontend knows it was checked
				if (baseGroupsValue !== undefined) {
					responseObj.baseGroups = baseGroupsValue
				}
				if (baseGroupValue !== undefined) {
					responseObj.baseGroup = baseGroupValue
				}
				
				return responseObj
			})
		)

		return NextResponse.json({ pairs: pairsWithUnavailability })
	} catch (error: any) {
		console.error('Error fetching pairs:', error)
		return NextResponse.json({ error: error.message || 'Failed to fetch pairs' }, { status: 500 })
	}
}

export async function POST(request: NextRequest) {
	try {
		await connectDB()
		const user = await getCurrentUser()
		if (!user) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}
		if (!user.clubId) {
			return NextResponse.json({ error: 'User not in a club' }, { status: 403 })
		}

		const body = await request.json()
		const { studentAId, studentBId, baseGroup, baseGroups, preferredTeacherId } = body

		if (!studentAId || !studentBId) {
			return NextResponse.json({ error: 'Both students are required' }, { status: 400 })
		}

		if (studentAId === studentBId) {
			return NextResponse.json({ error: 'A student cannot be paired with themselves' }, { status: 400 })
		}

		// Verify both students exist and are in the same club
		const studentA = await User.findById(studentAId)
		const studentB = await User.findById(studentBId)

		if (!studentA || !studentB) {
			return NextResponse.json({ error: 'One or both students not found' }, { status: 404 })
		}

		if (studentA.role !== 'student' || studentB.role !== 'student') {
			return NextResponse.json({ error: 'Both users must be students' }, { status: 400 })
		}

		if (studentA.clubId?.toString() !== user.clubId.toString() || studentB.clubId?.toString() !== user.clubId.toString()) {
			return NextResponse.json({ error: 'Both students must be in the same club' }, { status: 400 })
		}

		// Check if either student is already in a pair
		const existingPairA = await Pair.findOne({
			clubId: user.clubId,
			$or: [{ studentAId: studentAId }, { studentBId: studentAId }],
		})

		const existingPairB = await Pair.findOne({
			clubId: user.clubId,
			$or: [{ studentAId: studentBId }, { studentBId: studentBId }],
		})

		if (existingPairA || existingPairB) {
			return NextResponse.json({ error: 'One or both students are already in a pair' }, { status: 400 })
		}

		// Verify preferred teacher if provided
		if (preferredTeacherId) {
			const teacher = await User.findById(preferredTeacherId)
			if (!teacher || teacher.role !== 'trainer' || teacher.clubId?.toString() !== user.clubId.toString()) {
				return NextResponse.json({ error: 'Invalid preferred teacher' }, { status: 400 })
			}
		}

		// Calculate couple unavailability from both students' individual unavailability
		const coupleUnavailability = calculateCoupleUnavailability(studentA, studentB)

		const newPair = new Pair({
			clubId: user.clubId,
			studentAId,
			studentBId,
			baseGroups: baseGroups && Array.isArray(baseGroups) && baseGroups.length > 0 ? baseGroups : undefined,
			baseGroup: undefined, // Clear legacy field
			preferredTeacherId: preferredTeacherId || undefined,
			unavailability: coupleUnavailability,
		})

		await newPair.save()
		await newPair.populate('studentAId', 'firstName lastName email unavailability')
		await newPair.populate('studentBId', 'firstName lastName email unavailability')
		await newPair.populate('preferredTeacherId', 'firstName lastName')

		return NextResponse.json({ pair: newPair }, { status: 201 })
	} catch (error: any) {
		console.error('Error creating pair:', error)
		return NextResponse.json({ error: error.message || 'Failed to create pair' }, { status: 500 })
	}
}

