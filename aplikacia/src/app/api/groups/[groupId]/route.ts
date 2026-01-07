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

export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ groupId: string }> }
) {
	try {
		await connectDB()
		const { groupId } = await params
		const user = await getCurrentUser()
		
		if (!user) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}
		if (!user.clubId) {
			return NextResponse.json({ error: 'User not in a club' }, { status: 403 })
		}

		const group = await Group.findOne({
			_id: groupId,
			clubId: user.clubId,
		}).lean()

		if (!group) {
			return NextResponse.json({ error: 'Group not found' }, { status: 404 })
		}

		// Count couples in this group
		const coupleCount = await Pair.countDocuments({
			clubId: user.clubId,
			baseGroups: groupId,
		})

		return NextResponse.json({ 
			group: {
				...group,
				coupleCount,
			}
		})
	} catch (error: any) {
		console.error('Error fetching group:', error)
		return NextResponse.json({ error: error.message || 'Failed to fetch group' }, { status: 500 })
	}
}

export async function PUT(
	request: NextRequest,
	{ params }: { params: Promise<{ groupId: string }> }
) {
	try {
		await connectDB()
		const { groupId } = await params
		const user = await getCurrentUser()
		
		if (!user) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}
		if (!user.clubId) {
			return NextResponse.json({ error: 'User not in a club' }, { status: 403 })
		}

		// Only trainers can update groups
		if (user.role !== 'trainer') {
			return NextResponse.json({ error: 'Forbidden: Only trainers can update groups' }, { status: 403 })
		}

		const group = await Group.findOne({
			_id: groupId,
			clubId: user.clubId,
		})

		if (!group) {
			return NextResponse.json({ error: 'Group not found' }, { status: 404 })
		}

		const body = await request.json()
		const { name, description, coupleIds } = body

		// If name is being changed, check for duplicates
		if (name && name.trim() !== group.name) {
			const existingGroup = await Group.findOne({
				clubId: user.clubId,
				name: name.trim(),
				_id: { $ne: groupId },
			})

			if (existingGroup) {
				return NextResponse.json({ error: 'A group with this name already exists' }, { status: 400 })
			}

			group.name = name.trim()
		}

		if (description !== undefined) {
			group.description = description?.trim() || undefined
		}

		await group.save()

		// Update couples if coupleIds is provided
		if (coupleIds !== undefined) {
			const groupIdStr = String(groupId)
			
			// Get all pairs in this club
			const allPairs = await Pair.find({ clubId: user.clubId })
			
			// Update each pair
			for (const pair of allPairs) {
				const currentGroups: string[] = (pair.baseGroups || []).map(g => String(g))
				const shouldHaveGroup = coupleIds.includes(pair._id.toString())
				const hasGroup = currentGroups.some(g => String(g) === groupIdStr)
				
				if (hasGroup && !shouldHaveGroup) {
					// Remove from group
					const updatedGroups = currentGroups.filter(g => String(g) !== groupIdStr)
					pair.baseGroups = updatedGroups.length > 0 ? updatedGroups.map(g => String(g)) : undefined
					pair.baseGroup = undefined // Clear legacy field
					pair.markModified('baseGroups')
					await pair.save()
				} else if (!hasGroup && shouldHaveGroup) {
					// Add to group
					const updatedGroups = [...currentGroups, String(groupIdStr)]
					pair.baseGroups = updatedGroups.map(g => String(g))
					pair.baseGroup = undefined // Clear legacy field
					pair.markModified('baseGroups')
					await pair.save()
				}
			}
		}

		return NextResponse.json({ 
			group,
			message: coupleIds !== undefined ? 'Group and couples updated successfully' : 'Group updated successfully'
		})
	} catch (error: any) {
		console.error('Error updating group:', error)
		if (error.code === 11000) {
			return NextResponse.json({ error: 'A group with this name already exists' }, { status: 400 })
		}
		return NextResponse.json({ error: error.message || 'Failed to update group' }, { status: 500 })
	}
}

export async function DELETE(
	request: NextRequest,
	{ params }: { params: Promise<{ groupId: string }> }
) {
	try {
		await connectDB()
		const { groupId } = await params
		const user = await getCurrentUser()
		
		if (!user) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}
		if (!user.clubId) {
			return NextResponse.json({ error: 'User not in a club' }, { status: 403 })
		}

		// Only trainers can delete groups
		if (user.role !== 'trainer') {
			return NextResponse.json({ error: 'Forbidden: Only trainers can delete groups' }, { status: 403 })
		}

		const group = await Group.findOne({
			_id: groupId,
			clubId: user.clubId,
		})

		if (!group) {
			return NextResponse.json({ error: 'Group not found' }, { status: 404 })
		}

		// Remove group from all pairs that have it
		const groupIdStr = groupId.toString()
		await Pair.updateMany(
			{
				clubId: user.clubId,
				baseGroups: groupIdStr,
			},
			{
				$pull: { baseGroups: groupIdStr },
			}
		)

		// Delete the group
		await Group.findByIdAndDelete(groupId)

		return NextResponse.json({ message: 'Group deleted successfully' })
	} catch (error: any) {
		console.error('Error deleting group:', error)
		return NextResponse.json({ error: error.message || 'Failed to delete group' }, { status: 500 })
	}
}