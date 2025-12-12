import mongoose, { Schema, Document, Types } from 'mongoose'

export interface ISavedTimetable extends Document {
	timetableId: Types.ObjectId
	name: string
	description?: string
	createdBy: Types.ObjectId
	isDefault?: boolean
	snapshot: Record<string, unknown>
	createdAt?: Date
	updatedAt?: Date
}

const SavedTimetableSchema = new Schema<ISavedTimetable>(
	{
		timetableId: { type: Schema.Types.ObjectId, ref: 'Timetable', required: true },
		name: { type: String, required: true },
		description: { type: String },
		createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
		isDefault: { type: Boolean, default: false },
		snapshot: { type: Schema.Types.Mixed, required: true },
	},
	{ timestamps: true },
)

export default mongoose.models.SavedTimetable || mongoose.model<ISavedTimetable>('SavedTimetable', SavedTimetableSchema)

