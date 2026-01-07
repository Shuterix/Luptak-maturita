'use client'

import { useEffect, useState, useMemo } from 'react'
import { useAuth } from '@/context/AuthContext'
import { Button, Input, Alert } from '@/components'
import { showAlertToast } from '@/components/toast/Toast'

interface Student {
	_id: string
	firstName: string
	lastName: string
	email: string
}

interface Teacher {
	_id: string
	firstName: string
	lastName: string
}

interface Group {
	_id: string
	name: string
	description?: string
	coupleCount?: number
}

interface Pair {
	_id: string
	studentAId: Student
	studentBId: Student
	baseGroup?: string // Legacy field
	baseGroups?: string[] // Array of group IDs
	preferredTeacherId?: Teacher
	createdAt?: string
}

export default function CouplesPage() {
	const { user, isLoading: authLoading, refreshUser } = useAuth()
	const [pairs, setPairs] = useState<Pair[]>([])
	const [students, setStudents] = useState<Student[]>([])
	const [teachers, setTeachers] = useState<Teacher[]>([])
	const [availableGroups, setAvailableGroups] = useState<Group[]>([])
	const [loading, setLoading] = useState(true)
	const [submitting, setSubmitting] = useState(false)
	const [deletingId, setDeletingId] = useState<string | null>(null)
	const [error, setError] = useState<string | null>(null)
	const [isModalOpen, setIsModalOpen] = useState(false)
	const [editingPair, setEditingPair] = useState<Pair | null>(null)
	const [deleteConfirmPair, setDeleteConfirmPair] = useState<Pair | null>(null)
	const [filters, setFilters] = useState({
		baseGroup: '',
		preferredTeacher: '',
		search: '',
	})
	const [sortConfig, setSortConfig] = useState<{
		key: 'partnerA' | 'partnerB' | 'baseGroup' | 'teacher' | null
		direction: 'asc' | 'desc'
	}>({ key: null, direction: 'asc' })
	const [formData, setFormData] = useState<{
		studentAId: string
		studentBId: string
		baseGroup: string
		baseGroups?: string[]
		preferredTeacherId: string
	}>({
		studentAId: '',
		studentBId: '',
		baseGroup: '',
		baseGroups: [],
		preferredTeacherId: '',
	})
	const [selectedGroupsForCouple, setSelectedGroupsForCouple] = useState<Set<string>>(new Set())
	
	// Group management state
	const [isGroupModalOpen, setIsGroupModalOpen] = useState(false)
	const [editingGroup, setEditingGroup] = useState<Group | null>(null)
	const [groupFormData, setGroupFormData] = useState({
		name: '',
		description: '',
	})
	const [selectedCouplesForGroup, setSelectedCouplesForGroup] = useState<Set<string>>(new Set())
	const [creatingGroup, setCreatingGroup] = useState(false)
	const [deletingGroupId, setDeletingGroupId] = useState<string | null>(null)
	const [groupError, setGroupError] = useState<string | null>(null)

	useEffect(() => {
		// Wait for AuthContext to finish loading
		if (authLoading) return

		if (user === null) {
			// User is not authenticated
			setLoading(false)
			setError('Please log in to manage couples')
			return
		}

		// If user is a trainer but doesn't have clubId, try refreshing once
		if (!user.clubId && user.role === 'trainer') {
			refreshUser().catch(() => {
				setLoading(false)
				setError('You must be in a club to manage couples. Please create or join a club first.')
			})
			return
		}

		if (user?.clubId) {
			// Fetch all data in parallel
			Promise.all([fetchPairs(), fetchStudents(), fetchTeachers(), fetchGroups()])
		} else {
			// User is loaded but doesn't have a clubId
			setLoading(false)
			setError('You must be in a club to manage couples')
		}
	}, [user?.clubId, user, authLoading, refreshUser])

	// Handle the case where user gets refreshed and now has clubId
	useEffect(() => {
		if (!authLoading && user?.clubId && loading && pairs.length === 0 && students.length === 0 && !error) {
			Promise.all([fetchPairs(), fetchStudents(), fetchTeachers(), fetchGroups()])
		}
	}, [user?.clubId, authLoading, loading, pairs.length, students.length, error])

	const fetchPairs = async () => {
		try {
			const res = await fetch('/api/pairs', { cache: 'no-store' })
			if (!res.ok) {
				const errorData = await res.json().catch(() => ({}))
				throw new Error(errorData.error || 'Failed to fetch pairs')
			}
			const data = await res.json()
			console.log('Fetched pairs:', data.pairs?.length, 'pairs')
			// Log first pair's baseGroups for debugging
			if (data.pairs && data.pairs.length > 0) {
				console.log('First pair baseGroups:', data.pairs[0].baseGroups, 'baseGroup:', data.pairs[0].baseGroup)
			}
			setPairs(data.pairs || [])
			setError(null)
		} catch (err: any) {
			console.error('Error fetching pairs:', err)
			setError(err.message || 'Failed to fetch pairs')
			setPairs([])
		} finally {
			setLoading(false)
		}
	}

	const fetchStudents = async () => {
		try {
			if (!user?.clubId) return
			// Use user.clubId directly instead of fetching /api/users/me again
			const studentsRes = await fetch(`/api/users?clubId=${user.clubId}&role=student`, { cache: 'no-store' })
			if (studentsRes.ok) {
				const studentsData = await studentsRes.json()
				setStudents(studentsData.users || [])
			}
		} catch (err) {
			console.error('Error fetching students:', err)
		}
	}

	const fetchTeachers = async () => {
		try {
			if (!user?.clubId) return
			// Use user.clubId directly instead of fetching /api/users/me again
			const teachersRes = await fetch(`/api/users?clubId=${user.clubId}&role=trainer`, { cache: 'no-store' })
			if (teachersRes.ok) {
				const teachersData = await teachersRes.json()
				setTeachers(teachersData.users || [])
			}
		} catch (err) {
			console.error('Error fetching teachers:', err)
		}
	}

	const fetchGroups = async () => {
		try {
			const res = await fetch('/api/groups', { cache: 'no-store' })
			if (res.ok) {
				const data = await res.json()
				setAvailableGroups(data.groups || [])
				
				// Check if migration is needed (pairs with legacy baseGroup but no matching Group)
				const needsMigration = pairs.some(p => {
					if (p.baseGroup && typeof p.baseGroup === 'string') {
						// Check if there's a group with this name
						const hasMatchingGroup = data.groups.some((g: Group) => 
							g.name.toLowerCase() === p.baseGroup?.toLowerCase()
						)
						return !hasMatchingGroup
					}
					return false
				})

				if (needsMigration && user?.role === 'trainer') {
					// Auto-run migration
					try {
						await fetch('/api/groups/migrate', { method: 'POST' })
						// Refresh groups and pairs after migration
						await Promise.all([fetchGroups(), fetchPairs()])
					} catch (err) {
						console.error('Error running migration:', err)
					}
				}
			}
		} catch (err) {
			console.error('Error fetching groups:', err)
		}
	}

	const handleOpenModal = (pair?: Pair) => {
		setError(null) // Clear any previous errors
		if (pair) {
			setEditingPair(pair)
			// Get groups from baseGroups array (should be group IDs)
			const groups = pair.baseGroups || []
			setSelectedGroupsForCouple(new Set(groups))
			setFormData({
				studentAId: pair.studentAId._id,
				studentBId: pair.studentBId._id,
				baseGroup: '', // Legacy - not used
				baseGroups: groups,
				preferredTeacherId: pair.preferredTeacherId?._id || '',
			})
		} else {
			setEditingPair(null)
			setSelectedGroupsForCouple(new Set())
			setFormData({
				studentAId: '',
				studentBId: '',
				baseGroup: '',
				baseGroups: [],
				preferredTeacherId: '',
			})
		}
		setIsModalOpen(true)
	}

	const handleCloseModal = () => {
		setIsModalOpen(false)
		setEditingPair(null)
		setSelectedGroupsForCouple(new Set())
		setFormData({
			studentAId: '',
			studentBId: '',
			baseGroup: '',
			baseGroups: [],
			preferredTeacherId: '',
		})
	}

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		setError(null)
		setSubmitting(true)

		if (!formData.studentAId || !formData.studentBId) {
			setError('Please select both students')
			setSubmitting(false)
			return
		}

		if (formData.studentAId === formData.studentBId) {
			setError('A student cannot be paired with themselves')
			setSubmitting(false)
			return
		}

		try {
			const url = editingPair ? `/api/pairs/${editingPair._id}` : '/api/pairs'
			const method = editingPair ? 'PUT' : 'POST'

			const res = await fetch(url, {
				method,
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					studentAId: formData.studentAId,
					studentBId: formData.studentBId,
					baseGroups: Array.from(selectedGroupsForCouple).length > 0 ? Array.from(selectedGroupsForCouple) : undefined,
					baseGroup: undefined, // Clear legacy field
					preferredTeacherId: formData.preferredTeacherId || undefined,
				}),
			})

			if (!res.ok) {
				const data = await res.json()
				throw new Error(data.error || 'Failed to save pair')
			}

			showAlertToast(editingPair ? 'Couple updated successfully' : 'Couple created successfully', {
				variant: 'success',
				title: 'Success',
			})

			handleCloseModal()
			// Refresh both pairs and students (in case availability changed)
			await Promise.all([fetchPairs(), fetchStudents()])
		} catch (err: any) {
			setError(err.message)
		} finally {
			setSubmitting(false)
		}
	}

	const handleDeleteClick = (pair: Pair) => {
		setDeleteConfirmPair(pair)
	}

	const handleDeleteConfirm = async () => {
		if (!deleteConfirmPair) return

		const pairId = deleteConfirmPair._id
		setDeletingId(pairId)
		setDeleteConfirmPair(null)

		try {
			const res = await fetch(`/api/pairs/${pairId}`, { method: 'DELETE' })
			if (!res.ok) {
				const data = await res.json().catch(() => ({}))
				throw new Error(data.error || 'Failed to delete couple')
			}

			showAlertToast('Couple deleted successfully', { variant: 'success', title: 'Success' })
			// Refresh both pairs and students (students become available again)
			await Promise.all([fetchPairs(), fetchStudents()])
		} catch (err: any) {
			setError(err.message)
			showAlertToast(err.message, { variant: 'error', title: 'Error' })
		} finally {
			setDeletingId(null)
		}
	}

	const getStudentName = (student: Student) => `${student.firstName} ${student.lastName}`

	// Memoize available students calculation
	const availableStudents = useMemo(() => {
		const pairedStudentIds = new Set<string>()
		pairs.forEach((pair) => {
			pairedStudentIds.add(pair.studentAId._id)
			pairedStudentIds.add(pair.studentBId._id)
		})

		// If editing, include the current pair's students
		if (editingPair) {
			pairedStudentIds.delete(editingPair.studentAId._id)
			pairedStudentIds.delete(editingPair.studentBId._id)
		}

		return students.filter((student) => !pairedStudentIds.has(student._id))
	}, [pairs, students, editingPair])

	// Filter and sort pairs
	const filteredAndSortedPairs = useMemo(() => {
		let filtered = pairs.filter((pair) => {
			// Filter by base group (check both baseGroup and baseGroups)
			if (filters.baseGroup) {
				const hasGroup = pair.baseGroup === filters.baseGroup || 
					(pair.baseGroups && pair.baseGroups.includes(filters.baseGroup))
				if (!hasGroup) return false
			}

			// Filter by preferred teacher
			if (filters.preferredTeacher) {
				if (!pair.preferredTeacherId || pair.preferredTeacherId._id !== filters.preferredTeacher) return false
			}

			// Filter by search (partner names)
			if (filters.search) {
				const searchLower = filters.search.toLowerCase()
				const partnerA = getStudentName(pair.studentAId).toLowerCase()
				const partnerB = getStudentName(pair.studentBId).toLowerCase()
				if (!partnerA.includes(searchLower) && !partnerB.includes(searchLower)) return false
			}

			return true
		})

		// Sort
		if (sortConfig.key) {
			filtered = [...filtered].sort((a, b) => {
				let aVal: string
				let bVal: string

				switch (sortConfig.key) {
					case 'partnerA':
						aVal = getStudentName(a.studentAId)
						bVal = getStudentName(b.studentAId)
						break
					case 'partnerB':
						aVal = getStudentName(a.studentBId)
						bVal = getStudentName(b.studentBId)
						break
					case 'baseGroup':
						// Get first group from baseGroups array or use legacy baseGroup
						aVal = (a.baseGroups && a.baseGroups.length > 0) ? a.baseGroups[0] : (a.baseGroup || '')
						bVal = (b.baseGroups && b.baseGroups.length > 0) ? b.baseGroups[0] : (b.baseGroup || '')
						break
					case 'teacher':
						aVal = a.preferredTeacherId
							? `${a.preferredTeacherId.firstName} ${a.preferredTeacherId.lastName}`
							: ''
						bVal = b.preferredTeacherId
							? `${b.preferredTeacherId.firstName} ${b.preferredTeacherId.lastName}`
							: ''
						break
					default:
						return 0
				}

				if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1
				if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1
				return 0
			})
		}

		return filtered
	}, [pairs, filters, sortConfig])

	const handleSort = (key: 'partnerA' | 'partnerB' | 'baseGroup' | 'teacher') => {
		setSortConfig((prev) => ({
			key,
			direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
		}))
	}

	// Group management functions
	const handleOpenGroupModal = (group?: Group) => {
		setGroupError(null)
		if (group) {
			setEditingGroup(group)
			setGroupFormData({
				name: group.name,
				description: group.description || '',
			})
			// Find couples in this group
			const coupleIds = pairs
				.filter(p => p.baseGroups?.includes(group._id))
				.map(p => p._id)
			setSelectedCouplesForGroup(new Set(coupleIds))
		} else {
			setEditingGroup(null)
			setGroupFormData({
				name: '',
				description: '',
			})
			setSelectedCouplesForGroup(new Set())
		}
		setIsGroupModalOpen(true)
	}

	const handleCloseGroupModal = () => {
		setIsGroupModalOpen(false)
		setEditingGroup(null)
		setGroupFormData({
			name: '',
			description: '',
		})
		setSelectedCouplesForGroup(new Set())
		setGroupError(null)
	}

	const handleCreateOrUpdateGroup = async (e: React.FormEvent) => {
		e.preventDefault()
		setGroupError(null)
		setCreatingGroup(true)

		if (!groupFormData.name.trim()) {
			setGroupError('Group name is required')
			setCreatingGroup(false)
			return
		}

		try {
			const coupleIds = Array.from(selectedCouplesForGroup)
			const url = editingGroup ? `/api/groups/${editingGroup._id}` : '/api/groups'
			const method = editingGroup ? 'PUT' : 'POST'

			const res = await fetch(url, {
				method,
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: groupFormData.name.trim(),
					description: groupFormData.description.trim() || undefined,
					coupleIds: coupleIds,
				}),
			})

			if (!res.ok) {
				const data = await res.json()
				throw new Error(data.error || `Failed to ${editingGroup ? 'update' : 'create'} group`)
			}

			const responseData = await res.json()
			showAlertToast(
				editingGroup 
					? 'Group updated successfully' 
					: `Group created successfully${responseData.updatedPairs ? `. ${responseData.updatedPairs} couple(s) added.` : ''}`,
				{ variant: 'success', title: 'Success' }
			)

			handleCloseGroupModal()
			// Refresh groups and pairs
			await Promise.all([fetchGroups(), fetchPairs()])
		} catch (err: any) {
			setGroupError(err.message)
		} finally {
			setCreatingGroup(false)
		}
	}

	const handleDeleteGroup = async (groupId: string) => {
		if (!confirm('Are you sure you want to delete this group? Couples will be removed from this group but not deleted.')) {
			return
		}

		setDeletingGroupId(groupId)
		setGroupError(null)

		try {
			const res = await fetch(`/api/groups/${groupId}`, {
				method: 'DELETE',
			})

			if (!res.ok) {
				const data = await res.json()
				throw new Error(data.error || 'Failed to delete group')
			}

			showAlertToast('Group deleted successfully', { variant: 'success', title: 'Success' })
			// Refresh groups and pairs
			await Promise.all([fetchGroups(), fetchPairs()])
		} catch (err: any) {
			setGroupError(err.message)
			showAlertToast(err.message, { variant: 'error', title: 'Error' })
		} finally {
			setDeletingGroupId(null)
		}
	}

	if (loading) {
		return (
			<div className="flex items-center justify-center min-h-screen">
				<span className="loading loading-spinner loading-lg"></span>
			</div>
		)
	}

	return (
		<div className="max-w-6xl mx-auto px-6 py-10 space-y-6">
			<header className="flex flex-wrap items-center justify-between gap-4">
				<div>
					<h1 className="text-3xl font-semibold">Couples Management</h1>
					<p className="text-base-content/60">Create and manage dance couples, assign them to groups</p>
				</div>
				<div className="flex gap-2">
					<Button className="btn-primary" onClick={() => handleOpenModal()}>
						Create Couple
					</Button>
				</div>
			</header>

			{error && (
				<Alert variant="error" className="max-w-3xl">
					{error}
				</Alert>
			)}

			{/* Statistics Card */}
			<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
				<div className="stat bg-base-100 rounded-2xl border border-base-300 shadow-sm">
					<div className="stat-title">Total Couples</div>
					<div className="stat-value text-primary">{pairs.length}</div>
				</div>
				<div className="stat bg-base-100 rounded-2xl border border-base-300 shadow-sm">
					<div className="stat-title">Available Students</div>
					<div className="stat-value text-secondary">{availableStudents.length}</div>
					<div className="stat-desc">out of {students.length} total</div>
				</div>
				<div className="stat bg-base-100 rounded-2xl border border-base-300 shadow-sm">
					<div className="stat-title">Teachers</div>
					<div className="stat-value text-accent">{teachers.length}</div>
				</div>
			</div>

			{students.length === 0 && !loading && (
				<div className="alert alert-info">
					<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
					</svg>
					<span>No students found. Please add students through the Users page.</span>
				</div>
			)}

			{/* Groups Management Section */}
			<div className="card bg-base-100 shadow-sm border border-base-300 rounded-2xl">
				<div className="card-body">
					<div className="flex flex-wrap items-center justify-between gap-4 mb-4">
						<h2 className="card-title">Groups Management</h2>
						<Button
							className="btn-primary btn-sm"
							onClick={() => handleOpenGroupModal()}
						>
							+ Create Group
						</Button>
					</div>

					{groupError && (
						<Alert variant="error" className="mb-4">
							{groupError}
						</Alert>
					)}

					{availableGroups.length === 0 ? (
						<p className="text-base-content/60">
							No groups created yet. Create a group to organize your couples.
						</p>
					) : (
						<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
							{availableGroups.map((group) => (
								<div
									key={group._id}
									className="p-4 bg-base-200 rounded-lg border border-base-300 hover:border-primary/50 transition"
								>
									<div className="flex items-start justify-between gap-2 mb-2">
										<div className="flex-1">
											<h3 className="font-semibold text-base-content mb-1">{group.name}</h3>
											{group.description && (
												<p className="text-sm text-base-content/60 line-clamp-2">{group.description}</p>
											)}
										</div>
									</div>
									<div className="flex items-center justify-between mt-3 pt-3 border-t border-base-300">
										<span className="text-xs text-base-content/60">
											{group.coupleCount || 0} couple{(group.coupleCount || 0) !== 1 ? 's' : ''}
										</span>
										<div className="flex gap-2">
											<Button
												className="btn-ghost btn-xs"
												onClick={() => handleOpenGroupModal(group)}
											>
												Edit
											</Button>
											<Button
												className="btn-ghost btn-xs text-error hover:bg-error/10"
												onClick={() => handleDeleteGroup(group._id)}
												disabled={deletingGroupId === group._id}
											>
												{deletingGroupId === group._id ? (
													<span className="loading loading-spinner loading-xs"></span>
												) : (
													'Delete'
												)}
											</Button>
										</div>
									</div>
								</div>
							))}
						</div>
					)}
				</div>
			</div>

			<div className="card bg-base-100 shadow-sm border border-base-300 rounded-2xl">
				<div className="card-body">
					<div className="flex flex-wrap items-center justify-between gap-4 mb-4">
						<h2 className="card-title">All Couples</h2>
						<div className="flex flex-wrap gap-2">
							{/* Search Filter */}
							<input
								type="text"
								placeholder="Search couples..."
								className="input input-bordered input-sm w-48"
								value={filters.search}
								onChange={(e) => setFilters({ ...filters, search: e.target.value })}
							/>
							{/* Base Group Filter */}
							<select
								className="select select-bordered select-sm w-40"
								value={filters.baseGroup}
								onChange={(e) => setFilters({ ...filters, baseGroup: e.target.value })}
							>
								<option value="">All Groups</option>
								{availableGroups.map((group) => (
									<option key={group._id} value={group._id}>
										{group.name}
									</option>
								))}
							</select>
							{/* Teacher Filter */}
							<select
								className="select select-bordered select-sm w-48"
								value={filters.preferredTeacher}
								onChange={(e) => setFilters({ ...filters, preferredTeacher: e.target.value })}
							>
								<option value="">All Teachers</option>
								{teachers.map((teacher) => (
									<option key={teacher._id} value={teacher._id}>
										{teacher.firstName} {teacher.lastName}
									</option>
								))}
							</select>
							{/* Clear Filters */}
							{(filters.search || filters.baseGroup || filters.preferredTeacher) && (
								<Button
									className="btn-ghost btn-sm"
									onClick={() => setFilters({ baseGroup: '', preferredTeacher: '', search: '' })}
								>
									Clear
								</Button>
							)}
						</div>
					</div>

					{filteredAndSortedPairs.length === 0 ? (
						<p className="text-base-content/60">
							{pairs.length === 0
								? 'No couples created yet. Create your first couple to get started.'
								: 'No couples match the current filters.'}
						</p>
					) : (
						<>
							{/* Mobile Card View */}
							<div className="grid gap-3 sm:hidden">
								{filteredAndSortedPairs.map((pair) => (
									<div key={pair._id} className="bg-base-100 rounded-xl border border-base-300 p-4 space-y-3">
										<div className="flex items-start justify-between">
											<div>
												<p className="font-semibold text-base-content">
													{getStudentName(pair.studentAId)} & {getStudentName(pair.studentBId)}
												</p>
												<div className="flex flex-wrap gap-2 mt-2">
													{pair.baseGroups && pair.baseGroups.length > 0 && (
														<>
															{pair.baseGroups.map(g => {
																// Try to find by ID first (new system)
																let group = availableGroups.find(gr => gr._id === g)
																// If not found, try to find by name (legacy system)
																if (!group) {
																	group = availableGroups.find(gr => gr.name === g)
																}
																// If still not found, it might be a legacy string name
																return group ? (
																	<span key={g} className="badge badge-outline badge-sm">{group.name}</span>
																) : (
																	<span key={g} className="badge badge-outline badge-sm">{g}</span>
																)
															})}
														</>
													)}
													{pair.baseGroup && (!pair.baseGroups || pair.baseGroups.length === 0) && (
														<span className="badge badge-outline badge-sm">{pair.baseGroup}</span>
													)}
													{pair.preferredTeacherId && (
														<span className="badge badge-ghost badge-sm">
															{pair.preferredTeacherId.firstName} {pair.preferredTeacherId.lastName}
														</span>
													)}
												</div>
											</div>
										</div>
										<div className="flex gap-2 pt-2 border-t border-base-200">
											<Button className="btn-ghost btn-sm flex-1" onClick={() => handleOpenModal(pair)}>
												Edit
											</Button>
											<Button
												className="btn-ghost btn-sm flex-1 text-error"
												onClick={() => handleDeleteClick(pair)}
												disabled={deletingId === pair._id}
											>
												{deletingId === pair._id ? (
													<span className="loading loading-spinner loading-xs"></span>
												) : (
													'Delete'
												)}
											</Button>
										</div>
									</div>
								))}
							</div>

							{/* Desktop Table View */}
							<div className="overflow-x-auto hidden sm:block">
							<table className="table table-zebra">
								<thead>
									<tr>
										<th>
											<button
												className="flex items-center gap-1 hover:text-primary"
												onClick={() => handleSort('partnerA')}
											>
												Partner A
												{sortConfig.key === 'partnerA' && (
													<span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
												)}
											</button>
										</th>
										<th>
											<button
												className="flex items-center gap-1 hover:text-primary"
												onClick={() => handleSort('partnerB')}
											>
												Partner B
												{sortConfig.key === 'partnerB' && (
													<span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
												)}
											</button>
										</th>
										<th>
											<button
												className="flex items-center gap-1 hover:text-primary"
												onClick={() => handleSort('baseGroup')}
											>
												Base Group
												{sortConfig.key === 'baseGroup' && (
													<span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
												)}
											</button>
										</th>
										<th>
											<button
												className="flex items-center gap-1 hover:text-primary"
												onClick={() => handleSort('teacher')}
											>
												Preferred Teacher
												{sortConfig.key === 'teacher' && (
													<span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
												)}
											</button>
										</th>
										<th>Actions</th>
									</tr>
								</thead>
								<tbody>
									{filteredAndSortedPairs.map((pair) => (
										<tr key={pair._id}>
											<td>{getStudentName(pair.studentAId)}</td>
											<td>{getStudentName(pair.studentBId)}</td>
											<td>
												{pair.baseGroups && pair.baseGroups.length > 0 ? (
													<div className="flex flex-wrap gap-1">
														{pair.baseGroups.map(g => {
															// Try to find by ID first (new system)
															let group = availableGroups.find(gr => gr._id === g)
															// If not found, try to find by name (legacy system)
															if (!group) {
																group = availableGroups.find(gr => gr.name === g)
															}
															// If still not found, it might be a legacy string name
															return group ? (
																<span key={g} className="badge badge-outline">{group.name}</span>
															) : (
																<span key={g} className="badge badge-outline">{g}</span>
															)
														})}
													</div>
												) : pair.baseGroup ? (
													<span className="badge badge-outline">{pair.baseGroup}</span>
												) : (
													<span className="text-base-content/40">—</span>
												)}
											</td>
											<td>
												{pair.preferredTeacherId ? (
													`${pair.preferredTeacherId.firstName} ${pair.preferredTeacherId.lastName}`
												) : (
													<span className="text-base-content/40">—</span>
												)}
											</td>
											<td>
												<div className="flex gap-2">
													<Button className="btn-ghost btn-sm" onClick={() => handleOpenModal(pair)}>
														Edit
													</Button>
													<Button
														className="btn-ghost btn-sm text-error"
														onClick={() => handleDeleteClick(pair)}
														disabled={deletingId === pair._id}
													>
														{deletingId === pair._id ? (
															<span className="loading loading-spinner loading-xs"></span>
														) : (
															'Delete'
														)}
													</Button>
												</div>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
						</>
					)}
				</div>
			</div>

			{isModalOpen && (
				<div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 sm:p-4">
					<div className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl bg-base-200 shadow-2xl border border-base-300 max-h-[90vh] flex flex-col">
						{/* Mobile drag indicator */}
						<div className="flex justify-center pt-2 sm:hidden">
							<div className="w-12 h-1.5 bg-base-300 rounded-full" />
						</div>
						
						<div className="flex items-center justify-between border-b border-base-300 px-4 sm:px-6 py-3 sm:py-4">
							<h3 className="text-lg font-semibold text-base-content">
								{editingPair ? 'Edit Couple' : 'Create Couple'}
							</h3>
							<button type="button" className="btn btn-ghost btn-sm btn-circle" onClick={handleCloseModal}>
								✕
							</button>
						</div>

						<form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
							<div className="form-control">
								<label className="label">
									<span className="label-text">Partner A</span>
								</label>
								<select
									className="select select-bordered w-full"
									value={formData.studentAId}
									onChange={(e) => setFormData({ ...formData, studentAId: e.target.value })}
									required
									disabled={submitting}
								>
									<option value="">Select student...</option>
									{(editingPair ? students : availableStudents).map((student) => (
										<option key={student._id} value={student._id}>
											{getStudentName(student)} ({student.email})
										</option>
									))}
								</select>
							</div>

							<div className="form-control">
								<label className="label">
									<span className="label-text">Partner B</span>
								</label>
								<select
									className="select select-bordered w-full"
									value={formData.studentBId}
									onChange={(e) => setFormData({ ...formData, studentBId: e.target.value })}
									required
									disabled={submitting}
								>
									<option value="">Select student...</option>
									{(editingPair ? students : availableStudents)
										.filter((student) => student._id !== formData.studentAId)
										.map((student) => (
											<option key={student._id} value={student._id}>
												{getStudentName(student)} ({student.email})
											</option>
										))}
								</select>
							</div>

							<div className="form-control">
								<label className="label">
									<span className="label-text">Groups</span>
									<span className="label-text-alt">
										{selectedGroupsForCouple.size} selected (couple can be in multiple groups)
									</span>
								</label>
								<div className="max-h-48 overflow-y-auto border border-base-300 rounded-lg p-3 space-y-2">
									{availableGroups.length === 0 ? (
										<p className="text-base-content/60 text-sm">No groups available. Create groups first.</p>
									) : (
										<>
												<div className="flex items-center gap-2 pb-2 border-b border-base-300 mb-2 sticky top-0 bg-base-200">
													<input
														type="checkbox"
														className="checkbox checkbox-sm"
														checked={selectedGroupsForCouple.size === availableGroups.length && availableGroups.length > 0}
														onChange={(e) => {
															if (e.target.checked) {
																setSelectedGroupsForCouple(new Set(availableGroups.map(g => g._id)))
															} else {
																setSelectedGroupsForCouple(new Set())
															}
														}}
													/>
													<span className="text-sm font-medium">Select All</span>
												</div>
											{availableGroups.map((group) => (
												<label
													key={group._id}
													className="flex items-center gap-3 p-2 rounded-lg hover:bg-base-300/50 cursor-pointer"
												>
													<input
														type="checkbox"
														className="checkbox checkbox-sm"
														checked={selectedGroupsForCouple.has(group._id)}
														onChange={(e) => {
															const newSet = new Set(selectedGroupsForCouple)
															if (e.target.checked) {
																newSet.add(group._id)
															} else {
																newSet.delete(group._id)
															}
															setSelectedGroupsForCouple(newSet)
														}}
													/>
													<div className="flex-1">
														<span className="font-medium">{group.name}</span>
														{group.description && (
															<p className="text-xs text-base-content/60 mt-0.5">{group.description}</p>
														)}
													</div>
													<span className="text-xs text-base-content/60">
														{group.coupleCount || 0} couple{(group.coupleCount || 0) !== 1 ? 's' : ''}
													</span>
												</label>
											))}
										</>
									)}
								</div>
								<label className="label">
									<span className="label-text-alt text-base-content/50">
										Select one or more groups for this couple. Couples can be in multiple groups.
									</span>
								</label>
							</div>

							<div className="form-control">
								<label className="label">
									<span className="label-text">Preferred Teacher (optional)</span>
								</label>
								<select
									className="select select-bordered w-full"
									value={formData.preferredTeacherId}
									onChange={(e) => setFormData({ ...formData, preferredTeacherId: e.target.value })}
								>
									<option value="">No preference</option>
									{teachers.map((teacher) => (
										<option key={teacher._id} value={teacher._id}>
											{teacher.firstName} {teacher.lastName}
										</option>
									))}
								</select>
							</div>

							{error && (
								<Alert variant="error">
									{error}
								</Alert>
							)}

							<div className="flex justify-end gap-3 pt-4">
								<Button
									type="button"
									className="btn-secondary"
									onClick={handleCloseModal}
									disabled={submitting}
								>
									Cancel
								</Button>
								<Button type="submit" className="btn-primary" disabled={submitting}>
									{submitting ? (
										<>
											<span className="loading loading-spinner loading-sm"></span>
											{editingPair ? 'Updating...' : 'Creating...'}
										</>
									) : (
										editingPair ? 'Update' : 'Create'
									)}
								</Button>
							</div>
						</form>
					</div>
				</div>
			)}


			{/* Create/Edit Group Modal */}
			{isGroupModalOpen && (
				<div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 sm:p-4">
					<div className="w-full sm:max-w-2xl rounded-t-3xl sm:rounded-2xl bg-base-200 shadow-2xl border border-base-300 max-h-[90vh] flex flex-col">
						{/* Mobile drag indicator */}
						<div className="flex justify-center pt-2 sm:hidden">
							<div className="w-12 h-1.5 bg-base-300 rounded-full" />
						</div>
						
						<div className="flex items-center justify-between border-b border-base-300 px-4 sm:px-6 py-3 sm:py-4">
							<h3 className="text-lg font-semibold text-base-content">
								{editingGroup ? 'Edit Group' : 'Create New Group'}
							</h3>
							<button
								type="button"
								className="btn btn-ghost btn-sm btn-circle"
								onClick={handleCloseGroupModal}
							>
								✕
							</button>
						</div>

						<form onSubmit={handleCreateOrUpdateGroup} className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
							<div className="form-control">
								<label className="label">
									<span className="label-text">Group Name *</span>
								</label>
								<input
									type="text"
									className="input input-bordered w-full"
									placeholder="e.g., Beginners, Intermediate, Advanced"
									value={groupFormData.name}
									onChange={(e) => setGroupFormData({ ...groupFormData, name: e.target.value })}
									required
									disabled={creatingGroup}
								/>
							</div>

							<div className="form-control">
								<label className="label">
									<span className="label-text">Description</span>
								</label>
								<textarea
									className="textarea textarea-bordered w-full"
									placeholder="Add a description for this group (optional)..."
									rows={3}
									value={groupFormData.description}
									onChange={(e) => setGroupFormData({ ...groupFormData, description: e.target.value })}
									disabled={creatingGroup}
								/>
							</div>

							<div className="form-control">
								<label className="label">
									<span className="label-text">Assign Couples</span>
									<span className="label-text-alt">
										{selectedCouplesForGroup.size} of {pairs.length} selected
									</span>
								</label>
								<div className="max-h-64 overflow-y-auto border border-base-300 rounded-lg p-3 space-y-2">
									{pairs.length === 0 ? (
										<p className="text-base-content/60 text-sm text-center py-4">
											No couples available. Create couples first.
										</p>
									) : (
										<>
											<div className="flex items-center gap-2 pb-2 border-b border-base-300 mb-2 sticky top-0 bg-base-200">
												<input
													type="checkbox"
													className="checkbox checkbox-sm"
													checked={selectedCouplesForGroup.size === pairs.length && pairs.length > 0}
													onChange={(e) => {
														if (e.target.checked) {
															setSelectedCouplesForGroup(new Set(pairs.map(p => p._id)))
														} else {
															setSelectedCouplesForGroup(new Set())
														}
													}}
													disabled={creatingGroup}
												/>
												<span className="text-sm font-medium">Select All</span>
											</div>
											{pairs.map((pair) => (
												<label
													key={pair._id}
													className="flex items-center gap-3 p-2 rounded-lg hover:bg-base-300/50 cursor-pointer"
												>
													<input
														type="checkbox"
														className="checkbox checkbox-sm"
														checked={selectedCouplesForGroup.has(pair._id)}
														onChange={(e) => {
															const newSet = new Set(selectedCouplesForGroup)
															if (e.target.checked) {
																newSet.add(pair._id)
															} else {
																newSet.delete(pair._id)
															}
															setSelectedCouplesForGroup(newSet)
														}}
														disabled={creatingGroup}
													/>
													<span className="flex-1">
														{getStudentName(pair.studentAId)} & {getStudentName(pair.studentBId)}
													</span>
													{pair.baseGroups && pair.baseGroups.length > 0 && (
														<div className="flex gap-1 flex-wrap">
															{pair.baseGroups.map(g => {
																const group = availableGroups.find(gr => gr._id === g)
																return group ? (
																	<span key={g} className="badge badge-outline badge-xs">{group.name}</span>
																) : (
																	<span key={g} className="badge badge-outline badge-xs">{g}</span>
																)
															})}
														</div>
													)}
												</label>
											))}
										</>
									)}
								</div>
								<label className="label">
									<span className="label-text-alt text-base-content/50">
										Select couples to add to this group. You can assign couples later when editing.
									</span>
								</label>
							</div>

							{groupError && (
								<Alert variant="error">
									{groupError}
								</Alert>
							)}

							<div className="flex justify-end gap-3 pt-4 border-t border-base-300">
								<Button
									type="button"
									className="btn-secondary"
									onClick={handleCloseGroupModal}
									disabled={creatingGroup}
								>
									Cancel
								</Button>
								<Button
									type="submit"
									className="btn-primary"
									disabled={creatingGroup || !groupFormData.name.trim()}
								>
									{creatingGroup ? (
										<>
											<span className="loading loading-spinner loading-sm"></span>
											{editingGroup ? 'Updating...' : 'Creating...'}
										</>
									) : (
										editingGroup ? 'Update Group' : 'Create Group'
									)}
								</Button>
							</div>
						</form>
					</div>
				</div>
			)}

			{/* Delete Confirmation Modal */}
			{deleteConfirmPair && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
					<div className="w-full max-w-md rounded-2xl bg-base-200 shadow-2xl border border-base-300">
						<div className="flex items-center justify-between border-b border-base-300 px-6 py-4">
							<h3 className="text-lg font-semibold text-base-content">Confirm Delete</h3>
							<button
								type="button"
								className="btn btn-ghost btn-sm"
								onClick={() => setDeleteConfirmPair(null)}
							>
								✕
							</button>
						</div>
						<div className="p-6">
							<p className="text-base-content mb-4">
								Are you sure you want to delete the couple{' '}
								<strong>
									{getStudentName(deleteConfirmPair.studentAId)} &{' '}
									{getStudentName(deleteConfirmPair.studentBId)}
								</strong>?
							</p>
							<p className="text-sm text-base-content/60 mb-6">
								This action cannot be undone. Both students will become available for pairing again.
							</p>
							<div className="flex justify-end gap-3">
								<Button
									type="button"
									className="btn-secondary"
									onClick={() => setDeleteConfirmPair(null)}
								>
									Cancel
								</Button>
								<Button
									type="button"
									className="btn-error"
									onClick={handleDeleteConfirm}
									disabled={deletingId === deleteConfirmPair._id}
								>
									{deletingId === deleteConfirmPair._id ? (
										<>
											<span className="loading loading-spinner loading-sm"></span>
											Deleting...
										</>
									) : (
										'Delete'
									)}
								</Button>
							</div>
						</div>
					</div>
				</div>
			)}

		</div>
	)
}

