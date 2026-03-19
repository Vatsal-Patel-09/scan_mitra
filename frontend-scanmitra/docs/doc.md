# ScanMitra — Medical Clinic Appointment & Queue Management System
> **Master Reference Document** · Version 1.0 · Next.js Full-Stack

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture Decision Records (ADRs)](#2-architecture-decision-records)
3. [Tech Stack — Final Recommendations](#3-tech-stack--final-recommendations)
4. [System Features](#4-system-features)
   - 4.1 [Patient Features](#41-patient-features)
   - 4.2 [Doctor / Clinic Features](#42-doctor--clinic-features)
   - 4.3 [Admin Features](#43-admin-features)
5. [Data Models (Prisma Schema)](#5-data-models-prisma-schema)
6. [Queue Management System Design](#6-queue-management-system-design)
7. [Real-Time Architecture](#7-real-time-architecture)
8. [SMS & Notifications](#8-sms--notifications)
9. [Authentication & Authorization](#9-authentication--authorization)
10. [API Routes Design](#10-api-routes-design)
11. [Frontend Pages & Components](#11-frontend-pages--components)
12. [Deployment & Infrastructure](#12-deployment--infrastructure)
13. [Environment Variables Reference](#13-environment-variables-reference)
14. [Project Folder Structure](#14-project-folder-structure)
15. [Implementation Roadmap](#15-implementation-roadmap)
16. [Known Risks & Mitigations](#16-known-risks--mitigations)

---

## 1. Project Overview

**ScanMitra** is a full-stack, cloud-native appointment scheduling and real-time queue management platform for medical clinics. It serves two primary user classes — **Patients** and **Doctors/Clinic Staff** — through a unified Next.js application with role-based access control.

### Core Problems Solved

| Problem | Solution |
|---|---|
| Patients waiting without knowing queue position | Real-time queue position updates via WebSocket |
| Double-booked or chaotic scheduling | Central queue manager with slot locking |
| No-shows causing dead slots | SMS reminders + 15-min pre-confirmation window |
| Doctors unable to manage dynamic schedules | Doctor portal with live appointment controls |
| No audit trail for medical visits | Immutable visit records stored in cloud DB |

### High-Level Flow

```
Patient books → Slot reserved in DB → Queue assigned → WebSocket broadcasts position
→ SMS reminder sent → Patient arrives → Doctor marks "In Progress" → "Complete"
```

---

## 2. Architecture Decision Records

### ADR-001: Next.js App Router (not Pages Router)
**Decision:** Use App Router with Server Components.
**Reason:** Server Actions reduce client-server boilerplate; Layouts enable persistent socket connections; streaming enables progressive loading of queue data.

### ADR-002: Neon (PostgreSQL) as Primary Database
**Decision:** Use Neon serverless Postgres.
**Reason:** Neon's branching fits dev/staging/prod workflows. Serverless driver works with Next.js Edge Runtime. Free tier is generous. Prisma has first-class Neon support.
**Alternative considered:** PlanetScale — ruled out due to lack of foreign key support.

### ADR-003: Prisma ORM
**Decision:** Prisma as the sole ORM.
**Reason:** Type-safe queries, auto-generated client, excellent migration tooling, works with Neon via `@prisma/adapter-neon`.

### ADR-004: WebSockets via Ably (not raw WebSocket server)
**Decision:** Use **Ably** (or **Pusher**) as a managed WebSocket layer, NOT a raw `ws` server.
**Reason:** Next.js on Vercel is serverless — you cannot maintain persistent WebSocket server state. Ably/Pusher handle the pub/sub infrastructure; your Next.js API routes publish events; clients subscribe. This is the correct architecture for serverless Next.js.
**Alternative:** If self-hosting (e.g., Railway/Render), a standalone Node WebSocket server co-deployed alongside Next.js is viable.

### ADR-005: Twilio for SMS
**Decision:** Twilio SMS API.
**Reason:** Reliable delivery, Indian number support, webhook support for delivery receipts, simple REST API. Alternative: MSG91 (India-specific, cheaper for INR billing).

### ADR-006: NextAuth.js v5 (Auth.js) for Authentication
**Decision:** Auth.js with Credentials + OTP providers.
**Reason:** Built for Next.js App Router, supports server-side session on Edge, extensible for role-based access. Patients log in via phone OTP; Doctors via email/password.

---

## 3. Tech Stack — Final Recommendations

| Layer | Technology | Why |
|---|---|---|
| **Framework** | Next.js 14+ (App Router) | Full-stack, SSR, Server Actions, Edge |
| **Language** | TypeScript | Type safety across DB → API → UI |
| **Database** | Neon (Serverless PostgreSQL) | Scalable, branching, Prisma-native |
| **ORM** | Prisma | Type-safe, migrations, Neon adapter |
| **Auth** | Auth.js v5 (NextAuth) | App Router native, flexible providers |
| **Real-time** | Ably Realtime | Managed pub/sub over WebSocket/SSE |
| **SMS** | Twilio (or MSG91 for India) | Reliable, delivery receipts, INR billing |
| **Scheduling / Jobs** | Vercel Cron + Upstash QStash | SMS reminders, slot expiry jobs |
| **Caching / Rate Limiting** | Upstash Redis | Queue state cache, API rate limiting |
| **File Storage** | Cloudflare R2 or AWS S3 | Prescription attachments (future) |
| **Deployment** | Vercel | Native Next.js hosting |
| **Monitoring** | Sentry + Vercel Analytics | Error tracking, performance |

---

## 4. System Features

### 4.1 Patient Features

#### 4.1.1 Registration & Profile
- Register with mobile number (OTP verification via Twilio Verify)
- Profile: name, age, gender, blood group, emergency contact
- Medical history tags (optional, for doctor reference)

#### 4.1.2 Clinic & Doctor Discovery
- Search clinics by name, specialty, location
- View doctor profiles: qualifications, specialties, available timings
- View real-time slot availability (live, not cached)

#### 4.1.3 Appointment Booking
- Select clinic → Select doctor → Select date → Select available time slot
- Slot reservation with a **5-minute hold lock** (prevents double booking)
- Add reason for visit / symptoms (optional notes)
- Instant booking confirmation with appointment ID
- Option: **Pre-book** (future date) or **Walk-in Queue Join** (same day)

#### 4.1.4 Pre-booking vs Walk-in Queue
- **Pre-booked:** Specific time slot reserved. Patient gets estimated time window.
- **Walk-in Queue:** Patient joins live queue, gets real-time position updates.
- Both types are managed by the central queue system.

#### 4.1.5 Appointment Management
- View all upcoming and past appointments (dashboard)
- **Reschedule** appointment (up to 2 hours before slot)
- **Cancel** appointment (with configurable cancellation window)
- View queue position in real-time for same-day appointments
- Receive estimated wait time updates

#### 4.1.6 Notifications (SMS + In-App)
- Booking confirmation SMS
- Reminder SMS: 24 hours before, 1 hour before
- "You are next" SMS when position reaches 2
- Cancellation confirmation SMS
- Doctor delay notification SMS

#### 4.1.7 Post-Visit
- View visit summary (diagnosis notes shared by doctor)
- Appointment history with status trail

---

### 4.2 Doctor / Clinic Features

#### 4.2.1 Doctor Profile & Availability Setup
- Set weekly schedule (days + hours, e.g., Mon–Sat, 9 AM – 1 PM)
- Define slot duration (e.g., 15 min, 20 min, 30 min slots)
- Set max patients per day / per slot
- Mark holidays / leave dates (blocks slots system-wide)
- Set buffer time between appointments

#### 4.2.2 Live Queue Dashboard
- Real-time view of today's queue
- Each patient card shows: name, age, reason, booking time, queue position, status
- Queue status indicators: Waiting → In Progress → Completed / No-Show

#### 4.2.3 Appointment Actions
- **Mark as In Progress** (patient enters room) — broadcasts status to patient
- **Mark as Completed** — moves queue forward, notifies next patient
- **Mark No-Show** — removes from queue, slot freed
- **Skip patient** — moves patient to end of queue (emergency cases)
- Add **diagnosis notes / prescription summary** (visible to patient)
- **Extend consultation** — flag that current patient is taking longer, triggers delay SMS to waiting patients

#### 4.2.4 Schedule Management
- Change slot timing dynamically (broadcasts update to affected patients via SMS)
- Cancel specific slots or entire day (mass cancellation with SMS notification)
- Add emergency/walk-in slots on the fly
- Block time ranges (e.g., for hospital rounds)

#### 4.2.5 Analytics (Basic)
- Patients seen today / this week
- Average consultation duration
- No-show rate
- Peak hours visualization

---

### 4.3 Admin Features

- Manage clinics, add/remove doctors
- View all appointments across clinics
- Override any appointment status
- SMS log viewer (sent/failed)
- User management (ban/unban)
- System health dashboard

---

## 5. Data Models (Prisma Schema)

```prisma
// schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL") // for Neon
}

// ─── Users ───────────────────────────────────────────────────────────────────

model User {
  id          String   @id @default(cuid())
  phone       String?  @unique
  email       String?  @unique
  name        String
  role        Role     @default(PATIENT)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  patient     Patient?
  doctor      Doctor?
  sessions    Session[]
}

enum Role {
  PATIENT
  DOCTOR
  ADMIN
}

model Patient {
  id              String        @id @default(cuid())
  userId          String        @unique
  dateOfBirth     DateTime?
  gender          Gender?
  bloodGroup      String?
  emergencyContact String?
  medicalNotes    String?

  user            User          @relation(fields: [userId], references: [id])
  appointments    Appointment[]
}

enum Gender {
  MALE
  FEMALE
  OTHER
}

// ─── Clinic & Doctor ──────────────────────────────────────────────────────────

model Clinic {
  id          String   @id @default(cuid())
  name        String
  address     String
  phone       String
  specialty   String[]
  timezone    String   @default("Asia/Kolkata")
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())

  doctors     Doctor[]
  slots       Slot[]
}

model Doctor {
  id            String   @id @default(cuid())
  userId        String   @unique
  clinicId      String
  qualification String
  specialty     String[]
  slotDuration  Int      @default(15) // minutes
  maxPerDay     Int      @default(30)
  bufferMinutes Int      @default(0)
  isActive      Boolean  @default(true)

  user          User         @relation(fields: [userId], references: [id])
  clinic        Clinic       @relation(fields: [clinicId], references: [id])
  availability  Availability[]
  slots         Slot[]
  appointments  Appointment[]
}

model Availability {
  id        String   @id @default(cuid())
  doctorId  String
  dayOfWeek Int      // 0=Sun, 1=Mon ... 6=Sat
  startTime String   // "09:00"
  endTime   String   // "13:00"
  isActive  Boolean  @default(true)

  doctor    Doctor   @relation(fields: [doctorId], references: [id])

  @@unique([doctorId, dayOfWeek])
}

// ─── Slots ────────────────────────────────────────────────────────────────────

model Slot {
  id          String     @id @default(cuid())
  doctorId    String
  clinicId    String
  startTime   DateTime
  endTime     DateTime
  status      SlotStatus @default(AVAILABLE)
  lockedUntil DateTime?  // for 5-min hold during booking

  doctor      Doctor       @relation(fields: [doctorId], references: [id])
  clinic      Clinic       @relation(fields: [clinicId], references: [id])
  appointment Appointment?

  @@index([doctorId, startTime])
}

enum SlotStatus {
  AVAILABLE
  LOCKED     // temporarily held during booking flow
  BOOKED
  BLOCKED    // doctor marked unavailable
  COMPLETED
}

// ─── Appointments ─────────────────────────────────────────────────────────────

model Appointment {
  id              String            @id @default(cuid())
  patientId       String
  doctorId        String
  slotId          String?           @unique
  type            AppointmentType
  status          AppointmentStatus @default(SCHEDULED)
  queuePosition   Int?
  reason          String?
  diagnosisNotes  String?
  bookedAt        DateTime          @default(now())
  updatedAt       DateTime          @updatedAt
  reminderSent24h Boolean           @default(false)
  reminderSent1h  Boolean           @default(false)

  patient         Patient     @relation(fields: [patientId], references: [id])
  doctor          Doctor      @relation(fields: [doctorId], references: [id])
  slot            Slot?       @relation(fields: [slotId], references: [id])
  smsLogs         SmsLog[]
  statusHistory   AppointmentStatusHistory[]
}

enum AppointmentType {
  PREBOOKED   // specific time slot
  WALKIN      // joins live queue
}

enum AppointmentStatus {
  SCHEDULED
  CONFIRMED
  IN_QUEUE
  IN_PROGRESS
  COMPLETED
  CANCELLED
  NO_SHOW
}

model AppointmentStatusHistory {
  id            String            @id @default(cuid())
  appointmentId String
  status        AppointmentStatus
  changedBy     String            // userId
  changedAt     DateTime          @default(now())
  note          String?

  appointment   Appointment       @relation(fields: [appointmentId], references: [id])
}

// ─── SMS Logs ─────────────────────────────────────────────────────────────────

model SmsLog {
  id            String     @id @default(cuid())
  appointmentId String?
  toPhone       String
  message       String
  type          SmsType
  status        SmsStatus  @default(QUEUED)
  twilioSid     String?
  sentAt        DateTime?
  createdAt     DateTime   @default(now())

  appointment   Appointment? @relation(fields: [appointmentId], references: [id])
}

enum SmsType {
  BOOKING_CONFIRMATION
  REMINDER_24H
  REMINDER_1H
  YOU_ARE_NEXT
  DOCTOR_DELAY
  CANCELLATION
  SLOT_CHANGE
}

enum SmsStatus {
  QUEUED
  SENT
  DELIVERED
  FAILED
}

// ─── Auth (Auth.js compatible) ────────────────────────────────────────────────

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime

  user         User     @relation(fields: [userId], references: [id])
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}
```

---

## 6. Queue Management System Design

### 6.1 Core Queue Rules

1. **One central queue per doctor per day.** Queue is rebuilt from appointments ordered by `queuePosition`.
2. **Pre-booked appointments** get queue positions assigned at booking time, sorted by slot start time.
3. **Walk-in patients** are appended to the end of the current day's queue at the time they check in.
4. **When a patient is marked No-Show or Cancels**, all subsequent queue positions shift up by 1 and a WebSocket broadcast is fired.
5. **Slot locking**: During the booking checkout flow, a slot is `LOCKED` for 5 minutes. If payment/confirmation is not completed, a cron job releases the lock.

### 6.2 Queue State Machine

```
SCHEDULED ──► CONFIRMED ──► IN_QUEUE ──► IN_PROGRESS ──► COMPLETED
                                │                              
                                ├──► CANCELLED (patient/doctor action)
                                └──► NO_SHOW (doctor marks after window)
```

### 6.3 Queue Position Calculation

```typescript
// lib/queue.ts
export async function recalculateQueue(doctorId: string, date: Date) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  // Fetch all active appointments for the doctor today, ordered by slot time
  const appointments = await prisma.appointment.findMany({
    where: {
      doctorId,
      status: { in: ['SCHEDULED', 'CONFIRMED', 'IN_QUEUE', 'IN_PROGRESS'] },
      slot: {
        startTime: { gte: startOfDay, lte: endOfDay }
      }
    },
    include: { slot: true },
    orderBy: { slot: { startTime: 'asc' } }
  });

  // Reassign positions in a transaction
  await prisma.$transaction(
    appointments.map((apt, index) =>
      prisma.appointment.update({
        where: { id: apt.id },
        data: { queuePosition: index + 1 }
      })
    )
  );

  return appointments.length;
}
```

### 6.4 Estimated Wait Time

```typescript
export function estimateWaitTime(
  queuePosition: number,
  avgConsultationMinutes: number,
  currentPatientStartedAt: Date | null
): number {
  const baseWait = (queuePosition - 1) * avgConsultationMinutes;
  if (currentPatientStartedAt) {
    const elapsed = (Date.now() - currentPatientStartedAt.getTime()) / 60000;
    const remaining = Math.max(0, avgConsultationMinutes - elapsed);
    return Math.round(remaining + (queuePosition - 2) * avgConsultationMinutes);
  }
  return baseWait;
}
```

---

## 7. Real-Time Architecture

### 7.1 Why Ably (not raw WebSocket)

Next.js on Vercel is **stateless and serverless**. Each API call may hit a different serverless instance. A raw `ws://` server cannot maintain shared state across instances. Ably/Pusher solve this by acting as the stateful pub/sub broker — your Next.js code just publishes events.

### 7.2 Channel Structure

```
clinic:{clinicId}:queue:{doctorId}:{date}   → Queue updates (patients subscribe)
doctor:{doctorId}:dashboard                  → Doctor's live dashboard
appointment:{appointmentId}:status           → Individual appointment status
```

### 7.3 Event Types

```typescript
type QueueEvent =
  | { type: 'QUEUE_UPDATED'; data: QueueSnapshot }
  | { type: 'POSITION_CHANGED'; data: { appointmentId: string; newPosition: number } }
  | { type: 'STATUS_CHANGED'; data: { appointmentId: string; status: AppointmentStatus } }
  | { type: 'DOCTOR_DELAYED'; data: { doctorId: string; delayMinutes: number } }
  | { type: 'SLOT_CANCELLED'; data: { slotId: string; reason: string } };
```

### 7.4 Publishing Events from Next.js API Routes

```typescript
// lib/ably.ts
import Ably from 'ably';

const ably = new Ably.Rest(process.env.ABLY_API_KEY!);

export async function publishQueueUpdate(doctorId: string, date: string, data: QueueSnapshot) {
  const channel = ably.channels.get(`queue:${doctorId}:${date}`);
  await channel.publish('QUEUE_UPDATED', data);
}
```

### 7.5 Client Subscription (React Hook)

```typescript
// hooks/useQueue.ts
import { useEffect, useState } from 'react';
import * as Ably from 'ably';

export function useQueue(doctorId: string, date: string) {
  const [queue, setQueue] = useState<QueueSnapshot | null>(null);

  useEffect(() => {
    const client = new Ably.Realtime({ authUrl: '/api/ably/token' });
    const channel = client.channels.get(`queue:${doctorId}:${date}`);

    channel.subscribe('QUEUE_UPDATED', (msg) => {
      setQueue(msg.data);
    });

    return () => {
      channel.unsubscribe();
      client.close();
    };
  }, [doctorId, date]);

  return queue;
}
```

---

## 8. SMS & Notifications

### 8.1 Twilio Setup

```typescript
// lib/sms.ts
import twilio from 'twilio';

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
);

const FROM = process.env.TWILIO_PHONE_NUMBER!;

export async function sendSms(to: string, message: string): Promise<string | null> {
  try {
    const result = await client.messages.create({ to, from: FROM, body: message });
    return result.sid;
  } catch (err) {
    console.error('SMS send error:', err);
    return null;
  }
}
```

### 8.2 SMS Templates

```typescript
// lib/sms-templates.ts
export const templates = {
  bookingConfirmation: (name: string, doctor: string, time: string, queueNo: number) =>
    `Hi ${name}! Your appointment with Dr. ${doctor} is confirmed. Time: ${time}. Queue #${queueNo}. ScanMitra`,

  reminder24h: (name: string, doctor: string, time: string) =>
    `Reminder: Hi ${name}, your appointment with Dr. ${doctor} is tomorrow at ${time}. Reply CANCEL to cancel. ScanMitra`,

  reminder1h: (name: string, doctor: string, queuePos: number, waitMins: number) =>
    `Hi ${name}! You are #${queuePos} in queue for Dr. ${doctor}. Est. wait: ${waitMins} mins. Please arrive soon. ScanMitra`,

  youAreNext: (name: string, doctor: string) =>
    `Hi ${name}, you are NEXT for Dr. ${doctor}! Please proceed to the reception. ScanMitra`,

  doctorDelay: (name: string, doctor: string, delayMins: number) =>
    `Hi ${name}, Dr. ${doctor} is running ${delayMins} mins late. We apologize for the delay. ScanMitra`,

  cancellation: (name: string, doctor: string, time: string) =>
    `Hi ${name}, your appointment with Dr. ${doctor} on ${time} has been cancelled. ScanMitra`,
};
```

### 8.3 Scheduled SMS Jobs (Vercel Cron)

```typescript
// app/api/cron/reminders/route.ts
// Vercel Cron: runs every 30 minutes
export async function GET(request: Request) {
  const now = new Date();

  // Find appointments needing 24h reminder
  const upcoming24h = await prisma.appointment.findMany({
    where: {
      reminderSent24h: false,
      status: { in: ['SCHEDULED', 'CONFIRMED'] },
      slot: {
        startTime: {
          gte: addHours(now, 23),
          lte: addHours(now, 25),
        }
      }
    },
    include: { patient: { include: { user: true } }, doctor: { include: { user: true } }, slot: true }
  });

  for (const apt of upcoming24h) {
    const sid = await sendSms(
      apt.patient.user.phone!,
      templates.reminder24h(apt.patient.user.name, apt.doctor.user.name, formatTime(apt.slot!.startTime))
    );
    await prisma.appointment.update({ where: { id: apt.id }, data: { reminderSent24h: true } });
    await logSms(apt.id, apt.patient.user.phone!, 'REMINDER_24H', sid);
  }

  return Response.json({ sent: upcoming24h.length });
}
```

---

## 9. Authentication & Authorization

### 9.1 Strategy

| User Type | Auth Method |
|---|---|
| Patient | Phone number + OTP (via Twilio Verify) |
| Doctor | Email + Password (bcrypt hashed) |
| Admin | Email + Password |

### 9.2 Auth.js Configuration

```typescript
// auth.ts
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    // Doctor / Admin login
    Credentials({
      id: 'email-password',
      credentials: { email: {}, password: {} },
      async authorize(credentials) {
        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string }
        });
        if (!user || !user.passwordHash) return null;
        const valid = await bcrypt.compare(credentials.password as string, user.passwordHash);
        if (!valid) return null;
        return { id: user.id, name: user.name, email: user.email, role: user.role };
      }
    }),
    // Patient OTP login
    Credentials({
      id: 'phone-otp',
      credentials: { phone: {}, otp: {} },
      async authorize(credentials) {
        const verified = await verifyTwilioOtp(credentials.phone as string, credentials.otp as string);
        if (!verified) return null;
        const user = await prisma.user.upsert({
          where: { phone: credentials.phone as string },
          create: { phone: credentials.phone as string, name: 'Patient', role: 'PATIENT' },
          update: {}
        });
        return { id: user.id, name: user.name, phone: user.phone, role: user.role };
      }
    })
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) { token.role = user.role; token.id = user.id; }
      return token;
    },
    session({ session, token }) {
      session.user.role = token.role;
      session.user.id = token.id;
      return session;
    }
  },
  session: { strategy: 'jwt' }
});
```

### 9.3 Route Protection Middleware

```typescript
// middleware.ts
import { auth } from '@/auth';

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const role = req.auth?.user?.role;

  if (pathname.startsWith('/doctor') && role !== 'DOCTOR' && role !== 'ADMIN') {
    return Response.redirect(new URL('/auth/login', req.url));
  }
  if (pathname.startsWith('/admin') && role !== 'ADMIN') {
    return Response.redirect(new URL('/auth/login', req.url));
  }
  if (pathname.startsWith('/dashboard') && !role) {
    return Response.redirect(new URL('/auth/login', req.url));
  }
});

export const config = {
  matcher: ['/dashboard/:path*', '/doctor/:path*', '/admin/:path*']
};
```

---

## 10. API Routes Design

### Patient Endpoints

```
POST   /api/auth/otp/send              → Send OTP to phone
POST   /api/auth/otp/verify            → Verify OTP, return session

GET    /api/clinics                    → List clinics (with filters)
GET    /api/clinics/:id/doctors        → List doctors in clinic
GET    /api/doctors/:id/slots?date=    → Get available slots for date

POST   /api/appointments               → Book appointment
GET    /api/appointments               → Get patient's appointments
GET    /api/appointments/:id           → Get single appointment
PATCH  /api/appointments/:id           → Reschedule appointment
DELETE /api/appointments/:id           → Cancel appointment

GET    /api/appointments/:id/queue     → Real-time queue position (polling fallback)
```

### Doctor Endpoints

```
GET    /api/doctor/queue?date=         → Today's queue
PATCH  /api/doctor/appointments/:id/status  → Update appointment status
POST   /api/doctor/availability        → Set weekly availability
PATCH  /api/doctor/slots/:id           → Modify/block a slot
POST   /api/doctor/delay               → Broadcast delay to waiting patients
GET    /api/doctor/analytics           → Basic stats
```

### Real-Time

```
GET    /api/ably/token                 → Issue Ably auth token for client
```

### Admin

```
GET    /api/admin/clinics              → All clinics
POST   /api/admin/clinics              → Create clinic
GET    /api/admin/sms-logs             → SMS delivery logs
GET    /api/admin/appointments         → All appointments (filterable)
```

---

## 11. Frontend Pages & Components

### Page Map

```
/                           → Landing page
/auth/login                 → Role selector → OTP or Email login
/auth/register              → Patient registration

/dashboard                  → Patient dashboard (upcoming + past)
/dashboard/book             → Clinic search → Doctor select → Slot picker
/dashboard/appointments/:id → Appointment detail + live queue tracker

/doctor                     → Doctor dashboard (today's queue, live)
/doctor/appointments        → All appointments list
/doctor/schedule            → Manage availability + block slots
/doctor/analytics           → Stats overview

/admin                      → Admin panel
/admin/clinics              → Manage clinics
/admin/sms-logs             → SMS delivery dashboard
```

### Key Components

```typescript
// Patient-facing
<QueueTracker appointmentId={id} />       // Real-time queue position widget
<SlotPicker doctorId={id} date={date} />  // Slot grid with live availability
<AppointmentCard appointment={apt} />     // Appointment summary + actions

// Doctor-facing
<LiveQueueBoard doctorId={id} date={d} /> // Real-time draggable queue list
<PatientCard appointment={apt} />         // Patient info + action buttons (Start, Complete, No-Show)
<ScheduleEditor doctorId={id} />          // Weekly availability manager
<DelayBroadcastModal />                   // Trigger delay SMS to all waiting
```

---

## 12. Deployment & Infrastructure

### Vercel (Recommended)

```
Main App          → Vercel (Next.js)
Database          → Neon (PostgreSQL, Serverless)
Real-time         → Ably (Managed WebSocket)
SMS               → Twilio
Job Queue / Cron  → Vercel Cron (simple) or Upstash QStash (reliable)
Cache             → Upstash Redis
```

### Vercel Cron Jobs Setup (`vercel.json`)

```json
{
  "crons": [
    {
      "path": "/api/cron/reminders",
      "schedule": "*/30 * * * *"
    },
    {
      "path": "/api/cron/release-locks",
      "schedule": "*/5 * * * *"
    },
    {
      "path": "/api/cron/mark-noshows",
      "schedule": "0 * * * *"
    }
  ]
}
```

### Neon Database Setup

```bash
# Install Neon adapter
npm install @neondatabase/serverless @prisma/adapter-neon

# Prisma client with Neon adapter
# lib/prisma.ts
import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);
const adapter = new PrismaNeon(sql);
export const prisma = new PrismaClient({ adapter });
```

---

## 13. Environment Variables Reference

```env
# Database
DATABASE_URL=postgresql://user:pass@host.neon.tech/dbname?sslmode=require
DIRECT_URL=postgresql://user:pass@host.neon.tech/dbname?sslmode=require

# Auth
NEXTAUTH_SECRET=your-32-char-secret
NEXTAUTH_URL=https://your-domain.com

# SMS — Twilio
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_PHONE_NUMBER=+1XXXXXXXXXX
TWILIO_VERIFY_SERVICE_SID=VAxxxxxxxxxx

# Real-time — Ably
ABLY_API_KEY=your-ably-api-key
NEXT_PUBLIC_ABLY_PUBLISHABLE_KEY=your-public-key

# Cache — Upstash Redis
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token

# Cron Security
CRON_SECRET=your-cron-secret-for-validation
```

---

## 14. Project Folder Structure

```
ScanMitra/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── (patient)/
│   │   ├── dashboard/
│   │   │   ├── page.tsx
│   │   │   ├── book/page.tsx
│   │   │   └── appointments/[id]/page.tsx
│   ├── (doctor)/
│   │   ├── doctor/
│   │   │   ├── page.tsx
│   │   │   ├── schedule/page.tsx
│   │   │   └── analytics/page.tsx
│   ├── (admin)/
│   │   └── admin/
│   │       ├── page.tsx
│   │       └── sms-logs/page.tsx
│   └── api/
│       ├── auth/[...nextauth]/route.ts
│       ├── ably/token/route.ts
│       ├── appointments/
│       │   ├── route.ts
│       │   └── [id]/
│       │       ├── route.ts
│       │       └── status/route.ts
│       ├── clinics/route.ts
│       ├── doctor/
│       │   ├── queue/route.ts
│       │   └── delay/route.ts
│       └── cron/
│           ├── reminders/route.ts
│           ├── release-locks/route.ts
│           └── mark-noshows/route.ts
├── components/
│   ├── ui/                        ← shadcn/ui components
│   ├── queue/
│   │   ├── QueueTracker.tsx
│   │   ├── LiveQueueBoard.tsx
│   │   └── PatientCard.tsx
│   ├── appointments/
│   │   ├── SlotPicker.tsx
│   │   ├── AppointmentCard.tsx
│   │   └── StatusBadge.tsx
│   └── doctor/
│       ├── ScheduleEditor.tsx
│       └── DelayBroadcastModal.tsx
├── hooks/
│   ├── useQueue.ts
│   ├── useAppointment.ts
│   └── useAbly.ts
├── lib/
│   ├── prisma.ts
│   ├── ably.ts
│   ├── sms.ts
│   ├── sms-templates.ts
│   ├── queue.ts
│   └── auth-utils.ts
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── types/
│   ├── appointment.ts
│   ├── queue.ts
│   └── next-auth.d.ts
├── middleware.ts
├── auth.ts
├── vercel.json
└── .env.local
```

---

## 15. Implementation Roadmap

### Phase 1 — Foundation (Weeks 1–2)
- [ ] Initialize Next.js 14 project with TypeScript
- [ ] Set up Neon DB + Prisma schema + run initial migration
- [ ] Configure Auth.js with email/password for doctors
- [ ] Basic patient registration with phone OTP (Twilio Verify)
- [ ] Clinic and doctor CRUD (admin seeding)
- [ ] Basic slot generation from availability

### Phase 2 — Core Booking (Weeks 3–4)
- [ ] Slot availability API with lock mechanism
- [ ] Appointment booking flow (patient UI: clinic → doctor → slot → confirm)
- [ ] Appointment detail page (patient dashboard)
- [ ] Doctor availability setup UI
- [ ] Booking confirmation SMS

### Phase 3 — Queue System (Weeks 5–6)
- [ ] Queue calculation engine
- [ ] Doctor live queue dashboard
- [ ] Appointment status actions (Start, Complete, No-Show, Skip)
- [ ] Queue recalculation on every status change
- [ ] Ably integration: publish queue events
- [ ] Patient queue tracker component (subscribe to Ably channel)

### Phase 4 — Notifications (Week 7)
- [ ] Vercel Cron: 24h reminder job
- [ ] Vercel Cron: 1h reminder job
- [ ] "You are next" SMS trigger (fires when position becomes 2)
- [ ] Doctor delay broadcast + SMS to all waiting patients
- [ ] SMS delivery logging

### Phase 5 — Polish & Edge Cases (Week 8)
- [ ] Reschedule flow (slot swap logic)
- [ ] Cancellation with slot release
- [ ] Lock expiry job (release 5-min holds)
- [ ] Auto mark no-show (cron: 30 mins after slot with no action)
- [ ] Doctor analytics dashboard
- [ ] Rate limiting (Upstash Redis) on booking and OTP endpoints
- [ ] Error states + retry logic in UI

### Phase 6 — QA & Deployment
- [ ] E2E tests (Playwright) for critical flows
- [ ] Load testing (queue recalculation under concurrent updates)
- [ ] Vercel deployment with environment variables
- [ ] Monitoring: Sentry error tracking
- [ ] Security audit: input validation, auth guards, SQL injection prevention via Prisma

---

## 16. Known Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Double booking race condition | Medium | High | DB-level slot lock with `LOCKED` status + 5-min hold timeout |
| WebSocket connection drops | Medium | Medium | Ably handles reconnection; client-side polling fallback |
| SMS delivery failure | Low | Medium | Retry logic + delivery webhook from Twilio; log all attempts |
| Queue desync between DB and client | Low | High | Authoritative source is always DB; Ably events trigger re-fetch, not direct state mutation |
| Neon cold start latency | Low | Medium | Upstash Redis cache for frequently read queue snapshots |
| Doctor changes slots mid-day | Medium | Medium | Broadcast slot change SMS immediately; recalculate queue |
| Vercel serverless timeout on cron | Low | Low | Keep cron jobs lightweight; paginate large batches |
| OTP abuse / brute force | Medium | High | Rate limit OTP sends (1/min per phone); Twilio Verify has built-in lockout |

---

*This document is the single source of truth for ScanMitra. Update it as decisions evolve.*
