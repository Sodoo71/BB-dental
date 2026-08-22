import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get("all") === "true";

    const services = await prisma.service.findMany({
      where: includeInactive ? undefined : { isActive: true },
      orderBy: { createdAt: "desc" },
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

export async function POST(request: Request) {
  const user = await requireRole("SUPER_ADMIN");
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const description =
      typeof body.description === "string" ? body.description.trim() : null;
    const durationMin =
      typeof body.durationMin === "string" ? body.durationMin.trim() : "";
    const price = typeof body.price === "string" ? body.price.trim() : "";
    const isActive = body.isActive !== false;

    if (!name || !durationMin || !price) {
      return NextResponse.json(
        { error: "Нэр, хугацаа, үнэ шаардлагатай." },
        { status: 400 },
      );
    }

    const parsedDuration = Number(durationMin);
    if (!Number.isFinite(parsedDuration) || parsedDuration <= 0) {
      return NextResponse.json(
        { error: "Үйлчилгээний хугацаа буруу байна." },
        { status: 400 },
      );
    }

    const service = await prisma.service.create({
      data: {
        name,
        description: description || null,
        durationMin: String(parsedDuration),
        price,
        isActive,
      },
    });

    return NextResponse.json({ success: true, data: service }, { status: 201 });
  } catch (error) {
    console.error("POST /api/services error:", error);
    return NextResponse.json(
      { error: "Үйлчилгээ үүсгэхэд алдаа гарлаа." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  const user = await requireRole("SUPER_ADMIN");
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const serviceId = typeof body.serviceId === "string" ? body.serviceId : "";

    if (!serviceId.trim()) {
      return NextResponse.json(
        { error: "Үйлчилгээний ID шаардлагатай." },
        { status: 400 },
      );
    }

    const targetService = await prisma.service.findUnique({
      where: { id: serviceId },
      select: { id: true, name: true },
    });

    if (!targetService) {
      return NextResponse.json(
        { error: "Үйлчилгээ олдсонгүй." },
        { status: 404 },
      );
    }

    await prisma.service.delete({ where: { id: serviceId } });

    return NextResponse.json({
      success: true,
      message: `${targetService.name} үйлчилгээ устгагдлаа.`,
    });
  } catch (error) {
    console.error("DELETE /api/services error:", error);
    return NextResponse.json(
      { error: "Үйлчилгээ устгахад алдаа гарлаа." },
      { status: 500 },
    );
  }
}
