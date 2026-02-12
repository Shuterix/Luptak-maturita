import Sidebar from './components/Sidebar'
import NavbarMobile from './components/NavbarMobile'
import BackNavigationGuard from '@/components/BackNavigationGuard'
import { cookies } from 'next/headers'

export default async function DashboardLayout({
	children,
}: {
	children: React.ReactNode
}) {
	const cookieStore = await cookies()
	const role = cookieStore.get('role')?.value

	// External teachers get a minimal layout (no sidebar/navbar)
	if (role === 'external_teacher') {
		return (
			<div className="min-h-screen bg-base-200">
				{children}
			</div>
		)
	}

	return (
		<div className="drawer lg:drawer-open">
			<BackNavigationGuard />
			<input id="my-drawer" type="checkbox" className="drawer-toggle" />
			<div className="drawer-content flex flex-col">
				<NavbarMobile />
				<main className="flex-1 p-3 sm:p-6 lg:p-8 bg-base-200 min-h-screen">
					{children}
				</main>
			</div>
			<Sidebar />
		</div>
	)
}
