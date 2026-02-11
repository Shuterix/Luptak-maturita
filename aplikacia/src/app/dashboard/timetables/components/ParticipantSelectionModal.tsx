'use client'

import { useState, useMemo, useEffect } from 'react'
import { Search, X, Users, UserPlus, ChevronDown, ChevronRight, Check } from 'lucide-react'

interface ClubStudent {
	_id: string
	firstName: string
	lastName: string
}

interface ClubCouple {
	pairId: string
	label: string
	studentA: string
	studentB: string
	baseGroups?: string[]
}

type LessonType = 'group' | 'individual' | 'couple'

interface ParticipantSelectionModalProps {
	isOpen: boolean
	onClose: () => void
	onConfirm: (selection: {
		studentNames: string[]
		pairLabel?: string
	}) => void
	lessonType: LessonType
	students: ClubStudent[]
	couples: ClubCouple[]
	initialStudentNames: string[]
	initialPairLabel?: string
}

export function ParticipantSelectionModal({
	isOpen,
	onClose,
	onConfirm,
	lessonType,
	students,
	couples,
	initialStudentNames,
	initialPairLabel,
}: ParticipantSelectionModalProps) {
	const [search, setSearch] = useState('')
	const [selectedStudentNames, setSelectedStudentNames] = useState<string[]>(initialStudentNames)
	const [selectedPairLabel, setSelectedPairLabel] = useState<string | undefined>(initialPairLabel)
	const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
	const [activeTab, setActiveTab] = useState<'groups' | 'couples' | 'students'>(
		lessonType === 'individual' ? 'students' : lessonType === 'couple' ? 'couples' : 'groups'
	)

	// Re-initialize when modal opens
	useEffect(() => {
		if (isOpen) {
			setSelectedStudentNames(initialStudentNames)
			setSelectedPairLabel(initialPairLabel)
			setSearch('')
			setExpandedGroups(new Set())
			// Determine default tab based on lesson type and available data
			const realGroupsExist = couples.some(
				(c) => c.baseGroups && c.baseGroups.length > 0 && c.baseGroups.some((g) => g !== 'Ungrouped')
			)
			if (lessonType === 'individual') {
				setActiveTab('students')
			} else if (lessonType === 'couple') {
				setActiveTab('couples')
			} else if (realGroupsExist) {
				setActiveTab('groups')
			} else {
				setActiveTab('couples')
			}
		}
	}, [isOpen, initialStudentNames, initialPairLabel, lessonType, couples])

	// Derive unique groups from couples
	const groups = useMemo(() => {
		const groupMap = new Map<string, ClubCouple[]>()
		for (const couple of couples) {
			const coupleGroups = couple.baseGroups && couple.baseGroups.length > 0 ? couple.baseGroups : ['Ungrouped']
			for (const group of coupleGroups) {
				if (!groupMap.has(group)) groupMap.set(group, [])
				groupMap.get(group)!.push(couple)
			}
		}
		return groupMap
	}, [couples])

	const groupNames = useMemo(() => {
		return Array.from(groups.keys()).sort((a, b) => {
			if (a === 'Ungrouped') return 1
			if (b === 'Ungrouped') return -1
			return a.localeCompare(b)
		})
	}, [groups])

	// Available students mapped
	const availableStudents = useMemo(() => {
		return students.map((s) => ({
			id: s._id,
			name: `${s.firstName} ${s.lastName}`,
		}))
	}, [students])

	// Check if a couple is selected (both students present)
	const isCoupleSelected = (couple: ClubCouple) => {
		return selectedStudentNames.includes(couple.studentA) && selectedStudentNames.includes(couple.studentB)
	}

	// Check if entire group is selected
	const isGroupFullySelected = (groupName: string) => {
		const groupCouples = groups.get(groupName) || []
		if (groupCouples.length === 0) return false
		return groupCouples.every(isCoupleSelected)
	}

	// Check if group is partially selected
	const isGroupPartiallySelected = (groupName: string) => {
		const groupCouples = groups.get(groupName) || []
		if (groupCouples.length === 0) return false
		const selectedCount = groupCouples.filter(isCoupleSelected).length
		return selectedCount > 0 && selectedCount < groupCouples.length
	}

	// Toggle entire group
	const toggleGroup = (groupName: string) => {
		const groupCouples = groups.get(groupName) || []
		if (isGroupFullySelected(groupName)) {
			// Remove all couples from this group
			const namesToRemove = new Set<string>()
			groupCouples.forEach((c) => {
				namesToRemove.add(c.studentA)
				namesToRemove.add(c.studentB)
			})
			// But don't remove students that are also part of a selected couple from another group
			setSelectedStudentNames((prev) => {
				const remaining = prev.filter((name) => {
					if (!namesToRemove.has(name)) return true
					// Check if this student is in any selected couple from another group
					const otherCouples = couples.filter(
						(c) =>
							(c.studentA === name || c.studentB === name) &&
							!groupCouples.some((gc) => gc.pairId === c.pairId)
					)
					return otherCouples.some(isCoupleSelected)
				})
				return remaining
			})
		} else {
			// Add all couples from this group
			setSelectedStudentNames((prev) => {
				const newNames = [...prev]
				groupCouples.forEach((c) => {
					if (!newNames.includes(c.studentA)) newNames.push(c.studentA)
					if (!newNames.includes(c.studentB)) newNames.push(c.studentB)
				})
				return newNames
			})
		}
	}

	// Toggle individual couple
	const toggleCouple = (couple: ClubCouple) => {
		if (lessonType === 'couple') {
			// For couple lesson type: only one couple at a time
			if (selectedPairLabel === couple.label) {
				setSelectedPairLabel(undefined)
				setSelectedStudentNames([])
			} else {
				setSelectedPairLabel(couple.label)
				setSelectedStudentNames([couple.studentA, couple.studentB])
			}
			return
		}

		if (isCoupleSelected(couple)) {
			setSelectedStudentNames((prev) => prev.filter((n) => n !== couple.studentA && n !== couple.studentB))
		} else {
			setSelectedStudentNames((prev) => {
				const newNames = [...prev]
				if (!newNames.includes(couple.studentA)) newNames.push(couple.studentA)
				if (!newNames.includes(couple.studentB)) newNames.push(couple.studentB)
				return newNames
			})
		}
	}

	// Toggle individual student
	const toggleStudent = (studentName: string) => {
		if (lessonType === 'individual') {
			// Only one student for individual
			if (selectedStudentNames.includes(studentName)) {
				setSelectedStudentNames([])
			} else {
				setSelectedStudentNames([studentName])
			}
			return
		}

		setSelectedStudentNames((prev) => {
			if (prev.includes(studentName)) {
				return prev.filter((n) => n !== studentName)
			}
			return [...prev, studentName]
		})
	}

	// Remove a specific student from selection
	const removeStudent = (studentName: string) => {
		setSelectedStudentNames((prev) => prev.filter((n) => n !== studentName))
		if (selectedPairLabel) {
			const couple = couples.find((c) => c.label === selectedPairLabel)
			if (couple && (couple.studentA === studentName || couple.studentB === studentName)) {
				setSelectedPairLabel(undefined)
			}
		}
	}

	// Toggle group expansion
	const toggleGroupExpand = (groupName: string) => {
		setExpandedGroups((prev) => {
			const next = new Set(prev)
			if (next.has(groupName)) next.delete(groupName)
			else next.add(groupName)
			return next
		})
	}

	// Filter couples by search
	const filteredCouples = useMemo(() => {
		if (!search) return couples
		const s = search.toLowerCase()
		return couples.filter((c) => c.label.toLowerCase().includes(s))
	}, [couples, search])

	// Filter students by search
	const filteredStudents = useMemo(() => {
		if (!search) return availableStudents
		const s = search.toLowerCase()
		return availableStudents.filter((st) => st.name.toLowerCase().includes(s))
	}, [availableStudents, search])

	// Filter groups by search
	const filteredGroupNames = useMemo(() => {
		if (!search) return groupNames
		const s = search.toLowerCase()
		return groupNames.filter((name) => {
			if (name.toLowerCase().includes(s)) return true
			const groupCouples = groups.get(name) || []
			return groupCouples.some((c) => c.label.toLowerCase().includes(s))
		})
	}, [groupNames, groups, search])

	const handleConfirm = () => {
		onConfirm({
			studentNames: selectedStudentNames,
			pairLabel: selectedPairLabel,
		})
		setSearch('')
		onClose()
	}

	const handleClose = () => {
		setSearch('')
		onClose()
	}

	if (!isOpen) return null

	const hasRealGroups = groupNames.some((g) => g !== 'Ungrouped')
	const showGroupsTab = lessonType === 'group' && hasRealGroups
	const showCouplesTab = lessonType !== 'individual'
	const showStudentsTab = lessonType !== 'couple'

	// Determine selected couples count for summary
	const selectedCouplesCount = couples.filter(isCoupleSelected).length

	return (
		<div className="fixed inset-0 z-[60] flex items-center justify-center bg-base-content/60 backdrop-blur-sm p-4">
			<div className="w-full max-w-lg rounded-2xl bg-base-200 shadow-2xl border border-base-300 max-h-[85vh] flex flex-col">
				{/* Header */}
				<div className="flex items-center justify-between border-b border-base-300 px-5 py-3.5">
					<div>
						<h3 className="text-lg font-semibold text-base-content">Select Participants</h3>
						<p className="text-xs text-base-content/50 mt-0.5">
							{lessonType === 'couple'
								? 'Select one couple'
								: lessonType === 'individual'
									? 'Select one student'
									: 'Select groups, couples, or individual students'}
						</p>
					</div>
					<button type="button" className="btn btn-ghost btn-sm btn-circle" onClick={handleClose}>
						<X className="h-4 w-4" />
					</button>
				</div>

				{/* Search */}
				<div className="px-5 pt-3 pb-2">
					<div className="relative">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-base-content/40" />
						<input
							type="text"
							className="input input-bordered input-sm w-full pl-9"
							placeholder="Search groups, couples, or students..."
							value={search}
							onChange={(e) => setSearch(e.target.value)}
						/>
						{search && (
							<button
								type="button"
								className="absolute right-2 top-1/2 -translate-y-1/2"
								onClick={() => setSearch('')}
							>
								<X className="h-3.5 w-3.5 text-base-content/40" />
							</button>
						)}
					</div>
				</div>

				{/* Selection summary */}
				{selectedStudentNames.length > 0 && (
					<div className="px-5 pb-2">
						<div className="bg-primary/10 rounded-lg p-3">
							<div className="flex items-center justify-between mb-2">
								<span className="text-xs font-medium text-primary">
									{selectedPairLabel
										? `1 couple selected`
										: lessonType === 'group'
											? `${selectedStudentNames.length} student${selectedStudentNames.length !== 1 ? 's' : ''} · ${selectedCouplesCount} couple${selectedCouplesCount !== 1 ? 's' : ''}`
											: `${selectedStudentNames.length} selected`}
								</span>
								<button
									type="button"
									className="text-xs text-error hover:underline"
									onClick={() => {
										setSelectedStudentNames([])
										setSelectedPairLabel(undefined)
									}}
								>
									Clear all
								</button>
							</div>
							<div className="flex flex-wrap gap-1.5">
								{selectedStudentNames.map((name) => (
									<span key={name} className="badge badge-sm badge-primary gap-1">
										{name}
										<button type="button" onClick={() => removeStudent(name)}>
											<X className="h-2.5 w-2.5" />
										</button>
									</span>
								))}
							</div>
						</div>
					</div>
				)}

				{/* Tabs */}
				<div className="px-5 pt-1">
					<div className="flex rounded-lg border border-base-300 overflow-hidden">
						{showGroupsTab && (
							<button
								type="button"
								className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
									activeTab === 'groups'
										? 'bg-primary text-primary-content'
										: 'bg-base-100 hover:bg-base-200 text-base-content/70'
								}`}
								onClick={() => setActiveTab('groups')}
							>
								<Users className="h-3.5 w-3.5 inline mr-1.5" />
								Groups
							</button>
						)}
						{showCouplesTab && (
							<button
								type="button"
								className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${showGroupsTab ? 'border-l border-base-300' : ''} ${
									activeTab === 'couples'
										? 'bg-secondary text-secondary-content'
										: 'bg-base-100 hover:bg-base-200 text-base-content/70'
								}`}
								onClick={() => setActiveTab('couples')}
							>
								<UserPlus className="h-3.5 w-3.5 inline mr-1.5" />
								Couples
							</button>
						)}
						{showStudentsTab && (
							<button
								type="button"
								className={`flex-1 px-3 py-2 text-xs font-medium transition-colors border-l border-base-300 ${
									activeTab === 'students'
										? 'bg-accent text-accent-content'
										: 'bg-base-100 hover:bg-base-200 text-base-content/70'
								}`}
								onClick={() => setActiveTab('students')}
							>
								Students
							</button>
						)}
					</div>
				</div>

				{/* Content area */}
				<div className="flex-1 overflow-y-auto px-5 py-3 min-h-0">
					{/* Groups Tab */}
					{activeTab === 'groups' && showGroupsTab && (
						<div className="space-y-2">
							{filteredGroupNames.length === 0 ? (
								<p className="text-sm text-base-content/50 text-center py-6">No groups found</p>
							) : (
								filteredGroupNames.map((groupName) => {
									const groupCouples = groups.get(groupName) || []
									const isExpanded = expandedGroups.has(groupName)
									const fullySelected = isGroupFullySelected(groupName)
									const partiallySelected = isGroupPartiallySelected(groupName)

									// Filter group couples by search
									const visibleCouples = search
										? groupCouples.filter((c) => c.label.toLowerCase().includes(search.toLowerCase()))
										: groupCouples

									return (
										<div key={groupName} className="border border-base-300 rounded-xl overflow-hidden bg-base-100">
											{/* Group header */}
											<div className="flex items-center gap-2 px-3 py-2.5 hover:bg-base-200 transition-colors">
												<button
													type="button"
													className="flex items-center gap-2 flex-1 text-left"
													onClick={() => toggleGroupExpand(groupName)}
												>
													{isExpanded ? (
														<ChevronDown className="h-4 w-4 text-base-content/40 flex-shrink-0" />
													) : (
														<ChevronRight className="h-4 w-4 text-base-content/40 flex-shrink-0" />
													)}
													<span className="font-medium text-sm">{groupName}</span>
													<span className="text-xs text-base-content/40">
														({groupCouples.length} couple{groupCouples.length !== 1 ? 's' : ''})
													</span>
												</button>
												<button
													type="button"
													className={`btn btn-xs ${
														fullySelected
															? 'btn-primary'
															: partiallySelected
																? 'btn-outline btn-primary'
																: 'btn-ghost'
													}`}
													onClick={() => toggleGroup(groupName)}
												>
													{fullySelected ? (
														<>
															<Check className="h-3 w-3" /> Selected
														</>
													) : partiallySelected ? (
														'Select All'
													) : (
														'Select All'
													)}
												</button>
											</div>

											{/* Group couples (expanded) */}
											{isExpanded && (
												<div className="border-t border-base-300">
													{visibleCouples.map((couple) => {
														const selected = isCoupleSelected(couple)
														return (
															<button
																key={couple.pairId}
																type="button"
																className={`w-full text-left px-4 py-2 pl-10 flex items-center justify-between text-sm transition-colors ${
																	selected
																		? 'bg-primary/10 text-primary'
																		: 'hover:bg-base-200'
																}`}
																onClick={() => toggleCouple(couple)}
															>
																<span className="truncate">{couple.label}</span>
																{selected && <Check className="h-3.5 w-3.5 flex-shrink-0" />}
															</button>
														)
													})}
												</div>
											)}
										</div>
									)
								})
							)}
						</div>
					)}

					{/* Couples Tab */}
					{activeTab === 'couples' && showCouplesTab && (
						<div className="space-y-1">
							{filteredCouples.length === 0 ? (
								<p className="text-sm text-base-content/50 text-center py-6">No couples found</p>
							) : (
								filteredCouples.map((couple) => {
									const selected =
										lessonType === 'couple'
											? selectedPairLabel === couple.label
											: isCoupleSelected(couple)
									const groupLabels = couple.baseGroups?.filter((g) => g && g !== 'Ungrouped') || []

									return (
										<button
											key={couple.pairId}
											type="button"
											className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center justify-between gap-2 text-sm transition-colors ${
												selected
													? 'bg-secondary/15 text-secondary ring-1 ring-secondary/30'
													: 'hover:bg-base-100 bg-base-100/50'
											}`}
											onClick={() => toggleCouple(couple)}
										>
											<div className="flex items-center gap-2 min-w-0">
												<div
													className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
														selected
															? 'bg-secondary border-secondary text-secondary-content'
															: 'border-base-300'
													}`}
												>
													{selected && <Check className="h-3 w-3" />}
												</div>
												<div className="min-w-0">
													<span className="block truncate">{couple.label}</span>
													{groupLabels.length > 0 && (
														<span className="text-xs text-base-content/40">
															{groupLabels.join(', ')}
														</span>
													)}
												</div>
											</div>
										</button>
									)
								})
							)}
						</div>
					)}

					{/* Students Tab */}
					{activeTab === 'students' && showStudentsTab && (
						<div className="space-y-1">
							{filteredStudents.length === 0 ? (
								<p className="text-sm text-base-content/50 text-center py-6">No students found</p>
							) : (
								filteredStudents.map((student) => {
									const selected = selectedStudentNames.includes(student.name)
									return (
										<button
											key={student.id}
											type="button"
											className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center gap-2 text-sm transition-colors ${
												selected
													? 'bg-accent/15 text-accent ring-1 ring-accent/30'
													: 'hover:bg-base-100 bg-base-100/50'
											}`}
											onClick={() => toggleStudent(student.name)}
										>
											<div
												className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
													selected
														? 'bg-accent border-accent text-accent-content'
														: 'border-base-300'
												}`}
											>
												{selected && <Check className="h-3 w-3" />}
											</div>
											<span>{student.name}</span>
										</button>
									)
								})
							)}
						</div>
					)}
				</div>

				{/* Footer */}
				<div className="flex items-center justify-between gap-3 border-t border-base-300 px-5 py-3">
					<button type="button" className="btn btn-ghost btn-sm" onClick={handleClose}>
						Cancel
					</button>
					<button type="button" className="btn btn-primary btn-sm" onClick={handleConfirm}>
						Confirm Selection
						{selectedStudentNames.length > 0 && (
							<span className="badge badge-sm ml-1">{selectedStudentNames.length}</span>
						)}
					</button>
				</div>
			</div>
		</div>
	)
}

