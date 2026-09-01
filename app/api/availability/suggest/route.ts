import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateAvailableSlots } from "@/lib/availability";

const weekdayLabels = [
  "Ням",
  "Даваа",
  "Мягмар",
  "Лхагва",
  "Пүрэв",
  "Баасан",
  "Бямба",
];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const doctorId = searchParams.get("doctorId");
  const serviceId = searchParams.get("serviceId");

  try {
    const services = await prisma.service.findMany({
      where: serviceId ? { id: serviceId, isActive: true } : { isActive: true },
      select: { id: true, name: true, durationMin: true },
    });

    if (services.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        message: "Идэвхтэй үйлчилгээ олдсонгүй.",
      });
    }

    const doctors = await prisma.doctor.findMany({
      where: doctorId ? { id: doctorId, isActive: true } : { isActive: true },
      select: { id: true, name: true, title: true },
    });

    if (doctors.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        message: "Идэвхтэй эмч олдсонгүй.",
      });
    }

    const targetService = serviceId
      ? services.find((s) => s.id === serviceId) || services[0]
      : services[0];

    const targetDoctors = doctorId
      ? doctors.filter((d) => d.id === doctorId)
      : doctors;

    const now = new Date();
    const suggestions: Array<{
      date: string;
      formattedDate: string;
      dayOfWeek: string;
      slot: string;
      doctorId: string;
      doctorName: string;
      serviceId: string;
      serviceName: string;
    }> = [];

    // Scan the next 30 days
    for (let dayOffset = 0; dayOffset <= 30; dayOffset += 1) {
      const candidateDate = new Date(
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate() + dayOffset,
        ),
      );
      const isoDate = `${candidateDate.getUTCFullYear()}-${String(candidateDate.getUTCMonth() + 1).padStart(2, "0")}-${String(candidateDate.getUTCDate()).padStart(2, "0")}`;
      const dayName = weekdayLabels[candidateDate.getUTCDay()];
      const formattedDate = `${candidateDate.getUTCMonth() + 1}-р сарын ${candidateDate.getUTCDate()} (${dayName})`;

      for (const doc of targetDoctors) {
        const slots = await generateAvailableSlots({
          doctorId: doc.id,
          serviceId: targetService.id,
          date: candidateDate,
        });

        for (const slot of slots) {
          suggestions.push({
            date: isoDate,
            formattedDate,
            dayOfWeek: dayName,
            slot,
            doctorId: doc.id,
            doctorName: doc.name,
            serviceId: targetService.id,
            serviceName: targetService.name,
          });

          if (suggestions.length >= 6) {
            break;
          }
        }

        if (suggestions.length >= 6) break;
      }

      if (suggestions.length >= 6) break;
    }

    return NextResponse.json({
      success: true,
      data: suggestions,
      earliest: suggestions[0] || null,
    });
  } catch (error) {
    console.error("GET /api/availability/suggest error:", error);
    return NextResponse.json(
      { error: "Боломжит цагийг санал болгоход алдаа гарлаа." },
      { status: 500 },
    );
  }
}
