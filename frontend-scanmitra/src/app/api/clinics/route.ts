import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/types/api";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const search = searchParams.get("q");
  const specialty = searchParams.get("specialty");

  try {
    const clinics = await prisma.clinic.findMany({
      where: {
        isActive: true,
        ...(search && { name: { contains: search, mode: "insensitive" } }),
        ...(specialty && { specialty: { has: specialty } }),
      },
      include: {
        doctors: {
          where: { isActive: true },
          select: { id: true, specialty: true },
        },
        _count: { select: { doctors: true } },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(ok(clinics));
  } catch (error) {
    console.error("Failed to fetch clinics:", error);
    return NextResponse.json(err("Failed to fetch clinics"), { status: 500 });
  }
}
