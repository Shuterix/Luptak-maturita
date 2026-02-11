'use client'

import { useState } from 'react'
import Link from 'next/link'
import LoginForm from './LoginForm'
import ExternalLoginForm from './ExternalLoginForm'
import { Logo } from '@/components/Logo'

type LoginTab = 'member' | 'external'

export default function LoginPageClient() {
	const [activeTab, setActiveTab] = useState<LoginTab>('member')

	return (
		<div className="flex items-center justify-center min-h-screen bg-base-200 sm:px-0 px-4">
			<div className="w-full max-w-sm p-8 space-y-4 shadow-lg bg-base-100 rounded-box">
				<div className="text-center mb-2">
					<div className="flex justify-center mb-3">
						<Logo className="h-12 w-12 text-primary" />
					</div>
					<h1 className="text-2xl font-bold">Welcome back</h1>
					<p className="text-sm text-base-content/60">Sign in to your DanceHub account</p>
				</div>

				{/* Login type tabs */}
				<div className="flex rounded-lg border border-base-300 overflow-hidden">
					<button
						type="button"
						className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
							activeTab === 'member'
								? 'bg-primary text-primary-content'
								: 'bg-base-100 hover:bg-base-200 text-base-content'
						}`}
						onClick={() => setActiveTab('member')}
					>
						Member
					</button>
					<button
						type="button"
						className={`flex-1 px-4 py-2 text-sm font-medium transition-colors border-l border-base-300 ${
							activeTab === 'external'
								? 'bg-warning text-warning-content'
								: 'bg-base-100 hover:bg-base-200 text-base-content'
						}`}
						onClick={() => setActiveTab('external')}
					>
						External Teacher
					</button>
				</div>

				{activeTab === 'member' ? (
					<>
						<LoginForm />
						<p className="text-sm text-center text-base-content/70">
							Don&apos;t have an account?{' '}
							<Link
								href="/auth/register"
								className="text-primary hover:underline font-medium"
								prefetch={true}
							>
								Create account
							</Link>
						</p>
					</>
				) : (
					<ExternalLoginForm />
				)}
			</div>
		</div>
	)
}

