// app/dashboard/users/page.tsx
'use client'
import { useState, useEffect } from 'react'
import {
	User,
	Mail,
	Phone,
	Calendar,
	Shield,
	MoreHorizontal,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'

interface UserData {
	_id: string
	firstName: string
	lastName: string
	email: string
	role: string
	createdAt?: string
}

export default function UsersPage() {
	const { user } = useAuth()
	const [users, setUsers] = useState<UserData[]>([])
	const [loading, setLoading] = useState(true)

	useEffect(() => {
		if (user?.clubId) {
			fetchUsers()
		}
	}, [user?.clubId])

	const fetchUsers = async () => {
		try {
			setLoading(true)
			const res = await fetch(`/api/users?clubId=${user?.clubId}`, { cache: 'no-store' })
			if (res.ok) {
				const data = await res.json()
				setUsers(data.users || [])
			}
		} catch (err) {
			console.error('Error fetching users:', err)
		} finally {
			setLoading(false)
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
		<div className="space-y-6">
			{/* Page Header */}
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-bold flex items-center gap-2">
						<User className="h-6 w-6 text-primary" />
						User Management
					</h1>
					<p className="text-sm text-gray-500 mt-1">
						Manage all registered users and their permissions
					</p>
				</div>
				<button className="btn btn-primary">Add User</button>
			</div>

			{/* Stats Cards */}
			<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
				<div className="card bg-base-100 shadow">
					<div className="card-body">
						<div className="flex items-center justify-between">
							<div>
								<h3 className="font-bold text-lg flex items-center gap-2">
									<User className="h-5 w-5" />
									Total Users
								</h3>
								<p className="text-3xl font-bold mt-2">{users.length}</p>
							</div>
						</div>
					</div>
				</div>

				<div className="card bg-base-100 shadow">
					<div className="card-body">
						<h3 className="font-bold text-lg flex items-center gap-2">
							<Shield className="h-5 w-5" />
							Students
						</h3>
						<p className="text-3xl font-bold mt-2">{users.filter(u => u.role === 'student').length}</p>
					</div>
				</div>

				<div className="card bg-base-100 shadow">
					<div className="card-body">
						<h3 className="font-bold text-lg flex items-center gap-2">
							<Calendar className="h-5 w-5" />
							Trainers
						</h3>
						<p className="text-3xl font-bold mt-2">{users.filter(u => u.role === 'trainer').length}</p>
					</div>
				</div>
			</div>

			{/* Users Table */}
			<div className="card bg-base-100 shadow">
				<div className="card-body p-0">
					<div className="overflow-x-auto">
						<table className="table">
							{/* Table Header */}
							<thead>
								<tr>
									<th>
										<label>
											<input
												type="checkbox"
												className="checkbox"
											/>
										</label>
									</th>
									<th>User</th>
									<th>Contact</th>
									<th>Role</th>
									<th>Status</th>
									<th>Joined</th>
									<th>Actions</th>
								</tr>
							</thead>

							{/* Table Body */}
							<tbody>
								{users.length === 0 ? (
									<tr>
										<td colSpan={7} className="text-center py-8 text-base-content/60">
											No users found
										</td>
									</tr>
								) : (
									users.map((dbUser) => (
										<tr key={dbUser._id}>
											<td>
												<label>
													<input
														type="checkbox"
														className="checkbox"
													/>
												</label>
											</td>
											<td>
												<div className="flex items-center gap-3">
													<div className="avatar placeholder">
														<div className="bg-neutral text-neutral-content rounded-full w-10">
															<span className="text-xs">
																{`${dbUser.firstName?.[0] || ''}${dbUser.lastName?.[0] || ''}`}
															</span>
														</div>
													</div>
													<div>
														<div className="font-bold">
															{`${dbUser.firstName} ${dbUser.lastName}`}
														</div>
														<div className="text-sm text-gray-500">
															ID: {dbUser._id.slice(-8)}
														</div>
													</div>
												</div>
											</td>
											<td>
												<div className="flex flex-col gap-1">
													<div className="flex items-center gap-2">
														<Mail className="h-4 w-4" />
														<span>{dbUser.email}</span>
													</div>
												</div>
											</td>
											<td>
												<span className="badge badge-ghost">
													{dbUser.role}
												</span>
											</td>
											<td>
												<span className="badge badge-success">
													active
												</span>
											</td>
											<td>
												<div className="flex items-center gap-2">
													<Calendar className="h-4 w-4" />
													{dbUser.createdAt ? new Date(dbUser.createdAt).toLocaleDateString() : 'N/A'}
												</div>
											</td>
											<td>
												<div className="dropdown dropdown-end">
													<div
														tabIndex={0}
														role="button"
														className="btn btn-ghost btn-xs"
													>
														<MoreHorizontal className="h-4 w-4" />
													</div>
													<ul
														tabIndex={0}
														className="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-52"
													>
														<li>
															<a>Edit</a>
														</li>
														<li>
															<a>View Profile</a>
														</li>
													</ul>
												</div>
											</td>
										</tr>
									))
								)}
							</tbody>
						</table>
					</div>
				</div>
			</div>

		</div>
	)
}
