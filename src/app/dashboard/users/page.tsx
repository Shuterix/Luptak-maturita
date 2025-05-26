// app/dashboard/users/page.tsx
import {
	User,
	Mail,
	Phone,
	Calendar,
	Shield,
	MoreHorizontal,
} from 'lucide-react'

// Mock user data - replace with your actual data fetching
const mockUsers = [
	{
		id: 1,
		name: 'John Doe',
		email: 'john@example.com',
		phone: '+1 (555) 123-4567',
		role: 'Admin',
		status: 'active',
		joined: '2023-01-15',
	},
	{
		id: 2,
		name: 'Jane Smith',
		email: 'jane@example.com',
		phone: '+1 (555) 987-6543',
		role: 'User',
		status: 'active',
		joined: '2023-02-20',
	},
	{
		id: 3,
		name: 'Robert Johnson',
		email: 'robert@example.com',
		phone: '+1 (555) 456-7890',
		role: 'Editor',
		status: 'inactive',
		joined: '2023-03-10',
	},
	{
		id: 4,
		name: 'Emily Davis',
		email: 'emily@example.com',
		phone: '+1 (555) 789-0123',
		role: 'User',
		status: 'active',
		joined: '2023-04-05',
	},
	{
		id: 5,
		name: 'Michael Wilson',
		email: 'michael@example.com',
		phone: '+1 (555) 234-5678',
		role: 'User',
		status: 'pending',
		joined: '2023-05-12',
	},
]

export default function UsersPage() {
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
								<p className="text-3xl font-bold mt-2">24</p>
							</div>
							<div className="badge badge-primary badge-lg">
								+5 this month
							</div>
						</div>
					</div>
				</div>

				<div className="card bg-base-100 shadow">
					<div className="card-body">
						<h3 className="font-bold text-lg flex items-center gap-2">
							<Shield className="h-5 w-5" />
							Active Users
						</h3>
						<p className="text-3xl font-bold mt-2">18</p>
						<div className="text-sm text-gray-500 mt-1">
							84% active rate
						</div>
					</div>
				</div>

				<div className="card bg-base-100 shadow">
					<div className="card-body">
						<h3 className="font-bold text-lg flex items-center gap-2">
							<Calendar className="h-5 w-5" />
							New This Month
						</h3>
						<p className="text-3xl font-bold mt-2">5</p>
						<div className="text-sm text-gray-500 mt-1">
							+2 from last month
						</div>
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
								{mockUsers.map((user) => (
									<tr key={user.id}>
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
															{user.name
																.split(' ')
																.map(
																	(n) => n[0],
																)
																.join('')}
														</span>
													</div>
												</div>
												<div>
													<div className="font-bold">
														{user.name}
													</div>
													<div className="text-sm text-gray-500">
														ID: {user.id}
													</div>
												</div>
											</div>
										</td>
										<td>
											<div className="flex flex-col gap-1">
												<div className="flex items-center gap-2">
													<Mail className="h-4 w-4" />
													<span>{user.email}</span>
												</div>
												<div className="flex items-center gap-2">
													<Phone className="h-4 w-4" />
													<span>{user.phone}</span>
												</div>
											</div>
										</td>
										<td>
											<span className="badge badge-ghost">
												{user.role}
											</span>
										</td>
										<td>
											<span
												className={`badge ${user.status === 'active' ? 'badge-success' : user.status === 'inactive' ? 'badge-error' : 'badge-warning'}`}
											>
												{user.status}
											</span>
										</td>
										<td>
											<div className="flex items-center gap-2">
												<Calendar className="h-4 w-4" />
												{user.joined}
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
													<li>
														<a className="text-error">
															Delete
														</a>
													</li>
												</ul>
											</div>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</div>
			</div>

			{/* Pagination */}
			<div className="flex justify-center">
				<div className="join">
					<button className="join-item btn">«</button>
					<button className="join-item btn btn-active">1</button>
					<button className="join-item btn">2</button>
					<button className="join-item btn">3</button>
					<button className="join-item btn">»</button>
				</div>
			</div>
		</div>
	)
}
