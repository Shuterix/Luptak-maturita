import mongoose, { Schema, Document, Types } from 'mongoose'

export interface IClub extends Document {
	name: string
	description?: string
	logoUrl?: string
	code: string
	trainers: Types.ObjectId[]
	students: Types.ObjectId[]
	pairIds: Types.ObjectId[]
	scheduleIds: Types.ObjectId[]
	pricing?: {
		individual?: number
		group?: number
	}
	createdAt?: Date
	updatedAt?: Date
}

const ClubSchema: Schema<IClub> = new Schema(
	{
		name: { type: String, required: true },
		description: { type: String },
		logoUrl: { type: String },
		code: { type: String, required: true, unique: true },
		trainers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
		students: [{ type: Schema.Types.ObjectId, ref: 'User' }],
		pairIds: [{ type: Schema.Types.ObjectId, ref: 'Pair' }],
		scheduleIds: [{ type: Schema.Types.ObjectId, ref: 'Lesson' }],
		pricing: {
			individual: { type: Number },
			group: { type: Number },
		},
	},
	{
		timestamps: true,
	},
)

export default mongoose.models.Club || mongoose.model<IClub>('Club', ClubSchema)
