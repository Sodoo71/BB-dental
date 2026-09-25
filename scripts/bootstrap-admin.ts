import "dotenv/config";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "../lib/auth/password";
import { emailSchema, passwordSchema } from "../lib/validation/auth";
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
try {
  const email = emailSchema.parse(process.env.SUPER_ADMIN_EMAIL);
  const password = passwordSchema.parse(process.env.SUPER_ADMIN_PASSWORD);
  const passwordHash = await hashPassword(password);
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(82173642)`;
    if (await tx.user.count({ where: { role: { in: ["SUPER_ADMIN", "ADMIN"] } } })) throw new Error("An administrator already exists. Use authenticated user management.");
    const user = await tx.user.create({ data: { email, name: "Clinic administrator", passwordHash, role: "SUPER_ADMIN", status: "ACTIVE", isActive: true } });
    await tx.auditLog.create({ data: { actorId: user.id, action: "ADMIN_BOOTSTRAPPED", entity: "User", entityId: user.id } });
  });
  console.info("Administrator created.");
} catch (error) {
  console.error(error instanceof Error ? error.message : "Bootstrap failed");
  process.exitCode = 1;
} finally { await prisma.$disconnect(); }
