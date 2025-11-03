import mongoose, { Schema, Document, Types } from 'mongoose'

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
	},
	{
		timestamps: true,
	},
)

export default mongoose.models.User || mongoose.model<IUser>('User', UserSchema)
