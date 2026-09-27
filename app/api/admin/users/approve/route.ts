import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth";
import { changeAccountState } from "@/lib/auth/users";
import { apiError, HttpError } from "@/lib/security/http";
import { accountStatusSchema } from "@/lib/validation/auth";
export async function POST(request: Request) {
  try {
    const actor = await requirePermission("users:manage");
    if (!actor) throw new HttpError(403, "Хандах эрхгүй байна.");
    const input = z
      .object({
        userId: z.string().uuid(),
        status: accountStatusSchema.default("ACTIVE"),
      })
      .parse(await request.json());
    const user = await changeAccountState(actor, input.userId, input.status);
    return NextResponse.json({ success: true, data: user });
  } catch (error) {
    return apiError(error);
  }
}
