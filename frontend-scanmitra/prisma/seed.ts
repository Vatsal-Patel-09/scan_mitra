import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding...");

  const clinic = await prisma.clinic.upsert({
    where: { id: "clinic-001" },
    update: {},
    create: {
      id: "clinic-001",
      name: "ScanMitra Demo Clinic",
      address: "123 Health Street, Ahmedabad, Gujarat",
      phone: "+919876543210",
      specialty: ["General Medicine", "Cardiology"],
    },
  });

  const doctorUser = await prisma.user.upsert({
    where: { email: "doctor@demo.com" },
    update: {},
    create: {
      email: "doctor@demo.com",
      name: "Dr. Priya Sharma",
      role: "DOCTOR",
      passwordHash: await bcrypt.hash("doctor123", 12),
    },
  });

  const doctor = await prisma.doctor.upsert({
    where: { userId: doctorUser.id },
    update: {},
    create: {
      userId: doctorUser.id,
      clinicId: clinic.id,
      qualification: "MBBS, MD (General Medicine)",
      specialty: ["General Medicine"],
      slotDuration: 15,
      maxPerDay: 30,
    },
  });

  for (const day of [1, 2, 3, 4, 5, 6]) {
    await prisma.availability.upsert({
      where: { doctorId_dayOfWeek: { doctorId: doctor.id, dayOfWeek: day } },
      update: {},
      create: {
        doctorId: doctor.id,
        dayOfWeek: day,
        startTime: "09:00",
        endTime: "13:00",
      },
    });
  }

  await prisma.user.upsert({
    where: { email: "admin@demo.com" },
    update: {},
    create: {
      email: "admin@demo.com",
      name: "Admin User",
      role: "ADMIN",
      passwordHash: await bcrypt.hash("admin123", 12),
    },
  });

  console.log("Done. Credentials:");
  console.log("  Doctor: doctor@demo.com / doctor123");
  console.log("  Admin: admin@demo.com / admin123");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
