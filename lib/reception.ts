import { z } from "zod";
import { randomUUID } from "node:crypto";
import { db } from "./db";
import type { Prisma } from "@/app/generated/prisma/client";
import type { Actor } from "./auth";
import { ApiError } from "./http";
import { dateSchema, moneySchema, today } from "./domain";
import { doctorLock, notifyDoctor } from "./booking";
import {
  collectionSchema,
  expectedCash,
  invoiceBalance,
  invoiceSchema,
  queueTransitions,
} from "./reception-domain";
type Tx = Prisma.TransactionClient;
export function receptionOnly(actor: Pick<Actor, "role">) {
  if (actor.role !== "RECEPTION")
    throw new ApiError(403, "Зөвхөн ресепшн хандах эрхтэй.");
}
const invoiceInclude = {
  patient: { select: { id: true, name: true, phone: true } },
  items: true,
  payments: true,
  appointment: {
    include: {
      doctor: { select: { id: true, name: true } },
      service: { select: { name: true } },
    },
  },
} as const;
async function lock(tx: Tx, key: string) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))::text AS locked`;
}
async function log(
  tx: Tx,
  actor: Actor,
  action: string,
  entity: string,
  entityId: string,
) {
  await tx.auditLog.create({
    data: { actorId: actor.id, action, entity, entityId },
  });
}
async function openSession(tx: Tx, actor: Actor) {
  const session = await tx.cashSession.findFirst({
    where: { receptionistId: actor.id, closedAt: null },
  });
  if (!session) throw new ApiError(409, "Кассын ээлж нээнэ үү.");
  return session;
}
export async function receptionAction(
  actor: Actor,
  action: string,
  input: unknown,
) {
  receptionOnly(actor);
  if (action === "check-in") {
    const d = z
      .object({
        appointmentId: z.string().uuid().optional(),
        patientId: z.string().uuid(),
        doctorId: z.string().uuid(),
      })
      .parse(input);
    const entry = await db.$transaction(async (tx) => {
      await doctorLock(tx, d.doctorId);
      await lock(tx, `queue:${today()}`);
      const patient = await tx.patient.findUnique({
        where: { id: d.patientId },
      });
      const doctor = await tx.doctor.findUnique({ where: { id: d.doctorId } });
      if (!patient?.active || !doctor?.active)
        throw new ApiError(400, "Идэвхтэй өвчтөн, эмч сонгоно уу.");
      if (d.appointmentId) {
        const a = await tx.appointment.findUnique({
          where: { id: d.appointmentId },
        });
        if (
          !a ||
          a.date !== today() ||
          a.patientId !== d.patientId ||
          a.doctorId !== d.doctorId ||
          !["PENDING", "CONFIRMED", "ARRIVED"].includes(a.status)
        )
          throw new ApiError(409, "Өнөөдрийн хүчинтэй захиалгыг сонгоно уу.");
        const existing = await tx.queueEntry.findUnique({
          where: { appointmentId: a.id },
        });
        if (existing) return existing;
      }
      if (
        await tx.queueEntry.findFirst({
          where: {
            patientId: d.patientId,
            doctorId: d.doctorId,
            date: today(),
            status: { in: ["WAITING", "CALLED", "IN_PROGRESS"] },
          },
        })
      )
        throw new ApiError(409, "Өвчтөн дараалалд байна.");
      const last = await tx.queueEntry.aggregate({
        where: { date: today() },
        _max: { number: true },
      });
      const result = await tx.queueEntry.create({
        data: {
          ...d,
          date: today(),
          number: (last._max.number || 0) + 1,
          createdById: actor.id,
        },
      });
      // Arrival is recorded independently of treatment and payment states.
      if (d.appointmentId)
        await tx.appointment.update({
          where: { id: d.appointmentId },
          data: { status: "ARRIVED" },
        });
      await log(tx, actor, "CHECK_IN", "queue", result.id);
      return result;
    });
    const doctor = await db.doctor.findUnique({
      where: { id: entry.doctorId },
    });
    if (doctor)
      await notifyDoctor(
        doctor.telegramChatId,
        `Өвчтөн ирлээ · Дараалал #${entry.number}`,
      );
    return entry;
  }
  return db.$transaction(async (tx) => {
    if (action === "queue-status") {
      const d = z
        .object({
          id: z.string().uuid(),
          status: z.enum([
            "WAITING",
            "CALLED",
            "IN_PROGRESS",
            "COMPLETED",
            "CANCELLED",
          ]),
        })
        .parse(input);
      await lock(tx, `queue-entry:${d.id}`);
      const entry = await tx.queueEntry.findUniqueOrThrow({
        where: { id: d.id },
      });
      if (!queueTransitions[entry.status]?.includes(d.status))
        throw new ApiError(409, "Дарааллын төлөв шилжих боломжгүй.");
      if (entry.date !== today())
        throw new ApiError(409, "Зөвхөн өнөөдрийн дарааллыг өөрчилнө.");
      const result = await tx.queueEntry.update({
        where: { id: d.id },
        data: {
          status: d.status,
          ...(d.status === "CALLED" ? { calledAt: new Date() } : {}),
          ...(d.status === "IN_PROGRESS" ? { startedAt: new Date() } : {}),
          ...(d.status === "COMPLETED" ? { completedAt: new Date() } : {}),
        },
      });
      await log(tx, actor, `QUEUE_${d.status}`, "queue", d.id);
      return result;
    }
    if (action === "invoice-create") {
      const d = invoiceSchema.parse(input);
      const patient = await tx.patient.findUnique({
        where: { id: d.patientId },
      });
      if (!patient?.active) throw new ApiError(404, "Өвчтөн олдсонгүй.");
      if (d.appointmentId) {
        const a = await tx.appointment.findUnique({
          where: { id: d.appointmentId },
        });
        if (!a || a.patientId !== d.patientId)
          throw new ApiError(400, "Захиалгын өвчтөн зөрж байна.");
      }
      const items = [];
      for (const item of d.items) {
        const service = await tx.service.findUniqueOrThrow({
          where: { id: item.serviceId },
        });
        let price = service.price;
        if (item.treatmentId) {
          const t = await tx.treatment.findUniqueOrThrow({
            where: { id: item.treatmentId },
          });
          if (
            t.patientId !== d.patientId ||
            t.serviceId !== item.serviceId ||
            item.quantity !== 1
          )
            throw new ApiError(400, "Эмчилгээний мэдээлэл зөрж байна.");
          price = t.amount;
        } else if (!service.active)
          throw new ApiError(400, "Идэвхтэй үйлчилгээ сонгоно уу.");
        items.push({ ...item, description: service.name, unitPrice: price });
      }
      const result = await tx.invoice.create({
        data: {
          patientId: d.patientId,
          appointmentId: d.appointmentId,
          dueDate: d.dueDate,
          number: `BB-${today()}-${randomUUID()}`,
          createdById: actor.id,
          items: { create: items },
        },
        include: invoiceInclude,
      });
      await log(tx, actor, "INVOICE_CREATED", "invoice", result.id);
      return result;
    }
    if (action === "invoice-remove-item" || action === "invoice-finalize") {
      const d = z
        .object({
          id: z.string().min(1).max(100),
          itemId: z.string().uuid().optional(),
        })
        .parse(input);
      await lock(tx, `invoice:${d.id}`);
      const invoice = await tx.invoice.findUniqueOrThrow({
        where: { id: d.id },
        include: { items: true },
      });
      if (invoice.status !== "DRAFT")
        throw new ApiError(409, "Баталгаажсан нэхэмжлэхийг өөрчлөхгүй.");
      if (action === "invoice-remove-item") {
        if (!d.itemId) throw new ApiError(400, "Мөр сонгоно уу.");
        await tx.invoiceItem.deleteMany({
          where: { id: d.itemId, invoiceId: d.id },
        });
      } else {
        const total = invoice.items.reduce(
          (s, i) => s + i.quantity * i.unitPrice,
          0,
        );
        if (!invoice.items.length || total > 1_000_000_000)
          throw new ApiError(400, "Нэхэмжлэхийн дүн буруу байна.");
        await tx.invoice.update({
          where: { id: d.id },
          data: { status: "FINALIZED", total, finalizedAt: new Date() },
        });
      }
      await log(tx, actor, action.toUpperCase(), "invoice", d.id);
      return { ok: true };
    }
    if (action === "collect") {
      const d = collectionSchema.parse(input);
      // Lock order is shared by close, withdrawals and collection.
      await lock(tx, `cash:${actor.id}`);
      await lock(tx, `invoice:${d.invoiceId}`);
      const existing = await tx.payment.findMany({
        where: { idempotencyKey: { startsWith: `${d.idempotencyKey}:` } },
        orderBy: { idempotencyKey: "asc" },
      });
      if (existing.length) {
        if (
          existing.length !== d.allocations.length ||
          existing.some(
            (p, i) =>
              p.invoiceId !== d.invoiceId ||
              p.createdById !== actor.id ||
              p.amount !== d.allocations[i].amount ||
              p.method !== d.allocations[i].method ||
              p.reference !== d.allocations[i].reference,
          )
        )
          throw new ApiError(409, "Давтан хүсэлтийн мэдээлэл зөрж байна.");
        return existing;
      }
      const session = await openSession(tx, actor);
      const invoice = await tx.invoice.findUniqueOrThrow({
        where: { id: d.invoiceId },
        include: { payments: true },
      });
      if (
        invoice.status !== "FINALIZED" ||
        d.amount > invoiceBalance(invoice).balance
      )
        throw new ApiError(
          409,
          "Төлбөр нь баталгаажсан нэхэмжлэхийн үлдэгдлээс их байна.",
        );
      const results = [];
      for (const [i, a] of d.allocations.entries()) {
        // External settlements are manually reconciled using a bank/terminal reference.
        // No gateway is called and no gateway success is fabricated.
        if (a.method !== "CASH") {
          await lock(tx, `settlement:${a.method}:${a.reference}`);
          if (
            await tx.payment.findFirst({
              where: {
                method: a.method,
                reference: a.reference,
                voidedAt: null,
              },
            })
          )
            throw new ApiError(
              409,
              "Гүйлгээний дугаар өмнө бүртгэгдсэн байна.",
            );
        }
        const p = await tx.payment.create({
          data: {
            patientId: invoice.patientId,
            appointmentId: invoice.appointmentId,
            invoiceId: invoice.id,
            cashSessionId: session.id,
            ...a,
            date: today(),
            createdById: actor.id,
            idempotencyKey: `${d.idempotencyKey}:${i}`,
            note:
              a.method === "CASH"
                ? "Reception collection"
                : "Manually reconciled external settlement",
          },
        });
        await log(tx, actor, "PAYMENT_RECEIVED", "payment", p.id);
        results.push(p);
      }
      return results;
    }
    if (action === "cash-open") {
      const d = z.object({ openingCash: moneySchema }).parse(input);
      await lock(tx, `cash:${actor.id}`);
      if (
        await tx.cashSession.findFirst({
          where: { receptionistId: actor.id, closedAt: null },
        })
      )
        throw new ApiError(409, "Нээлттэй ээлж байна.");
      const result = await tx.cashSession.create({
        data: { receptionistId: actor.id, openingCash: d.openingCash },
      });
      await log(tx, actor, "CASH_OPENED", "cash-session", result.id);
      return result;
    }
    if (action === "cash-close" || action === "cash-withdraw") {
      await lock(tx, `cash:${actor.id}`);
      const current = await openSession(tx, actor);
      if (action === "cash-withdraw") {
        const d = z
          .object({
            amount: moneySchema.refine((n) => n > 0),
            reason: z.string().trim().min(3).max(500),
          })
          .parse(input);
        const s = await tx.cashSession.findUniqueOrThrow({
          where: { id: current.id },
          include: { payments: true, withdrawals: true },
        });
        if (d.amount > expectedCash(s.openingCash, s.payments, s.withdrawals))
          throw new ApiError(400, "Бэлэн мөнгө хүрэлцэхгүй.");
        const result = await tx.cashWithdrawal.create({
          data: { cashSessionId: current.id, ...d, createdById: actor.id },
        });
        await log(tx, actor, "CASH_WITHDRAWAL", "cash-session", current.id);
        return result;
      }
      const d = z
        .object({
          actualCash: moneySchema,
          explanation: z.string().trim().max(1000).default(""),
        })
        .parse(input);
      const s = await tx.cashSession.findUniqueOrThrow({
        where: { id: current.id },
        include: { payments: true, withdrawals: true },
      });
      const expected = expectedCash(s.openingCash, s.payments, s.withdrawals);
      const discrepancy = d.actualCash - expected;
      if (discrepancy && d.explanation.length < 3)
        throw new ApiError(400, "Мөнгөн зөрүүний тайлбар шаардлагатай.");
      const result = await tx.cashSession.update({
        where: { id: s.id },
        data: {
          ...d,
          expectedCash: expected,
          discrepancy,
          closedAt: new Date(),
        },
      });
      await log(tx, actor, "CASH_CLOSED", "cash-session", s.id);
      return result;
    }
    if (action === "refund-request") {
      const d = z
        .object({
          paymentId: z.string().uuid(),
          amount: moneySchema.refine((n) => n > 0),
          reason: z.string().trim().min(3).max(1000),
        })
        .parse(input);
      await lock(tx, `refund:${d.paymentId}`);
      const payment = await tx.payment.findUniqueOrThrow({
        where: { id: d.paymentId },
        include: { refundRequests: true },
      });
      const requested = payment.refundRequests
        .filter((r) => r.status !== "REJECTED")
        .reduce((s, r) => s + r.amount, 0);
      if (payment.voidedAt || d.amount + requested > payment.amount)
        throw new ApiError(409, "Буцаалтын дүн төлбөрөөс хэтэрсэн байна.");
      const result = await tx.refundRequest.create({
        data: { ...d, requestedById: actor.id },
      });
      await log(tx, actor, "REFUND_REQUESTED", "payment", payment.id);
      return result;
    }
    if (action === "patient-archive") {
      const { id } = z.object({ id: z.string().uuid() }).parse(input);
      await lock(tx, `patient:${id}`);
      const invoices = await tx.invoice.findMany({
        where: { patientId: id, status: "FINALIZED" },
        include: { payments: true },
      });
      if (
        invoices.some((i) => invoiceBalance(i).balance > 0) ||
        (await tx.appointment.count({
          where: {
            patientId: id,
            date: { gte: today() },
            status: { in: ["PENDING", "CONFIRMED", "ARRIVED"] },
          },
        }))
      )
        throw new ApiError(
          409,
          "Авлага эсвэл идэвхтэй захиалгатай өвчтөнийг архивлахгүй.",
        );
      await tx.patient.update({ where: { id }, data: { active: false } });
      await log(tx, actor, "PATIENT_ARCHIVED", "patient", id);
      return { ok: true };
    }
    if (action === "notifications-read") {
      const { through } = z.object({ through: z.iso.datetime() }).parse(input);
      if (new Date(through) > new Date())
        throw new ApiError(400, "Огноо буруу байна.");
      const key = `reception-notifications:${actor.id}`;
      await tx.setting.upsert({
        where: { key },
        create: { key, value: through },
        update: { value: through },
      });
      return { ok: true };
    }
    throw new ApiError(404, "Үйлдэл олдсонгүй.");
  });
}

export async function receptionData(
  actor: Actor,
  resource: string,
  q: URLSearchParams,
) {
  receptionOnly(actor);
  const date = dateSchema.parse(q.get("date") || today());
  const from = dateSchema.parse(q.get("from") || date);
  const to = dateSchema.parse(q.get("to") || from);
  if (from > to || Date.parse(to) - Date.parse(from) > 366 * 86400000)
    throw new ApiError(400, "Огнооны хязгаар буруу байна.");
  const page = z.coerce
    .number()
    .int()
    .min(1)
    .max(10000)
    .parse(q.get("page") || 1);
  const search = (q.get("q") || "").trim().slice(0, 100);
  if (resource === "invoices" || resource === "receivables") {
    const invoices = await db.invoice.findMany({
      where: {
        ...(q.get("patientId")
          ? { patientId: z.string().uuid().parse(q.get("patientId")) }
          : {}),
        ...(resource === "receivables" ? { status: "FINALIZED" } : {}),
        ...(search
          ? {
              OR: [
                { number: { contains: search, mode: "insensitive" } },
                {
                  patient: { name: { contains: search, mode: "insensitive" } },
                },
                { patient: { phone: { contains: search } } },
              ],
            }
          : {}),
        ...(q.get("overdue") === "true" ? { dueDate: { lt: today() } } : {}),
      },
      include: invoiceInclude,
      orderBy: { createdAt: "desc" },
    });
    const all = invoices.map((i) => ({
      ...i,
      ...invoiceBalance(i),
      lastPaymentDate: i.payments
        .filter((p) => !p.voidedAt)
        .map((p) => p.date)
        .sort()
        .at(-1),
    }));
    const items =
      resource === "receivables" ? all.filter((i) => i.balance > 0) : all;
    return {
      items: items.slice((page - 1) * 50, page * 50),
      total: items.length,
      balance: items.reduce((s, i) => s + i.balance, 0),
      patientBalances: Object.fromEntries(
        items.map((i) => [
          i.patientId,
          items
            .filter((o) => o.patientId === i.patientId)
            .reduce((s, o) => s + o.balance, 0),
        ]),
      ),
    };
  }
  if (resource === "invoice") {
    const i = await db.invoice.findUniqueOrThrow({
      where: { id: z.string().min(1).max(100).parse(q.get("id")) },
      include: invoiceInclude,
    });
    return { ...i, ...invoiceBalance(i) };
  }
  if (resource === "unbilled") {
    return {
      items: await db.treatment.findMany({
        where: {
          patientId: z.string().uuid().parse(q.get("patientId")),
          invoiceItem: null,
        },
        select: {
          id: true,
          serviceId: true,
          amount: true,
          date: true,
          service: { select: { name: true } },
          doctor: { select: { name: true } },
        },
      }),
    };
  }
  if (resource === "queue") {
    const entries = await db.queueEntry.findMany({
      where: { date },
      include: {
        patient: { select: { id: true, name: true, phone: true } },
        appointment: { select: { startTime: true } },
      },
      orderBy: { number: "asc" },
    });
    const doctors = await db.doctor.findMany({
      select: { id: true, name: true },
    });
    return {
      items: entries.map((e) => ({
        ...e,
        doctor: doctors.find((d) => d.id === e.doctorId),
      })),
    };
  }
  if (resource === "cash-sessions") {
    const items = await db.cashSession.findMany({
      where: { receptionistId: actor.id },
      include: { payments: true, withdrawals: true },
      orderBy: { openedAt: "desc" },
      take: 50,
    });
    return {
      items: items.map((s) => ({
        ...s,
        expected: expectedCash(s.openingCash, s.payments, s.withdrawals),
        nonCash: s.payments
          .filter((p) => p.method !== "CASH" && !p.voidedAt)
          .reduce((sum, p) => sum + p.amount, 0),
      })),
    };
  }
  if (resource === "transactions") {
    const where: Prisma.PaymentWhereInput = {
      date: { gte: from, lte: to },
      ...(q.get("method")
        ? {
            method: z
              .enum(["CASH", "CARD", "QPAY", "TRANSFER"])
              .parse(q.get("method")),
          }
        : {}),
      ...(q.get("status") === "VOIDED"
        ? { voidedAt: { not: null } }
        : q.get("status") === "RECORDED"
          ? { voidedAt: null }
          : {}),
      ...(search
        ? {
            OR: [
              { id: { contains: search } },
              { patient: { name: { contains: search, mode: "insensitive" } } },
              { patient: { phone: { contains: search } } },
              {
                invoice: { number: { contains: search, mode: "insensitive" } },
              },
            ],
          }
        : {}),
    };
    const items = await db.payment.findMany({
      where,
      include: {
        patient: { select: { name: true, phone: true } },
        invoice: { select: { number: true } },
        refundRequests: true,
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * 50,
      take: 50,
    });
    const users = await db.user.findMany({
      where: { id: { in: items.map((p) => p.createdById) } },
      select: { id: true, name: true },
    });
    return {
      items: items.map((p) => ({
        ...p,
        receptionist:
          users.find((u) => u.id === p.createdById)?.name || p.createdById,
      })),
      total: await db.payment.count({ where }),
    };
  }
  if (resource === "dashboard" || resource === "reports") {
    const appointments = await db.appointment.findMany({
      where: { date: { gte: from, lte: to } },
      include: {
        patient: { select: { id: true, name: true, phone: true } },
        doctor: { select: { id: true, name: true } },
        service: { select: { name: true, duration: true } },
        queueEntry: true,
        invoices: { include: { payments: true } },
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    });
    const payments = await db.payment.findMany({
      where: { date: { gte: from, lte: to } },
    });
    const invoices = await db.invoice.findMany({
      where: { status: "FINALIZED" },
      include: {
        payments: true,
        patient: { select: { name: true, phone: true } },
      },
    });
    const legacyCharges = await db.invoiceItem.aggregate({
      where: {
        invoice: { createdById: "migration" },
        treatment: { date: { gte: from, lte: to } },
      },
      _sum: { unitPrice: true },
    });
    const queue = await db.queueEntry.findMany({
      where: { date: { gte: from, lte: to } },
    });
    const refunds = await db.refundRequest.findMany({
      where: {
        createdAt: {
          gte: new Date(`${from}T00:00:00+08:00`),
          lt: new Date(new Date(`${to}T00:00:00+08:00`).getTime() + 86400000),
        },
      },
    });
    const sessions = await db.cashSession.findMany({
      where: {
        receptionistId: actor.id,
        openedAt: {
          gte: new Date(`${from}T00:00:00+08:00`),
          lt: new Date(new Date(`${to}T00:00:00+08:00`).getTime() + 86400000),
        },
      },
    });
    const activity = await db.auditLog.findMany({
      where: {
        actorId: actor.id,
        createdAt: {
          gte: new Date(`${from}T00:00:00+08:00`),
          lt: new Date(new Date(`${to}T00:00:00+08:00`).getTime() + 86400000),
        },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    const collected = payments.filter((p) => !p.voidedAt);
    return {
      appointments: appointments.map((a) => ({
        ...a,
        paymentStatus: a.invoices.length
          ? a.invoices.every((i) => invoiceBalance(i).balance === 0)
            ? "PAID"
            : "DUE"
          : "UNBILLED",
      })),
      statistics: {
        appointments: appointments.length,
        patients: new Set(appointments.map((a) => a.patientId)).size,
        confirmed: appointments.filter((a) => a.status === "CONFIRMED").length,
        checkedIn: queue.length,
        waiting: queue.filter((e) => ["WAITING", "CALLED"].includes(e.status))
          .length,
        inProgress: queue.filter((e) => e.status === "IN_PROGRESS").length,
        completed:
          appointments.filter((a) => a.status === "COMPLETED").length +
          queue.filter(
            (e) =>
              e.status === "COMPLETED" &&
              !appointments.some(
                (a) => a.id === e.appointmentId && a.status === "COMPLETED",
              ),
          ).length,
        collected: collected.reduce((s, p) => s + p.amount, 0),
        billed:
          (legacyCharges._sum.unitPrice || 0) +
          invoices
            .filter(
              (i) =>
                i.finalizedAt &&
                i.finalizedAt >= new Date(`${from}T00:00:00+08:00`) &&
                i.finalizedAt <
                  new Date(
                    new Date(`${to}T00:00:00+08:00`).getTime() + 86400000,
                  ),
            )
            .reduce((s, i) => s + i.total, 0),
        outstanding: invoices.reduce(
          (s, i) => s + invoiceBalance(i).balance,
          0,
        ),
        voided: payments
          .filter((p) => p.voidedAt)
          .reduce((s, p) => s + p.amount, 0),
        refundRequested: refunds.reduce((s, r) => s + r.amount, 0),
      },
      methods: Object.fromEntries(
        ["CASH", "CARD", "TRANSFER", "QPAY"].map((m) => [
          m,
          collected
            .filter((p) => p.method === m)
            .reduce((s, p) => s + p.amount, 0),
        ]),
      ),
      receivables: invoices
        .map((i) => ({
          id: i.id,
          number: i.number,
          patient: i.patient,
          total: i.total,
          dueDate: i.dueDate,
          ...invoiceBalance(i),
        }))
        .filter((i) => i.balance > 0),
      refunds,
      sessions,
      activity,
    };
  }
  if (resource === "notifications") {
    // Reuse the existing audit architecture plus live operational reminders.
    const events = await db.auditLog.findMany({
      where: {
        OR: [
          {
            entity: {
              in: [
                "appointments",
                "reschedule",
                "payments",
                "leaves",
                "queue",
                "payment",
              ],
            },
          },
          {
            action: {
              in: ["CHECK_IN", "PAYMENT_RECEIVED", "REFUND_REQUESTED"],
            },
          },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    const pending = await db.appointment.findMany({
      where: { status: "PENDING", date: { gte: today() } },
      select: { id: true, date: true, startTime: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    const followUps = await db.appointment.findMany({
      where: {
        repeatOfId: { not: null },
        date: today(),
        status: { in: ["PENDING", "CONFIRMED"] },
      },
      select: { id: true, date: true, startTime: true, createdAt: true },
      take: 50,
    });
    const balances = await db.invoice.findMany({
      where: { status: "FINALIZED", dueDate: { lte: today() } },
      include: { payments: true },
      take: 100,
    });
    const read = await db.setting.findUnique({
      where: { key: `reception-notifications:${actor.id}` },
    });
    return {
      events,
      pending,
      followUps,
      outstanding: balances
        .filter((i) => invoiceBalance(i).balance > 0)
        .map((i) => ({
          id: i.id,
          number: i.number,
          balance: invoiceBalance(i).balance,
          dueDate: i.dueDate,
        })),
      readAt: read?.value || null,
      asOf: new Date().toISOString(),
    };
  }
  throw new ApiError(404, "Хэсэг олдсонгүй.");
}
