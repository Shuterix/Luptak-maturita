'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { Users, GraduationCap, UserCheck, Mail, Phone, Heart } from 'lucide-react'
import { useMediaQuery } from '@/hooks/useMediaQuery'

interface UserData {
	_id: string
	firstName: string
	lastName: string
	email: string
	role: 'student' | 'trainer' | 'admin'
	profile?: {
		phone?: string
	}
}

interface ClubData {
	_id: string
	name: string
	description?: string
	coupleCount: number
}

export default function ClubOverviewPage() {
	const { user } = useAuth()
	const [students, setStudents] = useState<UserData[]>([])
	const [trainers, setTrainers] = useState<UserData[]>([])
	const [club, setClub] = useState<ClubData | null>(null)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const isMobile = useMediaQuery('(max-width: 768px)')

	useEffect(() => {
		if (user?.clubId) {
			fetchClubMembers()
		}
	}, [user?.clubId])

	const fetchClubMembers = async () => {
		try {
			setLoading(true)
			setError(null)

			if (!user?.clubId) {
				setError('You are not assigned to a club.')
				return
			}

			// Fetch club info
			const clubRes = await fetch(`/api/clubs/${user.clubId}`, { cache: 'no-store' })
			if (clubRes.ok) {
				const clubData = await clubRes.json()
				setClub(clubData.club)
			} else {
				throw new Error('Failed to fetch club information')
			}

			// Fetch students
			const studentsRes = await fetch(`/api/users?clubId=${user.clubId}&role=student`, { cache: 'no-store' })
			if (studentsRes.ok) {
				const studentsData = await studentsRes.json()
				setStudents(studentsData.users || [])
			} else {
				throw new Error('Failed to fetch students')
			}

			// Fetch trainers
			const trainersRes = await fetch(`/api/users?clubId=${user.clubId}&role=trainer`, { cache: 'no-store' })
			if (trainersRes.ok) {
				const trainersData = await trainersRes.json()
				setTrainers(trainersData.users || [])
			} else {
				throw new Error('Failed to fetch trainers')
			}
		} catch (err: any) {
			console.error('Error fetching club members:', err)
			setError(err.message || 'Failed to load club members')
		} finally {
			setLoading(false)
		}
	}

	const UserCard = ({ userData }: { userData: UserData }) => {
		const fullName = `${userData.firstName} ${userData.lastName}`
		const roleBadgeColor = userData.role === 'trainer' ? 'badge-primary' : 'badge-secondary'

		return (
			<div className="card bg-base-100 shadow-md border border-base-300 hover:shadow-lg transition-shadow">
				<div className="card-body p-4">
					<div className="flex items-start justify-between gap-3">
						<div className="flex-1 min-w-0">
							<div className="flex items-center gap-2 mb-2">
								<h3 className="font-semibold text-base truncate">{fullName}</h3>
								<span className={`badge badge-sm ${roleBadgeColor}`}>
									{userData.role === 'trainer' ? 'Trainer' : 'Student'}
								</span>
							</div>
							<div className="space-y-1 text-sm text-base-content/70">
								<div className="flex items-center gap-2">
									<Mail className="h-4 w-4 flex-shrink-0" />
									<span className="truncate">{userData.email}</span>
								</div>
								{userData.profile?.phone && (
									<div className="flex items-center gap-2">
										<Phone className="h-4 w-4 flex-shrink-0" />
										<span>{userData.profile.phone}</span>
									</div>
								)}
							</div>
						</div>
					</div>
				</div>
			</div>
		)
	}

	if (loading) {
		return (
			<div className="flex items-center justify-center min-h-screen">
				<span className="loading loading-spinner loading-lg"></span>
			</div>
		)
	}

	if (error) {
		return (
			<div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
				<div className="alert alert-error">
					<span>{error}</span>
					<button className="btn btn-sm btn-ghost" onClick={fetchClubMembers}>
						Retry
					</button>
				</div>
			</div>
		)
	}

	return (
		<div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6 sm:space-y-10">
			{/* Header */}
			<header>
				<div className="flex items-center gap-3 mb-2">
					<Users className="h-8 w-8 text-primary" />
					<h1 className="text-2xl sm:text-3xl font-semibold">Club Overview</h1>
				</div>
				{club && (
					<div className="mb-4">
						<h2 className="text-xl sm:text-2xl font-bold mb-2">{club.name}</h2>
						{club.description && (
							<p className="text-sm sm:text-base text-base-content/70 mb-2">{club.description}</p>
						)}
					</div>
				)}
				<p className="text-sm sm:text-base text-base-content/60">
					View all students and trainers in your club
				</p>
			</header>

			{/* Stats Cards */}
			<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
				<div className="card bg-base-100 shadow-md border border-base-300">
					<div className="card-body p-4 sm:p-6">
						<div className="flex items-center gap-3">
							<div className="p-3 bg-secondary/20 rounded-lg">
								<GraduationCap className="h-6 w-6 text-secondary" />
							</div>
							<div>
								<p className="text-sm text-base-content/60">Students</p>
								<p className="text-2xl font-bold">{students.length}</p>
							</div>
						</div>
					</div>
				</div>
				<div className="card bg-base-100 shadow-md border border-base-300">
					<div className="card-body p-4 sm:p-6">
						<div className="flex items-center gap-3">
							<div className="p-3 bg-primary/20 rounded-lg">
								<UserCheck className="h-6 w-6 text-primary" />
							</div>
							<div>
								<p className="text-sm text-base-content/60">Trainers</p>
								<p className="text-2xl font-bold">{trainers.length}</p>
							</div>
						</div>
					</div>
				</div>
				<div className="card bg-base-100 shadow-md border border-base-300">
					<div className="card-body p-4 sm:p-6">
						<div className="flex items-center gap-3">
							<div className="p-3 bg-accent/20 rounded-lg">
								<Heart className="h-6 w-6 text-accent" />
							</div>
							<div>
								<p className="text-sm text-base-content/60">Couples</p>
								<p className="text-2xl font-bold">{club?.coupleCount || 0}</p>
							</div>
						</div>
					</div>
				</div>
			</div>

			{/* Trainers Section */}
			<section>
				<div className="flex items-center gap-2 mb-4">
					<UserCheck className="h-5 w-5 text-primary" />
					<h2 className="text-xl font-semibold">Trainers</h2>
					<span className="badge badge-outline">{trainers.length}</span>
				</div>
				{trainers.length === 0 ? (
					<div className="card bg-base-100 border border-base-300">
						<div className="card-body text-center py-8">
							<p className="text-base-content/60">No trainers found in your club.</p>
						</div>
					</div>
				) : (
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
						{trainers.map((trainer) => (
							<UserCard key={trainer._id} userData={trainer} />
						))}
					</div>
				)}
			</section>

			{/* Students Section */}
			<section>
				<div className="flex items-center gap-2 mb-4">
					<GraduationCap className="h-5 w-5 text-secondary" />
					<h2 className="text-xl font-semibold">Students</h2>
					<span className="badge badge-outline">{students.length}</span>
				</div>
				{students.length === 0 ? (
					<div className="card bg-base-100 border border-base-300">
						<div className="card-body text-center py-8">
							<p className="text-base-content/60">No students found in your club.</p>
						</div>
					</div>
				) : (
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
						{students.map((student) => (
							<UserCard key={student._id} userData={student} />
						))}
					</div>
				)}
			</section>
		</div>
	)
}

