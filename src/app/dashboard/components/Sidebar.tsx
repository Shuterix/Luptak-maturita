import Link from 'next/link'
import {
	Home,
	Settings,
	LogOut,
	User,
	HelpCircle,
	Shield,
	CircleUser,
	Circle,
} from 'lucide-react'
import { ActionButton } from './ActionButton'
import { LogoutButton } from './LogoutButton'

interface NavItem {
	name: string
	href?: string
	icon: React.ReactNode
	isAction?: boolean
}

export default function Sidebar() {
	const mainNavItems: NavItem[] = [
		{
			name: 'Dashboard',
			href: '/dashboard',
			icon: <Home className="h-5 w-5" />,
		},
		{
			name: 'Users',
			href: '/dashboard/users',
			icon: <User className="h-5 w-5" />,
		},
		{
			name: 'Profile',
			href: '/dashboard/profile',
			icon: <CircleUser className="h-5 w-5" />,
		},
	]

	const secondaryNavItems: NavItem[] = [
		{
			name: 'Help & Support',
			href: '/dashboard/help',
			icon: <HelpCircle className="h-5 w-5" />,
		},
		{
			name: 'Settings',
			href: '/dashboard/settings',
			icon: <Settings className="h-5 w-5" />,
		},
		{
			name: 'Logout',
			icon: <LogOut className="h-5 w-5" />,
			isAction: true,
		},
	]

	return (
		<aside className="drawer-side">
			<label
				htmlFor="my-drawer"
				aria-label="close sidebar"
				className="drawer-overlay"
			></label>
			<div className="menu p-4 w-80 h-full bg-base-100 text-base-content">
				<div className="mb-4 p-4 flex items-center space-x-2">
					<Shield className="h-6 w-6 text-primary" />
					<Link href="/dashboard" className="text-xl font-bold">
						Project V1
					</Link>
				</div>

				<nav>
					<ul className="space-y-1">
						{mainNavItems.map((item) => (
							<li key={item.name}>
								<ActionButton
									href={item.href}
									icon={item.icon}
									className="hover:bg-base-200"
								>
									{item.name}
								</ActionButton>
							</li>
						))}
					</ul>
				</nav>

				<div className="mt-auto">
					<div className="divider"></div>
					<nav>
						<ul>
							{secondaryNavItems.map((item) => (
								<li key={item.name}>
									{item.isAction ? (
										<LogoutButton className="hover:bg-base-200" />
									) : (
										<ActionButton
											href={item.href}
											icon={item.icon}
											className="hover:bg-base-200"
										>
											{item.name}
										</ActionButton>
									)}
								</li>
							))}
						</ul>
					</nav>
				</div>
			</div>
		</aside>
	)
}
