# ScanMitra — Backend Implementation Roadmap
> **Execution Reference** · Built on top of `scan_mitra` frontend · Next.js App Router + Neon + Prisma + Auth.js + Ably + Twilio

---

## How to Read This Document

- Every task is a **concrete, completable unit** — not a vague goal.
- Tasks are ordered so that **each one builds on the previous**. Do not skip ahead.
- Each task tells you: what file to create/edit, the exact code, and what "done" looks like.
- `[ ]` checkboxes — check them off as you go.

---

## Current State Assessment

Your `scan_mitra` repo has:
- ✅ Next.js 14 App Router with TypeScript
- ✅ Route groups: `(admin)`, `(full-width-pages)/(auth)`, `(ui-elements)`
- ✅ Component library: ui/, form/, charts/, tables/
- ✅ Context: SidebarContext, ThemeContext
- ✅ Hooks: useGoBack, useModal
- ✅ Layout: AppHeader, AppSidebar

**What is missing (everything backend):**
- ❌ No `prisma/` directory or schema
- ❌ No `src/lib/` utility folder
- ❌ No `src/app/api/` routes
- ❌ No `auth.ts` / Auth.js config
- ❌ No `middleware.ts`
- ❌ No `src/types/` definitions
- ❌ No `.env.local` with service credentials
- ❌ No real-time, SMS, or queue logic

---

## What You Will Build — Folder Structure

Everything below will be added to your existing `scan_mitra/` repo:

```
scan_mitra/
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts
│   └── migrations/          ← auto-generated
│
├── src/
│   ├── app/
│   │   └── api/
│   │       ├── auth/[...nextauth]/route.ts
│   │       ├── auth/otp/send/route.ts
│   │       ├── auth/otp/verify/route.ts
│   │       ├── ably/token/route.ts
│   │       ├── clinics/route.ts
│   │       ├── clinics/[id]/doctors/route.ts
│   │       ├── doctors/[id]/slots/route.ts
│   │       ├── appointments/route.ts
│   │       ├── appointments/[id]/route.ts
│   │       ├── appointments/[id]/status/route.ts
│   │       ├── doctor/queue/route.ts
│   │       ├── doctor/delay/route.ts
│   │       ├── admin/clinics/route.ts
│   │       ├── admin/sms-logs/route.ts
│   │       └── cron/
│   │           ├── reminders/route.ts
│   │           ├── release-locks/route.ts
│   │           └── mark-noshows/route.ts
│   │
│   ├── lib/
│   │   ├── prisma.ts
│   │   ├── ably.ts
│   │   ├── sms.ts
│   │   ├── sms-templates.ts
│   │   ├── queue.ts
│   │   ├── slots.ts
│   │   ├── redis.ts
│   │   ├── rate-limit.ts
│   │   └── validations.ts
│   │
│   ├── hooks/
│   │   ├── useAbly.ts
│   │   ├── useQueue.ts
│   │   └── useAppointment.ts
│   │
│   └── types/
│       ├── api.ts
│       └── next-auth.d.ts
│
├── auth.ts                  ← Auth.js root config
├── middleware.ts            ← Route protection
├── vercel.json              ← Cron schedules
└── .env.local               ← All secrets (never commit)
```

---

## Phase 0 — Environment Setup
> **Goal:** All services provisioned, credentials in `.env.local`, packages installed.
> **Time estimate:** 2–4 hours

### Task 0.1 — Install backend packages

```bash
cd scan_mitra

# Database + ORM
npm install prisma @prisma/client @neondatabase/serverless @prisma/adapter-neon

# Auth
npm install next-auth@beta bcryptjs
npm install -D @types/bcryptjs

# Real-time
npm install ably

# SMS
npm install twilio

# Validation
npm install zod

# Caching + Rate limiting
npm install @upstash/redis @upstash/ratelimit

# Utilities
npm install date-fns

# Dev tools
npm install -D ts-node
```

**Done when:** `package.json` contains all of the above. `npm install` succeeds with no peer dependency errors.

---

### Task 0.2 — Provision Neon Database

1. Go to [neon.tech](https://neon.tech) → Create account → New Project → name it `ScanMitra`
2. Choose region: **ap-south-1 (Mumbai)** for India latency
3. Copy the **Connection string** — you need it twice:
   - `DATABASE_URL` — pooled connection (used by Prisma at runtime)
   - `DIRECT_URL` — direct connection (used by Prisma Migrate only)
4. In Neon dashboard → **Branches** → create a `dev` branch for local work, keep `main` for production

**Done when:** You have two PostgreSQL connection strings ready.

---

### Task 0.3 — Provision Ably

1. Go to [ably.com](https://ably.com) → Create account → New App → name `ScanMitra`
2. Go to **API Keys** → copy the **Root Key** (server-side, has all permissions)
3. Create a second key with **Subscribe only** — this is safe to expose to the browser

**Done when:** You have `ABLY_API_KEY` (root, private) and `NEXT_PUBLIC_ABLY_KEY` (subscribe-only, public).

---

### Task 0.4 — Provision Twilio

1. Go to [twilio.com](https://twilio.com) → Create account
2. Get a phone number (Trial gives a free US number; for India production you need DLT registration — use **MSG91** as an alternative, it's India-native and pre-registered for DLT)
3. Go to **Verify** → Create a new Verify Service → copy **Service SID**
4. Copy **Account SID** and **Auth Token** from the Twilio Console dashboard

**Done when:** You have `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`, `TWILIO_VERIFY_SERVICE_SID`.

---

### Task 0.5 — Provision Upstash Redis

1. Go to [upstash.com](https://upstash.com) → Create account → New Database → region **ap-south-1**
2. Copy **REST URL** and **REST Token**

**Done when:** You have `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.

---

### Task 0.6 — Create `.env.local`

Create file at the root of `scan_mitra/` (same level as `package.json`):

```env
# ── Database (Neon) ──────────────────────────────────────────────────────────
DATABASE_URL="postgresql://user:pass@ep-xxx.ap-south-1.aws.neon.tech/ScanMitra?sslmode=require"
DIRECT_URL="postgresql://user:pass@ep-xxx.ap-south-1.aws.neon.tech/ScanMitra?sslmode=require"

# ── Auth.js ──────────────────────────────────────────────────────────────────
AUTH_SECRET="generate-with: openssl rand -base64 32"
AUTH_URL="http://localhost:3000"

# ── Twilio ───────────────────────────────────────────────────────────────────
TWILIO_ACCOUNT_SID="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
TWILIO_AUTH_TOKEN="your_auth_token_here"
TWILIO_PHONE_NUMBER="+1XXXXXXXXXX"
TWILIO_VERIFY_SERVICE_SID="VAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

# ── Ably ─────────────────────────────────────────────────────────────────────
ABLY_API_KEY="xxxx.yyyy:zzzzzzzz"
NEXT_PUBLIC_ABLY_KEY="xxxx.yyyy:zzzzzzzz"

# ── Upstash Redis ────────────────────────────────────────────────────────────
UPSTASH_REDIS_REST_URL="https://xxx.upstash.io"
UPSTASH_REDIS_REST_TOKEN="your_token_here"

# ── Cron Security ────────────────────────────────────────────────────────────
CRON_SECRET="generate-with: openssl rand -hex 32"
```

Verify `.env.local` is in your `.gitignore`. Never commit this file.

**Done when:** App starts with `npm run dev` without missing environment variable warnings.

---

## Phase 1 — Database Foundation
> **Goal:** Prisma schema written, migrated to Neon, seed data loadable.
> **Time estimate:** 4–6 hours

### Task 1.1 — Initialize Prisma

```bash
npx prisma init
```

This creates `prisma/schema.prisma`. Open it and update the datasource block:

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

**Done when:** `prisma/schema.prisma` file exists.

---

### Task 1.2 — Write the Full Prisma Schema

Replace everything in `prisma/schema.prisma` with:

```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["driverAdapters"]
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

// ─── ENUMS ───────────────────────────────────────────────────────────────────

enum Role {
  PATIENT
  DOCTOR
  ADMIN
}

enum Gender {
  MALE
  FEMALE
  OTHER
}

enum SlotStatus {
  AVAILABLE
  LOCKED
  BOOKED
  BLOCKED
  COMPLETED
}

enum AppointmentType {
  PREBOOKED
  WALKIN
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

enum SmsType {
  BOOKING_CONFIRMATION
  REMINDER_24H
  REMINDER_1H
  YOU_ARE_NEXT
  DOCTOR_DELAY
  CANCELLATION
  SLOT_CHANGE
  OTP
}

enum SmsStatus {
  QUEUED
  SENT
  DELIVERED
  FAILED
}

// ─── USER & AUTH ─────────────────────────────────────────────────────────────

model User {
  id            String    @id @default(cuid())
  phone         String?   @unique
  email         String?   @unique
  name          String
  passwordHash  String?
  role          Role      @default(PATIENT)
  isActive      Boolean   @default(true)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  patient       Patient?
  doctor        Doctor?
  sessions      Session[]

  @@index([phone])
  @@index([email])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}

// ─── PATIENT ─────────────────────────────────────────────────────────────────

model Patient {
  id               String        @id @default(cuid())
  userId           String        @unique
  dateOfBirth      DateTime?
  gender           Gender?
  bloodGroup       String?
  emergencyContact String?
  medicalNotes     String?
  createdAt        DateTime      @default(now())

  user             User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  appointments     Appointment[]
}

// ─── CLINIC & DOCTOR ─────────────────────────────────────────────────────────

model Clinic {
  id          String    @id @default(cuid())
  name        String
  address     String
  phone       String
  specialty   String[]
  timezone    String    @default("Asia/Kolkata")
  isActive    Boolean   @default(true)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  doctors     Doctor[]
  slots       Slot[]
}

model Doctor {
  id            String         @id @default(cuid())
  userId        String         @unique
  clinicId      String
  qualification String
  specialty     String[]
  slotDuration  Int            @default(15)
  maxPerDay     Int            @default(30)
  bufferMinutes Int            @default(0)
  isActive      Boolean        @default(true)
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt

  user          User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  clinic        Clinic         @relation(fields: [clinicId], references: [id])
  availability  Availability[]
  slots         Slot[]
  appointments  Appointment[]

  @@index([clinicId])
}

model Availability {
  id        String   @id @default(cuid())
  doctorId  String
  dayOfWeek Int      // 0=Sun, 1=Mon ... 6=Sat
  startTime String   // "09:00"
  endTime   String   // "17:00"
  isActive  Boolean  @default(true)

  doctor    Doctor   @relation(fields: [doctorId], references: [id], onDelete: Cascade)

  @@unique([doctorId, dayOfWeek])
}

// ─── SLOTS ───────────────────────────────────────────────────────────────────

model Slot {
  id          String      @id @default(cuid())
  doctorId    String
  clinicId    String
  startTime   DateTime
  endTime     DateTime
  status      SlotStatus  @default(AVAILABLE)
  lockedBy    String?
  lockedUntil DateTime?

  doctor      Doctor       @relation(fields: [doctorId], references: [id], onDelete: Cascade)
  clinic      Clinic       @relation(fields: [clinicId], references: [id])
  appointment Appointment?

  @@unique([doctorId, startTime])
  @@index([doctorId, startTime])
  @@index([status])
}

// ─── APPOINTMENTS ─────────────────────────────────────────────────────────────

model Appointment {
  id               String            @id @default(cuid())
  patientId        String
  doctorId         String
  slotId           String?           @unique
  type             AppointmentType
  status           AppointmentStatus @default(SCHEDULED)
  queuePosition    Int?
  reason           String?
  diagnosisNotes   String?
  bookedAt         DateTime          @default(now())
  startedAt        DateTime?
  completedAt      DateTime?
  updatedAt        DateTime          @updatedAt
  reminderSent24h  Boolean           @default(false)
  reminderSent1h   Boolean           @default(false)
  nextAlertSent    Boolean           @default(false)

  patient          Patient           @relation(fields: [patientId], references: [id])
  doctor           Doctor            @relation(fields: [doctorId], references: [id])
  slot             Slot?             @relation(fields: [slotId], references: [id])
  smsLogs          SmsLog[]
  statusHistory    AppointmentStatusHistory[]

  @@index([patientId])
  @@index([doctorId, status])
}

model AppointmentStatusHistory {
  id            String            @id @default(cuid())
  appointmentId String
  status        AppointmentStatus
  changedBy     String
  changedAt     DateTime          @default(now())
  note          String?

  appointment   Appointment       @relation(fields: [appointmentId], references: [id], onDelete: Cascade)

  @@index([appointmentId])
}

// ─── SMS LOGS ─────────────────────────────────────────────────────────────────

model SmsLog {
  id            String      @id @default(cuid())
  appointmentId String?
  toPhone       String
  message       String
  type          SmsType
  status        SmsStatus   @default(QUEUED)
  twilioSid     String?
  sentAt        DateTime?
  createdAt     DateTime    @default(now())

  appointment   Appointment? @relation(fields: [appointmentId], references: [id])

  @@index([appointmentId])
  @@index([status])
}
```

**Done when:** `npx prisma validate` passes with no errors.

---

### Task 1.3 — Run Initial Migration

```bash
npx prisma migrate dev --name init
```

Verify by opening Prisma Studio:

```bash
npx prisma studio
# Opens at http://localhost:5555 — check all tables are present
```

**Done when:** All tables visible in Prisma Studio with correct columns.

---

### Task 1.4 — Create Prisma Client Singleton

Create `src/lib/prisma.ts`:

```typescript
import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { neon } from '@neondatabase/serverless';

const createPrismaClient = () => {
  const sql = neon(process.env.DATABASE_URL!);
  const adapter = new PrismaNeon(sql);
  return new PrismaClient({ adapter });
};

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
```

**Done when:** `import { prisma } from '@/lib/prisma'` compiles without TypeScript errors.

---

### Task 1.5 — Write Seed Data

Create `prisma/seed.ts`:

```typescript
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding...');

  const clinic = await prisma.clinic.upsert({
    where: { id: 'clinic-001' },
    update: {},
    create: {
      id: 'clinic-001',
      name: 'ScanMitra Demo Clinic',
      address: '123 Health Street, Ahmedabad, Gujarat',
      phone: '+919876543210',
      specialty: ['General Medicine', 'Cardiology'],
    },
  });

  const doctorUser = await prisma.user.upsert({
    where: { email: 'doctor@demo.com' },
    update: {},
    create: {
      email: 'doctor@demo.com',
      name: 'Dr. Priya Sharma',
      role: 'DOCTOR',
      passwordHash: await bcrypt.hash('doctor123', 12),
    },
  });

  const doctor = await prisma.doctor.upsert({
    where: { userId: doctorUser.id },
    update: {},
    create: {
      userId: doctorUser.id,
      clinicId: clinic.id,
      qualification: 'MBBS, MD (General Medicine)',
      specialty: ['General Medicine'],
      slotDuration: 15,
      maxPerDay: 30,
    },
  });

  // Mon–Sat, 9 AM to 1 PM
  for (const day of [1, 2, 3, 4, 5, 6]) {
    await prisma.availability.upsert({
      where: { doctorId_dayOfWeek: { doctorId: doctor.id, dayOfWeek: day } },
      update: {},
      create: {
        doctorId: doctor.id,
        dayOfWeek: day,
        startTime: '09:00',
        endTime: '13:00',
      },
    });
  }

  await prisma.user.upsert({
    where: { email: 'admin@demo.com' },
    update: {},
    create: {
      email: 'admin@demo.com',
      name: 'Admin User',
      role: 'ADMIN',
      passwordHash: await bcrypt.hash('admin123', 12),
    },
  });

  console.log('Done. Credentials:');
  console.log('  Doctor: doctor@demo.com / doctor123');
  console.log('  Admin:  admin@demo.com  / admin123');
}

main().catch(console.error).finally(() => prisma.$disconnect());
```

Add to `package.json`:
```json
"prisma": {
  "seed": "ts-node --compiler-options {\"module\":\"CommonJS\"} prisma/seed.ts"
}
```

```bash
npx prisma db seed
```

**Done when:** Seed completes, rows visible in Prisma Studio.

---

## Phase 2 — Authentication
> **Goal:** Doctors log in via email/password. Patients log in via phone OTP. Sessions carry user ID and role.
> **Time estimate:** 6–8 hours

### Task 2.1 — Type Augmentation

Create `src/types/next-auth.d.ts`:

```typescript
import { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: 'PATIENT' | 'DOCTOR' | 'ADMIN';
    } & DefaultSession['user'];
  }
  interface User {
    role: 'PATIENT' | 'DOCTOR' | 'ADMIN';
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: 'PATIENT' | 'DOCTOR' | 'ADMIN';
  }
}
```

---

### Task 2.2 — Auth.js Core Config

Create `auth.ts` at **root** of `scan_mitra/` (not inside `src/`):

```typescript
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    // Doctor & Admin: email + password
    Credentials({
      id: 'email-password',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });
        if (!user || !user.passwordHash || !user.isActive) return null;
        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        );
        if (!isValid) return null;
        return { id: user.id, name: user.name, email: user.email ?? undefined, role: user.role };
      },
    }),

    // Patient: phone OTP (runs after OTP verified by separate API route)
    Credentials({
      id: 'phone-otp',
      credentials: {
        phone: { label: 'Phone', type: 'text' },
        verified: { label: 'Verified', type: 'text' },
      },
      async authorize(credentials) {
        if (credentials?.verified !== 'true') return null;
        const phone = credentials.phone as string;
        const user = await prisma.user.upsert({
          where: { phone },
          create: { phone, name: 'Patient', role: 'PATIENT', patient: { create: {} } },
          update: {},
        });
        return { id: user.id, name: user.name, role: user.role };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) { token.id = user.id; token.role = user.role; }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id;
      session.user.role = token.role;
      return session;
    },
  },
  pages: { signIn: '/signin' },
  session: { strategy: 'jwt' },
});
```

---

### Task 2.3 — Auth Route Handler

Create `src/app/api/auth/[...nextauth]/route.ts`:

```typescript
import { handlers } from '@/auth';
export const { GET, POST } = handlers;
```

---

### Task 2.4 — OTP Send Route

Create `src/app/api/auth/otp/send/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';

const client = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);

export async function POST(req: NextRequest) {
  const { phone } = await req.json();

  if (!phone || !/^\+[1-9]\d{7,14}$/.test(phone)) {
    return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 });
  }

  try {
    await client.verify.v2
      .services(process.env.TWILIO_VERIFY_SERVICE_SID!)
      .verifications.create({ to: phone, channel: 'sms' });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('OTP send error:', err);
    return NextResponse.json({ error: 'Failed to send OTP' }, { status: 500 });
  }
}
```

---

### Task 2.5 — OTP Verify Route

Create `src/app/api/auth/otp/verify/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';

const client = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);

export async function POST(req: NextRequest) {
  const { phone, code } = await req.json();

  if (!phone || !code) {
    return NextResponse.json({ error: 'Phone and code required' }, { status: 400 });
  }

  try {
    const check = await client.verify.v2
      .services(process.env.TWILIO_VERIFY_SERVICE_SID!)
      .verificationChecks.create({ to: phone, code });

    if (check.status !== 'approved') {
      return NextResponse.json({ error: 'Invalid OTP' }, { status: 401 });
    }

    // Return verified=true. The client then calls signIn('phone-otp', { phone, verified: 'true' })
    return NextResponse.json({ verified: true });
  } catch (err) {
    console.error('OTP verify error:', err);
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
  }
}
```

---

### Task 2.6 — Route Protection Middleware

Create `middleware.ts` at **root** of `scan_mitra/`:

```typescript
import { auth } from '@/auth';
import { NextResponse } from 'next/server';

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const role = req.auth?.user?.role;
  const isLoggedIn = !!req.auth;

  if (pathname.startsWith('/doctor')) {
    if (!isLoggedIn || (role !== 'DOCTOR' && role !== 'ADMIN')) {
      return NextResponse.redirect(new URL('/signin', req.url));
    }
  }
  if (pathname.startsWith('/admin')) {
    if (!isLoggedIn || role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/signin', req.url));
    }
  }
  if (pathname.startsWith('/dashboard')) {
    if (!isLoggedIn) {
      return NextResponse.redirect(new URL('/signin', req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/doctor/:path*',
    '/admin/:path*',
    '/api/appointments/:path*',
    '/api/doctor/:path*',
    '/api/admin/:path*',
  ],
};
```

**Done when:** Doctor login (`doctor@demo.com` / `doctor123`) works. Session has `id` and `role`. Visiting `/doctor` without login redirects to `/signin`.

---

## Phase 3 — Core API Routes (Clinics, Doctors, Slots)
> **Goal:** Endpoints for clinic discovery, doctor profiles, and slot availability.
> **Time estimate:** 4–6 hours

### Task 3.1 — API Response Helpers

Create `src/types/api.ts`:

```typescript
export type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: string };

export function ok<T>(data: T): ApiResponse<T> {
  return { success: true, data };
}

export function err(error: string): ApiResponse<never> {
  return { success: false, error };
}
```

---

### Task 3.2 — Clinics List API

Create `src/app/api/clinics/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ok, err } from '@/types/api';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const search = searchParams.get('q');
  const specialty = searchParams.get('specialty');

  try {
    const clinics = await prisma.clinic.findMany({
      where: {
        isActive: true,
        ...(search && { name: { contains: search, mode: 'insensitive' } }),
        ...(specialty && { specialty: { has: specialty } }),
      },
      include: {
        doctors: { where: { isActive: true }, select: { id: true, specialty: true } },
        _count: { select: { doctors: true } },
      },
      orderBy: { name: 'asc' },
    });
    return NextResponse.json(ok(clinics));
  } catch (e) {
    return NextResponse.json(err('Failed to fetch clinics'), { status: 500 });
  }
}
```

---

### Task 3.3 — Doctors by Clinic API

Create `src/app/api/clinics/[id]/doctors/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ok, err } from '@/types/api';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const doctors = await prisma.doctor.findMany({
      where: { clinicId: params.id, isActive: true },
      include: {
        user: { select: { name: true, email: true } },
        availability: { where: { isActive: true } },
      },
    });
    return NextResponse.json(ok(doctors));
  } catch (e) {
    return NextResponse.json(err('Failed to fetch doctors'), { status: 500 });
  }
}
```

---

### Task 3.4 — Slot Generator Utility

Create `src/lib/slots.ts`:

```typescript
import { prisma } from '@/lib/prisma';
import { addMinutes, startOfDay, endOfDay } from 'date-fns';

export async function generateSlotsForDate(doctorId: string, date: Date) {
  const dayOfWeek = date.getDay();

  const availability = await prisma.availability.findUnique({
    where: { doctorId_dayOfWeek: { doctorId, dayOfWeek } },
  });
  if (!availability || !availability.isActive) return [];

  const doctor = await prisma.doctor.findUnique({ where: { id: doctorId } });
  if (!doctor) return [];

  const [startH, startM] = availability.startTime.split(':').map(Number);
  const [endH, endM] = availability.endTime.split(':').map(Number);

  const baseDate = startOfDay(date);
  let current = new Date(baseDate);
  current.setHours(startH, startM, 0, 0);

  const endTime = new Date(baseDate);
  endTime.setHours(endH, endM, 0, 0);

  const slotDuration = doctor.slotDuration + doctor.bufferMinutes;

  while (current < endTime) {
    const slotEnd = addMinutes(current, doctor.slotDuration);
    if (slotEnd > endTime) break;

    // Upsert is idempotent — safe to call multiple times
    await prisma.slot.upsert({
      where: { doctorId_startTime: { doctorId, startTime: new Date(current) } },
      create: {
        doctorId,
        clinicId: doctor.clinicId,
        startTime: new Date(current),
        endTime: new Date(slotEnd),
      },
      update: {},
    });

    current = addMinutes(current, slotDuration);
  }

  return prisma.slot.findMany({
    where: {
      doctorId,
      startTime: { gte: startOfDay(date), lte: endOfDay(date) },
      status: 'AVAILABLE',
    },
    orderBy: { startTime: 'asc' },
  });
}

export async function lockSlot(slotId: string, userId: string): Promise<boolean> {
  const now = new Date();
  const lockUntil = addMinutes(now, 5);

  return prisma.$transaction(async (tx) => {
    const slot = await tx.slot.findUnique({ where: { id: slotId } });
    if (!slot) return false;
    if (slot.status === 'BOOKED' || slot.status === 'BLOCKED') return false;
    if (slot.status === 'LOCKED' && slot.lockedUntil && slot.lockedUntil > now) {
      if (slot.lockedBy !== userId) return false;
    }

    await tx.slot.update({
      where: { id: slotId },
      data: { status: 'LOCKED', lockedBy: userId, lockedUntil: lockUntil },
    });
    return true;
  });
}

export async function releaseExpiredLocks() {
  const result = await prisma.slot.updateMany({
    where: { status: 'LOCKED', lockedUntil: { lt: new Date() } },
    data: { status: 'AVAILABLE', lockedBy: null, lockedUntil: null },
  });
  return result.count;
}
```

---

### Task 3.5 — Slots API

Create `src/app/api/doctors/[id]/slots/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { generateSlotsForDate } from '@/lib/slots';
import { ok, err } from '@/types/api';
import { parseISO } from 'date-fns';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const dateStr = new URL(req.url).searchParams.get('date');
  if (!dateStr) return NextResponse.json(err('date query param required'), { status: 400 });

  try {
    const slots = await generateSlotsForDate(params.id, parseISO(dateStr));
    return NextResponse.json(ok(slots));
  } catch (e) {
    return NextResponse.json(err('Failed to fetch slots'), { status: 500 });
  }
}
```

**Done when:** `GET /api/clinics` returns the seeded clinic. `GET /api/doctors/:id/slots?date=2025-04-01` returns generated time slots.

---

## Phase 4 — Appointment Booking
> **Goal:** Patients can book, view, reschedule, and cancel appointments.
> **Time estimate:** 6–8 hours

### Task 4.1 — Validation Schemas

Create `src/lib/validations.ts`:

```typescript
import { z } from 'zod';

export const BookAppointmentSchema = z.object({
  doctorId: z.string().cuid(),
  slotId: z.string().cuid().optional(),
  type: z.enum(['PREBOOKED', 'WALKIN']),
  reason: z.string().max(500).optional(),
});

export const UpdateStatusSchema = z.object({
  status: z.enum(['IN_PROGRESS', 'COMPLETED', 'NO_SHOW', 'CANCELLED']),
  diagnosisNotes: z.string().max(2000).optional(),
  note: z.string().optional(),
});

export function validateCronSecret(req: Request): boolean {
  return req.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`;
}
```

---

### Task 4.2 — Queue Engine

Create `src/lib/queue.ts`:

```typescript
import { prisma } from '@/lib/prisma';
import { startOfDay, endOfDay } from 'date-fns';

export interface QueueEntry {
  appointmentId: string;
  position: number;
  patientName: string;
  reason: string | null;
  status: string;
  estimatedWaitMins: number;
  slotTime: string | null;
}

export interface QueueSnapshot {
  doctorId: string;
  date: string;
  totalPatients: number;
  currentPosition: number | null;
  queue: QueueEntry[];
}

export async function recalculateQueue(doctorId: string, date: Date): Promise<number> {
  const appointments = await prisma.appointment.findMany({
    where: {
      doctorId,
      status: { in: ['SCHEDULED', 'CONFIRMED', 'IN_QUEUE', 'IN_PROGRESS'] },
      slot: { startTime: { gte: startOfDay(date), lte: endOfDay(date) } },
    },
    include: { slot: true },
    orderBy: { slot: { startTime: 'asc' } },
  });

  if (appointments.length === 0) return 0;

  await prisma.$transaction(
    appointments.map((apt, index) =>
      prisma.appointment.update({ where: { id: apt.id }, data: { queuePosition: index + 1 } })
    )
  );

  return appointments.length;
}

export async function getQueueSnapshot(doctorId: string, date: Date): Promise<QueueSnapshot> {
  const doctor = await prisma.doctor.findUnique({ where: { id: doctorId } });
  const avgMins = doctor?.slotDuration ?? 15;

  const appointments = await prisma.appointment.findMany({
    where: {
      doctorId,
      status: { in: ['SCHEDULED', 'CONFIRMED', 'IN_QUEUE', 'IN_PROGRESS'] },
      slot: { startTime: { gte: startOfDay(date), lte: endOfDay(date) } },
    },
    include: {
      patient: { include: { user: { select: { name: true } } } },
      slot: true,
    },
    orderBy: { queuePosition: 'asc' },
  });

  const inProgress = appointments.find((a) => a.status === 'IN_PROGRESS');
  let waitOffset = 0;
  if (inProgress?.startedAt) {
    const elapsed = (Date.now() - inProgress.startedAt.getTime()) / 60000;
    waitOffset = Math.max(0, avgMins - elapsed);
  }

  const queue: QueueEntry[] = appointments.map((apt, i) => ({
    appointmentId: apt.id,
    position: apt.queuePosition ?? i + 1,
    patientName: apt.patient.user.name,
    reason: apt.reason,
    status: apt.status,
    estimatedWaitMins: Math.round(
      apt.status === 'IN_PROGRESS' ? 0 : waitOffset + (i - (inProgress ? 1 : 0)) * avgMins
    ),
    slotTime: apt.slot?.startTime.toISOString() ?? null,
  }));

  return {
    doctorId,
    date: date.toISOString().split('T')[0],
    totalPatients: appointments.length,
    currentPosition: inProgress?.queuePosition ?? null,
    queue,
  };
}
```

---

### Task 4.3 — SMS Utilities

Create `src/lib/sms.ts`:

```typescript
import twilio from 'twilio';
import { prisma } from '@/lib/prisma';
import { SmsType } from '@prisma/client';

const client = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);

export async function sendSms(
  to: string,
  message: string,
  type: SmsType,
  appointmentId?: string
): Promise<void> {
  const log = await prisma.smsLog.create({
    data: { toPhone: to, message, type, appointmentId, status: 'QUEUED' },
  });

  try {
    const result = await client.messages.create({
      to,
      from: process.env.TWILIO_PHONE_NUMBER!,
      body: message,
    });
    await prisma.smsLog.update({
      where: { id: log.id },
      data: { status: 'SENT', twilioSid: result.sid, sentAt: new Date() },
    });
  } catch (e) {
    await prisma.smsLog.update({ where: { id: log.id }, data: { status: 'FAILED' } });
    console.error('SMS failed:', e);
  }
}
```

Create `src/lib/sms-templates.ts`:

```typescript
export const sms = {
  bookingConfirmation: (name: string, doctor: string, time: string, queueNo: number) =>
    `Hi ${name}! Appt confirmed with Dr. ${doctor} at ${time}. Queue #${queueNo}. -ScanMitra`,

  reminder24h: (name: string, doctor: string, date: string) =>
    `Reminder: Hi ${name}, appt with Dr. ${doctor} is tomorrow (${date}). Reply CANCEL to cancel. -ScanMitra`,

  reminder1h: (name: string, queuePos: number, waitMins: number) =>
    `Hi ${name}, you are #${queuePos} in queue. Est. wait ~${waitMins} mins. Head over now. -ScanMitra`,

  youAreNext: (name: string, doctor: string) =>
    `Hi ${name}, you are NEXT for Dr. ${doctor}! Please go to reception now. -ScanMitra`,

  doctorDelay: (name: string, doctor: string, delayMins: number) =>
    `Hi ${name}, Dr. ${doctor} is running ~${delayMins} mins late. Sorry for the delay. -ScanMitra`,

  cancellation: (name: string, doctor: string) =>
    `Hi ${name}, your appt with Dr. ${doctor} has been cancelled. -ScanMitra`,
};
```

---

### Task 4.4 — Ably Publisher Utility

Create `src/lib/ably.ts`:

```typescript
import Ably from 'ably';
import type { QueueSnapshot } from './queue';

let _ably: Ably.Rest | null = null;
function getAbly() {
  if (!_ably) _ably = new Ably.Rest(process.env.ABLY_API_KEY!);
  return _ably;
}

export async function publishQueueUpdate(doctorId: string, date: string, snapshot: QueueSnapshot) {
  const channel = getAbly().channels.get(`queue:${doctorId}:${date}`);
  await channel.publish('QUEUE_UPDATED', snapshot);
}

export async function publishStatusChange(appointmentId: string, status: string) {
  const channel = getAbly().channels.get(`appointment:${appointmentId}`);
  await channel.publish('STATUS_CHANGED', { appointmentId, status });
}
```

---

### Task 4.5 — Ably Token Endpoint

Create `src/app/api/ably/token/route.ts`:

```typescript
import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import Ably from 'ably';

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const ably = new Ably.Rest(process.env.ABLY_API_KEY!);
  const tokenRequest = await ably.auth.createTokenRequest({ clientId: session.user.id });
  return NextResponse.json(tokenRequest);
}
```

---

### Task 4.6 — Book / List Appointments API

Create `src/app/api/appointments/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { lockSlot } from '@/lib/slots';
import { recalculateQueue, getQueueSnapshot } from '@/lib/queue';
import { sendSms } from '@/lib/sms';
import { sms } from '@/lib/sms-templates';
import { publishQueueUpdate } from '@/lib/ably';
import { BookAppointmentSchema } from '@/lib/validations';
import { ok, err } from '@/types/api';
import { format } from 'date-fns';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== 'PATIENT') {
    return NextResponse.json(err('Unauthorized'), { status: 401 });
  }

  const body = await req.json();
  const parsed = BookAppointmentSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json(err('Invalid data'), { status: 400 });

  const { doctorId, slotId, type, reason } = parsed.data;

  const patient = await prisma.patient.findUnique({
    where: { userId: session.user.id },
    include: { user: true },
  });
  if (!patient) return NextResponse.json(err('Patient profile not found'), { status: 404 });

  try {
    // Lock slot to prevent race condition
    if (type === 'PREBOOKED' && slotId) {
      const locked = await lockSlot(slotId, session.user.id);
      if (!locked) return NextResponse.json(err('Slot is no longer available'), { status: 409 });
    }

    const appointment = await prisma.appointment.create({
      data: { patientId: patient.id, doctorId, slotId, type, status: 'SCHEDULED', reason },
      include: { slot: true, doctor: { include: { user: true } } },
    });

    if (slotId) {
      await prisma.slot.update({
        where: { id: slotId },
        data: { status: 'BOOKED', lockedBy: null, lockedUntil: null },
      });
    }

    const date = appointment.slot?.startTime ?? new Date();
    await recalculateQueue(doctorId, date);

    const updated = await prisma.appointment.findUnique({ where: { id: appointment.id } });

    const dateStr = format(date, 'yyyy-MM-dd');
    const snapshot = await getQueueSnapshot(doctorId, date);
    await publishQueueUpdate(doctorId, dateStr, snapshot);

    if (patient.user.phone) {
      const timeStr = appointment.slot
        ? format(appointment.slot.startTime, 'dd MMM, hh:mm a')
        : 'Today (Walk-in)';
      await sendSms(
        patient.user.phone,
        sms.bookingConfirmation(patient.user.name, appointment.doctor.user.name, timeStr, updated?.queuePosition ?? 0),
        'BOOKING_CONFIRMATION',
        appointment.id
      );
    }

    await prisma.appointmentStatusHistory.create({
      data: { appointmentId: appointment.id, status: 'SCHEDULED', changedBy: session.user.id },
    });

    return NextResponse.json(ok(updated), { status: 201 });
  } catch (e) {
    console.error('Booking error:', e);
    return NextResponse.json(err('Booking failed'), { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json(err('Unauthorized'), { status: 401 });

  const patient = await prisma.patient.findUnique({ where: { userId: session.user.id } });
  if (!patient) return NextResponse.json(err('Not found'), { status: 404 });

  const appointments = await prisma.appointment.findMany({
    where: { patientId: patient.id },
    include: {
      slot: true,
      doctor: { include: { user: { select: { name: true } }, clinic: true } },
    },
    orderBy: { bookedAt: 'desc' },
  });

  return NextResponse.json(ok(appointments));
}
```

---

### Task 4.7 — Get / Cancel Single Appointment

Create `src/app/api/appointments/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { recalculateQueue, getQueueSnapshot } from '@/lib/queue';
import { publishQueueUpdate } from '@/lib/ably';
import { sendSms } from '@/lib/sms';
import { sms } from '@/lib/sms-templates';
import { ok, err } from '@/types/api';
import { format } from 'date-fns';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json(err('Unauthorized'), { status: 401 });

  const appointment = await prisma.appointment.findUnique({
    where: { id: params.id },
    include: {
      slot: true,
      doctor: { include: { user: true, clinic: true } },
      statusHistory: { orderBy: { changedAt: 'asc' } },
    },
  });
  if (!appointment) return NextResponse.json(err('Not found'), { status: 404 });

  return NextResponse.json(ok(appointment));
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json(err('Unauthorized'), { status: 401 });

  const appointment = await prisma.appointment.findUnique({
    where: { id: params.id },
    include: { slot: true, patient: { include: { user: true } }, doctor: { include: { user: true } } },
  });
  if (!appointment) return NextResponse.json(err('Not found'), { status: 404 });

  await prisma.appointment.update({ where: { id: params.id }, data: { status: 'CANCELLED' } });

  if (appointment.slotId) {
    await prisma.slot.update({ where: { id: appointment.slotId }, data: { status: 'AVAILABLE' } });
  }

  const date = appointment.slot?.startTime ?? new Date();
  await recalculateQueue(appointment.doctorId, date);
  const dateStr = format(date, 'yyyy-MM-dd');
  const snapshot = await getQueueSnapshot(appointment.doctorId, date);
  await publishQueueUpdate(appointment.doctorId, dateStr, snapshot);

  await prisma.appointmentStatusHistory.create({
    data: { appointmentId: params.id, status: 'CANCELLED', changedBy: session.user.id },
  });

  if (appointment.patient.user.phone) {
    await sendSms(
      appointment.patient.user.phone,
      sms.cancellation(appointment.patient.user.name, appointment.doctor.user.name),
      'CANCELLATION',
      params.id
    );
  }

  return NextResponse.json(ok({ cancelled: true }));
}
```

**Done when:** `POST /api/appointments` books, returns queue position, sends SMS, broadcasts to Ably. `DELETE` cancels and frees the slot.

---

## Phase 5 — Doctor Queue & Actions
> **Goal:** Doctor portal APIs for live queue management and status actions.
> **Time estimate:** 4–6 hours

### Task 5.1 — Doctor Queue API

Create `src/app/api/doctor/queue/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getQueueSnapshot } from '@/lib/queue';
import { ok, err } from '@/types/api';
import { parseISO } from 'date-fns';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user.role !== 'DOCTOR' && session.user.role !== 'ADMIN')) {
    return NextResponse.json(err('Unauthorized'), { status: 401 });
  }

  const dateStr = new URL(req.url).searchParams.get('date') ?? new Date().toISOString().split('T')[0];
  const doctor = await prisma.doctor.findUnique({ where: { userId: session.user.id } });
  if (!doctor) return NextResponse.json(err('Doctor not found'), { status: 404 });

  const snapshot = await getQueueSnapshot(doctor.id, parseISO(dateStr));
  return NextResponse.json(ok(snapshot));
}
```

---

### Task 5.2 — Status Update API (Doctor Actions)

Create `src/app/api/appointments/[id]/status/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { recalculateQueue, getQueueSnapshot } from '@/lib/queue';
import { publishQueueUpdate, publishStatusChange } from '@/lib/ably';
import { sendSms } from '@/lib/sms';
import { sms } from '@/lib/sms-templates';
import { UpdateStatusSchema } from '@/lib/validations';
import { ok, err } from '@/types/api';
import { format } from 'date-fns';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session || (session.user.role !== 'DOCTOR' && session.user.role !== 'ADMIN')) {
    return NextResponse.json(err('Unauthorized'), { status: 401 });
  }

  const parsed = UpdateStatusSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json(err('Invalid data'), { status: 400 });

  const { status, diagnosisNotes, note } = parsed.data;

  const appointment = await prisma.appointment.findUnique({
    where: { id: params.id },
    include: {
      patient: { include: { user: true } },
      doctor: { include: { user: true } },
      slot: true,
    },
  });
  if (!appointment) return NextResponse.json(err('Not found'), { status: 404 });

  const updateData: Record<string, unknown> = { status };
  if (status === 'IN_PROGRESS') updateData.startedAt = new Date();
  if (status === 'COMPLETED') {
    updateData.completedAt = new Date();
    if (diagnosisNotes) updateData.diagnosisNotes = diagnosisNotes;
  }

  await prisma.appointment.update({ where: { id: params.id }, data: updateData });

  if ((status === 'COMPLETED' || status === 'NO_SHOW') && appointment.slotId) {
    await prisma.slot.update({ where: { id: appointment.slotId }, data: { status: 'COMPLETED' } });
  }

  await prisma.appointmentStatusHistory.create({
    data: { appointmentId: params.id, status, changedBy: session.user.id, note },
  });

  const date = appointment.slot?.startTime ?? new Date();
  await recalculateQueue(appointment.doctorId, date);
  const dateStr = format(date, 'yyyy-MM-dd');
  const snapshot = await getQueueSnapshot(appointment.doctorId, date);
  await publishQueueUpdate(appointment.doctorId, dateStr, snapshot);
  await publishStatusChange(params.id, status);

  // "You are next" SMS for position-2 patient
  if (status === 'COMPLETED' || status === 'NO_SHOW') {
    const nextTwo = snapshot.queue.find((q) => q.position === 2);
    if (nextTwo) {
      const nextAppt = await prisma.appointment.findUnique({
        where: { id: nextTwo.appointmentId },
        include: { patient: { include: { user: true } } },
      });
      if (nextAppt?.patient.user.phone && !nextAppt.nextAlertSent) {
        await sendSms(
          nextAppt.patient.user.phone,
          sms.youAreNext(nextAppt.patient.user.name, appointment.doctor.user.name),
          'YOU_ARE_NEXT',
          nextAppt.id
        );
        await prisma.appointment.update({ where: { id: nextAppt.id }, data: { nextAlertSent: true } });
      }
    }
  }

  return NextResponse.json(ok({ updated: true, snapshot }));
}
```

---

### Task 5.3 — Doctor Delay Broadcast

Create `src/app/api/doctor/delay/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { sendSms } from '@/lib/sms';
import { sms } from '@/lib/sms-templates';
import { ok, err } from '@/types/api';
import { startOfDay, endOfDay } from 'date-fns';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== 'DOCTOR') {
    return NextResponse.json(err('Unauthorized'), { status: 401 });
  }

  const { delayMinutes } = await req.json();
  if (!delayMinutes || delayMinutes < 5) {
    return NextResponse.json(err('Delay must be at least 5 minutes'), { status: 400 });
  }

  const doctor = await prisma.doctor.findUnique({
    where: { userId: session.user.id },
    include: { user: true },
  });
  if (!doctor) return NextResponse.json(err('Doctor not found'), { status: 404 });

  const now = new Date();
  const waiting = await prisma.appointment.findMany({
    where: {
      doctorId: doctor.id,
      status: { in: ['SCHEDULED', 'CONFIRMED', 'IN_QUEUE'] },
      slot: { startTime: { gte: startOfDay(now), lte: endOfDay(now) } },
    },
    include: { patient: { include: { user: true } } },
  });

  let sent = 0;
  for (const apt of waiting) {
    if (apt.patient.user.phone) {
      await sendSms(
        apt.patient.user.phone,
        sms.doctorDelay(apt.patient.user.name, doctor.user.name, delayMinutes),
        'DOCTOR_DELAY',
        apt.id
      );
      sent++;
    }
  }

  return NextResponse.json(ok({ sent, delayMinutes }));
}
```

**Done when:** Doctor can mark IN_PROGRESS / COMPLETED / NO_SHOW via API. Queue recalculates, broadcasts. "You are next" SMS fires automatically.

---

## Phase 6 — Cron Jobs
> **Goal:** Automated reminders, lock cleanup, no-show detection.
> **Time estimate:** 3–4 hours

### Task 6.1 — 24h & 1h Reminder Cron

Create `src/app/api/cron/reminders/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendSms } from '@/lib/sms';
import { sms } from '@/lib/sms-templates';
import { validateCronSecret } from '@/lib/validations';
import { addHours, format } from 'date-fns';

export async function GET(req: NextRequest) {
  if (!validateCronSecret(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const now = new Date();
  let sent = 0;

  // 24h reminders
  const for24h = await prisma.appointment.findMany({
    where: {
      reminderSent24h: false,
      status: { in: ['SCHEDULED', 'CONFIRMED'] },
      slot: { startTime: { gte: addHours(now, 23), lte: addHours(now, 25) } },
    },
    include: { patient: { include: { user: true } }, doctor: { include: { user: true } }, slot: true },
  });

  for (const apt of for24h) {
    if (apt.patient.user.phone && apt.slot) {
      await sendSms(
        apt.patient.user.phone,
        sms.reminder24h(apt.patient.user.name, apt.doctor.user.name, format(apt.slot.startTime, 'dd MMM hh:mm a')),
        'REMINDER_24H',
        apt.id
      );
      await prisma.appointment.update({ where: { id: apt.id }, data: { reminderSent24h: true } });
      sent++;
    }
  }

  // 1h reminders
  const for1h = await prisma.appointment.findMany({
    where: {
      reminderSent1h: false,
      status: { in: ['SCHEDULED', 'CONFIRMED'] },
      slot: { startTime: { gte: addHours(now, 0.75), lte: addHours(now, 1.25) } },
    },
    include: { patient: { include: { user: true } } },
  });

  for (const apt of for1h) {
    if (apt.patient.user.phone) {
      await sendSms(
        apt.patient.user.phone,
        sms.reminder1h(apt.patient.user.name, apt.queuePosition ?? 0, (apt.queuePosition ?? 1) * 15),
        'REMINDER_1H',
        apt.id
      );
      await prisma.appointment.update({ where: { id: apt.id }, data: { reminderSent1h: true } });
      sent++;
    }
  }

  return NextResponse.json({ ok: true, sent });
}
```

---

### Task 6.2 — Release Locks Cron

Create `src/app/api/cron/release-locks/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { releaseExpiredLocks } from '@/lib/slots';
import { validateCronSecret } from '@/lib/validations';

export async function GET(req: NextRequest) {
  if (!validateCronSecret(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const released = await releaseExpiredLocks();
  return NextResponse.json({ ok: true, released });
}
```

---

### Task 6.3 — Auto Mark No-Show Cron

Create `src/app/api/cron/mark-noshows/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { recalculateQueue, getQueueSnapshot } from '@/lib/queue';
import { publishQueueUpdate } from '@/lib/ably';
import { validateCronSecret } from '@/lib/validations';
import { subMinutes, format } from 'date-fns';

export async function GET(req: NextRequest) {
  if (!validateCronSecret(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const threshold = subMinutes(new Date(), 30);

  const noShows = await prisma.appointment.findMany({
    where: {
      status: { in: ['SCHEDULED', 'CONFIRMED', 'IN_QUEUE'] },
      slot: { startTime: { lte: threshold } },
    },
    include: { slot: true },
  });

  const doctorsToUpdate = new Set<string>();
  for (const apt of noShows) {
    await prisma.appointment.update({ where: { id: apt.id }, data: { status: 'NO_SHOW' } });
    if (apt.slotId) {
      await prisma.slot.update({ where: { id: apt.slotId }, data: { status: 'COMPLETED' } });
    }
    doctorsToUpdate.add(`${apt.doctorId}::${apt.slot?.startTime.toISOString().split('T')[0]}`);
  }

  for (const key of doctorsToUpdate) {
    const [doctorId, dateStr] = key.split('::');
    await recalculateQueue(doctorId, new Date(dateStr));
    const snapshot = await getQueueSnapshot(doctorId, new Date(dateStr));
    await publishQueueUpdate(doctorId, dateStr, snapshot);
  }

  return NextResponse.json({ ok: true, marked: noShows.length });
}
```

---

### Task 6.4 — Register Crons

Create `vercel.json` at root:

```json
{
  "crons": [
    { "path": "/api/cron/reminders",      "schedule": "*/30 * * * *" },
    { "path": "/api/cron/release-locks",  "schedule": "*/5 * * * *"  },
    { "path": "/api/cron/mark-noshows",   "schedule": "0 * * * *"    }
  ]
}
```

**Done when:** Each cron route returns 200 with the correct `Authorization: Bearer {CRON_SECRET}` header.

---

## Phase 7 — Real-Time React Hooks
> **Goal:** Frontend hooks that subscribe to Ably for live queue data.
> **Time estimate:** 2–3 hours

### Task 7.1 — Base Ably Hook

Create `src/hooks/useAbly.ts`:

```typescript
import { useEffect, useRef } from 'react';
import * as Ably from 'ably';

let ablyInstance: Ably.Realtime | null = null;

export function useAblyClient(): Ably.Realtime | null {
  const ref = useRef<Ably.Realtime | null>(null);

  useEffect(() => {
    if (!ablyInstance) {
      ablyInstance = new Ably.Realtime({
        authUrl: '/api/ably/token',
        authMethod: 'GET',
      });
    }
    ref.current = ablyInstance;
  }, []);

  return ref.current;
}
```

---

### Task 7.2 — Queue Subscription Hook (Doctor dashboard)

Create `src/hooks/useQueue.ts`:

```typescript
import { useEffect, useState } from 'react';
import { useAblyClient } from './useAbly';
import type { QueueSnapshot } from '@/lib/queue';

export function useQueue(doctorId: string, date: string) {
  const ably = useAblyClient();
  const [snapshot, setSnapshot] = useState<QueueSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch initial state
  useEffect(() => {
    fetch(`/api/doctor/queue?date=${date}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success) setSnapshot(res.data);
        setLoading(false);
      });
  }, [date]);

  // Live updates
  useEffect(() => {
    if (!ably || !doctorId) return;
    const channel = ably.channels.get(`queue:${doctorId}:${date}`);
    channel.subscribe('QUEUE_UPDATED', (msg) => setSnapshot(msg.data));
    return () => { channel.unsubscribe(); };
  }, [ably, doctorId, date]);

  return { snapshot, loading };
}
```

---

### Task 7.3 — Appointment Status Hook (Patient side)

Create `src/hooks/useAppointment.ts`:

```typescript
import { useEffect, useState } from 'react';
import { useAblyClient } from './useAbly';

export function useAppointmentStatus(appointmentId: string) {
  const ably = useAblyClient();
  const [status, setStatus] = useState<string | null>(null);
  const [queuePosition, setQueuePosition] = useState<number | null>(null);

  useEffect(() => {
    if (!ably || !appointmentId) return;
    const channel = ably.channels.get(`appointment:${appointmentId}`);

    channel.subscribe('STATUS_CHANGED', (msg) => setStatus(msg.data.status));
    channel.subscribe('QUEUE_UPDATED', (msg) => {
      const mine = msg.data?.queue?.find(
        (q: { appointmentId: string }) => q.appointmentId === appointmentId
      );
      if (mine) setQueuePosition(mine.position);
    });

    return () => { channel.unsubscribe(); };
  }, [ably, appointmentId]);

  return { status, queuePosition };
}
```

**Done when:** A patient page using `useAppointmentStatus` shows real-time position changes when the doctor acts in the queue.

---

## Phase 8 — Rate Limiting
> **Goal:** Prevent OTP abuse and booking spam.
> **Time estimate:** 2 hours

### Task 8.1 — Redis Client

Create `src/lib/redis.ts`:

```typescript
import { Redis } from '@upstash/redis';
export const redis = Redis.fromEnv();
```

---

### Task 8.2 — Rate Limiters

Create `src/lib/rate-limit.ts`:

```typescript
import { Ratelimit } from '@upstash/ratelimit';
import { redis } from './redis';
import { NextRequest } from 'next/server';

// 3 OTP requests per phone per 10 minutes
export const otpLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(3, '10 m'),
  prefix: 'rl:otp',
});

// 10 booking requests per user per minute
export const bookingLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '1 m'),
  prefix: 'rl:booking',
});

export function getIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown';
}
```

---

### Task 8.3 — Apply to OTP Route

In `src/app/api/auth/otp/send/route.ts`, add at the start of POST():

```typescript
import { otpLimiter } from '@/lib/rate-limit';

// First lines of POST():
const { success } = await otpLimiter.limit(phone);
if (!success) {
  return NextResponse.json(
    { error: 'Too many OTP requests. Try again in 10 minutes.' },
    { status: 429 }
  );
}
```

**Done when:** 4th OTP request for the same number within 10 minutes returns 429.

---

## Phase 9 — Admin APIs
> **Goal:** Admin can manage clinics and view SMS logs.
> **Time estimate:** 2 hours

### Task 9.1 — Admin SMS Logs

Create `src/app/api/admin/sms-logs/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { ok, err } from '@/types/api';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json(err('Unauthorized'), { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const page = parseInt(searchParams.get('page') ?? '1');
  const limit = 50;

  const [logs, total] = await Promise.all([
    prisma.smsLog.findMany({
      where: status ? { status: status as any } : undefined,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: (page - 1) * limit,
    }),
    prisma.smsLog.count({ where: status ? { status: status as any } : undefined }),
  ]);

  return NextResponse.json(ok({ logs, total, page, pages: Math.ceil(total / limit) }));
}
```

---

### Task 9.2 — Admin Clinics CRUD

Create `src/app/api/admin/clinics/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { ok, err } from '@/types/api';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json(err('Unauthorized'), { status: 401 });
  }

  const clinics = await prisma.clinic.findMany({
    include: { _count: { select: { doctors: true } } },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(ok(clinics));
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json(err('Unauthorized'), { status: 401 });
  }

  const body = await req.json();
  const clinic = await prisma.clinic.create({ data: body });
  return NextResponse.json(ok(clinic), { status: 201 });
}
```

---

## Phase 10 — Deployment
> **Goal:** App live on Vercel, all services connected, crons running.
> **Time estimate:** 2–3 hours

### Task 10.1 — Pre-Deployment Checklist

```
[ ] npm run build completes with zero TypeScript errors
[ ] All .env.local values confirmed working locally
[ ] vercel.json committed to repo
[ ] .env.local is in .gitignore
[ ] npx prisma validate passes
```

---

### Task 10.2 — Deploy to Vercel

```bash
npm install -g vercel
vercel login
vercel --prod
```

When prompted, add every environment variable from `.env.local`. Change `AUTH_URL` to your production domain.

---

### Task 10.3 — Production DB Migration

```bash
# Run this once after deploying to push schema to production Neon branch
DATABASE_URL="<your-neon-main-branch-url>" npx prisma migrate deploy
npx prisma db seed  # only run once
```

---

### Task 10.4 — Test Cron Jobs

```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  https://your-domain.vercel.app/api/cron/release-locks

curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  https://your-domain.vercel.app/api/cron/reminders
```

Both should return `{ "ok": true }`.

---

## Master Checklist

### Phase 0 — Environment
- [ ] All npm packages installed without errors
- [ ] Neon project created, both connection strings copied
- [ ] Ably app created, root + subscribe-only keys copied
- [ ] Twilio account ready, Verify service created
- [ ] Upstash Redis database created
- [ ] `.env.local` fully populated

### Phase 1 — Database
- [ ] `npx prisma init` run
- [ ] Full schema written in `prisma/schema.prisma`
- [ ] `npx prisma validate` passes
- [ ] `npx prisma migrate dev --name init` succeeds
- [ ] All tables visible in Prisma Studio
- [ ] `src/lib/prisma.ts` singleton created
- [ ] `prisma/seed.ts` written and run

### Phase 2 — Auth
- [ ] `src/types/next-auth.d.ts` type augmentation
- [ ] `auth.ts` at root with two providers
- [ ] `src/app/api/auth/[...nextauth]/route.ts`
- [ ] OTP send route
- [ ] OTP verify route
- [ ] `middleware.ts` route protection
- [ ] Doctor login works, session has `id` + `role`

### Phase 3 — Clinics/Doctors/Slots
- [ ] `src/types/api.ts` helpers
- [ ] `GET /api/clinics`
- [ ] `GET /api/clinics/:id/doctors`
- [ ] `src/lib/slots.ts` with generator + lock + release
- [ ] `GET /api/doctors/:id/slots?date=`

### Phase 4 — Appointments
- [ ] `src/lib/validations.ts` Zod schemas
- [ ] `src/lib/queue.ts` engine (recalculate + snapshot)
- [ ] `src/lib/sms.ts` + `src/lib/sms-templates.ts`
- [ ] `src/lib/ably.ts` publisher
- [ ] `GET /api/ably/token`
- [ ] `POST /api/appointments` (books + SMS + broadcast)
- [ ] `GET /api/appointments`
- [ ] `GET /api/appointments/:id`
- [ ] `DELETE /api/appointments/:id` (cancel + free slot)

### Phase 5 — Doctor Queue
- [ ] `GET /api/doctor/queue`
- [ ] `PATCH /api/appointments/:id/status`
- [ ] "You are next" SMS fires automatically on complete
- [ ] `POST /api/doctor/delay`

### Phase 6 — Cron Jobs
- [ ] `GET /api/cron/reminders` (24h + 1h SMS)
- [ ] `GET /api/cron/release-locks`
- [ ] `GET /api/cron/mark-noshows`
- [ ] `vercel.json` with cron schedules

### Phase 7 — Real-Time Hooks
- [ ] `src/hooks/useAbly.ts`
- [ ] `src/hooks/useQueue.ts`
- [ ] `src/hooks/useAppointment.ts`

### Phase 8 — Rate Limiting
- [ ] `src/lib/redis.ts`
- [ ] `src/lib/rate-limit.ts`
- [ ] OTP rate limiting applied (429 on 4th request)

### Phase 9 — Admin APIs
- [ ] `GET /api/admin/sms-logs`
- [ ] `GET /api/admin/clinics`
- [ ] `POST /api/admin/clinics`

### Phase 10 — Deployment
- [ ] `npm run build` clean — zero errors
- [ ] Deployed to Vercel
- [ ] Production DB migrated
- [ ] Cron jobs tested via curl
- [ ] All env vars set in Vercel dashboard

---

## Common Commands Reference

```bash
# Database
npx prisma migrate dev --name <name>    # create + apply new migration
npx prisma migrate deploy               # apply migrations to production
npx prisma studio                       # open DB GUI at localhost:5555
npx prisma db seed                      # run seed file
npx prisma generate                     # regenerate client after schema change
npx prisma validate                     # check schema for errors

# Development
npm run dev                             # start Next.js dev server
npm run build                           # production build (catches all TS errors)
npm run lint                            # ESLint

# Deployment
vercel --prod                           # deploy to production
vercel env pull .env.local              # pull env vars from Vercel to local
```

---

*Reference `ScanMitra-system-design.md` for architecture decisions, feature specs, and ADRs. This document is the step-by-step execution guide.*
