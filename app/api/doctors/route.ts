import { NextResponse } from "next/server";
import { publicDoctorSelect } from "@/lib/appointments/dto";
import { apiError } from "@/lib/security/http";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const doctors = await prisma.doctor.findMany({
      where: { isActive: true },
      select: publicDoctorSelect,
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }, { id: "asc" }],
    });
    return NextResponse.json({ success: true, data: doctors });
  } catch (error: unknown) {
    return apiError(error);
  }
}
