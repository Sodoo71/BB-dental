import { publicSettingKeys } from "@/lib/clinic-settings";
import { connection } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { bookingSchema, createBooking, availability } from "@/lib/booking";
import { rateLimit } from "@/lib/auth";
import { dateSchema, phoneSchema, today } from "@/lib/domain";
import {
  ApiError,
  body,
  ensureDatabase,
  json,
  safe,
  sameOrigin,
} from "@/lib/http";
type Ctx = { params: Promise<{ action: string }> };
export async function GET(req: Request, ctx: Ctx) {
  return safe(async () => {
    await connection();
    ensureDatabase();
    const { action } = await ctx.params;
    const q = new URL(req.url).searchParams;
    if (action === "catalog")
      return json({
        clinic: Object.fromEntries(
          (
            await db.setting.findMany({
              where: {
                key: {
                  in: [...publicSettingKeys],
                },
              },
            })
          ).map((s) => [s.key, s.value]),
        ),
        services: await db.service.findMany({
          where: { active: true },
          select: {
            id: true,
            name: true,
            imageUrl: true,
            category: true,
            description: true,
            price: true,
            doctorIds: true,
          },
          orderBy: [{ category: "asc" }, { name: "asc" }],
        }),
        doctors: await db.doctor.findMany({
          where: { active: true },
          select: {
            id: true,
            name: true,
            specialty: true,
            bio: true,
            imageUrl: true,
          },
        }),
      });
    if (action === "suggestions") {
      const serviceId = z.string().uuid().parse(q.get("serviceId"));
      const date = dateSchema.parse(q.get("date") || today());
      const service = await db.service.findUnique({
        where: { id: serviceId, active: true },
      });
      if (!service) throw new ApiError(404, "Үйлчилгээ олдсонгүй.");
      const doctors = await db.doctor.findMany({
        where: {
          active: true,
          ...(service.doctorIds.length
            ? { id: { in: service.doctorIds } }
            : {}),
        },
        select: { id: true, name: true, specialty: true, imageUrl: true },
        orderBy: { name: "asc" },
      });
      const suggestions = await Promise.all(
        doctors.map(async (doctor) => ({
          doctor,
          slots: await availability(doctor.id, serviceId, date),
        })),
      );
      return json({ suggestions: suggestions.filter((s) => s.slots.length) });
    }
    if (action === "availability") {
      const data = z
        .object({
          doctorId: z.string().uuid(),
          serviceId: z.string().uuid(),
          date: dateSchema,
        })
        .parse(Object.fromEntries(q));
      return json({
        slots: await availability(data.doctorId, data.serviceId, data.date),
      });
    }
    throw new ApiError(404, "Олдсонгүй.");
  });
}
export async function POST(req: Request, ctx: Ctx) {
  return safe(async () => {
    sameOrigin(req);
    ensureDatabase();
    const { action } = await ctx.params;
    if (action === "booking") {
      const data = bookingSchema
        .omit({ patientId: true, repeatOfId: true })
        .parse(await body(req));
      await rateLimit(`booking:${data.phone}`, 6, 3600);
      const created = await createBooking(data);
      return json(
        { id: created.id, date: created.date, startTime: created.startTime },
        201,
      );
    }
    if (action === "lookup") {
      const data = z
        .object({ phone: phoneSchema, confirmed: z.literal(true) })
        .parse(await body(req));
      await rateLimit(`lookup:${data.phone}`, 10, 900);
      return json({
        appointments: await db.appointment.findMany({
          where: {
            patient: { phone: data.phone },
            status: { not: "CANCELLED" },
          },
          select: {
            id: true,
            date: true,
            startTime: true,
            status: true,
            service: { select: { name: true } },
            doctor: { select: { name: true } },
          },
          orderBy: [{ date: "desc" }, { startTime: "desc" }],
          take: 30,
        }),
      });
    }
    throw new ApiError(404, "Олдсонгүй.");
  });
}
