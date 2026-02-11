import mongoose, { Schema, Document, Types } from 'mongoose'

export interface IExternalTeacher extends Document {
	name: string
	code: string // Auto-generated login code (6-char uppercase alphanumeric)
	clubId: Types.ObjectId
	createdAt?: Date
	updatedAt?: Date
}

const ExternalTeacherSchema = new Schema<IExternalTeacher>(
	{
		name: { type: String, required: true },
		code: { type: String, required: true, unique: true },
		clubId: { type: Schema.Types.ObjectId, ref: 'Club', required: true, index: true },
	},
	{ timestamps: true },
)

export default mongoose.models.ExternalTeacher ||
	mongoose.model<IExternalTeacher>('ExternalTeacher', ExternalTeacherSchema)

