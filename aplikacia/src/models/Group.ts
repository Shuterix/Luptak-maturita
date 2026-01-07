import mongoose, { Schema, Document, Types } from 'mongoose'

export interface IGroup extends Document {
	clubId: Types.ObjectId
	name: string
	description?: string
	createdAt?: Date
	updatedAt?: Date
}

const GroupSchema = new Schema<IGroup>(
	{
		clubId: { type: Schema.Types.ObjectId, ref: 'Club', required: true },
		name: { type: String, required: true },
		description: { type: String },
	},
	{
		timestamps: true,
	},
)

// Ensure unique group names per club
GroupSchema.index({ clubId: 1, name: 1 }, { unique: true })

export default mongoose.models.Group || mongoose.model<IGroup>('Group', GroupSchema)

