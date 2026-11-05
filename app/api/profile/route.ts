import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ApiError, body, json, safe, sameOrigin } from "@/lib/http";
import { phoneSchema } from "@/lib/domain";
import { emailSchema, telegramSchema } from "@/lib/validation";
import { isCloudinaryImage } from "@/lib/cloudinary";
const select = {
  id: true,
  name: true,
  phone: true,
  email: true,
  telegramChatId: true,
  role: true,
  doctor: {
    select: {
      id: true,
      name: true,
      specialty: true,
      bio: true,
      imageUrl: true,
    },
  },
} as const;
const schema = z
  .object({
    name: z.string().trim().min(2).max(100),
    phone: phoneSchema,
    email: z.union([emailSchema, z.literal("")]),
    telegramChatId: z.union([telegramSchema, z.literal("")]),
    specialty: z.string().trim().min(2).max(200).optional(),
    bio: z.string().max(10000).optional(),
    imageUrl: z
      .string()
      .refine(
        (v) => !v || isCloudinaryImage(v),
        "Зургаа Cloudinary upload-аар оруулна уу.",
      )
      .optional(),
  })
  .strict();
export async function GET() {
  return safe(async () => {
    const actor = await requireUser(["ADMIN", "DOCTOR"]);
    return json(
      await db.user.findUniqueOrThrow({ where: { id: actor.id }, select }),
    );
  });
}
export async function PATCH(req: Request) {
  return safe(async () => {
    sameOrigin(req);
    const actor = await requireUser(["ADMIN", "DOCTOR"]);
    const data = schema.parse(await body(req));
    const { specialty, bio, imageUrl, ...contact } = data;
    if (
      actor.role !== "DOCTOR" &&
      [specialty, bio, imageUrl].some((v) => v !== undefined)
    )
      throw new ApiError(403, "Эмчийн профайл өөрчлөх эрхгүй.");
    await db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: actor.id },
        data: { ...contact, email: contact.email || null },
      });
      if (actor.role === "DOCTOR") {
        if (!actor.doctor) throw new ApiError(404, "Эмчийн профайл олдсонгүй.");
        await tx.doctor.update({
          where: { id: actor.doctor.id },
          data: {
            name: contact.name,
            telegramChatId: contact.telegramChatId,
            ...(specialty !== undefined ? { specialty } : {}),
            ...(bio !== undefined ? { bio } : {}),
            ...(imageUrl !== undefined ? { imageUrl } : {}),
          },
        });
      }
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: "UPDATE_OWN_PROFILE",
          entity: "users",
          entityId: actor.id,
        },
      });
    });
    return json(
      await db.user.findUniqueOrThrow({ where: { id: actor.id }, select }),
    );
  });
}
