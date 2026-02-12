'use client'

import { useState, useRef, useEffect } from 'react'
import { Clock, Plus, Trash2, Copy, Check } from 'lucide-react'

type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'

interface TimeWindow {
	start: string
	end: string
}

interface WeeklyAvailability {
	timezone?: string
	monday?: TimeWindow[]
	tuesday?: TimeWindow[]
	wednesday?: TimeWindow[]
	thursday?: TimeWindow[]
	friday?: TimeWindow[]
	saturday?: TimeWindow[]
	sunday?: TimeWindow[]
	exceptions?: {
		date: string
		windows: TimeWindow[]
	}[]
}

const DAYS: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

const DAY_SHORT: Record<DayOfWeek, string> = {
	monday: 'Mon',
	tuesday: 'Tue',
	wednesday: 'Wed',
	thursday: 'Thu',
	friday: 'Fri',
	saturday: 'Sat',
	sunday: 'Sun',
}

const DAY_LABELS: Record<DayOfWeek, string> = {
	monday: 'Monday',
	tuesday: 'Tuesday',
	wednesday: 'Wednesday',
	thursday: 'Thursday',
	friday: 'Friday',
	saturday: 'Saturday',
	sunday: 'Sunday',
}

// Quick presets for common unavailable times
const TIME_PRESETS = [
	{ label: 'Morning', start: '06:00', end: '12:00', icon: '🌅' },
	{ label: 'Afternoon', start: '12:00', end: '17:00', icon: '☀️' },
	{ label: 'Evening', start: '17:00', end: '21:00', icon: '🌇' },
	{ label: 'School Hours', start: '08:00', end: '15:00', icon: '🏫' },
	{ label: 'Work Hours', start: '09:00', end: '17:00', icon: '💼' },
]

interface AvailabilityEditorProps {
	unavailability: WeeklyAvailability
	onChange: (unavailability: WeeklyAvailability) => void
	/** Label e.g. "teach" or "train" */
	activityLabel?: string
}

export default function AvailabilityEditor({
	unavailability,
	onChange,
	activityLabel = 'train',
}: AvailabilityEditorProps) {
	const [selectedDay, setSelectedDay] = useState<DayOfWeek>('monday')
	const [showCopyMenu, setShowCopyMenu] = useState(false)
	const [copiedFrom, setCopiedFrom] = useState<DayOfWeek | null>(null)
	const scrollContainerRef = useRef<HTMLDivElement>(null)

	// Auto-select first day with data, or Monday
	useEffect(() => {
		const dayWithData = DAYS.find(day => unavailability[day] && unavailability[day]!.length > 0)
		if (dayWithData) setSelectedDay(dayWithData)
	}, [])

	// Scroll selected day into view
	useEffect(() => {
		if (scrollContainerRef.current) {
			const selectedBtn = scrollContainerRef.current.querySelector(`[data-day="${selectedDay}"]`)
			if (selectedBtn) {
				selectedBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
			}
		}
	}, [selectedDay])

	const getWindowsForDay = (day: DayOfWeek): TimeWindow[] => {
		return unavailability[day] || []
	}

	const addTimeWindow = (day: DayOfWeek, preset?: { start: string; end: string }) => {
		const existing = getWindowsForDay(day)
		const newWindow = preset || { start: '08:00', end: '15:00' }
		onChange({
			...unavailability,
			[day]: [...existing, newWindow],
		})
	}

	const removeTimeWindow = (day: DayOfWeek, index: number) => {
		const existing = getWindowsForDay(day)
		onChange({
			...unavailability,
			[day]: existing.filter((_, i) => i !== index),
		})
	}

	const updateTimeWindow = (day: DayOfWeek, index: number, field: 'start' | 'end', value: string) => {
		const existing = getWindowsForDay(day)
		onChange({
			...unavailability,
			[day]: existing.map((window, i) =>
				i === index ? { ...window, [field]: value } : window
			),
		})
	}

	const clearDay = (day: DayOfWeek) => {
		onChange({
			...unavailability,
			[day]: [],
		})
	}

	const copyToDay = (fromDay: DayOfWeek, toDay: DayOfWeek) => {
		const windows = getWindowsForDay(fromDay)
		onChange({
			...unavailability,
			[toDay]: [...windows.map(w => ({ ...w }))],
		})
	}

	const copyToAllDays = (fromDay: DayOfWeek) => {
		const windows = getWindowsForDay(fromDay)
		const updated = { ...unavailability }
		DAYS.forEach(day => {
			if (day !== fromDay) {
				updated[day] = [...windows.map(w => ({ ...w }))]
			}
		})
		onChange(updated)
		setCopiedFrom(fromDay)
		setShowCopyMenu(false)
		setTimeout(() => setCopiedFrom(null), 2000)
	}

	const copyToWeekdays = (fromDay: DayOfWeek) => {
		const windows = getWindowsForDay(fromDay)
		const updated = { ...unavailability }
		const weekdays: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
		weekdays.forEach(day => {
			if (day !== fromDay) {
				updated[day] = [...windows.map(w => ({ ...w }))]
			}
		})
		onChange(updated)
		setCopiedFrom(fromDay)
		setShowCopyMenu(false)
		setTimeout(() => setCopiedFrom(null), 2000)
	}

	const adjustTime = (day: DayOfWeek, index: number, field: 'start' | 'end', delta: number) => {
		const existing = getWindowsForDay(day)
		const window = existing[index]
		if (!window) return

		const [h, m] = window[field].split(':').map(Number)
		let totalMinutes = h * 60 + m + delta
		if (totalMinutes < 0) totalMinutes = 0
		if (totalMinutes > 23 * 60 + 59) totalMinutes = 23 * 60 + 59

		const newH = Math.floor(totalMinutes / 60)
		const newM = totalMinutes % 60
		const newValue = `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`

		updateTimeWindow(day, index, field, newValue)
	}

	const currentWindows = getWindowsForDay(selectedDay)
	const hasWindows = currentWindows.length > 0

	return (
		<div className="space-y-4">
			{/* Day selector - horizontal scrollable pills */}
			<div
				ref={scrollContainerRef}
				className="flex gap-1.5 sm:gap-2 overflow-x-auto scrollbar-none px-1 py-1 snap-x snap-mandatory"
				style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
			>
				{DAYS.map((day) => {
					const windows = getWindowsForDay(day)
					const isSelected = selectedDay === day
					const hasData = windows.length > 0

					return (
						<button
							key={day}
							data-day={day}
							type="button"
							onClick={() => setSelectedDay(day)}
							className={`
								snap-center flex-shrink-0 flex flex-col items-center gap-0.5 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl transition-all min-w-[52px]
								${isSelected
									? 'bg-primary text-primary-content shadow-md scale-105'
									: hasData
										? 'bg-error/10 text-error border border-error/30 hover:bg-error/20'
										: 'bg-base-200 text-base-content/70 hover:bg-base-300'
								}
							`}
						>
							<span className="text-[11px] sm:text-xs font-medium uppercase tracking-wide">
								{DAY_SHORT[day]}
							</span>
							{hasData ? (
								<span className={`text-[10px] sm:text-[11px] ${isSelected ? 'text-primary-content/80' : 'text-error/70'}`}>
									{windows.length} block{windows.length !== 1 ? 's' : ''}
								</span>
							) : (
								<span className={`text-[10px] sm:text-[11px] ${isSelected ? 'text-primary-content/70' : 'text-success/60'}`}>
									Free
								</span>
							)}
						</button>
					)
				})}
			</div>

			{/* Selected day header */}
			<div className="flex items-center justify-between">
				<h3 className="font-semibold text-lg text-base-content">
					{DAY_LABELS[selectedDay]}
				</h3>
				<div className="flex items-center gap-1">
					{hasWindows && (
						<>
							<button
								type="button"
								className="btn btn-xs btn-ghost text-base-content/60"
								onClick={() => clearDay(selectedDay)}
								title="Clear all times for this day"
							>
								Clear
							</button>
							<div className="relative">
								<button
									type="button"
									className="btn btn-xs btn-ghost text-base-content/60"
									onClick={() => setShowCopyMenu(!showCopyMenu)}
									title="Copy to other days"
								>
									<Copy className="h-3.5 w-3.5" />
									Copy
								</button>
								{showCopyMenu && (
									<div className="absolute right-0 top-full mt-1 z-20 bg-base-100 border border-base-300 rounded-xl shadow-lg p-2 min-w-[180px]">
										<button
											type="button"
											className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-base-200 transition"
											onClick={() => copyToWeekdays(selectedDay)}
										>
											Copy to weekdays
										</button>
										<button
											type="button"
											className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-base-200 transition"
											onClick={() => copyToAllDays(selectedDay)}
										>
											Copy to all days
										</button>
										<div className="divider my-1 h-0"></div>
										{DAYS.filter(d => d !== selectedDay).map(day => (
											<button
												key={day}
												type="button"
												className="w-full text-left px-3 py-1.5 text-sm rounded-lg hover:bg-base-200 transition"
												onClick={() => {
													copyToDay(selectedDay, day)
													setShowCopyMenu(false)
												}}
											>
												Copy to {DAY_LABELS[day]}
											</button>
										))}
									</div>
								)}
							</div>
						</>
					)}
				</div>
			</div>

			{/* Copied feedback */}
			{copiedFrom && (
				<div className="flex items-center gap-2 text-sm text-success animate-in fade-in duration-300">
					<Check className="h-4 w-4" />
					<span>Copied {DAY_LABELS[copiedFrom]}'s schedule</span>
				</div>
			)}

			{/* Status / time windows */}
			{!hasWindows ? (
				<div className="bg-success/5 border border-success/20 rounded-xl p-4 text-center">
					<p className="text-success font-medium text-sm">
						Available all day
					</p>
					<p className="text-xs text-base-content/50 mt-1">
						No restrictions set. Tap a preset or add a custom time to mark when you cannot {activityLabel}.
					</p>
				</div>
			) : (
				<div className="space-y-3">
					{currentWindows.map((window, index) => (
						<div
							key={index}
							className="bg-error/5 border border-error/20 rounded-xl p-3 sm:p-4"
						>
							<div className="flex items-center justify-between mb-3">
								<span className="text-error/80 text-xs sm:text-sm font-medium flex items-center gap-1.5">
									<Clock className="h-3.5 w-3.5" />
									Cannot {activityLabel}
								</span>
								<button
									type="button"
									onClick={() => removeTimeWindow(selectedDay, index)}
									className="btn btn-xs btn-ghost text-error/60 hover:text-error hover:bg-error/10"
								>
									<Trash2 className="h-3.5 w-3.5" />
								</button>
							</div>

							{/* Time range with +/- buttons */}
							<div className="flex items-center gap-2 sm:gap-3 justify-center flex-wrap">
								{/* FROM time */}
								<div className="flex flex-col items-center gap-1">
									<span className="text-[10px] sm:text-xs text-base-content/50 uppercase tracking-wider">From</span>
									<div className="flex items-center gap-1">
										<button
											type="button"
											onClick={() => adjustTime(selectedDay, index, 'start', -30)}
											className="btn btn-xs btn-circle btn-ghost"
											aria-label="Decrease start time by 30 minutes"
										>
											−
										</button>
										<input
											type="time"
											value={window.start}
											onChange={(e) => updateTimeWindow(selectedDay, index, 'start', e.target.value)}
											className="input input-bordered input-sm w-[110px] sm:w-[120px] text-center font-mono text-base"
										/>
										<button
											type="button"
											onClick={() => adjustTime(selectedDay, index, 'start', 30)}
											className="btn btn-xs btn-circle btn-ghost"
											aria-label="Increase start time by 30 minutes"
										>
											+
										</button>
									</div>
								</div>

								<span className="text-base-content/40 font-bold text-lg mt-4">→</span>

								{/* TO time */}
								<div className="flex flex-col items-center gap-1">
									<span className="text-[10px] sm:text-xs text-base-content/50 uppercase tracking-wider">Until</span>
									<div className="flex items-center gap-1">
										<button
											type="button"
											onClick={() => adjustTime(selectedDay, index, 'end', -30)}
											className="btn btn-xs btn-circle btn-ghost"
											aria-label="Decrease end time by 30 minutes"
										>
											−
										</button>
										<input
											type="time"
											value={window.end}
											onChange={(e) => updateTimeWindow(selectedDay, index, 'end', e.target.value)}
											className="input input-bordered input-sm w-[110px] sm:w-[120px] text-center font-mono text-base"
										/>
										<button
											type="button"
											onClick={() => adjustTime(selectedDay, index, 'end', 30)}
											className="btn btn-xs btn-circle btn-ghost"
											aria-label="Increase end time by 30 minutes"
										>
											+
										</button>
									</div>
								</div>
							</div>
						</div>
					))}
				</div>
			)}

			{/* Quick presets */}
			<div>
				<p className="text-xs text-base-content/50 mb-2 font-medium">Quick add:</p>
				<div className="flex flex-wrap gap-2">
					{TIME_PRESETS.map((preset) => (
						<button
							key={preset.label}
							type="button"
							onClick={() => addTimeWindow(selectedDay, { start: preset.start, end: preset.end })}
							className="btn btn-sm btn-outline gap-1.5 rounded-full text-xs"
						>
							<span>{preset.icon}</span>
							{preset.label}
						</button>
					))}
				</div>
			</div>

			{/* Custom add button */}
			<button
				type="button"
				onClick={() => addTimeWindow(selectedDay)}
				className="btn btn-sm btn-ghost w-full border border-dashed border-base-300 gap-2"
			>
				<Plus className="h-4 w-4" />
				Add Custom Time Block
			</button>

		</div>
	)
}

