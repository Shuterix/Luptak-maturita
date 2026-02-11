import mongoose, { Schema, Document, Types } from 'mongoose'

export interface INotificationPreference extends Document {
	userId?: Types.ObjectId
	externalTeacherId?: Types.ObjectId
	/** Enable/disable all notifications */
	enabled: boolean
	/** How many hours before the lesson to send a reminder (default: 24 = 1 day) */
	reminderHoursBefore: number
	/** Send a second reminder closer to the lesson (0 = disabled) */
	secondReminderHoursBefore: number
	/** Push notifications enabled */
	pushEnabled: boolean
	createdAt?: Date
	updatedAt?: Date
}

const NotificationPreferenceSchema = new Schema<INotificationPreference>(
	{
		userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
		externalTeacherId: { type: Schema.Types.ObjectId, ref: 'ExternalTeacher', index: true },
		enabled: { type: Boolean, default: true },
		reminderHoursBefore: { type: Number, default: 24 },
		secondReminderHoursBefore: { type: Number, default: 0 },
		pushEnabled: { type: Boolean, default: true },
	},
	{ timestamps: true },
)

// One preference per user
NotificationPreferenceSchema.index({ userId: 1 }, { unique: true, sparse: true })
NotificationPreferenceSchema.index({ externalTeacherId: 1 }, { unique: true, sparse: true })

export default mongoose.models.NotificationPreference ||
	mongoose.model<INotificationPreference>('NotificationPreference', NotificationPreferenceSchema)

