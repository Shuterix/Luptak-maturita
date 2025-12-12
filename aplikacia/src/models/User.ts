import mongoose, { Schema, Document, Types } from 'mongoose'

export interface ITimeWindow {
	start: string // HH:mm format
	end: string // HH:mm format
}

export interface IWeeklyAvailability {
	timezone?: string
	monday?: ITimeWindow[]
	tuesday?: ITimeWindow[]
	wednesday?: ITimeWindow[]
	thursday?: ITimeWindow[]
	friday?: ITimeWindow[]
	saturday?: ITimeWindow[]
	sunday?: ITimeWindow[]
	exceptions?: {
		date: string // yyyy-MM-dd
		windows: ITimeWindow[]
	}[]
}

export interface IUserProfile {
	phone?: string
}

export interface IUser extends Document {
	firstName: string
	lastName: string
	email: string
	password: string
	role: 'student' | 'trainer' | 'admin'
	clubId?: Types.ObjectId
	partnerId?: Types.ObjectId
	profile?: IUserProfile
	onboardingStep?: number
	unavailability?: IWeeklyAvailability // Individual student/trainer unavailability (when they CANNOT train)
	createdAt?: Date
	updatedAt?: Date
}

const UserSchema: Schema<IUser> = new Schema(
	{
		firstName: { type: String, required: true },
		lastName: { type: String, required: true },
		email: { type: String, required: true, unique: true },
		password: { type: String, required: true },
		role: { type: String, enum: ['student', 'trainer', 'admin'] },
		clubId: { type: Schema.Types.ObjectId, ref: 'Club' },
		partnerId: { type: Schema.Types.ObjectId, ref: 'User' },
		profile: {
			phone: { type: String },
		},
		onboardingStep: { type: Number, default: 0 },
		unavailability: {
			timezone: { type: String, default: 'UTC' },
			monday: [{ start: String, end: String }],
			tuesday: [{ start: String, end: String }],
			wednesday: [{ start: String, end: String }],
			thursday: [{ start: String, end: String }],
			friday: [{ start: String, end: String }],
			saturday: [{ start: String, end: String }],
			sunday: [{ start: String, end: String }],
			exceptions: [
				{
					date: String,
					windows: [{ start: String, end: String }],
				},
			],
		},
	},
	{
		timestamps: true,
	},
)

export default mongoose.models.User || mongoose.model<IUser>('User', UserSchema)
