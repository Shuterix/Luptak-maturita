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

		// Only trainers can run migration
		if (user.role !== 'trainer') {
			return NextResponse.json({ error: 'Forbidden: Only trainers can run migration' }, { status: 403 })
		}

		// Find all pairs with legacy baseGroup field
		const pairsWithLegacyGroups = await Pair.find({
			clubId: user.clubId,
			baseGroup: { $exists: true, $ne: null, $ne: '' },
			$or: [
				{ baseGroups: { $exists: false } },
				{ baseGroups: [] },
			],
		})

		const migrationResults = {
			groupsCreated: 0,
			couplesUpdated: 0,
			errors: [] as string[],
		}

		// Get all existing groups for this club
		const existingGroups = await Group.find({ clubId: user.clubId })
		const groupNameMap = new Map<string, string>() // name -> _id
		existingGroups.forEach(g => {
			groupNameMap.set(g.name.toLowerCase(), g._id.toString())
		})

		// Process each pair
		for (const pair of pairsWithLegacyGroups) {
			const legacyGroupName = pair.baseGroup
			if (!legacyGroupName || typeof legacyGroupName !== 'string') continue

			try {
				// Check if group already exists (case-insensitive)
				let groupId = groupNameMap.get(legacyGroupName.toLowerCase())

				// If group doesn't exist, create it
				if (!groupId) {
					const newGroup = new Group({
						clubId: user.clubId,
						name: legacyGroupName,
						description: `Migrated from legacy group system`,
					})
					await newGroup.save()
					groupId = newGroup._id.toString()
					groupNameMap.set(legacyGroupName.toLowerCase(), groupId)
					migrationResults.groupsCreated++
				}

				// Update pair to use baseGroups array
				const currentBaseGroups = pair.baseGroups || []
				if (!currentBaseGroups.includes(groupId)) {
					pair.baseGroups = [...currentBaseGroups, groupId]
					pair.baseGroup = undefined // Clear legacy field
					await pair.save()
					migrationResults.couplesUpdated++
				}
			} catch (error: any) {
				migrationResults.errors.push(`Pair ${pair._id}: ${error.message}`)
			}
		}

		// Also handle pairs with baseGroups containing string names instead of IDs
		const pairsWithStringGroups = await Pair.find({
			clubId: user.clubId,
			baseGroups: { $exists: true, $ne: [] },
		})

		for (const pair of pairsWithStringGroups) {
			if (!pair.baseGroups || !Array.isArray(pair.baseGroups)) continue

			const updatedGroupIds: string[] = []
			let needsUpdate = false

			for (const groupValue of pair.baseGroups) {
				if (typeof groupValue === 'string') {
					// Check if it's already an ObjectId string (24 hex chars)
					if (/^[0-9a-fA-F]{24}$/.test(groupValue)) {
						// It's already an ID, keep it
						updatedGroupIds.push(groupValue)
					} else {
						// It's a string name, need to convert
						needsUpdate = true
						let groupId = groupNameMap.get(groupValue.toLowerCase())

						if (!groupId) {
							// Create the group
							const newGroup = new Group({
								clubId: user.clubId,
								name: groupValue,
								description: `Migrated from legacy group system`,
							})
							await newGroup.save()
							groupId = newGroup._id.toString()
							groupNameMap.set(groupValue.toLowerCase(), groupId)
							migrationResults.groupsCreated++
						}

						updatedGroupIds.push(groupId)
					}
				} else {
					// It's already an ObjectId, convert to string
					updatedGroupIds.push(groupValue.toString())
				}
			}

			if (needsUpdate) {
				pair.baseGroups = updatedGroupIds
				await pair.save()
				migrationResults.couplesUpdated++
			}
		}

		return NextResponse.json({
			message: 'Migration completed successfully',
			results: migrationResults,
		})
	} catch (error: any) {
		console.error('Error running migration:', error)
		return NextResponse.json({ error: error.message || 'Failed to run migration' }, { status: 500 })
	}
}

