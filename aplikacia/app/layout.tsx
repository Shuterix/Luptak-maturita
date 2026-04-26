import type { Viewport } from "next"
import { Toaster } from "@/components/ui/sonner"
import { ErrorBoundary } from "@/components/error-boundary"
import { MSClarity } from "@/components/ms-clarity"
import "./_theme/globals.css"

export const viewport: Viewport = {
	width: "device-width",
	initialScale: 1,
	viewportFit: "cover",
}

export default function RootLayout({
	children,
}: { children: React.ReactNode }) {
	return (
		<html lang="en" className="dark" data-theme="dark" suppressHydrationWarning>
			<body className="min-h-svh overflow-x-hidden bg-background text-foreground safe-area-insets flex flex-col">
				<ErrorBoundary>
					<div className="flex min-h-0 flex-1 flex-col">
						{children}
					</div>
				</ErrorBoundary>
				<Toaster />
				<MSClarity />
			</body>
		</html>
	)
}