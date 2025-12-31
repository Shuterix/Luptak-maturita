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

interface Pair {
	_id: string
	studentAId: Student
	studentBId: Student
	baseGroup?: string
	preferredTeacherId?: Teacher
	createdAt?: string
}

export default function CouplesPage() {
	const { user, isLoading: authLoading, refreshUser } = useAuth()
	const [pairs, setPairs] = useState<Pair[]>([])
	const [students, setStudents] = useState<Student[]>([])
	const [teachers, setTeachers] = useState<Teacher[]>([])
	const [availableGroups, setAvailableGroups] = useState<string[]>([])
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
	const [formData, setFormData] = useState({
		studentAId: '',
		studentBId: '',
		baseGroup: '',
		preferredTeacherId: '',
	})
	const [newGroupName, setNewGroupName] = useState('')
	const [showNewGroupInput, setShowNewGroupInput] = useState(false)
	const [creatingGroup, setCreatingGroup] = useState(false)
	const [deletingGroup, setDeletingGroup] = useState<string | null>(null)
	const [groupToDelete, setGroupToDelete] = useState<string | null>(null)

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
			}
		} catch (err) {
			console.error('Error fetching groups:', err)
		}
	}

	const handleOpenModal = (pair?: Pair) => {
		setError(null) // Clear any previous errors
		setShowNewGroupInput(false)
		setNewGroupName('')
		if (pair) {
			setEditingPair(pair)
			setFormData({
				studentAId: pair.studentAId._id,
				studentBId: pair.studentBId._id,
				baseGroup: pair.baseGroup || '',
				preferredTeacherId: pair.preferredTeacherId?._id || '',
			})
		} else {
			setEditingPair(null)
			setFormData({
				studentAId: '',
				studentBId: '',
				baseGroup: '',
				preferredTeacherId: '',
			})
		}
		setIsModalOpen(true)
	}

	const handleCloseModal = () => {
		setIsModalOpen(false)
		setEditingPair(null)
		setFormData({
			studentAId: '',
			studentBId: '',
			baseGroup: '',
			preferredTeacherId: '',
		})
		setShowNewGroupInput(false)
		setNewGroupName('')
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
					baseGroup: formData.baseGroup || undefined,
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
			// Filter by base group
			if (filters.baseGroup && pair.baseGroup !== filters.baseGroup) return false

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
						aVal = a.baseGroup || ''
						bVal = b.baseGroup || ''
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

	const handleCreateGroup = async () => {
		if (!newGroupName.trim()) {
			setError('Group name cannot be empty')
			return
		}

		if (availableGroups.includes(newGroupName.trim())) {
			setError('Group already exists')
			return
		}

		setCreatingGroup(true)
		setError(null)
		try {
			// Add to available groups immediately (optimistic update)
			setAvailableGroups([...availableGroups, newGroupName.trim()].sort())
			setNewGroupName('')
			showAlertToast('Group created successfully', { variant: 'success' })
		} catch (err: any) {
			setError(err.message || 'Failed to create group')
			showAlertToast(err.message || 'Failed to create group', { variant: 'error' })
		} finally {
			setCreatingGroup(false)
		}
	}

	const handleDeleteGroup = async (groupName: string) => {
		if (!confirm(`Are you sure you want to delete the group "${groupName}"? This will remove the group assignment from all couples that have it.`)) {
			return
		}

		setDeletingGroup(groupName)
		setError(null)
		try {
			// Remove group from all pairs that have it
			const pairsWithGroup = pairs.filter(p => p.baseGroup === groupName)
			
			// Update all pairs to remove the group
			await Promise.all(
				pairsWithGroup.map(pair =>
					fetch(`/api/pairs/${pair._id}`, {
						method: 'PUT',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							studentAId: pair.studentAId._id,
							studentBId: pair.studentBId._id,
							baseGroup: undefined, // Remove group
							preferredTeacherId: pair.preferredTeacherId?._id || undefined,
						}),
					})
				)
			)

			// Remove from available groups
			setAvailableGroups(availableGroups.filter(g => g !== groupName))
			
			// Refresh pairs to update the UI
			await fetchPairs()
			
			showAlertToast(`Group "${groupName}" deleted successfully`, { variant: 'success' })
		} catch (err: any) {
			setError(err.message || 'Failed to delete group')
			showAlertToast(err.message || 'Failed to delete group', { variant: 'error' })
		} finally {
			setDeletingGroup(null)
			setGroupToDelete(null)
		}
	}

	// Count couples per group
	const groupCounts = useMemo(() => {
		const counts: Record<string, number> = {}
		pairs.forEach(pair => {
			if (pair.baseGroup) {
				counts[pair.baseGroup] = (counts[pair.baseGroup] || 0) + 1
			}
		})
		return counts
	}, [pairs])

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
						<div className="flex gap-2">
							<input
								type="text"
								placeholder="New group name..."
								className="input input-bordered input-sm w-48"
								value={newGroupName}
								onChange={(e) => setNewGroupName(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === 'Enter' && newGroupName.trim()) {
										handleCreateGroup()
									}
								}}
							/>
							<Button
								className="btn-primary btn-sm"
								onClick={handleCreateGroup}
								disabled={creatingGroup || !newGroupName.trim()}
							>
								{creatingGroup ? (
									<>
										<span className="loading loading-spinner loading-xs"></span>
										Creating...
									</>
								) : (
									'Create Group'
								)}
							</Button>
						</div>
					</div>

					{availableGroups.length === 0 ? (
						<p className="text-base-content/60">
							No groups created yet. Create a group to organize your couples.
						</p>
					) : (
						<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
							{availableGroups.map((group) => (
								<div
									key={group}
									className="flex items-center justify-between p-3 bg-base-200 rounded-lg border border-base-300"
								>
									<div className="flex items-center gap-2">
										<span className="badge badge-outline badge-lg font-semibold">{group}</span>
										<span className="text-sm text-base-content/60">
											{groupCounts[group] || 0} couple{groupCounts[group] !== 1 ? 's' : ''}
										</span>
									</div>
									<Button
										className="btn-ghost btn-sm text-error hover:bg-error/10"
										onClick={() => setGroupToDelete(group)}
										disabled={deletingGroup === group}
									>
										{deletingGroup === group ? (
											<span className="loading loading-spinner loading-xs"></span>
										) : (
											'Delete'
										)}
									</Button>
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
									<option key={group} value={group}>
										{group}
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
													{pair.baseGroup && (
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
												{pair.baseGroup ? (
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
									<span className="label-text">Base Group</span>
								</label>
								{!showNewGroupInput ? (
									<div className="flex gap-2">
										<select
											className="select select-bordered flex-1"
											value={formData.baseGroup}
											onChange={(e) => {
												if (e.target.value === '__create_new__') {
													setShowNewGroupInput(true)
													setFormData({ ...formData, baseGroup: '' })
												} else {
													setFormData({ ...formData, baseGroup: e.target.value })
												}
											}}
										>
											<option value="">No group assigned</option>
											{availableGroups.map((group) => (
												<option key={group} value={group}>
													{group}
												</option>
											))}
											<option value="__create_new__">+ Create New Group</option>
										</select>
									</div>
								) : (
									<div className="flex gap-2">
										<input
											type="text"
											className="input input-bordered flex-1"
											placeholder="Enter new group name..."
											value={newGroupName}
											onChange={(e) => setNewGroupName(e.target.value)}
											onKeyDown={(e) => {
												if (e.key === 'Enter') {
													e.preventDefault()
													if (newGroupName.trim()) {
														setFormData({ ...formData, baseGroup: newGroupName.trim() })
														setShowNewGroupInput(false)
														setNewGroupName('')
														// Add to available groups if not already there
														if (!availableGroups.includes(newGroupName.trim())) {
															setAvailableGroups([...availableGroups, newGroupName.trim()].sort())
														}
													}
												} else if (e.key === 'Escape') {
													setShowNewGroupInput(false)
													setNewGroupName('')
												}
											}}
											autoFocus
										/>
										<Button
											type="button"
											className="btn-primary btn-sm"
											onClick={() => {
												if (newGroupName.trim()) {
													setFormData({ ...formData, baseGroup: newGroupName.trim() })
													setShowNewGroupInput(false)
													setNewGroupName('')
													// Add to available groups if not already there
													if (!availableGroups.includes(newGroupName.trim())) {
														setAvailableGroups([...availableGroups, newGroupName.trim()].sort())
													}
												}
											}}
										>
											Add
										</Button>
										<Button
											type="button"
											className="btn-ghost btn-sm"
											onClick={() => {
												setShowNewGroupInput(false)
												setNewGroupName('')
											}}
										>
											Cancel
										</Button>
									</div>
								)}
								<label className="label">
									<span className="label-text-alt text-base-content/50">
										Assign this couple to an age-based group for group lessons
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

			{/* Delete Group Confirmation Modal */}
			{groupToDelete && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
					<div className="w-full max-w-md rounded-2xl bg-base-200 shadow-2xl border border-base-300">
						<div className="flex items-center justify-between border-b border-base-300 px-6 py-4">
							<h3 className="text-lg font-semibold text-base-content">Confirm Delete Group</h3>
							<button
								type="button"
								className="btn btn-ghost btn-sm"
								onClick={() => setGroupToDelete(null)}
							>
								✕
							</button>
						</div>
						<div className="p-6">
							<p className="text-base-content mb-4">
								Are you sure you want to delete the group <strong>"{groupToDelete}"</strong>?
							</p>
							<p className="text-sm text-base-content/60 mb-6">
								This will remove the group assignment from {groupCounts[groupToDelete] || 0} couple{groupCounts[groupToDelete] !== 1 ? 's' : ''}. 
								The couples themselves will not be deleted, only their group assignment.
							</p>
							<div className="flex justify-end gap-3">
								<Button
									type="button"
									className="btn-secondary"
									onClick={() => setGroupToDelete(null)}
								>
									Cancel
								</Button>
								<Button
									type="button"
									className="btn-error"
									onClick={() => handleDeleteGroup(groupToDelete)}
									disabled={deletingGroup === groupToDelete}
								>
									{deletingGroup === groupToDelete ? (
										<>
											<span className="loading loading-spinner loading-sm"></span>
											Deleting...
										</>
									) : (
										'Delete Group'
									)}
								</Button>
							</div>
						</div>
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

