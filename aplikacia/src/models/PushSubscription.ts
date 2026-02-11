import mongoose, { Schema, Document, Types } from 'mongoose'

export interface IPushSubscription extends Document {
	userId?: Types.ObjectId
	externalTeacherId?: Types.ObjectId
	endpoint: string
	keys: {
		p256dh: string
		auth: string
	}
	userAgent?: string
	createdAt?: Date
	updatedAt?: Date
}

const PushSubscriptionSchema = new Schema<IPushSubscription>(
	{
		userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
		externalTeacherId: { type: Schema.Types.ObjectId, ref: 'ExternalTeacher', index: true },
		endpoint: { type: String, required: true },
		keys: {
			p256dh: { type: String, required: true },
			auth: { type: String, required: true },
		},
		userAgent: { type: String },
	},
	{ timestamps: true },
)

// Unique subscription per endpoint
PushSubscriptionSchema.index({ endpoint: 1 }, { unique: true })

export default mongoose.models.PushSubscription ||
	mongoose.model<IPushSubscription>('PushSubscription', PushSubscriptionSchema)

