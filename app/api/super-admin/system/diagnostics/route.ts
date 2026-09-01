import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { readdir, unlink } from "fs/promises";
import path from "path";

export async function POST(request: Request) {
  const user = await requireRole("SUPER_ADMIN", "ADMIN");
  if (!user) {
    return NextResponse.json(
      { error: "Хандах эрхгүй байна." },
      { status: 403 },
    );
  }

  try {
    const body = await request.json();
    const action = typeof body.action === "string" ? body.action : "ping";

    if (action === "ping") {
      const startTime = performance.now();
      await prisma.$queryRaw`SELECT 1`;
      const latencyMs = Math.round(performance.now() - startTime);

      const [
        usersCount,
        doctorsCount,
        patientsCount,
        appointmentsCount,
        servicesCount,
      ] = await Promise.all([
        prisma.user.count(),
        prisma.doctor.count(),
        prisma.patient.count(),
        prisma.appointment.count(),
        prisma.service.count(),
      ]);

      return NextResponse.json({
        success: true,
        latencyMs,
        status: "HEALTHY",
        dbProvider: "PostgreSQL (Neon Cloud)",
        timestamp: new Date().toISOString(),
        counts: {
          users: usersCount,
          doctors: doctorsCount,
          patients: patientsCount,
          appointments: appointmentsCount,
          services: servicesCount,
        },
      });
    }

    if (action === "clean_uploads") {
      const uploadDir = path.join(process.cwd(), "public", "uploads");
      let files: string[] = [];
      try {
        files = await readdir(uploadDir);
      } catch {
        files = [];
      }

      const doctors = await prisma.doctor.findMany({
        select: { avatarUrl: true, imageUrl: true },
      });
      const services = await prisma.service.findMany({
        select: { imageUrl: true },
      });

      const usedFiles = new Set<string>();
      for (const d of doctors) {
        if (d.avatarUrl) usedFiles.add(path.basename(d.avatarUrl));
        if (d.imageUrl) usedFiles.add(path.basename(d.imageUrl));
      }
      for (const s of services) {
        if (s.imageUrl) usedFiles.add(path.basename(s.imageUrl));
      }

      let deletedCount = 0;
      for (const f of files) {
        if (!usedFiles.has(f) && f !== ".gitkeep") {
          try {
            await unlink(path.join(uploadDir, f));
            deletedCount++;
          } catch {
            // ignore
          }
        }
      }

      return NextResponse.json({
        success: true,
        message: `Ашиглагдаагүй ${deletedCount} файлыг амжилттай цэвэрлэлээ.`,
        deletedCount,
      });
    }

    if (action === "export_backup") {
      const [users, doctors, patients, appointments, services, settings] =
        await Promise.all([
          prisma.user.findMany({
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              isActive: true,
              createdAt: true,
            },
          }),
          prisma.doctor.findMany(),
          prisma.patient.findMany(),
          prisma.appointment.findMany({
            include: { patient: true, service: true, notes: true },
          }),
          prisma.service.findMany(),
          prisma.systemSetting.findMany(),
        ]);

      return NextResponse.json({
        success: true,
        backup: {
          exportedAt: new Date().toISOString(),
          clinic: "BB Dental Clinic",
          users,
          doctors,
          patients,
          appointments,
          services,
          settings,
        },
      });
    }

    return NextResponse.json({ error: "Тодорхойгүй үйлдэл." }, { status: 400 });
  } catch (error) {
    console.error("POST /api/super-admin/system/diagnostics error:", error);
    return NextResponse.json(
      { error: "Оношилгоо хийхэд алдаа гарлаа." },
      { status: 500 },
    );
  }
}
