/**
 * Seed script for USB MongoDB – creates demo data for testing DanceHub.
 * Run from app folder: node scripts/seed-usb.js
 * Ensure MongoDB is running (start-db.bat) and MONGODB_URI is in .env.local
 */

const fs = require('fs')
const path = require('path')
const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')

// Load .env.local from app root
const envPath = path.join(__dirname, '..', '.env.local')
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8')
  content.split('\n').forEach((line) => {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m) process.env[m[1].trim()] = m[2].trim()
  })
}

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/dancehub'

const DEMO_PASSWORD = 'password123'

async function run() {
  console.log('Connecting to MongoDB...', MONGODB_URI.replace(/:[^:@]+@/, ':***@'))
  await mongoose.connect(MONGODB_URI)
  console.log('Connected.')

  const db = mongoose.connection.db
  const usersCol = db.collection('users')
  const clubsCol = db.collection('clubs')
  const pairsCol = db.collection('pairs')
  const groupsCol = db.collection('groups')
  const timetablesCol = db.collection('timetables')

  const hashedPassword = await bcrypt.hash(DEMO_PASSWORD, 10)

  // Clear existing demo data (optional – comment out to keep existing data)
  await usersCol.deleteMany({})
  await clubsCol.deleteMany({})
  await pairsCol.deleteMany({})
  await groupsCol.deleteMany({})
  await timetablesCol.deleteMany({})
  console.log('Cleared existing collections.')

  const now = new Date()

  // 1. Club
  const clubId = new mongoose.Types.ObjectId()
  await clubsCol.insertOne({
    _id: clubId,
    name: 'Demo Tanečný klub',
    description: 'Demo klub pre testovanie DanceHub.',
    code: 'DEMO',
    trainers: [],
    students: [],
    pairIds: [],
    timetableIds: [],
    pricing: { individual: 25, group: 15 },
    createdAt: now,
    updatedAt: now,
  })
  console.log('Created club: Demo Tanečný klub (code DEMO)')

  // 2. Admin
  const adminId = new mongoose.Types.ObjectId()
  await usersCol.insertOne({
    _id: adminId,
    firstName: 'Admin',
    lastName: 'Demo',
    email: 'admin@demo.sk',
    password: hashedPassword,
    role: 'admin',
    clubId,
    onboardingStep: 99,
    createdAt: now,
    updatedAt: now,
  })

  // 3. Trainers
  const trainer1Id = new mongoose.Types.ObjectId()
  const trainer2Id = new mongoose.Types.ObjectId()
  await usersCol.insertMany([
    {
      _id: trainer1Id,
      firstName: 'Ján',
      lastName: 'Tréner',
      email: 'trainer1@demo.sk',
      password: hashedPassword,
      role: 'trainer',
      clubId,
      onboardingStep: 99,
      createdAt: now,
      updatedAt: now,
    },
    {
      _id: trainer2Id,
      firstName: 'Mária',
      lastName: 'Trénerová',
      email: 'trainer2@demo.sk',
      password: hashedPassword,
      role: 'trainer',
      clubId,
      onboardingStep: 99,
      createdAt: now,
      updatedAt: now,
    },
  ])

  // 4. Students (4 – two pairs)
  const s1Id = new mongoose.Types.ObjectId()
  const s2Id = new mongoose.Types.ObjectId()
  const s3Id = new mongoose.Types.ObjectId()
  const s4Id = new mongoose.Types.ObjectId()
  await usersCol.insertMany([
    {
      _id: s1Id,
      firstName: 'Peter',
      lastName: 'Študent',
      email: 'student1@demo.sk',
      password: hashedPassword,
      role: 'student',
      clubId,
      partnerId: s2Id,
      onboardingStep: 99,
      createdAt: now,
      updatedAt: now,
    },
    {
      _id: s2Id,
      firstName: 'Anna',
      lastName: 'Študentová',
      email: 'student2@demo.sk',
      password: hashedPassword,
      role: 'student',
      clubId,
      partnerId: s1Id,
      onboardingStep: 99,
      createdAt: now,
      updatedAt: now,
    },
    {
      _id: s3Id,
      firstName: 'Martin',
      lastName: 'Novák',
      email: 'student3@demo.sk',
      password: hashedPassword,
      role: 'student',
      clubId,
      partnerId: s4Id,
      onboardingStep: 99,
      createdAt: now,
      updatedAt: now,
    },
    {
      _id: s4Id,
      firstName: 'Eva',
      lastName: 'Nováková',
      email: 'student4@demo.sk',
      password: hashedPassword,
      role: 'student',
      clubId,
      partnerId: s3Id,
      onboardingStep: 99,
      createdAt: now,
      updatedAt: now,
    },
  ])
  console.log('Created users: 1 admin, 2 trainers, 4 students.')

  // 5. Pairs
  const pair1Id = new mongoose.Types.ObjectId()
  const pair2Id = new mongoose.Types.ObjectId()
  await pairsCol.insertMany([
    {
      _id: pair1Id,
      clubId,
      studentAId: s1Id,
      studentBId: s2Id,
      preferredTeacherId: trainer1Id,
      baseGroups: ['Začiatočníci'],
      createdAt: now,
      updatedAt: now,
    },
    {
      _id: pair2Id,
      clubId,
      studentAId: s3Id,
      studentBId: s4Id,
      preferredTeacherId: trainer2Id,
      baseGroups: ['Pokročilí'],
      createdAt: now,
      updatedAt: now,
    },
  ])
  console.log('Created 2 pairs.')

  // 6. Groups
  await groupsCol.insertMany([
    { _id: new mongoose.Types.ObjectId(), clubId, name: 'Začiatočníci', description: 'Skupina začiatočníkov', createdAt: now, updatedAt: now },
    { _id: new mongoose.Types.ObjectId(), clubId, name: 'Pokročilí', description: 'Skupina pokročilých', createdAt: now, updatedAt: now },
  ])
  console.log('Created 2 groups.')

  // 7. Timetable with a few lessons
  const timetableId = new mongoose.Types.ObjectId()
  const lesson1Id = new mongoose.Types.ObjectId()
  const lesson2Id = new mongoose.Types.ObjectId()
  await timetablesCol.insertOne({
    _id: timetableId,
    clubId,
    name: 'Týždeň 1',
    type: 'weekly',
    startDate: '',
    endDate: '',
    dayStart: '08:00',
    dayEnd: '20:00',
    slotMinutes: 15,
    defaultLessonDuration: 45,
    createdBy: adminId,
    lessons: [
      {
        _id: lesson1Id,
        kind: 'lesson',
        lessonType: 'couple',
        teacherId: trainer1Id,
        teacherName: 'Ján Tréner',
        pairId: pair1Id,
        pairLabel: 'Peter Študent & Anna Študentová',
        date: '2026-03-02',
        start: '10:00',
        end: '10:45',
        durationMinutes: 45,
        status: 'scheduled',
        locked: false,
        manualOverride: false,
        createdAt: now,
        updatedAt: now,
      },
      {
        _id: lesson2Id,
        kind: 'lesson',
        lessonType: 'couple',
        teacherId: trainer2Id,
        teacherName: 'Mária Trénerová',
        pairId: pair2Id,
        pairLabel: 'Martin Novák & Eva Nováková',
        date: '2026-03-02',
        start: '11:00',
        end: '11:45',
        durationMinutes: 45,
        status: 'scheduled',
        locked: false,
        manualOverride: false,
        createdAt: now,
        updatedAt: now,
      },
    ],
    createdAt: now,
    updatedAt: now,
  })
  console.log('Created 1 timetable with 2 lessons.')

  // 8. Update club with refs
  await clubsCol.updateOne(
    { _id: clubId },
    {
      $set: {
        trainers: [trainer1Id, trainer2Id],
        students: [s1Id, s2Id, s3Id, s4Id],
        pairIds: [pair1Id, pair2Id],
        timetableIds: [timetableId],
        updatedAt: new Date(),
      },
    }
  )
  console.log('Updated club with members and timetable.')

  console.log('\n--- Seed done. Demo accounts (password: ' + DEMO_PASSWORD + ') ---')
  console.log('  admin@demo.sk    (admin)')
  console.log('  trainer1@demo.sk, trainer2@demo.sk (trainers)')
  console.log('  student1@demo.sk … student4@demo.sk (students)')
  console.log('----------------------------------------\n')

  await mongoose.disconnect()
  process.exit(0)
}

run().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
