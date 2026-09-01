import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, requireRole } from "@/lib/auth";

const validRoles = ["DOCTOR", "ADMIN", "SUPER_ADMIN", "PATIENT"] as const;

export async function GET(request: Request) {
  const user = await requireRole("SUPER_ADMIN", "ADMIN");
  if (!user) {
    return NextResponse.json(
      { error: "Нэвтрэх эрхгүй байна. Дахин нэвтэрнэ үү." },
      { status: 401 },
    );
  }

  const { searchParams } = new URL(request.url);
  const pendingOnly = searchParams.get("pending") === "true";

  try {
    let users: any[] = [];
    try {
      users = await prisma.user.findMany({
        where: pendingOnly ? { isActive: false } : undefined,
        orderBy: { createdAt: "desc" },
        include: {
          doctor: {
            select: {
              phone: true,
              avatarUrl: true,
              imageUrl: true,
              telegramChatId: true,
              title: true,
            },
          },
        },
      });
    } catch {
      // Fallback query
      users = await prisma.$queryRawUnsafe<any[]>(
        `SELECT u.*, d.phone as "doctorPhone", d."avatarUrl" as "doctorAvatar", d."imageUrl" as "doctorImage", d."telegramChatId" as "doctorTg", d.title as "doctorTitle"
         FROM "User" u
         LEFT JOIN "Doctor" d ON u."doctorId" = d.id
         ${pendingOnly ? 'WHERE u."isActive" = false' : ''}
         ORDER BY u."createdAt" DESC`
      );
    }

    const formatted = users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone || u.doctor?.phone || u.doctorPhone || "",
      avatarUrl:
        u.avatarUrl ||
        u.doctor?.avatarUrl ||
        u.doctor?.imageUrl ||
        u.doctorAvatar ||
        u.doctorImage ||
        "",
      telegramChatId:
        u.telegramChatId || u.doctor?.telegramChatId || u.doctorTg || "",
      role: u.role,
      isActive: u.isActive,
      doctorId: u.doctorId,
      doctorTitle: u.doctor?.title || u.doctorTitle || null,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    }));

    return NextResponse.json({ success: true, data: formatted });
  } catch (error) {
    console.error("GET /api/admin/users error:", error);
    return NextResponse.json(
      { error: "Хэрэглэгчдийн жагсаалт ачаалахад алдаа гарлаа." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const currentUser = await requireRole("SUPER_ADMIN", "ADMIN");
  if (!currentUser) {
    return NextResponse.json(
      { error: "Нэвтрэх эрхгүй байна. Дахин нэвтэрнэ үү." },
      { status: 401 },
    );
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const phone = typeof body.phone === "string" ? body.phone.trim() : null;
    const avatarUrl =
      typeof body.avatarUrl === "string" ? body.avatarUrl.trim() : null;
    const telegramChatId =
      typeof body.telegramChatId === "string"
        ? body.telegramChatId.trim()
        : null;
    const password = typeof body.password === "string" ? body.password : "";
    const role = typeof body.role === "string" ? body.role : "DOCTOR";
    const isActive = body.isActive === true;

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Нэр, и-мэйл, нууц үг шаардлагатай." },
        { status: 400 },
      );
    }

    if (!validRoles.includes(role as (typeof validRoles)[number])) {
      return NextResponse.json({ error: "Роль буруу байна." }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Нууц үг хамгийн багадаа 6 тэмдэгт байна." },
        { status: 400 },
      );
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json(
        { error: `"${email}" и-мэйл хаяг аль хэдийн бүртгэгдсэн байна.` },
        { status: 409 },
      );
    }

    const createdUser = await prisma.$transaction(async (tx) => {
      let user;
      try {
        user = await tx.user.create({
          data: {
            name,
            email,
            phone,
            avatarUrl,
            telegramChatId,
            passwordHash: hashPassword(password),
            role: role as (typeof validRoles)[number],
            isActive,
          },
        });
      } catch {
        // Raw SQL fallback if in-memory dmmf has not refreshed
        const id = crypto.randomUUID();
        await tx.$executeRawUnsafe(
          `INSERT INTO "User" ("id", "name", "email", "phone", "avatarUrl", "telegramChatId", "passwordHash", "role", "isActive", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8::"UserRole", $9, NOW(), NOW())`,
          id,
          name,
          email,
          phone,
          avatarUrl,
          telegramChatId,
          hashPassword(password),
          role,
          isActive,
        );
        user = await tx.user.findUniqueOrThrow({ where: { id } });
      }

      if (role === "DOCTOR" && isActive) {
        const doctor = await tx.doctor.create({
          data: {
            name: user.name,
            title: "Шүдний их эмч",
            email: user.email,
            phone: user.phone || phone,
            avatarUrl: user.avatarUrl || avatarUrl,
            imageUrl: user.avatarUrl || avatarUrl,
            telegramChatId: user.telegramChatId || telegramChatId,
            isActive: true,
          },
        });

        await tx.user.update({
          where: { id: user.id },
          data: { doctorId: doctor.id },
        });
      }

      return user;
    });

    return NextResponse.json(
      {
        success: true,
        data: createdUser,
        message: "Хэрэглэгч амжилттай бүртгэгдлээ.",
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/admin/users error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Хэрэглэгч үүсгэхэд алдаа гарлаа.",
      },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  const currentUser = await requireRole("SUPER_ADMIN", "ADMIN");
  if (!currentUser) {
    return NextResponse.json(
      { error: "Нэвтрэх эрхгүй байна. Дахин нэвтэрнэ үү." },
      { status: 401 },
    );
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const userId =
      typeof body.id === "string"
        ? body.id
        : typeof body.userId === "string"
          ? body.userId
          : "";
    const name = typeof body.name === "string" ? body.name.trim() : undefined;
    const email =
      typeof body.email === "string"
        ? body.email.trim().toLowerCase()
        : undefined;
    const phone =
      typeof body.phone === "string" ? body.phone.trim() || null : null;
    const avatarUrl =
      typeof body.avatarUrl === "string" ? body.avatarUrl.trim() || null : null;
    const telegramChatId =
      typeof body.telegramChatId === "string"
        ? body.telegramChatId.trim() || null
        : null;
    const role = typeof body.role === "string" ? body.role : undefined;
    const isActive =
      typeof body.isActive === "boolean" ? body.isActive : undefined;
    const password =
      typeof body.password === "string" && body.password.length >= 6
        ? body.password
        : undefined;

    if (!userId.trim()) {
      return NextResponse.json(
        { error: "Хэрэглэгчийн ID шаардлагатай." },
        { status: 400 },
      );
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: "Хэрэглэгч олдсонгүй." },
        { status: 404 },
      );
    }

    // Check if new email conflicts with another user
    if (email && email !== targetUser.email) {
      const emailConflict = await prisma.user.findUnique({ where: { email } });
      if (emailConflict) {
        return NextResponse.json(
          {
            error: `"${email}" и-мэйл хаяг өөр хэрэглэгч дээр бүртгэлтэй байна.`,
          },
          { status: 409 },
        );
      }
    }

    // Direct, ultra-reliable raw SQL update
    await prisma.$executeRawUnsafe(
      `UPDATE "User"
       SET "name" = COALESCE($1, "name"),
           "email" = COALESCE($2, "email"),
           "phone" = $3,
           "avatarUrl" = $4,
           "telegramChatId" = $5,
           "role" = COALESCE($6::"UserRole", "role"),
           "isActive" = COALESCE($7, "isActive"),
           "updatedAt" = NOW()
       WHERE "id" = $8`,
      name ?? null,
      email ?? null,
      phone,
      avatarUrl,
      telegramChatId,
      role ?? null,
      isActive ?? null,
      userId,
    );

    if (password) {
      await prisma.$executeRawUnsafe(
        `UPDATE "User" SET "passwordHash" = $1 WHERE "id" = $2`,
        hashPassword(password),
        userId,
      );
    }

    const updatedUser = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    // Safely sync to Doctor table if doctor record exists
    if (updatedUser.doctorId) {
      await prisma.doctor.updateMany({
        where: { id: updatedUser.doctorId },
        data: {
          ...(name ? { name } : {}),
          ...(email ? { email } : {}),
          phone,
          avatarUrl,
          imageUrl: avatarUrl,
          telegramChatId,
          ...(isActive !== undefined ? { isActive } : {}),
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: updatedUser,
      message: `${updatedUser.name} хэрэглэгчийн мэдээлэл амжилттай шинэчлэгдлээ.`,
    });
  } catch (error) {
    console.error("PUT /api/admin/users error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Хэрэглэгчийн мэдээллийг шинэчлэхэд алдаа гарлаа.",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  const currentUser = await requireRole("SUPER_ADMIN", "ADMIN");
  if (!currentUser) {
    return NextResponse.json(
      { error: "Нэвтрэх эрхгүй байна. Дахин нэвтэрнэ үү." },
      { status: 401 },
    );
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const userId = typeof body.userId === "string" ? body.userId : "";

    if (!userId.trim()) {
      return NextResponse.json(
        { error: "Хэрэглэгчийн ID шаардлагатай." },
        { status: 400 },
      );
    }

    if (userId === currentUser.id) {
      return NextResponse.json(
        { error: "Өөрийн хэрэглэгчийн бүртгэлийг устгах боломжгүй." },
        { status: 400 },
      );
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, name: true, doctorId: true },
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: "Хэрэглэгч олдсонгүй." },
        { status: 404 },
      );
    }

    await prisma.user.delete({ where: { id: userId } });

    return NextResponse.json({
      success: true,
      message: `${targetUser.name} хэрэглэгчийг устгалаа.`,
    });
  } catch (error) {
    console.error("DELETE /api/admin/users error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Хэрэглэгч устгахад алдаа гарлаа.",
      },
      { status: 500 },
    );
  }
}
