import {
  registerAccount,
  requestPasswordReset,
  requestTelegramPasswordReset,
  resetPassword,
} from "@/lib/accounts";
import {
  registrationSchema,
  resetPasswordSchema,
  emailSchema,
} from "@/lib/validation";
import { ensureMailConfigured } from "@/lib/mail";
import { z } from "zod";
import { compare } from "bcryptjs";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import {
  COOKIE,
  currentUser,
  digest,
  loginSession,
  rateLimit,
} from "@/lib/auth";
import {
  ApiError,
  body,
  ensureDatabase,
  json,
  safe,
  sameOrigin,
} from "@/lib/http";
import { phoneSchema } from "@/lib/domain";
type Ctx = { params: Promise<{ action: string }> };
export async function GET(_req: Request, ctx: Ctx) {
  return safe(async () => {
    const { action } = await ctx.params;
    if (action !== "me") throw new ApiError(404, "Олдсонгүй.");
    return json({ user: await currentUser() });
  });
}
export async function POST(req: Request, ctx: Ctx) {
  return safe(async () => {
    sameOrigin(req);
    ensureDatabase();
    const { action } = await ctx.params;
    if (action === "register") {
      const data = registrationSchema.parse(await body(req));
      await rateLimit(`register:phone:${data.phone}`, 5, 3600);
      await rateLimit(`register:email:${data.email}`, 5, 3600);
      const user = await registerAccount(data);
      return json(
        {
          ok: true,
          first: user.first,
          approvalStatus: user.approvalStatus,
          message: user.first
            ? "Анхны бүртгэл админ эрхээр идэвхжлээ. Нэвтэрнэ үү."
            : user.approvalStatus === "APPROVED"
              ? "Бүртгэл идэвхжлээ. Нэвтэрнэ үү."
              : "Бүртгэл илгээгдлээ. Админ хянасны дараа идэвхжинэ.",
        },
        201,
      );
    }
    if (action === "forgot-password") {
      const input = z
        .object({
          channel: z.enum(["telegram", "email"]).optional(),
          email: z.unknown().optional(),
          phone: z.unknown().optional(),
        })
        .parse(await body(req));
      const data = z
        .discriminatedUnion("channel", [
          z.object({ channel: z.literal("telegram"), phone: phoneSchema }),
          z.object({ channel: z.literal("email"), email: emailSchema }),
        ])
        .parse({
          ...input,
          channel: input.channel || (input.email ? "email" : "telegram"),
        });
      if (data.channel === "telegram") {
        await rateLimit(`forgot:telegram:${data.phone}`, 4, 3600);
        await requestTelegramPasswordReset(data.phone);
        return json({
          ok: true,
          message:
            "Энэ утас идэвхтэй, Telegram холбосон бүртгэлтэй бол сэргээх холбоос бүртгэлтэй Telegram руу илгээгдэнэ.",
        });
      }
      await rateLimit(`forgot:${data.email}`, 4, 3600);
      ensureMailConfigured();
      await requestPasswordReset(data.email);
      return json({
        ok: true,
        message:
          "Энэ имэйл идэвхтэй бүртгэлтэй бол сэргээх холбоос илгээгдэнэ.",
      });
    }
    if (action === "reset-password") {
      const data = resetPasswordSchema.parse(await body(req));
      await rateLimit(`reset:${data.token}`, 5, 900);
      await resetPassword(data);
      return json({
        ok: true,
        message: "Нууц үг шинэчлэгдлээ. Шинэ нууц үгээр нэвтэрнэ үү.",
      });
    }
    if (action === "logout") {
      const token = (await cookies()).get(COOKIE)?.value;
      if (token)
        await db.session.deleteMany({ where: { tokenHash: digest(token) } });
      (await cookies()).delete(COOKIE);
      return json({ ok: true });
    }
    if (action !== "login") throw new ApiError(404, "Олдсонгүй.");
    const data = z
      .object({ phone: phoneSchema, password: z.string().min(1).max(128) })
      .parse(await body(req));
    await rateLimit(`login:${data.phone}`, 8, 900);
    const user = await db.user.findUnique({ where: { phone: data.phone } });
    const valid = await compare(
      data.password,
      user?.passwordHash ||
        "$2b$12$C6UzMDM.H6dfI/f/IKcEe.6M3aJV9PCb4Z.IhNln/OvAJhCjS2U1y",
    );
    if (!user || !valid)
      throw new ApiError(401, "Утас эсвэл нууц үг буруу байна.");
    if (user.approvalStatus === "PENDING")
      throw new ApiError(403, "Таны бүртгэл админы зөвшөөрөл хүлээж байна.");
    if (!user.active || user.approvalStatus !== "APPROVED")
      throw new ApiError(
        403,
        "Таны бүртгэл идэвхгүй байна. Админтай холбогдоно уу.",
      );
    await loginSession(user.id);
    return json({ ok: true, role: user.role });
  });
}
