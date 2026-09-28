import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { defaultClinicInfo } from "@/lib/clinic-info";
import { apiError } from "@/lib/security/http";
export async function GET() {
  try {
    const row = await prisma.systemSetting.findUnique({ where: { key: "clinic_info" } });
    const saved = row ? JSON.parse(row.value) : {};
    const data = { ...defaultClinicInfo };
    for (const key of Object.keys(data) as (keyof typeof data)[]) {
      if (typeof saved[key] === "string") data[key] = saved[key];
    }
    return NextResponse.json({ data });
  } catch (error) { return apiError(error); }
}
