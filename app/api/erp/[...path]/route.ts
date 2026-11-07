import { schedulePolicy, scheduleLockDays } from "@/lib/schedule-policy";
import {
  saveLeave,
  removeLeave,
  saveWeek,
  reviewLeave,
  weekSchema,
} from "@/lib/schedule-actions";
import { ensureWorkCoverage } from "@/lib/work-schedule-server";
import { createHash, randomBytes } from "node:crypto";
import {
  telegramConfig,
  telegramStatus,
  telegramCall,
  telegramIdentity,
  rememberBot,
  sealToken,
  webhookUrl,
  webhookSecret,
} from "@/lib/telegram";
import {
  publicSettingKeys,
  editableSettingKeys,
  settingValue,
  clinicBatchSchema,
} from "@/lib/clinic-settings";
import { isCloudinaryImage } from "@/lib/cloudinary";
import { adminTelegramPasswordReset } from "@/lib/accounts";
import { z } from "zod";
import { hash } from "bcryptjs";
import { db } from "@/lib/db";
import { Prisma } from "@/app/generated/prisma/client";
import {
  audit,
  patientAccess,
  patientScope,
  clinicalScope,
  rateLimit,
  requireUser,
  type Actor,
} from "@/lib/auth";
import { ApiError, body, json, safe, sameOrigin } from "@/lib/http";
import {
  dateSchema,
  timeSchema,
  periodRange,
  today,
  clock,
  minutes,
} from "@/lib/domain";
import {
  staffBookingSchema,
  createBooking,
  doctorLock,
  availability,
  notifyDoctor,
  notifyBooking,
} from "@/lib/booking";
import * as v from "@/lib/validation";
import { reportData } from "@/lib/reports";

type Ctx = { params: Promise<{ path: string[] }> };
const staff = ["ADMIN", "RECEPTION"] as const;
function permit(user: Actor, roles: readonly string[]) {
  if (!roles.includes(user.role))
    throw new ApiError(403, "Энэ үйлдлийг хийх эрхгүй.");
}
function ownDoctor(user: Actor, id: string) {
  if (user.role === "DOCTOR" && user.doctor?.id !== id)
    throw new ApiError(403, "Зөвхөн өөрийн хуваарийг өөрчилнө.");
}
const patientWhere = patientScope;
const userSelect = {
  id: true,
  name: true,
  phone: true,
  email: true,
  telegramChatId: true,
  approvalStatus: true,
  approvedAt: true,
  role: true,
  active: true,
  doctor: { select: { id: true, name: true } },
  createdAt: true,
} as const;
export async function GET(req: Request, ctx: Ctx) {
  return safe(async () => {
    const user = await requireUser();
    const [resource, id] = (await ctx.params).path;
    if (user.role === "RECEPTION" && !["options", "availability", "appointments", "patients"].includes(resource))
      throw new ApiError(403, "Ресепшний ажлын хэсгийг ашиглана уу.");
    const q = new URL(req.url).searchParams;
    const search = (q.get("q") || "").slice(0, 100);
    const page = Math.max(1, Math.min(10000, Number(q.get("page")) || 1));
    const skip = (page - 1) * 50;
    let date = periodRange(
      q.get("period") || "all",
      q.get("year"),
      q.get("month"),
    );
    if (q.get("from") && q.get("to")) {
      const from = dateSchema.parse(q.get("from")),
        to = dateSchema.parse(q.get("to"));
      if (from > to || Date.parse(to) - Date.parse(from) > 31 * 86400000)
        throw new ApiError(
          400,
          "Календарын хугацаа 31 өдрөөс хэтэрч болохгүй.",
        );
      date = { gte: from, lte: to };
    }
    if (resource === "doctor-detail") {
      permit(user, ["ADMIN"]);
      const doctorId = z.string().uuid().parse(id);
      const page = z.coerce
        .number()
        .int()
        .min(1)
        .max(100000)
        .parse(q.get("page") || 1);
      const doctor = await db.doctor.findUniqueOrThrow({
        where: { id: doctorId },
        select: {
          id: true,
          name: true,
          specialty: true,
          bio: true,
          imageUrl: true,
          active: true,
          schedules: { orderBy: { weekday: "asc" } },
          leaves: {
            where: { date: { gte: today() } },
            orderBy: { date: "asc" },
            take: 100,
          },
        },
      });
      const [total, completed, patients, appointments] = await Promise.all([
        db.appointment.count({ where: { doctorId } }),
        db.appointment.count({ where: { doctorId, status: "COMPLETED" } }),
        db.patient.count({ where: { appointments: { some: { doctorId } } } }),
        db.appointment.findMany({
          where: { doctorId },
          select: {
            id: true,
            date: true,
            startTime: true,
            status: true,
            patient: { select: { name: true } },
            service: { select: { name: true } },
          },
          orderBy: [{ date: "desc" }, { startTime: "desc" }, { id: "asc" }],
          skip: (page - 1) * 50,
          take: 50,
        }),
      ]);
      return json({
        doctor,
        stats: { total, completed, patients },
        appointments,
      });
    }
    if (resource === "system-status") {
      permit(user, ["ADMIN"]);
      await rateLimit(`system-status:${user.id}`, 30, 3600);
      const start = performance.now();
      await db.$queryRaw`SELECT 1`;
      const latencyMs = Math.round(performance.now() - start);
      const [users, doctors, patients, appointments, services] =
        await Promise.all([
          db.user.count(),
          db.doctor.count(),
          db.patient.count(),
          db.appointment.count(),
          db.service.count(),
        ]);
      return json({
        status: "HEALTHY",
        latencyMs,
        dbProvider: "PostgreSQL",
        timestamp: new Date().toISOString(),
        counts: { users, doctors, patients, appointments, services },
      });
    }
    if (resource === "availability") {
      const data = z
        .object({
          doctorId: z.string().uuid(),
          serviceId: z.string().uuid(),
          date: dateSchema,
          excludeId: z.string().uuid().optional(),
        })
        .parse(Object.fromEntries(q));
      ownDoctor(user, data.doctorId);
      if (data.excludeId) {
        const existing = await db.appointment.findUnique({
          where: { id: data.excludeId },
        });
        if (!existing) throw new ApiError(404, "Захиалга олдсонгүй.");
        ownDoctor(user, existing.doctorId);
      }
      return json({
        slots: await availability(
          data.doctorId,
          data.serviceId,
          data.date,
          db,
          data.excludeId,
        ),
      });
    }
    if (resource === "roster") {
      const from = dateSchema.parse(q.get("from") || today()),
        to = dateSchema.parse(q.get("to") || from);
      if (from > to || Date.parse(to) - Date.parse(from) > 31 * 86400000)
        throw new ApiError(400, "31 хоногийн хугацаа сонгоно уу.");
      const setting = await db.setting.findUnique({
        where: { key: "scheduleLockDays" },
      });
      const doctors = await db.doctor.findMany({
        where: { active: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          specialty: true,
          schedules: true,
          leaves: {
            where: {
              date: { gte: from, lte: to },
              ...(user.role === "DOCTOR"
                ? {
                    OR: [
                      { status: "APPROVED" },
                      { doctorId: user.doctor?.id || "none" },
                    ],
                  }
                : {}),
            },
          },
          appointments: {
            where: {
              date: { gte: from, lte: to },
              status: { notIn: ["CANCELLED", "NO_SHOW"] },
              ...(user.role === "DOCTOR"
                ? { doctorId: user.doctor?.id || "none" }
                : {}),
            },
            select: {
              id: true,
              date: true,
              startTime: true,
              endTime: true,
              status: true,
            },
          },
        },
      });
      return json({
        policy: schedulePolicy(scheduleLockDays(setting?.value), today()),
        doctors: doctors.map((doctor) => ({
          ...doctor,
          leaves: doctor.leaves.map((leave) =>
            user.role === "DOCTOR" && doctor.id !== user.doctor?.id
              ? {
                  ...leave,
                  reason: "",
                  reviewedById: null,
                  reviewedAt: null,
                  replacesId: null,
                }
              : leave,
          ),
        })),
        nurses: await db.nurseShift.findMany({
          where: { date: { gte: from, lte: to } },
          orderBy: [{ date: "asc" }, { startTime: "asc" }],
        }),
      });
    }
    if (resource === "transfer-options") {
      permit(user, ["ADMIN", "DOCTOR"]);
      return json({
        items: await db.doctor.findMany({
          where: {
            active: true,
            user: { active: true, approvalStatus: "APPROVED", role: "DOCTOR" },
          },
          select: { id: true, name: true, specialty: true },
          orderBy: { name: "asc" },
        }),
      });
    }
    if (resource === "options")
      return json({
        services: await db.service.findMany({
          where: { active: true },
          orderBy: { name: "asc" },
        }),
        doctors: await db.doctor.findMany({
          where: {
            active: true,
            ...(user.role === "DOCTOR"
              ? { id: user.doctor?.id || "none" }
              : {}),
          },
          select: { id: true, name: true, specialty: true },
        }),
      });
    if (resource === "dashboard") {
      if (user.role === "ADMIN") return json(await reportData(q));
      const appointments = await db.appointment.findMany({
        where: {
          date,
          ...(user.role === "DOCTOR"
            ? { doctorId: user.doctor?.id || "none" }
            : {}),
        },
        select: { id: true, status: true, date: true, patientId: true },
      });
      return json({
        appointmentCount: appointments.length,
        patientCount: new Set(appointments.map((a) => a.patientId)).size,
        statuses: Object.fromEntries(
          [
            "PENDING",
            "CONFIRMED",
            "ARRIVED",
            "COMPLETED",
            "CANCELLED",
            "NO_SHOW",
          ].map((s) => [s, appointments.filter((a) => a.status === s).length]),
        ),
      });
    }
    if (resource === "reports") {
      permit(user, ["ADMIN"]);
      return json(await reportData(q));
    }
    if (resource === "appointments") {
      const where: Prisma.AppointmentWhereInput = {
        date,
        ...(user.role === "DOCTOR"
          ? { doctorId: user.doctor?.id || "none" }
          : {}),
        ...(q.get("status")
          ? {
              status: z
                .enum([
                  "PENDING",
                  "CONFIRMED",
                  "ARRIVED",
                  "COMPLETED",
                  "CANCELLED",
                  "NO_SHOW",
                ])
                .parse(q.get("status")),
            }
          : {}),
        ...(q.get("date") ? { date: dateSchema.parse(q.get("date")) } : {}),
        ...(search
          ? {
              OR: [
                {
                  patient: { name: { contains: search, mode: "insensitive" } },
                },
                { patient: { phone: { contains: search } } },
                {
                  service: { name: { contains: search, mode: "insensitive" } },
                },
              ],
            }
          : {}),
      };
      return json({
        items: await db.appointment.findMany({
          where,
          include: {
            patient: { select: { id: true, name: true, phone: true } },
            doctor: { select: { id: true, name: true } },
            service: true,
          },
          orderBy: [{ date: "desc" }, { startTime: "asc" }],
          take: q.get("view") === "calendar" && q.get("from") ? undefined : 50,
          skip: q.get("view") === "calendar" ? undefined : skip,
        }),
        total: await db.appointment.count({ where }),
      });
    }
    if (resource === "patients" && user.role === "RECEPTION") {
      const select = { id: true, name: true, phone: true, birthDate: true, gender: true, guardianName: true, guardianPhone: true, address: true, allergies: true, active: true,
        ...(id ? { appointments: { include: { doctor: { select: { name: true } }, service: { select: { name: true } } }, orderBy: { date: "desc" as const } }, payments: { orderBy: { createdAt: "desc" as const } } } : {}) };
      if (id) return json(await db.patient.findUniqueOrThrow({ where: { id }, select }));
      const where: Prisma.PatientWhereInput = { active: true, ...(search ? { OR: [{ name: { contains: search, mode: "insensitive" } }, { phone: { contains: search } }, { id: { contains: search } }] } : {}) };
      return json({ items: await db.patient.findMany({ where, select, take: 50, skip, orderBy: { name: "asc" } }), total: await db.patient.count({ where }) });
    }
    if (resource === "patients") {
      if (id) {
        const scope = await clinicalScope(user, id);
        return json(
          await db.patient.findUnique({
            where: { id },
            include: {
              notes: {
                include: { author: { select: { name: true, role: true } } },
                orderBy: { createdAt: "desc" },
              },
              transfers: {
                include: {
                  sourceDoctor: { select: { name: true } },
                  targetDoctor: { select: { name: true } },
                },
                orderBy: { createdAt: "desc" },
              },
              appointments: {
                where: scope,
                include: { doctor: { select: { name: true } }, service: true },
                orderBy: [{ date: "desc" }, { startTime: "desc" }],
              },
              treatments: {
                where: scope,
                include: {
                  doctor: { select: { name: true } },
                  service: { select: { name: true } },
                },
                orderBy: { date: "desc" },
              },
              ...(user.role !== "DOCTOR"
                ? { payments: { orderBy: { date: "desc" } } }
                : {}),
            },
          }),
        );
      }
      const where: Prisma.PatientWhereInput = {
        active: true,
        ...patientWhere(user),
        ...(search
          ? {
              AND: [
                {
                  OR: [
                    { name: { contains: search, mode: "insensitive" } },
                    { phone: { contains: search } },
                  ],
                },
              ],
            }
          : {}),
      };
      return json({
        items: await db.patient.findMany({
          where,
          orderBy: { name: "asc" },
          take: 50,
          skip,
        }),
        total: await db.patient.count({ where }),
      });
    }
    if (resource === "services") {
      const where: Prisma.ServiceWhereInput = {
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { category: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      };
      return json({
        items: await db.service.findMany({
          where,
          orderBy: [{ category: "asc" }, { name: "asc" }],
          take: 50,
          skip,
        }),
        total: await db.service.count({ where }),
      });
    }
    if (resource === "doctors")
      return json({
        items: await db.doctor.findMany({
          where:
            user.role === "DOCTOR" ? { id: user.doctor?.id || "none" } : {},
          include: { user: { select: { id: true, name: true, phone: true } } },
          orderBy: { name: "asc" },
        }),
      });
    if (resource === "schedules")
      return json({
        items: await db.schedule.findMany({
          where:
            user.role === "DOCTOR"
              ? { doctorId: user.doctor?.id || "none" }
              : {},
          include: { doctor: { select: { name: true } } },
          orderBy: [{ doctorId: "asc" }, { weekday: "asc" }],
        }),
      });
    if (resource === "leaves")
      return json({
        items: await db.leave.findMany({
          where:
            user.role === "DOCTOR"
              ? { doctorId: user.doctor?.id || "none" }
              : {},
          include: { doctor: { select: { name: true } } },
          orderBy: { date: "desc" },
          take: 200,
        }),
      });
    if (resource === "treatments" && user.role === "RECEPTION") throw new ApiError(403, "Эмнэлзүйн мэдээлэлд хандах эрхгүй.");
    if (resource === "treatments")
      return json({
        items: await db.treatment.findMany({
          where: {
            date,
            ...(user.role === "DOCTOR"
              ? { doctorId: user.doctor?.id || "none" }
              : {}),
            ...(search
              ? {
                  OR: [
                    {
                      patient: {
                        name: { contains: search, mode: "insensitive" },
                      },
                    },
                    {
                      service: {
                        name: { contains: search, mode: "insensitive" },
                      },
                    },
                  ],
                }
              : {}),
          },
          include: {
            patient: { select: { id: true, name: true, phone: true } },
            doctor: { select: { name: true } },
            service: { select: { name: true } },
          },
          orderBy: { date: "desc" },
          take: 50,
          skip,
        }),
      });
    if (resource === "payments") {
      permit(user, staff);
      const where: Prisma.PaymentWhereInput = {
        date,
        ...(search
          ? {
              patient: {
                OR: [
                  { name: { contains: search, mode: "insensitive" } },
                  { phone: { contains: search } },
                ],
              },
            }
          : {}),
      };
      return json({
        items: await db.payment.findMany({
          where,
          include: {
            patient: { select: { name: true, phone: true } },
            appointment: { include: { service: { select: { name: true } } } },
          },
          orderBy: [{ date: "desc" }, { createdAt: "desc" }],
          take: 50,
          skip,
        }),
        total: await db.payment.count({ where }),
      });
    }
    if (resource === "expenses") {
      permit(user, ["ADMIN"]);
      return json({
        items: await db.expense.findMany({
          where: { date },
          orderBy: { date: "desc" },
          take: 50,
          skip,
        }),
      });
    }
    if (resource === "inventory") {
      permit(user, ["ADMIN", "RECEPTION"]);
      return json({
        items: await db.inventoryItem.findMany({
          where: {
            active: true,
            ...(search
              ? {
                  OR: [
                    { name: { contains: search, mode: "insensitive" } },
                    { sku: { contains: search } },
                  ],
                }
              : {}),
          },
          include: { movements: { orderBy: { createdAt: "desc" }, take: 10 } },
          orderBy: { name: "asc" },
          take: 50,
          skip,
        }),
      });
    }
    if (resource === "documents")
      return json({
        items: await db.document.findMany({
          where: {
            ...(user.role === "DOCTOR" ? { patient: patientWhere(user) } : {}),
            ...(q.get("patientId") ? { patientId: q.get("patientId")! } : {}),
          },
          include: { patient: { select: { id: true, name: true } } },
          orderBy: { createdAt: "desc" },
          take: 50,
          skip,
        }),
      });
    if (resource === "users") {
      permit(user, ["ADMIN"]);
      return json({
        items: await db.user.findMany({
          select: userSelect,
          orderBy: { createdAt: "desc" },
        }),
      });
    }
    if (resource === "telegram-settings") {
      permit(user, ["ADMIN"]);
      return json(await telegramStatus());
    }
    if (resource === "settings") {
      permit(user, ["ADMIN"]);
      return json({
        items: await db.setting.findMany({
          where: { key: { in: [...editableSettingKeys] } },
        }),
      });
    }
    if (resource === "audit") {
      permit(user, ["ADMIN"]);
      return json({
        items: await db.auditLog.findMany({
          orderBy: { createdAt: "desc" },
          take: 50,
          skip,
        }),
      });
    }
    throw new ApiError(404, "Модуль олдсонгүй.");
  });
}
export async function POST(req: Request, ctx: Ctx) {
  return safe(async () => {
    sameOrigin(req);
    const user = await requireUser();
    const [resource, id] = (await ctx.params).path;
    if (user.role === "RECEPTION" && !["appointments", "reschedule", "patients"].includes(resource))
      throw new ApiError(403, "Энэ үйлдлийг хийх эрхгүй.");
    const input = await body(req);
    if (resource === "schedule-week") {
      permit(user, ["ADMIN"]);
      const data = weekSchema.parse(input);
      ownDoctor(user, data.doctorId);
      return json(await saveWeek(data, user.id));
    }
    if (resource === "leave-review") {
      permit(user, ["ADMIN"]);
      const data = z
        .object({ status: z.enum(["APPROVED", "REJECTED"]) })
        .parse(input);
      if (!id) throw new ApiError(400, "Хүсэлт сонгоно уу.");
      return json(await reviewLeave(id, data.status, user.id));
    }
    let result: { id: string };
    if (resource === "appointment-reminder") {
      permit(user, ["ADMIN", "DOCTOR"]);
      const appointmentId = z.string().uuid().parse(id);
      const appointment = await db.appointment.findUnique({
        where: { id: appointmentId },
        include: {
          patient: { select: { name: true, phone: true } },
          doctor: { select: { name: true, telegramChatId: true } },
          service: { select: { name: true } },
        },
      });
      if (
        !appointment ||
        (user.role === "DOCTOR" && appointment.doctorId !== user.doctor?.id)
      )
        throw new ApiError(404, "Захиалга олдсонгүй.");
      if (
        appointment.date < today() ||
        !["PENDING", "CONFIRMED", "ARRIVED"].includes(appointment.status)
      )
        throw new ApiError(
          409,
          "Зөвхөн хүлээгдэж буй үзлэгт сануулга илгээнэ.",
        );
      await rateLimit(`reminder:${appointment.id}`, 1, 60);
      await rateLimit(`reminder:actor:${user.id}`, 30, 3600);
      const sent = await notifyDoctor(
        appointment.doctor.telegramChatId,
        `🦷 ҮЗЛЭГИЙН САНУУЛГА\nЭмч: ${appointment.doctor.name}\nӨвчтөн: ${appointment.patient.name}\nУтас: ${appointment.patient.phone}\nҮйлчилгээ: ${appointment.service.name}\nӨдөр: ${appointment.date}\nЦаг: ${appointment.startTime}`,
        undefined,
        "booking",
      );
      if (!sent.ok)
        throw new ApiError(
          503,
          "Сануулга хүрсэнгүй. Telegram тохиргоо, Chat ID болон мэдэгдэл идэвхтэй эсэхийг шалгана уу.",
        );
      await audit(
        user,
        "APPOINTMENT_REMINDER_SENT",
        "appointments",
        appointment.id,
      );
      return json({ ok: true });
    }
    if (resource === "nurse-shifts") {
      permit(user, ["ADMIN"]);
      const data = z
        .object({
          name: z.string().trim().min(2).max(100),
          date: dateSchema,
          startTime: timeSchema,
          endTime: timeSchema,
        })
        .parse(input);
      if (data.startTime >= data.endTime)
        throw new ApiError(400, "Дуусах цаг эхлэх цагаас хойш байна.");
      const shift = await db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`nurse:${data.date}:${data.name.toLocaleLowerCase()}`}))::text AS locked`;
        const overlap = await tx.nurseShift.count({
          where: {
            name: { equals: data.name, mode: "insensitive" },
            date: data.date,
            startTime: { lt: data.endTime },
            endTime: { gt: data.startTime },
          },
        });
        if (overlap)
          throw new ApiError(409, "Энэ сувилагчийн ээлж давхцаж байна.");
        return tx.nurseShift.create({ data });
      });
      await audit(user, "CREATE", "nurse-shifts", shift.id);
      return json(shift, 201);
    }
    if (resource === "telegram-settings") {
      permit(user, ["ADMIN"]);
      const action = z
        .enum([
          "save",
          "test",
          "clear-token",
          "webhook-status",
          "webhook-install",
          "webhook-remove",
        ])
        .parse(input.action);
      if (action === "save") {
        const data = z
          .object({
            token: z.string().max(200).optional(),
            booking: z.boolean(),
            transfer: z.boolean(),
            recovery: z.boolean(),
          })
          .parse(input);
        const writes = [
          { key: "telegramBookingEnabled", value: String(data.booking) },
          { key: "telegramTransferEnabled", value: String(data.transfer) },
          { key: "telegramRecoveryEnabled", value: String(data.recovery) },
        ];
        if (data.token?.trim()) {
          const token = data.token.trim();
          if (!/^\d+:[A-Za-z0-9_-]{20,}$/.test(token))
            throw new ApiError(400, "Bot token-ийн хэлбэр буруу байна.");
          const sealed = sealToken(token);
          const bot = await telegramIdentity({
            token,
            booking: true,
            transfer: true,
            recovery: true,
            source: "database",
          });
          writes.push(
            { key: "telegramBotTokenEncrypted", value: sealed },
            { key: "telegramBotUsername", value: bot.username },
            { key: "telegramBotName", value: bot.name },
          );
        }
        await db.$transaction(
          writes.map((item) =>
            db.setting.upsert({
              where: { key: item.key },
              create: item,
              update: { value: item.value },
            }),
          ),
        );
      } else if (action === "clear-token")
        await db.setting.deleteMany({
          where: {
            key: {
              in: [
                "telegramBotTokenEncrypted",
                "telegramBotName",
                "telegramBotUsername",
              ],
            },
          },
        });
      else if (action === "test") {
        const bot = await telegramIdentity();
        await rememberBot(bot);
      } else if (action === "webhook-install")
        await telegramCall("setWebhook", {
          url: webhookUrl(),
          secret_token: await webhookSecret(),
          allowed_updates: ["message", "callback_query"],
          drop_pending_updates: false,
        });
      else if (action === "webhook-remove")
        await telegramCall("deleteWebhook", { drop_pending_updates: false });
      if (action.startsWith("webhook-")) {
        const info = await telegramCall("getWebhookInfo");
        await audit(user, action, "telegram", "settings");
        return json({
          url: info.url || "",
          pending: Number(info.pending_update_count || 0),
          lastError: String(info.last_error_message || ""),
        });
      }
      await audit(user, action, "telegram", "settings");
      return json(await telegramStatus());
    }
    if (resource === "telegram-link") {
      const targetId = id || user.id;
      if (user.role !== "ADMIN" && targetId !== user.id)
        throw new ApiError(403, "Өөр ажилтны Telegram холбоос үүсгэх эрхгүй.");
      const target = await db.user.findFirst({
        where: { id: targetId, active: true, approvalStatus: "APPROVED" },
      });
      if (!target) throw new ApiError(404, "Идэвхтэй ажилтан олдсонгүй.");
      await rateLimit(`telegram-link:${targetId}`, 10, 3600);
      const bot = await telegramIdentity();
      await rememberBot(bot);
      const token = randomBytes(24).toString("hex"),
        key = `telegramLink:${createHash("sha256").update(token).digest("hex")}`;
      await db.setting.create({
        data: {
          key,
          value: JSON.stringify({
            userId: targetId,
            expiresAt: Date.now() + 15 * 60000,
          }),
        },
      });
      await audit(user, "TELEGRAM_LINK_CREATED", "users", targetId);
      return json({
        url: `https://t.me/${bot.username}?start=${token}`,
        expiresIn: 900,
      });
    }
    if (resource === "telegram-user-test") {
      const targetId = id || user.id;
      if (user.role !== "ADMIN" && targetId !== user.id)
        throw new ApiError(403, "Өөр ажилтанд туршилт илгээх эрхгүй.");
      const target = await db.user.findUniqueOrThrow({
        where: { id: targetId },
      });
      const config = await telegramConfig();
      const sent = await notifyDoctor(
        target.telegramChatId,
        "BB Dental Clinic · Telegram холболтын туршилт амжилттай.",
        undefined,
        "test",
        config,
      );
      if (!sent.ok)
        throw new ApiError(
          503,
          "Мэдэгдэл хүрсэнгүй. Chat ID болон bot дээр /start дарсан эсэхээ шалгана уу.",
        );
      return json({ ok: true });
    }
    if (resource === "user-password-reset") {
      permit(user, ["ADMIN"]);
      if (!id) throw new ApiError(400, "Ажилтан сонгоно уу.");
      await rateLimit(`admin-reset:actor:${user.id}`, 30, 3600);
      await rateLimit(`admin-reset:user:${id}`, 4, 3600);
      await adminTelegramPasswordReset(id, user.id);
      return json({
        ok: true,
        message: "Сэргээх холбоос ажилтны бүртгэлтэй Telegram руу илгээгдлээ.",
      });
    }
    if (resource === "telegram-test") {
      permit(user, ["ADMIN", "DOCTOR"]);
      if (!id) throw new ApiError(400, "Эмч сонгоно уу.");
      ownDoctor(user, id);
      const doctor = await db.doctor.findUniqueOrThrow({ where: { id } });
      const sent = await notifyDoctor(
        doctor.telegramChatId,
        "BB Dental Clinic · Туршилтын мэдэгдэл. Эмчийн Telegram холболт ажиллаж байна.",
        undefined,
        "test",
      );
      if (!sent.ok)
        throw new ApiError(
          503,
          sent.code === "NOT_CONFIGURED"
            ? "Bot token эсвэл эмчийн Telegram Chat ID тохируулаагүй байна."
            : "Мэдэгдэл хүрсэнгүй. Bot дээр /start дарсан эсэх, Chat ID-гаа шалгана уу.",
        );
      result = doctor;
    } else if (resource === "user-approval") {
      permit(user, ["ADMIN"]);
      if (!id) throw new ApiError(400, "Ажилтан сонгоно уу.");
      const data = z
        .object({
          status: z.enum(["APPROVED", "REJECTED"]),
          role: z.enum(["ADMIN", "DOCTOR", "RECEPTION"]),
        })
        .parse(input);
      result = await db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('bb-users'))::text AS locked`;
        const pending = await tx.user.findUniqueOrThrow({
          where: { id },
          include: { doctor: true },
        });
        if (pending.approvalStatus !== "PENDING")
          throw new ApiError(409, "Энэ бүртгэлийг өмнө нь хянасан байна.");
        const approved = data.status === "APPROVED";
        if (pending.doctor && data.role !== "DOCTOR")
          await tx.doctor.delete({ where: { id: pending.doctor.id } });
        if (data.role === "DOCTOR")
          await tx.doctor.upsert({
            where: { userId: id },
            create: {
              userId: id,
              name: pending.name,
              specialty: "Шүдний эмч",
              telegramChatId: pending.telegramChatId,
              active: approved,
            },
            update: {
              active: approved,
              telegramChatId: pending.telegramChatId,
            },
          });
        const updated = await tx.user.update({
          where: { id },
          data: {
            role: data.role,
            active: approved,
            approvalStatus: data.status,
            approvedById: user.id,
            approvedAt: new Date(),
          },
        });
        await tx.session.deleteMany({ where: { userId: id } });
        return updated;
      });
    } else if (resource === "patient-notes") {
      const data = v.patientNoteSchema.parse(input);
      await patientAccess(user, data.patientId);
      result = await db.patientNote.create({
        data: { ...data, authorId: user.id },
      });
    } else if (resource === "transfers") {
      permit(user, ["ADMIN", "DOCTOR"]);
      const data = v.transferSchema.parse(input);
      await patientAccess(user, data.patientId);
      ownDoctor(user, data.sourceDoctorId);
      const transfer = await db.$transaction(async (tx) => {
        for (const doctorId of [
          data.sourceDoctorId,
          data.targetDoctorId,
        ].sort())
          await doctorLock(tx, doctorId);
        const target = await tx.doctor.findFirst({
          where: {
            id: data.targetDoctorId,
            active: true,
            user: { active: true, approvalStatus: "APPROVED", role: "DOCTOR" },
          },
        });
        if (!target)
          throw new ApiError(400, "Идэвхтэй, зөвшөөрөгдсөн эмч сонгоно уу.");
        const previous = await tx.patientTransfer.findFirst({
          where: {
            patientId: data.patientId,
            sourceDoctorId: data.sourceDoctorId,
            targetDoctorId: data.targetDoctorId,
          },
          orderBy: { createdAt: "desc" },
        });
        if (previous && Date.now() - previous.createdAt.getTime() < 10000)
          throw new ApiError(409, "Шилжүүлэг сая бүртгэгдсэн байна.");
        return tx.patientTransfer.create({
          data: { ...data, createdById: user.id },
          include: { targetDoctor: true },
        });
      });
      await notifyDoctor(
        transfer.targetDoctor.telegramChatId,
        "Танд өвчтөн шилжүүллээ. BB Dental ERP-ийн өвчтөний картаас дэлгэрэнгүй харна уу.",
        undefined,
        "transfer",
      );
      result = transfer;
    } else if (resource === "reschedule") {
      permit(user, staff);
      if (!id) throw new ApiError(400, "Захиалгын ID шаардлагатай.");
      const data = z
        .object({
          doctorId: z.string().uuid(),
          serviceId: z.string().uuid(),
          date: dateSchema,
          startTime: timeSchema,
          force: z.boolean().default(false),
        })
        .parse(input);
      const { force, ...details } = data;
      const previous = await db.appointment.findUniqueOrThrow({
        where: { id },
      });
      const moved = await db.$transaction(async (tx) => {
        for (const doctor of [
          ...new Set([previous.doctorId, data.doctorId]),
        ].sort())
          await doctorLock(tx, doctor);
        const current = await tx.appointment.findUniqueOrThrow({
          where: { id },
        });
        if (current.doctorId !== previous.doctorId)
          throw new ApiError(
            409,
            "Захиалга өөрчлөгдсөн байна. Дахин ачаална уу.",
          );
        if (user.role === "RECEPTION" && await tx.queueEntry.findUnique({ where: { appointmentId: id } }))
          throw new ApiError(409, "Ирсэн өвчтөний цагийг шилжүүлэхгүй. Давтан цаг үүсгэнэ үү.");
        if (["COMPLETED", "CANCELLED", "NO_SHOW"].includes(current.status))
          throw new ApiError(
            400,
            "Дууссан эсвэл цуцлагдсан захиалгыг шилжүүлэхгүй. Давтан цаг үүсгэнэ үү.",
          );
        if (
          !(
            await availability(data.doctorId, data.serviceId, data.date, tx, id, data.startTime, force)
          ).includes(data.startTime)
        )
          throw new ApiError(
            409,
            "Сонгосон цаг боломжгүй эсвэл давхардсан байна.",
          );
        const service = await tx.service.findUniqueOrThrow({
          where: { id: data.serviceId },
        });
        const appointment = await tx.appointment.update({
          where: { id },
          data: {
            ...details,
            endTime: clock(minutes(data.startTime) + service.duration),
            status: "CONFIRMED",
          },
          include: { doctor: true, service: true, patient: true },
        });
        if (force) await tx.auditLog.create({ data: { actorId: user.id, action: "APPOINTMENT_SCHEDULE_OVERRIDE", entity: "appointments", entityId: id } });
        return appointment;
      });
      await notifyBooking(moved);
      result = moved;
    } else if (resource === "appointments") {
      permit(user, staff);
      const data = staffBookingSchema.parse(input);
      result = await createBooking(data, user.id, undefined, { allowScheduleOverride: data.force });
    } else if (resource === "patients") {
      permit(user, staff);
      result = await db.patient.create({ data: user.role === "RECEPTION" ? v.patientSchema.omit({ medicalHistory: true, allergies: true }).parse(input) : v.patientSchema.parse(input) });
    } else if (resource === "services") {
      permit(user, ["ADMIN"]);
      const data = v.serviceSchema.parse(input);
      if (
        (await db.doctor.count({ where: { id: { in: data.doctorIds } } })) !==
        new Set(data.doctorIds).size
      )
        throw new ApiError(400, "Үйлчилгээний эмч олдсонгүй.");
      result = await db.service.create({ data });
    } else if (resource === "doctors") {
      permit(user, ["ADMIN"]);
      const data = v.doctorSchema.parse(input);
      if (data.userId) {
        const linked = await db.user.findFirst({
          where: { id: data.userId, role: "DOCTOR", active: true },
        });
        if (!linked)
          throw new ApiError(400, "Идэвхтэй эмчийн данс сонгоно уу.");
      }
      result = await db.doctor.create({ data });
    } else if (resource === "users") {
      permit(user, ["ADMIN"]);
      const { password, ...data } = v.userSchema.parse(input);
      result = await db.$transaction(async (tx) => {
        const u = await tx.user.create({
          data: {
            ...data,
            approvalStatus: "APPROVED",
            approvedById: user.id,
            approvedAt: new Date(),
            passwordHash: await hash(password, 12),
          },
        });
        if (u.role === "DOCTOR")
          await tx.doctor.create({
            data: {
              userId: u.id,
              name: u.name,
              specialty: "Шүдний эмч",
              telegramChatId: u.telegramChatId,
              active: u.active,
            },
          });
        return u;
      });
    } else if (resource === "schedules") {
      permit(user, ["ADMIN"]);
      const data = v.scheduleSchema.parse(input);
      ownDoctor(user, data.doctorId);
      result = await db.$transaction(async (tx) => {
        await doctorLock(tx, data.doctorId);
        const existing = await tx.appointment.findMany({
          where: {
            doctorId: data.doctorId,
            date: { gte: today() },
            status: { notIn: ["CANCELLED", "NO_SHOW", "COMPLETED"] },
          },
        });
        if (
          existing.some(
            (a) =>
              new Date(`${a.date}T12:00Z`).getUTCDay() === data.weekday &&
              (a.startTime < data.startTime || a.endTime > data.endTime),
          )
        )
          throw new ApiError(
            409,
            "Шинэ хуваарь өмнөх захиалгатай зөрчилдөж байна.",
          );
        return tx.schedule.upsert({
          where: {
            doctorId_weekday: {
              doctorId: data.doctorId,
              weekday: data.weekday,
            },
          },
          create: data,
          update: data,
        });
      });
    } else if (resource === "leaves") {
      permit(user, ["ADMIN", "DOCTOR"]);
      result = await saveLeave(input, user);
    } else if (resource === "treatments") {
      permit(user, ["ADMIN", "DOCTOR"]);
      const data = v.treatmentSchema.parse(input);
      ownDoctor(user, data.doctorId);
      await patientAccess(user, data.patientId);
      if (data.appointmentId) {
        const a = await db.appointment.findUnique({
          where: { id: data.appointmentId },
        });
        if (
          !a ||
          a.patientId !== data.patientId ||
          a.doctorId !== data.doctorId ||
          a.serviceId !== data.serviceId
        )
          throw new ApiError(
            400,
            "Захиалга, өвчтөн, эмч, үйлчилгээ зөрж байна.",
          );
      }
      result = await db.treatment.create({ data });
    } else if (resource === "payments") {
      if (user.role === "RECEPTION") throw new ApiError(403, "Касс / POS хэсгээр нэхэмжлэхийн төлбөр бүртгэнэ үү.");
      permit(user, staff);
      const data = v.paymentSchema.parse(input);
      if (data.appointmentId) {
        const a = await db.appointment.findUnique({
          where: { id: data.appointmentId },
        });
        if (!a || a.patientId !== data.patientId)
          throw new ApiError(400, "Захиалгын өвчтөн зөрж байна.");
      }
      result = await db.payment.create({
        data: { ...data, createdById: user.id },
      });
    } else if (resource === "expenses") {
      permit(user, ["ADMIN"]);
      result = await db.expense.create({
        data: { ...v.expenseSchema.parse(input), createdById: user.id },
      });
    } else if (resource === "inventory") {
      permit(user, ["ADMIN"]);
      result = await db.inventoryItem.create({
        data: v.inventorySchema.parse(input),
      });
    } else if (resource === "movements") {
      permit(user, ["ADMIN"]);
      const data = v.movementSchema.parse(input);
      result = await db.$transaction(async (tx) => {
        const updated = await tx.inventoryItem.updateMany({
          where: {
            id: data.itemId,
            active: true,
            quantity: { gte: Math.max(0, -data.quantity) },
          },
          data: { quantity: { increment: data.quantity } },
        });
        if (!updated.count)
          throw new ApiError(
            409,
            "Үлдэгдэл хүрэлцэхгүй эсвэл бараа олдсонгүй.",
          );
        return tx.stockMovement.create({
          data: { ...data, createdById: user.id },
        });
      });
    } else if (resource === "documents") {
      const data = v.documentSchema.parse(input);
      await patientAccess(user, data.patientId);
      result = await db.document.create({
        data: {
          ...data,
          createdById: user.id,
          consentAt: data.consentName ? new Date() : null,
        },
      });
    } else throw new ApiError(404, "Модуль олдсонгүй.");
    await audit(user, "CREATE", resource, result.id);
    return json({ id: result.id }, 201);
  });
}
export async function PATCH(req: Request, ctx: Ctx) {
  return safe(async () => {
    sameOrigin(req);
    const user = await requireUser();
    const [resource, id] = (await ctx.params).path;
    if (user.role === "RECEPTION" && !["appointments", "patients"].includes(resource))
      throw new ApiError(403, "Энэ үйлдлийг хийх эрхгүй.");
    if (!id) throw new ApiError(400, "ID шаардлагатай.");
    const input = await body(req);
    if (resource === "services") {
      permit(user, ["ADMIN"]);
      const data = v.serviceSchema.parse(input);
      if (
        (await db.doctor.count({ where: { id: { in: data.doctorIds } } })) !==
        new Set(data.doctorIds).size
      )
        throw new ApiError(400, "Үйлчилгээний эмч олдсонгүй.");
      await db.service.update({ where: { id }, data });
    } else if (resource === "doctors") {
      permit(user, ["ADMIN"]);
      const data = v.doctorSchema.omit({ userId: true }).parse(input);
      await db.$transaction(async (tx) => {
        const current = await tx.doctor.findUniqueOrThrow({
          where: { id },
          include: { user: true },
        });
        if (
          data.active &&
          current.user &&
          (!current.user.active ||
            current.user.approvalStatus !== "APPROVED" ||
            current.user.role !== "DOCTOR")
        )
          throw new ApiError(
            400,
            "Эхлээд эмчийн дансыг зөвшөөрч идэвхжүүлнэ үү.",
          );
        const doctor = await tx.doctor.update({ where: { id }, data });
        if (doctor.userId)
          await tx.user.update({
            where: { id: doctor.userId },
            data: { telegramChatId: data.telegramChatId },
          });
      });
    } else if (resource === "patients") {
      permit(user, staff);
      await db.patient.update({
        where: { id },
        data: user.role === "RECEPTION" ? v.patientSchema.omit({ medicalHistory: true, allergies: true }).parse(input) : v.patientSchema.parse(input),
      });
    } else if (resource === "inventory") {
      permit(user, ["ADMIN"]);
      await db.inventoryItem.update({
        where: { id },
        data: v.inventorySchema.parse(input),
      });
    } else if (resource === "users") {
      permit(user, ["ADMIN"]);
      const data = v.userSchema
        .omit({ password: true })
        .extend({ password: v.passwordSchema.optional() })
        .parse(input);
      await db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('bb-users'))::text AS locked`;
        const previous = await tx.user.findUniqueOrThrow({
          where: { id },
          include: { doctor: true },
        });
        if (
          previous.role === "ADMIN" &&
          previous.active &&
          previous.approvalStatus === "APPROVED" &&
          (!data.active || data.role !== "ADMIN")
        ) {
          const others = await tx.user.count({
            where: {
              id: { not: id },
              role: "ADMIN",
              active: true,
              approvalStatus: "APPROVED",
            },
          });
          if (!others)
            throw new ApiError(
              400,
              "Сүүлийн идэвхтэй админы эрхийг хаах боломжгүй.",
            );
        }
        if (previous.approvalStatus !== "APPROVED" && data.active)
          throw new ApiError(400, "Эхлээд бүртгэлийг хянаж зөвшөөрнө үү.");
        const { password, ...rest } = data;
        await tx.user.update({
          where: { id },
          data: {
            ...rest,
            ...(password ? { passwordHash: await hash(password, 12) } : {}),
          },
        });
        if (data.role === "DOCTOR")
          await tx.doctor.upsert({
            where: { userId: id },
            create: {
              userId: id,
              name: data.name,
              specialty: "Шүдний эмч",
              telegramChatId: data.telegramChatId,
              active: data.active,
            },
            update: {
              telegramChatId: data.telegramChatId,
              active: data.active,
            },
          });
        if (data.role !== "DOCTOR" && previous.doctor)
          await tx.doctor.update({
            where: { id: previous.doctor.id },
            data: { active: false, telegramChatId: data.telegramChatId },
          });
        await tx.session.deleteMany({ where: { userId: id } });
      });
    } else if (resource === "schedules") {
      permit(user, ["ADMIN"]);
      const data = v.scheduleSchema.parse(input);
      ownDoctor(user, data.doctorId);
      await db.$transaction(async (tx) => {
        const previous = await tx.schedule.findUniqueOrThrow({ where: { id } });
        if (previous.doctorId !== data.doctorId)
          throw new ApiError(400, "Хуваарийн эмчийг солих боломжгүй.");
        await doctorLock(tx, data.doctorId);
        const booked = await tx.appointment.findMany({
          where: {
            doctorId: data.doctorId,
            date: { gte: today() },
            status: { notIn: ["CANCELLED", "NO_SHOW", "COMPLETED"] },
          },
        });
        if (
          booked.some((a) => {
            const weekday = new Date(`${a.date}T12:00Z`).getUTCDay();
            return (
              (weekday === previous.weekday && weekday !== data.weekday) ||
              (weekday === data.weekday &&
                (a.startTime < data.startTime || a.endTime > data.endTime))
            );
          })
        )
          throw new ApiError(
            409,
            "Хуваарийн өөрчлөлт өмнөх захиалгатай зөрчилдөж байна.",
          );
        await tx.schedule.update({ where: { id }, data });
      });
    } else if (resource === "leaves") {
      permit(user, ["ADMIN", "DOCTOR"]);
      await saveLeave(input, user, id);
    } else if (resource === "appointments") {
      const data = z
        .object({
          status: z.enum([
            "PENDING",
            "CONFIRMED",
            "ARRIVED",
            "COMPLETED",
            "CANCELLED",
            "NO_SHOW",
          ]),
          note: z.string().max(2000).optional(),
        })
        .parse(input);
      await db.$transaction(async (tx) => {
        const current = await tx.appointment.findUniqueOrThrow({
          where: { id },
          select: { doctorId: true },
        });
        await doctorLock(tx, current.doctorId);
        const a = await tx.appointment.findUniqueOrThrow({ where: { id } });
        if (user.role === "RECEPTION" && data.status !== a.status) {
          const transitions: Record<string, string[]> = { PENDING: ["CONFIRMED", "CANCELLED", "NO_SHOW"], CONFIRMED: ["CANCELLED", "NO_SHOW"], ARRIVED: [], COMPLETED: [], CANCELLED: [], NO_SHOW: [] };
          if (!transitions[a.status].includes(data.status)) throw new ApiError(409, "Захиалгын төлөв шилжих боломжгүй. Ирэлтийг check-in хэсгээр бүртгэнэ үү.");
        }
        if (user.role === "DOCTOR" && a.doctorId !== user.doctor?.id)
          throw new ApiError(403, "Өөр эмчийн захиалгыг өөрчлөх эрхгүй.");
        if (
          ["CANCELLED", "NO_SHOW"].includes(a.status) &&
          !["CANCELLED", "NO_SHOW"].includes(data.status)
        ) {
          if (
            !(
              await availability(a.doctorId, a.serviceId, a.date, tx, id)
            ).includes(a.startTime)
          )
            throw new ApiError(409, "Цаг давхцсан эсвэл өнгөрсөн байна.");
        }
        await tx.appointment.update({ where: { id }, data });
      });
    } else if (resource === "payments") {
      permit(user, ["ADMIN"]);
      const { reason } = z
        .object({ reason: z.string().trim().min(3).max(500) })
        .parse(input);
      await db.payment.update({
        where: { id },
        data: { voidedAt: new Date(), voidReason: reason },
      });
    } else if (resource === "settings") {
      permit(user, ["ADMIN"]);
      if (id === "clinic") {
        const data = clinicBatchSchema.parse(input);
        const writes = Object.entries(data)
          .filter(
            (entry): entry is [string, string] => typeof entry[1] === "string",
          )
          .map(([key, value]) => ({ key, value: settingValue(key, value) }));
        await db.$transaction(
          writes.map((item) =>
            db.setting.upsert({
              where: { key: item.key },
              create: item,
              update: { value: item.value },
            }),
          ),
        );
      } else {
        if (!(editableSettingKeys as readonly string[]).includes(id))
          throw new ApiError(400, "Тохиргооны түлхүүр буруу.");
        const data = z.object({ value: z.string().max(5000) }).parse(input);
        if (id === "logoUrl" && data.value && !isCloudinaryImage(data.value))
          throw new ApiError(400, "Логог Cloudinary upload-аар оруулна уу.");
        const value = settingValue(id, data.value);
        await db.setting.upsert({
          where: { key: id },
          create: { key: id, value },
          update: { value },
        });
      }
    } else if (resource === "treatments") {
      permit(user, ["ADMIN"]);
      await db.treatment.update({
        where: { id },
        data: v.treatmentSchema.parse(input),
      });
    } else if (resource === "expenses") {
      permit(user, ["ADMIN"]);
      await db.expense.update({
        where: { id },
        data: v.expenseSchema.parse(input),
      });
    } else throw new ApiError(404, "Модуль олдсонгүй.");
    await audit(user, user.role === "RECEPTION" && resource === "appointments" ? `APPOINTMENT_${String(input.status)}` : "UPDATE", resource, id);
    return json({ ok: true });
  });
}
export async function DELETE(req: Request, ctx: Ctx) {
  return safe(async () => {
    sameOrigin(req);
    const user = await requireUser();
    if (user.role === "RECEPTION") throw new ApiError(403, "Ресепшн бүртгэлийг устгах эрхгүй.");
    const [resource, id] = (await ctx.params).path;
    if (resource === "nurse-shifts") {
      permit(user, ["ADMIN"]);
      await db.nurseShift.delete({ where: { id } });
      await audit(user, "DELETE", "nurse-shifts", id);
      return json({ ok: true });
    }
    if (!id) throw new ApiError(400, "ID шаардлагатай.");
    if (resource === "leaves") {
      permit(user, ["ADMIN", "DOCTOR"]);
      const result = await removeLeave(id, user);
      await audit(user, "DELETE_REQUEST", "leaves", id);
      return json(result);
    }
    if (resource === "schedules" || resource === "leaves") {
      permit(user, ["ADMIN", "DOCTOR"]);
      await db.$transaction(async (tx) => {
        const item =
          resource === "schedules"
            ? await tx.schedule.findUniqueOrThrow({ where: { id } })
            : await tx.leave.findUniqueOrThrow({ where: { id } });
        ownDoctor(user, item.doctorId);
        await doctorLock(tx, item.doctorId);
        if (resource === "schedules") {
          permit(user, ["ADMIN"]);
          const weekday = (item as { weekday: number }).weekday;
          const appts = await tx.appointment.findMany({
            where: {
              doctorId: item.doctorId,
              date: { gte: today() },
              status: { notIn: ["CANCELLED", "NO_SHOW", "COMPLETED"] },
            },
          });
          if (
            appts.some(
              (a) => new Date(`${a.date}T12:00Z`).getUTCDay() === weekday,
            )
          )
            throw new ApiError(
              409,
              "Идэвхтэй захиалгатай хуваарийг устгах боломжгүй.",
            );
          await tx.schedule.delete({ where: { id } });
        }
      });
    } else {
      permit(user, ["ADMIN"]);
      if (resource === "services")
        await db.service.update({ where: { id }, data: { active: false } });
      else if (resource === "doctors")
        await db.doctor.update({ where: { id }, data: { active: false } });
      else if (resource === "patients")
        await db.patient.update({ where: { id }, data: { active: false } });
      else if (resource === "inventory")
        await db.inventoryItem.update({
          where: { id },
          data: { active: false },
        });
      else if (resource === "documents")
        await db.document.delete({ where: { id } });
      else if (resource === "expenses")
        await db.expense.delete({ where: { id } });
      else if (resource === "treatments")
        await db.treatment.delete({ where: { id } });
      else
        throw new ApiError(
          400,
          "Энэ бүртгэлийг устгахгүй. Төлөвөөр удирдана уу.",
        );
    }
    await audit(user, "DELETE", resource, id);
    return json({ ok: true });
  });
}
