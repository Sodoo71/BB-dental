import { createHmac } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { HttpError } from "./http";
// One atomic PostgreSQL upsert, shared across all application instances.
export async function rateLimit(scope: string, identity: string, limit: number, minutes = 15) {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is required");
  const key = createHmac("sha256", secret).update(`${scope}:${identity}`).digest("hex");
  const rows = await prisma.$queryRaw<{ count: number }[]>`
    INSERT INTO "AuthRateLimit" ("key", "count", "expiresAt")
    VALUES (${key}, 1, NOW() + ${minutes} * INTERVAL '1 minute')
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "AuthRateLimit"."expiresAt" <= NOW() THEN 1 ELSE "AuthRateLimit"."count" + 1 END,
      "expiresAt" = CASE WHEN "AuthRateLimit"."expiresAt" <= NOW() THEN NOW() + ${minutes} * INTERVAL '1 minute' ELSE "AuthRateLimit"."expiresAt" END
    RETURNING "count"`;
  if (rows[0].count > limit) throw new HttpError(429, "Хэт олон оролдлого хийсэн байна. Түр хүлээгээд дахин оролдоно уу.");
}
