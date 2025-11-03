/* eslint-disable */

import mongoose from 'mongoose'

const MONGODB_URI = process.env.MONGODB_URI as string

if (!MONGODB_URI) {
    throw new Error(
        'Missing MONGODB_URI. Add it to aplikacia/.env.local (or environment).',
    )
}

let cached = (global as any).mongoose

if (!cached) cached = (global as any).mongoose = { conn: null, promise: null }

async function connectToDatabase() {
	if (cached.conn) return cached.conn

    if (!cached.promise) {
        cached.promise = mongoose
            .connect(MONGODB_URI, {
                bufferCommands: false,
            })
            .then((mongoose) => {
                console.log('DB connected successfully')
                return mongoose
            })
            .catch((err) => {
                // Re-throw so callers know connection failed
                console.error('DB connection error:', err)
                throw err
            })
    }

	cached.conn = await cached.promise
	return cached.conn
}

export default connectToDatabase
