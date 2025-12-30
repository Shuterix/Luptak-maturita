'use client'

import { useAuth } from '@/context/AuthContext'
import { TimetableManager } from './timetables/page'
import StudentDashboard from './students/page'

export default function DashboardPage() {
	const { user } = useAuth()

	// Show student dashboard for students
	if (user?.role === 'student') {
		return <StudentDashboard />
	}

	// Show timetable manager for trainers and admins
	return <TimetableManager />
}

