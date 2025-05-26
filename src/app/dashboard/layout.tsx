import Sidebar from './components/Sidebar'
import NavbarMobile from './components/NavbarMobile'

export default function DashboardLayout({
	children,
}: {
	children: React.ReactNode
}) {
	return (
		<div className="drawer lg:drawer-open">
			<input id="my-drawer" type="checkbox" className="drawer-toggle" />
			<div className="drawer-content flex flex-col">
				<NavbarMobile />
				<main className="flex-1 sm:p-8 p-4 bg-base-200 min-h-screen">
					{children}
				</main>
			</div>
			<Sidebar />
		</div>
	)
}
