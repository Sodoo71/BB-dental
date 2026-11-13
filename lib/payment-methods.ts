import { z } from "zod";
import { db } from "./db";
import { ApiError } from "./http";
import type { Actor } from "./auth";

export const defaultMethodIds: Record<string, string> = {
  CASH: "00000000-0000-4000-8000-000000000001",
  CARD: "00000000-0000-4000-8000-000000000002",
  TRANSFER: "00000000-0000-4000-8000-000000000003",
  QPAY: "00000000-0000-4000-8000-000000000004",
};
const methodSchema = z.object({
  name: z.string().trim().min(1, "Нэр оруулна уу.").max(80),
  kind: z.enum(["CASH", "CARD", "TRANSFER", "QPAY"]),
  enabled: z.boolean(),
  sortOrder: z.coerce.number().int().min(0).max(10000),
  referenceRequired: z.boolean(),
  description: z.string().trim().max(500).default(""),
});
export async function listPaymentMethods(actor: Pick<Actor, "role">) {
  if (!["ADMIN", "RECEPTION"].includes(actor.role))
    throw new ApiError(403, "Төлбөрийн хэлбэр харах эрхгүй.");
  return {
    items: await db.paymentMethodOption.findMany({
      where: actor.role === "RECEPTION" ? { enabled: true } : {},
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    }),
  };
}
export async function savePaymentMethod(
  actor: Pick<Actor, "id" | "role">,
  input: unknown,
) {
  if (actor.role !== "ADMIN")
    throw new ApiError(403, "Зөвхөн админ тохируулна.");
  const { id, ...values } = methodSchema
    .extend({ id: z.string().uuid().optional() })
    .parse(input);
  return db.$transaction(async (tx) => {
    // Shared with collection: a disabled method cannot race a new payment.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('payment-methods'))::text AS locked`;
    const previous = id
      ? await tx.paymentMethodOption.findUniqueOrThrow({ where: { id } })
      : null;
    if (previous && previous.kind !== values.kind)
      throw new ApiError(
        400,
        "Бүртгэлтэй хэлбэрийн тооцооны төрлийг солихгүй. Шинэ хэлбэр нэмнэ үү.",
      );
    const result = id
      ? await tx.paymentMethodOption.update({ where: { id }, data: values })
      : await tx.paymentMethodOption.create({ data: values });
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action: previous ? "PAYMENT_METHOD_UPDATED" : "PAYMENT_METHOD_CREATED",
        entity: "payment-method",
        entityId: result.id,
      },
    });
    return result;
  });
}
