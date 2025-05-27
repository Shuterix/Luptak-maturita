'use client'

import { useAuth } from '@/context/AuthContext'
import { User, Phone, Shield, Home, FolderGit2, Mail } from 'lucide-react'

interface UserProfile {
	name: string
	email: string
	phone?: string
	role: 'user' | 'admin'
	projects?: {
		id: string
		name: string
		status: 'active' | 'completed' | 'pending'
	}[]
	rooms?: {
		id: string
		name: string
		location: string
	}[]
}

const mockProfileData: UserProfile = {
	name: 'John Doe',
	email: 'john@example.com',
	phone: '+1 (555) 123-4567',
	role: 'admin',
	projects: [
		{ id: '1', name: 'Website Redesign', status: 'active' },
		{ id: '2', name: 'Mobile App', status: 'pending' },
	],
	rooms: [
		{ id: '1', name: 'Conference Room A', location: 'Floor 3' },
		{ id: '2', name: 'Creative Studio', location: 'Floor 2' },
	],
}

export default function ProfilePage() {
	const { user } = useAuth()

	if (!user) return null

	return (
		<div className="space-y-6">
			{/* Profile Header */}
			<div className="flex items-center justify-between">
				<h1 className="text-3xl font-bold flex items-center gap-2">
					<User className="h-8 w-8 text-primary" />
					My Profile
				</h1>
				<div className="badge badge-primary badge-lg">
					{mockProfileData.role === 'admin' ? 'Admin' : 'User'}
				</div>
			</div>

			{/* Basic Info Card */}
			<div className="card bg-base-100 shadow">
				<div className="card-body">
					<h2 className="card-title flex items-center gap-2">
						<User className="h-5 w-5" />
						Basic Information
					</h2>
					<div className="space-y-4">
						<div className="flex items-center gap-3">
							<Mail className="h-5 w-5 text-gray-500" />
							<div>
								<p className="text-sm text-gray-500">Email</p>
								<p>{mockProfileData.email}</p>
							</div>
						</div>

						{mockProfileData.phone && (
							<div className="flex items-center gap-3">
								<Phone className="h-5 w-5 text-gray-500" />
								<div>
									<p className="text-sm text-gray-500">
										Phone
									</p>
									<p>{mockProfileData.phone}</p>
								</div>
							</div>
						)}
					</div>
				</div>
			</div>

			{/* Admin Sections */}
			{mockProfileData.role === 'admin' && (
				<>
					{/* Projects Card */}
					{mockProfileData.projects &&
						mockProfileData.projects.length > 0 && (
							<div className="card bg-base-100 shadow">
								<div className="card-body">
									<h2 className="card-title flex items-center gap-2">
										<FolderGit2 className="h-5 w-5" />
										My Projects
									</h2>
									<div className="overflow-x-auto">
										<table className="table">
											<thead>
												<tr>
													<th>Project</th>
													<th>Status</th>
												</tr>
											</thead>
											<tbody>
												{mockProfileData.projects.map(
													(project) => (
														<tr key={project.id}>
															<td>
																{project.name}
															</td>
															<td>
																<span
																	className={`badge ${
																		project.status ===
																		'active'
																			? 'badge-success'
																			: project.status ===
																				  'pending'
																				? 'badge-warning'
																				: 'badge-neutral'
																	}`}
																>
																	{
																		project.status
																	}
																</span>
															</td>
														</tr>
													),
												)}
											</tbody>
										</table>
									</div>
								</div>
							</div>
						)}

					{/* Rooms Card */}
					{mockProfileData.rooms &&
						mockProfileData.rooms.length > 0 && (
							<div className="card bg-base-100 shadow">
								<div className="card-body">
									<h2 className="card-title flex items-center gap-2">
										<Home className="h-5 w-5" />
										Managed Rooms
									</h2>
									<div className="overflow-x-auto">
										<table className="table">
											<thead>
												<tr>
													<th>Room</th>
													<th>Location</th>
												</tr>
											</thead>
											<tbody>
												{mockProfileData.rooms.map(
													(room) => (
														<tr key={room.id}>
															<td>{room.name}</td>
															<td>
																{room.location}
															</td>
														</tr>
													),
												)}
											</tbody>
										</table>
									</div>
								</div>
							</div>
						)}
				</>
			)}

			{/* Action Buttons */}
			<div className="flex gap-4">
				<button className="btn btn-primary">
					<User className="h-4 w-4" />
					Edit Profile
				</button>
				{mockProfileData.role === 'admin' && (
					<button className="btn btn-secondary">
						<Shield className="h-4 w-4" />
						Admin Dashboard
					</button>
				)}
			</div>
		</div>
	)
}
