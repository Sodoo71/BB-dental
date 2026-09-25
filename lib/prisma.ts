import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "@/app/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  pool?: Pool;
  dbUrl?: string;
};

const rawDbUrl = process.env.DATABASE_URL?.trim();

if (!rawDbUrl) {
  throw new Error("DATABASE_URL is required to initialize Prisma.");
}

// Clean channel_binding parameter for optimal serverless pg/Vercel compatibility
const cleanDbUrl = rawDbUrl
  .replace(/channel_binding=[^&]+&?/g, "")
  .replace(/\?&/, "?")
  .replace(/[?&]$/, "");

if (!globalForPrisma.pool || globalForPrisma.dbUrl !== cleanDbUrl) {
  globalForPrisma.pool = new Pool({
    connectionString: cleanDbUrl,
    max: 10, // Generous pool size for concurrent Next.js API route handling
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 15000, // Allow Neon cold-start wake up
  });
  globalForPrisma.dbUrl = cleanDbUrl;
  globalForPrisma.prisma = new PrismaClient({
    adapter: new PrismaPg(globalForPrisma.pool),
  });
}

export const prisma = globalForPrisma.prisma!;
