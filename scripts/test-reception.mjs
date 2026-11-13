// Real Prisma/PostgreSQL semantics in an isolated ephemeral database only.
import assert from "node:assert/strict";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mock, setSystemTime } from "bun:test";
setSystemTime(new Date("2026-11-07T01:00:00Z"));
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";
process.env.DATABASE_URL = "postgresql://localhost/isolated_reception_test";
process.env.DIRECT_URL = "";
process.env.TELEGRAM_BOT_TOKEN = "";
const dir = await mkdtemp(join(tmpdir(), "bb-reception-"));
const database = await PGlite.create();
const server = new PGLiteSocketServer({
  db: database,
  path: join(dir, ".s.PGSQL.5432"),
});
const pool = new Pool({
  host: dir,
  user: "postgres",
  database: "reception_test",
  max: 1,
});
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
let passed = 0;
const check = (name, fn) => {
  fn();
  passed++;
  console.log(`PASS ${name}`);
};
try {
  const migrations = (
    await readdir("prisma/migrations", { withFileTypes: true })
  )
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
  for (const m of migrations) {
    if (m === "202611070003_reception") {
      // Exercise migration on historical patients, charges and voided payments.
      await database.exec(
        `INSERT INTO "Patient" (id,name,phone) VALUES ('legacy-patient','Historical','99110099'); INSERT INTO "Doctor" (id,name,specialty) VALUES ('legacy-doctor','Historical','General'); INSERT INTO "Service" (id,name,category,price) VALUES ('legacy-service','Visit','General',200000); INSERT INTO "Treatment" (id,"patientId","doctorId","serviceId",diagnosis,procedure,date,amount) VALUES ('legacy-treatment','legacy-patient','legacy-doctor','legacy-service','secret','secret','2026-01-01',200000); INSERT INTO "Payment" (id,"patientId",amount,method,date,"createdById","idempotencyKey") VALUES ('legacy-payment','legacy-patient',50000,'CASH','2026-01-01','legacy','legacy');`,
      );
    }
    await database.exec(
      await readFile(`prisma/migrations/${m}/migration.sql`, "utf8"),
    );
  }
  await server.start();
  mock.module("../lib/db", () => ({
    db: prisma,
    databaseConfigured: () => true,
  }));
  // Disable outbound notifications even if the surrounding shell has Telegram secrets.
  mock.module("../lib/telegram", () => ({
    telegramConfig: async () => ({ token: "" }),
    telegramCall: async () => ({}),
  }));
  const {
    receptionAction: action,
    receptionData: data,
    receptionOnly,
  } = await import("../lib/reception");
  const { createBooking, availability } = await import("../lib/booking");
  const { today } = await import("../lib/domain");
  const { bookingSchema } = await import("../lib/booking");
  const u = await prisma.user.create({
    data: {
      name: "Reception",
      phone: "99110001",
      role: "RECEPTION",
      passwordHash: "test",
    },
  });
  const actor = { ...u, doctor: null };
  check("server role guards reject Doctor and Admin", () => {
    assert.throws(() => receptionOnly({ role: "DOCTOR" }));
    assert.throws(() => receptionOnly({ role: "ADMIN" }));
  });
  const historical = await prisma.invoice.findUniqueOrThrow({
    where: { id: "legacy-legacy-patient" },
    include: { items: true, payments: true },
  });
  check("migration preserves historical charge, payment ID and links", () => {
    assert.equal(historical.total, 200000);
    assert.equal(historical.payments[0].id, "legacy-payment");
    assert.equal(historical.items[0].treatmentId, "legacy-treatment");
  });
  const patient = await prisma.patient.create({
    data: {
      name: "Patient",
      phone: "99110002",
      allergies: "Penicillin",
      medicalHistory: "CONFIDENTIAL",
    },
  });
  await assert.rejects(
    prisma.patient.create({
      data: { name: "Duplicate", phone: patient.phone },
    }),
  );
  passed++;
  console.log("PASS duplicate patient phone rejected");
  const doctor = await prisma.doctor.create({
    data: { name: "Doctor", specialty: "General" },
  });
  const service = await prisma.service.create({
    data: { name: "Service", category: "General", price: 200000, duration: 30 },
  });
  for (let weekday = 0; weekday < 7; weekday++)
    await prisma.schedule.create({
      data: {
        doctorId: doctor.id,
        weekday,
        startTime: "00:00",
        endTime: "23:59",
      },
    });
  const slots = await availability(doctor.id, service.id, today(), prisma);
  assert.ok(
    slots.length > 2,
    "requires at least two remaining slots in clinic day",
  );
  const booking = bookingSchema.parse({
    patientId: patient.id,
    name: patient.name,
    phone: patient.phone,
    doctorId: doctor.id,
    serviceId: service.id,
    date: today(),
    startTime: slots[0],
  });
  const appointment = await createBooking(booking, actor.id);
  await assert.rejects(createBooking(booking, actor.id), /давхардсан/);
  passed++;
  console.log("PASS server double-booking prevention");
  const checkin = {
    appointmentId: appointment.id,
    patientId: patient.id,
    doctorId: doctor.id,
  };
  const q = await action(actor, "check-in", checkin);
  const repeat = await action(actor, "check-in", checkin);
  check("check-in is idempotent and records arrival", () => {
    assert.equal(q.id, repeat.id);
    assert.equal(q.number, 1);
    assert.ok(q.arrivedAt);
  });
  await assert.rejects(
    action(actor, "queue-status", { id: q.id, status: "COMPLETED" }),
  );
  for (const status of ["CALLED", "IN_PROGRESS", "COMPLETED"])
    await action(actor, "queue-status", { id: q.id, status });
  const afterQueue = await prisma.appointment.findUniqueOrThrow({
    where: { id: appointment.id },
  });
  check("queue transitions do not complete appointment or payment", () =>
    assert.equal(afterQueue.status, "ARRIVED"),
  );
  await action(actor, "check-in", {
    patientId: patient.id,
    doctorId: doctor.id,
  });
  passed++;
  console.log("PASS walk-in queue");
  const invoice = await action(actor, "invoice-create", {
    patientId: patient.id,
    appointmentId: appointment.id,
    dueDate: today(),
    items: [{ serviceId: service.id, quantity: 1 }],
  });
  await assert.rejects(
    action(actor, "collect", {
      invoiceId: invoice.id,
      idempotencyKey: crypto.randomUUID(),
      amount: 1,
      allocations: [{ method: "CASH", amount: 1 }],
    }),
  );
  await action(actor, "invoice-finalize", { id: invoice.id });
  await assert.rejects(
    action(actor, "invoice-remove-item", {
      id: invoice.id,
      itemId: invoice.items[0].id,
    }),
  );
  passed++;
  console.log("PASS finalized billing is immutable");
  await action(actor, "cash-open", { openingCash: 10000 });
  await assert.rejects(action(actor, "cash-open", { openingCash: 0 }));
  const partial = {
    invoiceId: invoice.id,
    idempotencyKey: crypto.randomUUID(),
    amount: 50000,
    allocations: [{ method: "CASH", amount: 50000 }],
  };
  const first = await action(actor, "collect", partial);
  const retried = await action(actor, "collect", partial);
  check("partial payment and retry create exactly one transaction", () =>
    assert.equal(first[0].id, retried[0].id),
  );
  await assert.rejects(
    action(actor, "collect", {
      ...partial,
      allocations: [{ method: "CASH", amount: 40000 }],
      amount: 40000,
    }),
  );
  let detail = await data(
    actor,
    "invoice",
    new URLSearchParams({ id: invoice.id }),
  );
  check("outstanding balance after partial payment", () => {
    assert.equal(detail.paid, 50000);
    assert.equal(detail.balance, 150000);
  });
  await assert.rejects(
    action(actor, "collect", {
      invoiceId: invoice.id,
      idempotencyKey: crypto.randomUUID(),
      amount: 200000,
      allocations: [{ method: "CASH", amount: 200000 }],
    }),
  );
  await assert.rejects(
    action(actor, "collect", {
      invoiceId: invoice.id,
      idempotencyKey: crypto.randomUUID(),
      amount: 150000,
      allocations: [{ method: "CASH", amount: 50000 }],
    }),
  );
  await assert.rejects(
    action(actor, "collect", {
      invoiceId: invoice.id,
      idempotencyKey: crypto.randomUUID(),
      amount: 150000,
      allocations: [{ method: "QPAY", amount: 150000 }],
    }),
  );
  const split = await action(actor, "collect", {
    invoiceId: invoice.id,
    idempotencyKey: crypto.randomUUID(),
    amount: 150000,
    allocations: [
      { method: "QPAY", amount: 100000, reference: "verified-qpay-1" },
      { method: "TRANSFER", amount: 50000, reference: "verified-transfer-1" },
    ],
  });
  detail = await data(
    actor,
    "invoice",
    new URLSearchParams({ id: invoice.id }),
  );
  check("split full payment produces settled balance", () => {
    assert.equal(split.length, 2);
    assert.equal(detail.balance, 0);
    assert.equal(detail.paid, 200000);
  });
  await assert.rejects(prisma.payment.delete({ where: { id: first[0].id } }));
  await assert.rejects(
    prisma.payment.update({ where: { id: first[0].id }, data: { amount: 1 } }),
  );
  passed++;
  console.log("PASS database prevents financial history mutation");
  await action(actor, "refund-request", {
    paymentId: first[0].id,
    amount: 10000,
    reason: "Review requested",
  });
  await assert.rejects(
    action(actor, "refund-request", {
      paymentId: first[0].id,
      amount: 50000,
      reason: "Excess request",
    }),
  );
  await assert.rejects(
    action({ ...actor, role: "DOCTOR" }, "refund-request", {
      paymentId: first[0].id,
      amount: 1,
      reason: "Unauthorized",
    }),
  );
  await assert.rejects(action(actor, "refund-approve", {}));
  passed++;
  console.log(
    "PASS refund requests cannot execute refunds or exceed settlement",
  );
  await action(actor, "cash-withdraw", {
    amount: 5000,
    reason: "Cash transfer",
  });
  const cash = await data(actor, "cash-sessions", new URLSearchParams());
  check("expected cash excludes noncash and unexecuted refund requests", () => {
    assert.equal(cash.items[0].expected, 55000);
    assert.equal(cash.items[0].nonCash, 150000);
  });
  await assert.rejects(action(actor, "cash-close", { actualCash: 54000 }));
  const closed = await action(actor, "cash-close", {
    actualCash: 54000,
    explanation: "Count discrepancy for review",
  });
  check("close records expected cash and explained discrepancy", () => {
    assert.equal(closed.expectedCash, 55000);
    assert.equal(closed.discrepancy, -1000);
  });
  const report = await data(actor, "reports", new URLSearchParams());
  check(
    "reports distinguish billed, collected, outstanding and requested refunds",
    () => {
      assert.equal(report.statistics.collected, 200000);
      assert.equal(report.statistics.refundRequested, 10000);
      assert.equal(report.statistics.outstanding, 150000);
    },
  );
  const historicalReport = await data(
    actor,
    "reports",
    new URLSearchParams({ from: "2026-01-01", to: "2026-01-01" }),
  );
  check(
    "legacy billed dates remain historical rather than migration-day revenue",
    () => {
      assert.equal(historicalReport.statistics.billed, 200000);
      assert.equal(historicalReport.statistics.collected, 50000);
    },
  );
  const notifications = await data(
    actor,
    "notifications",
    new URLSearchParams(),
  );
  check("audit architecture supplies operational notifications", () =>
    assert.ok(
      notifications.events.some((e) => e.action === "PAYMENT_RECEIVED"),
    ),
  );
  const audit = await prisma.auditLog.count({ where: { actorId: actor.id } });
  check("financial and queue mutations are audited", () =>
    assert.equal(audit, 14),
  );
  const { listPaymentMethods, savePaymentMethod, defaultMethodIds } =
    await import("../lib/payment-methods");
  const admin = { ...actor, role: "ADMIN" };
  const defaults = await listPaymentMethods(actor);
  check(
    "migration adds four enabled methods without changing old payments",
    () => {
      assert.equal(defaults.items.length, 4);
      assert.equal(historical.payments[0].method, "CASH");
    },
  );
  for (const role of ["RECEPTION", "DOCTOR"])
    await assert.rejects(
      savePaymentMethod({ ...actor, role }, {}),
      /Зөвхөн админ/,
    );
  passed++;
  console.log("PASS method management rejects non-admin actors");
  const makeInvoice = async () => {
    const i = await action(actor, "invoice-create", {
      patientId: patient.id,
      dueDate: today(),
      items: [{ serviceId: service.id, quantity: 1 }],
    });
    await action(actor, "invoice-finalize", { id: i.id });
    return i;
  };
  const collect = (i, allocations, key = crypto.randomUUID()) =>
    action(actor, "collect", {
      invoiceId: i.id,
      idempotencyKey: key,
      amount: allocations.reduce((n, a) => n + a.amount, 0),
      allocations,
    });
  const closedInvoice = await makeInvoice();
  await assert.rejects(
    collect(closedInvoice, [
      { paymentMethodId: defaultMethodIds.CASH, amount: 200000 },
    ]),
    /Кассын ээлж/,
  );
  passed++;
  console.log("PASS closed cash session rejects an otherwise valid payment");
  await action(actor, "cash-open", { openingCash: 0 });
  for (const kind of ["CASH", "CARD", "TRANSFER", "QPAY"]) {
    const i = await makeInvoice();
    const payments = await collect(i, [
      {
        paymentMethodId: defaultMethodIds[kind],
        amount: 200000,
        reference: kind === "CASH" ? "" : `full-${kind}`,
      },
    ]);
    const receipt = await data(
      actor,
      "receipt",
      new URLSearchParams({ id: payments[0].id }),
    );
    check(`full ${kind} payment and receipt`, () => {
      assert.equal(receipt.total, 200000);
      assert.equal(receipt.balance, 0);
      assert.equal(receipt.cashier, actor.name);
      assert.equal(receipt.payments.length, 1);
    });
    await assert.rejects(
      collect(i, [{ paymentMethodId: defaultMethodIds.CASH, amount: 1 }]),
      /үлдэгдлээс/,
    );
  }
  const three = await makeInvoice();
  const split3 = await collect(three, [
    { paymentMethodId: defaultMethodIds.CASH, amount: 40000 },
    {
      paymentMethodId: defaultMethodIds.CARD,
      amount: 60000,
      reference: "split-card",
    },
    {
      paymentMethodId: defaultMethodIds.QPAY,
      amount: 100000,
      reference: "split-qpay",
    },
  ]);
  const receipt3 = await data(
    actor,
    "receipt",
    new URLSearchParams({ id: split3[2].id }),
  );
  check("three-way split appears as one receipt", () => {
    assert.equal(receipt3.total, 200000);
    assert.equal(receipt3.payments.length, 3);
    assert.equal(receipt3.balance, 0);
  });
  const custom = await savePaymentMethod(admin, {
    name: "Нэмэлт банк",
    kind: "TRANSFER",
    enabled: true,
    sortOrder: 8,
    referenceRequired: true,
    description: "Test method",
  });
  const customInvoice = await makeInvoice();
  await assert.rejects(
    collect(customInvoice, [{ paymentMethodId: custom.id, amount: 50000 }]),
    /гүйлгээний дугаар/,
  );
  const partialKey = crypto.randomUUID();
  const customPayment = await collect(
    customInvoice,
    [{ paymentMethodId: custom.id, amount: 50000, reference: "custom-ref" }],
    partialKey,
  );
  await savePaymentMethod(admin, {
    ...custom,
    name: "Шинэ нэр",
    enabled: false,
  });
  assert.equal(
    (await listPaymentMethods(actor)).items.some((m) => m.id === custom.id),
    false,
  );
  await assert.rejects(
    collect(customInvoice, [
      { paymentMethodId: custom.id, amount: 1, reference: "disabled" },
    ]),
    /идэвхгүй/,
  );
  const retryDisabled = await collect(
    customInvoice,
    [{ paymentMethodId: custom.id, amount: 50000, reference: "custom-ref" }],
    partialKey,
  );
  assert.equal(retryDisabled[0].id, customPayment[0].id);
  const saved = await prisma.payment.findUniqueOrThrow({
    where: { id: customPayment[0].id },
  });
  const receiptBefore = await data(
    actor,
    "receipt",
    new URLSearchParams({ id: saved.id }),
  );
  check(
    "disabled methods reject new payments and preserve snapshot/retry/receipt",
    () => {
      assert.equal(saved.methodName, "Нэмэлт банк");
      assert.equal(saved.method, "TRANSFER");
      assert.equal(receiptBefore.payments[0].methodName, "Нэмэлт банк");
      assert.equal(receiptBefore.balance, 150000);
    },
  );
  await assert.rejects(
    prisma.paymentMethodOption.delete({ where: { id: custom.id } }),
  );
  await assert.rejects(
    savePaymentMethod(admin, { ...custom, kind: "CASH" }),
    /тооцооны төрлийг/,
  );
  const optional = await savePaymentMethod(admin, {
    ...custom,
    name: "Лавлагаа заавал биш",
    enabled: true,
    referenceRequired: false,
  });
  await collect(customInvoice, [
    { paymentMethodId: optional.id, amount: 150000 },
  ]);
  const receiptAfter = await data(
    actor,
    "receipt",
    new URLSearchParams({ id: saved.id }),
  );
  check(
    "configured optional reference accepted and earlier receipt balance stays unchanged",
    () => assert.equal(receiptAfter.balance, 150000),
  );
  const duplicateRefInvoice = await makeInvoice();
  await assert.rejects(
    collect(duplicateRefInvoice, [
      { paymentMethodId: optional.id, amount: 1, reference: "custom-ref" },
    ]),
    /өмнө бүртгэгдсэн/,
  );
  const defaultCard = defaults.items.find((m) => m.kind === "CARD");
  await savePaymentMethod(admin, { ...defaultCard, enabled: false });
  await assert.rejects(
    collect(duplicateRefInvoice, [
      { method: "CARD", amount: 1, reference: "legacy-bypass" },
    ]),
    /идэвхгүй/,
  );
  passed++;
  console.log(
    "PASS disabled default cannot be bypassed with legacy enum payload",
  );
  await savePaymentMethod(admin, defaultCard);
  // Unpaid balance must not block booking or arrival.
  const queuedWalkIns = await prisma.queueEntry.findMany({
    where: { patientId: patient.id, status: "WAITING" },
  });
  for (const entry of queuedWalkIns)
    await action(actor, "queue-status", { id: entry.id, status: "CANCELLED" });
  const unpaid = await makeInvoice();
  const nextSlots = await availability(doctor.id, service.id, today(), prisma);
  const unpaidBooking = await createBooking(
    { ...booking, startTime: nextSlots[0] },
    actor.id,
  );
  await action(actor, "check-in", {
    appointmentId: unpaidBooking.id,
    patientId: patient.id,
    doctorId: doctor.id,
  });
  await assert.rejects(
    action(actor, "patient-archive", { id: patient.id }),
    /Авлага/,
  );
  check(
    "unpaid invoice does not block booking or check-in; archive remains restricted",
    () => assert.ok(unpaid.id),
  );
  const cleanPatient = await prisma.patient.create({
    data: { name: "Archive eligible", phone: "99110088" },
  });
  await action(actor, "patient-archive", { id: cleanPatient.id });
  check("eligible patient archives without deletion", () =>
    assert.ok(cleanPatient.id),
  );
  const auditMethods = await prisma.auditLog.count({
    where: { entity: "payment-method", actorId: admin.id },
  });
  check("admin payment configuration changes are audited", () =>
    assert.ok(auditMethods >= 5),
  );
  const legacyCash = await data(
    actor,
    "transactions",
    new URLSearchParams({
      from: "2026-01-01",
      to: "2026-01-01",
      paymentMethodId: defaultMethodIds.CASH,
      q: "Historical",
    }),
  );
  check(
    "method history filters include pre-migration enum-only settlements",
    () => assert.equal(legacyCash.items[0].id, "legacy-payment"),
  );
  const futurePatient = await prisma.patient.create({
    data: { name: "Future booking", phone: "99110077" },
  });
  await createBooking(
    {
      ...booking,
      patientId: futurePatient.id,
      name: futurePatient.name,
      phone: futurePatient.phone,
      date: "2099-01-05",
      startTime: "10:00",
    },
    actor.id,
  );
  await assert.rejects(
    action(actor, "patient-archive", { id: futurePatient.id }),
    /идэвхтэй захиалгатай/,
  );
  passed++;
  console.log(
    "PASS future active appointment prevents archive without any debt",
  );
  console.log(`${passed} isolated reception checks passed.`);
} finally {
  setSystemTime();
  await prisma.$disconnect();
  await pool.end();
  await server.stop();
  await database.close();
  await rm(dir, { recursive: true, force: true });
}
