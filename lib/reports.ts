import { z } from "zod";
import { db } from "./db";
import { periodRange } from "./domain";
export async function reportData(params: URLSearchParams) {
  const serviceId = params.get("serviceId")
    ? z.string().uuid().parse(params.get("serviceId"))
    : undefined;
  const date = periodRange(
    params.get("period"),
    params.get("year"),
    params.get("month"),
  );
  const [payments, expenses, appointments, treatments, services] =
    await Promise.all([
      db.payment.findMany({
        where: {
          date,
          voidedAt: null,
          ...(serviceId ? { appointment: { serviceId } } : {}),
        },
        include: {
          patient: { select: { name: true, phone: true } },
          appointment: {
            include: {
              doctor: { select: { name: true } },
              service: { select: { name: true } },
            },
          },
        },
        orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      }),
      serviceId
        ? Promise.resolve([])
        : db.expense.findMany({ where: { date }, orderBy: { date: "asc" } }),
      db.appointment.findMany({
        where: { date, ...(serviceId ? { serviceId } : {}) },
        include: {
          doctor: { select: { id: true, name: true } },
          service: { select: { id: true, name: true } },
        },
        orderBy: [{ date: "asc" }, { startTime: "asc" }],
      }),
      db.treatment.findMany({
        where: { date, ...(serviceId ? { serviceId } : {}) },
        include: {
          service: { select: { name: true } },
          doctor: { select: { name: true } },
        },
      }),
      db.service.findMany({
        where: serviceId ? { id: serviceId } : {},
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
    ]);
  const revenue = payments.reduce((s, p) => s + p.amount, 0),
    expense = expenses.reduce((s, p) => s + p.amount, 0),
    charges = treatments.reduce((s, t) => s + t.amount, 0);
  const monthly: Record<
    string,
    { label: string; income: number; expense: number }
  > = {};
  for (const p of payments) {
    const key = p.date.slice(0, 7);
    monthly[key] ??= { label: key, income: 0, expense: 0 };
    monthly[key].income += p.amount;
  }
  for (const p of expenses) {
    const key = p.date.slice(0, 7);
    monthly[key] ??= { label: key, income: 0, expense: 0 };
    monthly[key].expense += p.amount;
  }
  const statuses = Object.fromEntries(
    [
      "PENDING",
      "CONFIRMED",
      "ARRIVED",
      "COMPLETED",
      "CANCELLED",
      "NO_SHOW",
    ].map((status) => [
      status,
      appointments.filter((a) => a.status === status).length,
    ]),
  );
  const methods = Object.fromEntries(
    ["CASH", "CARD", "TRANSFER", "QPAY"].map((method) => [
      method,
      payments
        .filter((p) => p.method === method)
        .reduce((s, p) => s + p.amount, 0),
    ]),
  );
  const byDoctor = Object.values(
    appointments.reduce(
      (acc, a) => {
        acc[a.doctor.id] ??= { name: a.doctor.name, count: 0 };
        acc[a.doctor.id].count++;
        return acc;
      },
      {} as Record<string, { name: string; count: number }>,
    ),
  );
  const byService = services.map((service) => ({
    ...service,
    count: appointments.filter((a) => a.serviceId === service.id).length,
    completed: appointments.filter(
      (a) => a.serviceId === service.id && a.status === "COMPLETED",
    ).length,
    treatments: treatments.filter((t) => t.serviceId === service.id).length,
    charges: treatments
      .filter((t) => t.serviceId === service.id)
      .reduce((sum, t) => sum + t.amount, 0),
    revenue: payments
      .filter((p) => p.appointment?.serviceId === service.id)
      .reduce((sum, p) => sum + p.amount, 0),
  }));
  return {
    byService,
    serviceName: serviceId ? services[0]?.name : undefined,
    revenue,
    expense,
    net: revenue - expense,
    charges,
    balance: charges - revenue,
    appointmentCount: appointments.length,
    patientCount: new Set(appointments.map((a) => a.patientId)).size,
    statuses,
    methods,
    byDoctor,
    monthly: Object.values(monthly).sort((a, b) =>
      a.label.localeCompare(b.label),
    ),
    payments,
    expenses,
  };
}
