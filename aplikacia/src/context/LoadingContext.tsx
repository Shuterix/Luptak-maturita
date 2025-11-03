import { createContext, useContext, useState } from 'react'

// Define the shape of the context
interface LoadingContextType {
	isLoading: boolean
	showLoader: () => void
	hideLoader: () => void
}

// Initialize context (default value if no Provider exists)
const LoadingContext = createContext<LoadingContextType | undefined>(undefined)

// Create a Provider component
export function LoadingProvider({ children }: { children: React.ReactNode }) {
	const [isLoading, setIsLoading] = useState(false)

	const showLoader = () => setIsLoading(true)
	const hideLoader = () => setIsLoading(false)

	return (
		<LoadingContext.Provider value={{ isLoading, showLoader, hideLoader }}>
			{children}
		</LoadingContext.Provider>
	)
}

// Custom hook for easy access
export function useLoading() {
	const context = useContext(LoadingContext)
	if (!context) {
		throw new Error('useLoading must be used within a LoadingProvider!')
	}
	return context
}
