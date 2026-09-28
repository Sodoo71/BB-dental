import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get("all") === "true";

    const services = await prisma.service.findMany({
      where: includeInactive ? undefined : { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }, { id: "asc" }],
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
  const user = await requireRole("SUPER_ADMIN", "ADMIN");
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const description =
      typeof body.description === "string" ? body.description.trim() : null;
    const policy = await prisma.systemSetting.findUnique({ where: { key: "registration_policy" } });
    let defaultDuration = "30";
    try { const value = JSON.parse(policy?.value ?? "{}").defaultDuration; if (["15", "30", "45", "60"].includes(value)) defaultDuration = value; } catch {}
    const durationMin =
      typeof body.durationMin === "string" ||
      typeof body.durationMin === "number"
        ? String(body.durationMin).trim()
        : defaultDuration;
    const price =
      typeof body.price === "string" || typeof body.price === "number"
        ? String(body.price).trim()
        : "";
    const imageUrl =
      typeof body.imageUrl === "string" ? body.imageUrl.trim() : null;
    const isActive = body.isActive !== false;
    const sortOrder = Number(body.sortOrder ?? 0);
    if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 100000) return NextResponse.json({ error: "Эрэмбэ 0–100000 бүхэл тоо байна." }, { status: 400 });

    if (!name || !durationMin || !price) {
      return NextResponse.json(
        { error: "Нэр, хугацаа, үнэ шаардлагатай." },
        { status: 400 },
      );
    }

    const parsedDuration = Number(durationMin);
    if (!Number.isInteger(parsedDuration) || parsedDuration < 5 || parsedDuration > 480) {
      return NextResponse.json(
        { error: "Үйлчилгээний хугацаа буруу байна." },
        { status: 400 },
      );
    }

    const parsedPrice = Number(price);
    const slug =
      typeof body.slug === "string" && body.slug.trim()
        ? body.slug.trim()
        : name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "") || `service-${Date.now()}`;
    const category =
      typeof body.category === "string" && body.category.trim()
        ? body.category.trim()
        : "GENERAL";

    const service = await prisma.service.create({
      data: {
        name,
        sortOrder,
        slug,
        category,
        description: description || null,
        durationMin: parsedDuration,
        price: Number.isFinite(parsedPrice) ? parsedPrice : 0,
        imageUrl: imageUrl || null,
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

export async function PUT(request: Request) {
  const user = await requireRole("SUPER_ADMIN", "ADMIN");
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const serviceId =
      typeof body.id === "string" && body.id.trim()
        ? body.id.trim()
        : typeof body.serviceId === "string" && body.serviceId.trim()
          ? body.serviceId.trim()
          : "";

    if (!serviceId) {
      return NextResponse.json(
        { error: "Үйлчилгээний ID шаардлагатай." },
        { status: 400 },
      );
    }

    const target = await prisma.service.findUnique({
      where: { id: serviceId },
    });

    if (!target) {
      return NextResponse.json(
        { error: "Үйлчилгээ олдсонгүй." },
        { status: 404 },
      );
    }

    const name = typeof body.name === "string" ? body.name.trim() : undefined;
    const description =
      typeof body.description === "string"
        ? body.description.trim()
        : body.description === null
          ? null
          : undefined;
    const durationMin =
      body.durationMin !== undefined ? Number(body.durationMin) : undefined;
    const price = body.price !== undefined ? Number(body.price) : undefined;
    const imageUrl =
      typeof body.imageUrl === "string"
        ? body.imageUrl.trim()
        : body.imageUrl === null
          ? null
          : undefined;
    const category =
      typeof body.category === "string" && body.category.trim()
        ? body.category.trim()
        : undefined;
    const isActive =
      typeof body.isActive === "boolean" ? body.isActive : undefined;

    const sortOrder = body.sortOrder === undefined ? undefined : Number(body.sortOrder);
    if (sortOrder !== undefined && (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 100000)) return NextResponse.json({ error: "Эрэмбэ 0–100000 бүхэл тоо байна." }, { status: 400 });
    if (durationMin !== undefined && (!Number.isInteger(durationMin) || durationMin < 5 || durationMin > 480)) return NextResponse.json({ error: "Хугацаа 5–480 минут байна." }, { status: 400 });
    const updated = await prisma.service.update({
      where: { id: serviceId },
      data: {
        ...(sortOrder !== undefined ? { sortOrder } : {}),
        ...(name !== undefined ? { name } : {}),
        ...(description !== undefined
          ? { description: description || null }
          : {}),
        ...(durationMin !== undefined && Number.isFinite(durationMin)
          ? { durationMin }
          : {}),
        ...(price !== undefined && Number.isFinite(price) ? { price } : {}),
        ...(imageUrl !== undefined ? { imageUrl: imageUrl || null } : {}),
        ...(category !== undefined ? { category } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("PUT /api/services error:", error);
    return NextResponse.json(
      { error: "Үйлчилгээ шинэчлэхэд алдаа гарлаа." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  const user = await requireRole("SUPER_ADMIN", "ADMIN");
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
