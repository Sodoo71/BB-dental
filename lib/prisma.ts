import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "@/app/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  pool?: Pool;
  dbUrl?: string;
};

const rawDbUrl =
  process.env.DATABASE_URL?.trim() ||
  "postgresql://neondb_owner:npg_DA7cev5GBxrQ@ep-cold-breeze-azyxz1o0-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";

// Clean channel_binding parameter for optimal serverless pg/Vercel compatibility
const cleanDbUrl = rawDbUrl
  .replace(/channel_binding=[^&]+&?/g, "")
  .replace(/\?&/, "?")
  .replace(/[?&]$/, "");

if (!globalForPrisma.pool || globalForPrisma.dbUrl !== cleanDbUrl) {
  globalForPrisma.pool = new Pool({
    connectionString: cleanDbUrl,
    ssl: { rejectUnauthorized: false },
    max: 2, // Serverless recommended pool size per lambda container
    idleTimeoutMillis: 15000,
    connectionTimeoutMillis: 15000, // Allow Neon cold-start wake up
  });
  globalForPrisma.dbUrl = cleanDbUrl;
  globalForPrisma.prisma = new PrismaClient({
    adapter: new PrismaPg(globalForPrisma.pool),
  });
}

export const prisma = globalForPrisma.prisma!;
