'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { format, parseISO } from 'date-fns'

interface MobileDaySelectorProps {
	dates: string[]
	selectedDate: string
	onDateChange: (date: string) => void
}

export default function MobileDaySelector({
	dates,
	selectedDate,
	onDateChange,
}: MobileDaySelectorProps) {
	const currentIndex = dates.indexOf(selectedDate)

	const goToPrevious = () => {
		if (currentIndex > 0) {
			onDateChange(dates[currentIndex - 1])
		}
	}

	const goToNext = () => {
		if (currentIndex < dates.length - 1) {
			onDateChange(dates[currentIndex + 1])
		}
	}

	const formatDate = (dateStr: string) => {
		try {
			const date = parseISO(dateStr)
			return {
				day: format(date, 'EEEE'),
				date: format(date, 'MMM d'),
			}
		} catch {
			return { day: dateStr, date: '' }
		}
	}

	const formatted = formatDate(selectedDate)

	return (
		<div className="flex items-center justify-between bg-base-100 rounded-xl border border-base-300 p-2 mb-4 sticky top-0 z-10 shadow-sm">
			<button
				onClick={goToPrevious}
				disabled={currentIndex === 0}
				className="btn btn-circle btn-sm btn-ghost disabled:opacity-30"
				aria-label="Previous day"
			>
				<ChevronLeft className="h-5 w-5" />
			</button>

			<div className="flex-1 text-center">
				<p className="font-semibold text-base-content">{formatted.day}</p>
				<p className="text-sm text-base-content/60">{formatted.date}</p>
				<p className="text-xs text-base-content/40 mt-1">
					{currentIndex + 1} of {dates.length}
				</p>
			</div>

			<button
				onClick={goToNext}
				disabled={currentIndex === dates.length - 1}
				className="btn btn-circle btn-sm btn-ghost disabled:opacity-30"
				aria-label="Next day"
			>
				<ChevronRight className="h-5 w-5" />
			</button>
		</div>
	)
}

