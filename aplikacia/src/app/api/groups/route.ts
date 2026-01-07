import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import Group from '@/models/Group'
import Pair from '@/models/Pair'
import jwt from 'jsonwebtoken'
import { cookies } from 'next/headers'

async function getCurrentUser() {
	try {
		const cookieStore = await cookies()
		const token = cookieStore.get('token')?.value
		if (!token) return null
		const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string }
		const User = (await import('@/models/User')).default
		return await User.findById(decoded.userId)
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

		// Fetch all groups for this club
		const groups = await Group.find({ clubId: user.clubId })
			.sort({ name: 1 })
			.lean()

		// Count couples per group
		const groupCounts: Record<string, number> = {}
		const pairs = await Pair.find({ 
			clubId: user.clubId,
			$or: [
				{ baseGroups: { $exists: true, $ne: [] } },
				{ baseGroup: { $exists: true, $ne: null } },
				{ baseGroup: { $exists: true, $ne: '' } }
			]
		}).select('baseGroups baseGroup').lean()

		pairs.forEach(pair => {
			// Count baseGroups array
			if (pair.baseGroups && Array.isArray(pair.baseGroups)) {
				pair.baseGroups.forEach(groupId => {
					const id = typeof groupId === 'string' ? groupId : groupId.toString()
					groupCounts[id] = (groupCounts[id] || 0) + 1
				})
			}
			// Count legacy baseGroup (if it's an ObjectId string)
			if (pair.baseGroup) {
				const id = typeof pair.baseGroup === 'string' ? pair.baseGroup : pair.baseGroup.toString()
				groupCounts[id] = (groupCounts[id] || 0) + 1
			}
		})

		// Add couple count to each group
		const groupsWithCounts = groups.map((group: any) => ({
			...group,
			coupleCount: groupCounts[String(group._id)] || 0,
		}))

		return NextResponse.json({ groups: groupsWithCounts })
	} catch (error: any) {
		console.error('Error fetching groups:', error)
		return NextResponse.json({ error: error.message || 'Failed to fetch groups' }, { status: 500 })
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

		// Only trainers can create groups
		if (user.role !== 'trainer') {
			return NextResponse.json({ error: 'Forbidden: Only trainers can create groups' }, { status: 403 })
		}

		const body = await request.json()
		const { name, description, coupleIds } = body

		console.log('Creating group with:', { name, description, coupleIds, coupleIdsLength: coupleIds?.length })

		if (!name || !name.trim()) {
			return NextResponse.json({ error: 'Group name is required' }, { status: 400 })
		}

		// Check if group with same name already exists in this club
		const existingGroup = await Group.findOne({
			clubId: user.clubId,
			name: name.trim(),
		})

		if (existingGroup) {
			return NextResponse.json({ error: 'A group with this name already exists' }, { status: 400 })
		}

		// Create the group
		const newGroup = new Group({
			clubId: user.clubId,
			name: name.trim(),
			description: description?.trim() || undefined,
		})

		await newGroup.save()

		// Add group to selected couples if provided
		const groupIdStr = newGroup._id.toString()
		const updatedPairIds: string[] = []
		
		if (coupleIds && Array.isArray(coupleIds) && coupleIds.length > 0) {
			console.log(`[GROUP API] Processing ${coupleIds.length} couples for group ${groupIdStr}`)
			console.log(`[GROUP API] Couple IDs:`, coupleIds)
			
			// Process each couple
			for (const pairId of coupleIds) {
				try {
					console.log(`[GROUP API] Processing pair ${pairId}`)
					
					// Find the pair
					const pair = await Pair.findById(pairId)
					
					if (!pair) {
						console.error(`[GROUP API] Pair ${pairId} not found`)
						continue
					}
					
					// Verify club match
					if (!pair.clubId || pair.clubId.toString() !== user.clubId.toString()) {
						console.error(`[GROUP API] Pair ${pairId} club mismatch`)
						continue
					}

					// Get current groups array
					let currentGroups: string[] = []
					if (pair.baseGroups && Array.isArray(pair.baseGroups)) {
						currentGroups = pair.baseGroups.map((g: any) => String(g))
					}
					
					console.log(`[GROUP API] Current groups before update:`, currentGroups)
					console.log(`[GROUP API] Group ID to add:`, groupIdStr)
					
					// Check if already in group (compare as strings)
					if (currentGroups.some(g => String(g) === groupIdStr)) {
						console.log(`[GROUP API] Pair ${pairId} already in group ${groupIdStr}`)
						updatedPairIds.push(pairId)
						continue
					}
					
					// Add the group to the array (ensure it's a string)
					currentGroups.push(String(groupIdStr))
					console.log(`[GROUP API] Updated groups array:`, currentGroups)
					
					// Update the pair - explicitly set as array of strings
					pair.baseGroups = currentGroups.map(g => String(g))
					// Clear legacy baseGroup if it exists
					pair.baseGroup = undefined
					
					// Mark the field as modified to ensure it's saved
					pair.markModified('baseGroups')
					
					await pair.save()
					updatedPairIds.push(pairId)
					console.log(`[GROUP API] Successfully added group to pair ${pairId}`)
					console.log(`[GROUP API] Verified saved baseGroups:`, pair.baseGroups)
					
				} catch (error: any) {
					console.error(`[GROUP API] Error processing pair ${pairId}:`, error.message)
				}
			}
			
			console.log(`[GROUP API] Updated ${updatedPairIds.length} out of ${coupleIds.length} couples`)
		} else {
			console.log('[GROUP API] No coupleIds provided')
		}

		return NextResponse.json({ 
			group: newGroup,
			updatedPairs: updatedPairIds.length,
		}, { status: 201 })
	} catch (error: any) {
		console.error('Error creating group:', error)
		if (error.code === 11000) {
			return NextResponse.json({ error: 'A group with this name already exists' }, { status: 400 })
		}
		return NextResponse.json({ error: error.message || 'Failed to create group' }, { status: 500 })
	}
}