import { cookies } from "next/headers";
import {
  BOOKING_CONTACT_COOKIE,
  bookingContactSession,
  prepareBookingContact,
} from "@/lib/booking-contact-session";
import { publicSettingKeys } from "@/lib/clinic-settings";
import {
  calendarAvailability,
  earliestAvailability,
} from "@/lib/availability-suggestions";
import { connection } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  publicBookingSchema,
  createBooking,
  availability,
} from "@/lib/booking";
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
    if (action === "calendar") {
      const data = z
        .object({
          serviceId: z.string().uuid(),
          doctorId: z.string().uuid().optional(),
          from: dateSchema,
          days: z.coerce.number().int().min(1).max(31),
        })
        .parse(Object.fromEntries(q));
      const items = await calendarAvailability(
        data.serviceId,
        data.doctorId,
        data.from,
        data.days,
      );
      return json({ dates: [...new Set(items.map((item) => item.date))] });
    }
    if (action === "earliest") {
      const data = z
        .object({
          serviceId: z.string().uuid(),
          doctorId: z.string().uuid().optional(),
          from: dateSchema.optional(),
        })
        .parse(Object.fromEntries(q));
      return json({
        items: await earliestAvailability(
          data.serviceId,
          data.doctorId,
          data.from,
        ),
      });
    }
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
          orderBy: [
            { sortOrder: "asc" },
            { category: "asc" },
            { name: "asc" },
            { id: "asc" },
          ],
        }),
        doctors: await db.doctor.findMany({
          where: { active: true },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }, { id: "asc" }],
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
    if (action === "returning-contact") {
      const data = z
        .object({ phone: phoneSchema, previouslyVisited: z.literal(true) })
        .parse(await body(req));
      const source =
        req.headers.get("cf-connecting-ip") ||
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        "unknown";
      await rateLimit(`returning-contact:source:${source}`, 20, 900);
      await rateLimit(`returning-contact:phone:${data.phone}`, 5, 900);
      const contact = await db.patient.findUnique({
        where: { phone: data.phone, active: true },
        select: {
          name: true,
          birthDate: true,
          gender: true,
          guardianName: true,
          guardianPhone: true,
        },
      });
      return json({ contact });
    }
    if (action === "booking") {
      const data = publicBookingSchema.parse(await body(req));
      await rateLimit(`booking:${data.phone}`, 6, 3600);
      const cookieStore = await cookies();
      const contact = await prepareBookingContact(
        data,
        cookieStore.get(BOOKING_CONTACT_COOKIE)?.value,
        data.rememberContact,
      );
      const created = await createBooking(data, undefined, contact.session);
      cookieStore.set(BOOKING_CONTACT_COOKIE, contact.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/api/public",
        maxAge: contact.maxAge,
      });
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
      const session = await bookingContactSession(
        (await cookies()).get(BOOKING_CONTACT_COOKIE)?.value,
        data.phone,
      );
      if (!session)
        throw new ApiError(
          403,
          "Захиалга хийсэн төхөөрөмжөөсөө шалгах эсвэл эмнэлэгтэй холбогдоно уу.",
        );
      return json({
        appointments: await db.appointment.findMany({
          where: {
            bookingContactId: session.id,
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
