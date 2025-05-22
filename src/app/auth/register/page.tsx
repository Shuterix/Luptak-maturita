import Head from 'next/head'
import Link from 'next/link'

export default function RegisterPage() {
	return (
		<>
			<Head>
				<title>Register</title>
			</Head>
			<div className="flex items-center justify-center min-h-screen bg-base-200 sm:px-0 px-4">
				<div className="w-full max-w-sm p-8 space-y-4 shadow-lg bg-base-100 rounded-box">
					<h2 className="text-2xl font-bold text-center">Register</h2>
					<form className="space-y-4">
						<div className="form-control">
							<label className="label">
								<span className="label-text">Name</span>
							</label>
							<input
								type="text"
								placeholder="Your name"
								className="input input-bordered"
							/>
						</div>
						<div className="form-control">
							<label className="label">
								<span className="label-text">Email</span>
							</label>
							<input
								type="email"
								placeholder="email@example.com"
								className="input input-bordered"
							/>
						</div>
						<div className="form-control">
							<label className="label">
								<span className="label-text">Password</span>
							</label>
							<input
								type="password"
								placeholder="••••••••"
								className="input input-bordered"
							/>
						</div>
						<div className="form-control">
							<button
								type="submit"
								className="btn btn-primary w-full"
							>
								Register
							</button>
						</div>
					</form>
					<p className="text-sm text-center">
						Already have an account?{' '}
						<Link
							href="/auth/login"
							className="text-primary hover:underline"
							prefetch={true}
						>
							Login
						</Link>
					</p>
				</div>
			</div>
		</>
	)
}
