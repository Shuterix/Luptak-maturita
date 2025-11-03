import Link from 'next/link'
import { Menu, Bell } from 'lucide-react'

export default function NavbarMobile() {
	return (
		<header className="navbar bg-base-100 lg:hidden">
			<div className="flex-none">
				<label htmlFor="my-drawer" className="btn btn-square btn-ghost">
					<Menu className="h-5 w-5" />
				</label>
			</div>
			<div className="flex-1">
				<Link
					href="/dashboard"
					className="btn btn-ghost normal-case text-xl"
				>
					Dashboard
				</Link>
			</div>
			<div className="flex-none">
				<button className="btn btn-square btn-ghost">
					<Bell className="h-5 w-5" />
				</button>
			</div>
		</header>
	)
}
