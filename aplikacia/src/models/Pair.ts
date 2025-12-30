import mongoose, { Schema, Document, Types } from 'mongoose'

export interface ITimeWindow {
	start: string
	end: string
}

// Match the User model's IWeeklyAvailability format (direct day properties)
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
		date: string
		windows: ITimeWindow[]
	}[]
}

export interface IPair extends Document {
	clubId: Types.ObjectId
	studentAId: Types.ObjectId
	studentBId: Types.ObjectId
	preferredTeacherId?: Types.ObjectId
	baseGroup?: string // e.g., 'juniors1', 'juniors2', 'intermediates', 'advanced'
	unavailability?: IWeeklyAvailability // Calculated union of both partners' unavailability
	createdAt?: Date
	updatedAt?: Date
}

const TimeWindowSchema = new Schema<ITimeWindow>(
	{
		start: { type: String, required: true },
		end: { type: String, required: true },
	},
	{ _id: false },
)

// Use the same format as User model (direct day properties, not nested Map)
const UnavailabilitySchema = new Schema(
	{
		timezone: { type: String, default: 'UTC' },
		monday: [TimeWindowSchema],
		tuesday: [TimeWindowSchema],
		wednesday: [TimeWindowSchema],
		thursday: [TimeWindowSchema],
		friday: [TimeWindowSchema],
		saturday: [TimeWindowSchema],
		sunday: [TimeWindowSchema],
		exceptions: [
			{
				date: { type: String, required: true },
				windows: { type: [TimeWindowSchema], default: [] },
			},
		],
	},
	{ _id: false },
)

const PairSchema = new Schema<IPair>(
	{
		clubId: { type: Schema.Types.ObjectId, ref: 'Club', required: true },
		studentAId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
		studentBId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
		preferredTeacherId: { type: Schema.Types.ObjectId, ref: 'User' },
		baseGroup: { type: String, required: false },
		unavailability: { type: UnavailabilitySchema, required: false },
	},
	{ timestamps: true },
)

export default mongoose.models.Pair || mongoose.model<IPair>('Pair', PairSchema)

