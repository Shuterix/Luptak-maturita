'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
	children: ReactNode
	fallback?: ReactNode
}

interface State {
	hasError: boolean
	error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
	constructor(props: Props) {
		super(props)
		this.state = { hasError: false, error: null }
	}

	static getDerivedStateFromError(error: Error): State {
		return { hasError: true, error }
	}

	componentDidCatch(error: Error, errorInfo: ErrorInfo) {
		console.error('ErrorBoundary caught an error:', error, errorInfo)
	}

	render() {
		if (this.state.hasError) {
			return (
				this.props.fallback || (
					<div className="min-h-screen flex items-center justify-center bg-base-100 p-4">
						<div className="card bg-base-200 shadow-xl max-w-md w-full">
							<div className="card-body">
								<h2 className="card-title text-error">Chyba aplikácie</h2>
								<p className="text-sm">
									Došlo k neočakávanej chybe. Skúste obnoviť stránku alebo sa prihlásiť znova.
								</p>
								<div className="card-actions justify-end mt-4">
									<button
										className="btn btn-primary"
										onClick={() => {
											this.setState({ hasError: false, error: null })
											window.location.reload()
										}}
									>
										Obnoviť stránku
									</button>
								</div>
							</div>
						</div>
					</div>
				)
			)
		}

		return this.props.children
	}
}

