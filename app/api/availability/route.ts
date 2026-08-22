import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateAvailableSlots, parseDateInput } from "@/lib/availability";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const doctorId = searchParams.get("doctorId");
  const serviceId = searchParams.get("serviceId");
  const date = parseDateInput(searchParams.get("date"));

  if (!doctorId || !serviceId || !date) {
    return NextResponse.json(
      { error: "Эмч, үйлчилгээ, өдөр сонгоно уу." },
      { status: 400 },
    );
  }

  try {
    const slots = await generateAvailableSlots({ doctorId, serviceId, date });
    const durationMin = Number(
      (
        await prisma.service.findFirst({
          where: { id: serviceId, isActive: true },
          select: { durationMin: true },
        })
      )?.durationMin ?? 0,
    );

    return NextResponse.json({
      success: true,
      data: slots,
      slots,
      date: searchParams.get("date"),
      serviceDuration: Number.isFinite(durationMin) ? durationMin : 0,
    });
  } catch (error) {
    console.error("GET /api/availability error:", error);
    return NextResponse.json(
      { error: "Боломжит цагийг авахад алдаа гарлаа." },
      { status: 500 },
    );
  }
}
