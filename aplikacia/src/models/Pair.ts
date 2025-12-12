import mongoose, { Schema, Document, Types } from 'mongoose'

export interface ITimeWindow {
	start: string
	end: string
}

export interface IWeeklyAvailability {
	timezone: string
	days: Map<string, ITimeWindow[]>
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

const UnavailabilitySchema = new Schema<IWeeklyAvailability>(
	{
		timezone: { type: String, default: 'UTC' },
		days: {
			type: Map,
			of: [TimeWindowSchema],
			default: () => new Map<string, ITimeWindow[]>(),
		},
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

