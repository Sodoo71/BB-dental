import { PrismaClient } from "@/app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
const globalDb = globalThis as unknown as { bbPrisma?: PrismaClient };
export const db =
  globalDb.bbPrisma ??
  new PrismaClient({
    adapter: new PrismaPg({
      connectionString:
        process.env.DATABASE_URL || "postgresql://localhost:5432/bbdental",
      max: 5,
      connectionTimeoutMillis: 5000,
    }),
  });
if (process.env.NODE_ENV !== "production") globalDb.bbPrisma = db;
export const databaseConfigured = () => Boolean(process.env.DATABASE_URL);
