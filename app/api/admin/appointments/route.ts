import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const appointments = await prisma.appointment.findMany({
      include: {
        patient: true,
        doctor: true,
        service: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({ success: true, data: appointments });
  } catch (error: unknown) {
    console.error("❌ [GET /api/admin/appointments Error]:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Захиалгын дата авахад алдаа гарлаа",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
