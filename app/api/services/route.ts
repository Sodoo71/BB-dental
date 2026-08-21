import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const services = await prisma.service.findMany({
      where: { isActive: true },
    });
    return NextResponse.json({ success: true, data: services });
  } catch (error: unknown) {
    console.error("GET /api/services error:", error);
    return NextResponse.json(
      { success: false, error: "Үйлчилгээний дата авахад алдаа гарлаа." },
      { status: 500 },
    );
  }
}
