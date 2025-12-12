import mongoose, { Schema, Document, Types } from 'mongoose'

type LessonType = 'group' | 'individual' | 'couple'
type LessonStatus = 'scheduled' | 'cancelled' | 'completed' | 'no_show' | 'rescheduled'

export interface ITimeWindow {
	start: string
	end: string
}

export interface IDefaultBreak extends ITimeWindow {}

export interface ILesson extends Document {
	kind: 'lesson' | 'break' | 'unused'
	lessonType?: LessonType
	teacherId?: Types.ObjectId
	teacherName?: string
	roomId?: Types.ObjectId
	roomLabel?: string
	studentIds?: Types.ObjectId[]
	studentNames?: string[]
	studentId?: Types.ObjectId
	studentName?: string
	pairId?: Types.ObjectId
	pairLabel?: string
	date: string
	start: string
	end: string
	durationMinutes?: number
	status: LessonStatus
	cancellation?: {
		byUserId?: Types.ObjectId
		reason?: string
		at?: Date
	}
	locked?: boolean
	manualOverride?: boolean
	notes?: string
	metadata?: Record<string, unknown>
	breakType?: 'consecutive' | 'default'
}

export interface ITimetable extends Document {
	clubId: Types.ObjectId
	name: string
	type: 'weekly' | 'yearly' | 'after_school' | 'camp' | 'custom'
	startDate: string
	endDate: string
	dayStart?: string
	dayEnd?: string
	defaultBreaks?: IDefaultBreak[]
	consecutiveLessonLimit?: number
	slotMinutes?: 5 | 10 | 15 | 30
	defaultLessonDuration?: number
	lockedLessonIds?: Types.ObjectId[]
	createdBy: Types.ObjectId
	lessons: ILesson[]
	settings?: {
		daySchedules?: Record<string, { start: string; end: string }>
		ruleEnforcedDuringGeneration?: boolean
		metadata?: Record<string, unknown>
	}
	createdAt?: Date
	updatedAt?: Date
}

const TimeWindowSchema = new Schema<IDefaultBreak>(
	{
		start: { type: String, required: true },
		end: { type: String, required: true },
	},
	{ _id: false },
)

const LessonSchema = new Schema<ILesson>(
	{
		kind: { type: String, enum: ['lesson', 'break', 'unused'], default: 'lesson' },
		lessonType: { type: String, enum: ['group', 'individual', 'couple'], required: false },
		teacherId: { type: Schema.Types.ObjectId, ref: 'User' },
		teacherName: { type: String },
		roomId: { type: Schema.Types.ObjectId },
		roomLabel: { type: String },
		studentIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
		studentNames: [{ type: String }],
		studentId: { type: Schema.Types.ObjectId, ref: 'User' },
		studentName: { type: String },
		pairId: { type: Schema.Types.ObjectId, ref: 'Pair' },
		pairLabel: { type: String },
		date: { type: String, required: true },
		start: { type: String, required: true },
		end: { type: String, required: true },
		durationMinutes: { type: Number },
		status: {
			type: String,
			enum: ['scheduled', 'cancelled', 'completed', 'no_show', 'rescheduled'],
			default: 'scheduled',
		},
		cancellation: {
			byUserId: { type: Schema.Types.ObjectId, ref: 'User' },
			reason: String,
			at: Date,
		},
		locked: { type: Boolean, default: false },
		manualOverride: { type: Boolean, default: false },
		notes: { type: String },
		metadata: { type: Schema.Types.Mixed },
		breakType: { type: String, enum: ['consecutive', 'default'], required: false },
	},
	{ timestamps: true },
)

const TimetableSchema = new Schema<ITimetable>(
	{
		clubId: { type: Schema.Types.ObjectId, ref: 'Club', required: true },
		name: { type: String, required: true },
		type: { type: String, enum: ['weekly', 'yearly', 'after_school', 'camp', 'custom'], required: true },
		startDate: { type: String }, // Optional - validated in pre-save hook
		endDate: { type: String }, // Optional - validated in pre-save hook
		dayStart: { type: String },
		dayEnd: { type: String },
		defaultBreaks: { type: [TimeWindowSchema], default: [] },
		consecutiveLessonLimit: { type: Number },
		slotMinutes: { type: Number, enum: [5, 10, 15, 30], default: 15 },
		defaultLessonDuration: { type: Number, default: 45 },
		lockedLessonIds: [{ type: Schema.Types.ObjectId }],
		createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
		lessons: { type: [LessonSchema], default: [] },
		settings: {
			daySchedules: { type: Schema.Types.Mixed },
			ruleEnforcedDuringGeneration: { type: Boolean, default: true },
			metadata: { type: Schema.Types.Mixed },
		},
	},
	{ timestamps: true },
)

// Pre-validate hook to handle date validation for weekly timetables
// This runs before Mongoose's required validation
TimetableSchema.pre('validate', function(next) {
	// For weekly timetables, allow empty strings or missing dates
	if (this.type === 'weekly') {
		// Set to empty string if not provided (this ensures the field exists for validation)
		if (this.startDate === undefined || this.startDate === null) {
			this.startDate = ''
		}
		if (this.endDate === undefined || this.endDate === null) {
			this.endDate = ''
		}
	} else {
		// For other types, dates are required
		if (!this.startDate || this.startDate.trim() === '') {
			return next(new Error('startDate is required for non-weekly timetables'))
		}
		if (!this.endDate || this.endDate.trim() === '') {
			return next(new Error('endDate is required for non-weekly timetables'))
		}
	}
	next()
})

// Clear the model cache to ensure fresh schema is used
if (mongoose.models.Timetable) {
	delete mongoose.models.Timetable
}

export default mongoose.model<ITimetable>('Timetable', TimetableSchema)

