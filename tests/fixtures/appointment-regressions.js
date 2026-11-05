// Run in a separate Bun process so Prisma/auth mocks cannot leak into other suites.
import assert from "node:assert/strict";
import { mock } from "bun:test";
let role = "RECEPTION";
let current = { id: "visit", doctorId: "doctor", serviceId: "service", status: "CANCELLED", appointmentDate: new Date("2099-01-02T00:00:00Z"), startTime: "10:00", endTime: "10:30" };
let collision = true;
let writes = 0;
let audits = 0;
let lockTaken = false;
let selections;
let patientUpdates;
const db = {
    $queryRaw: async () => { lockTaken = true; return []; },
    appointment: {
        findUnique: async () => ({ ...current }),
        findUniqueOrThrow: async () => ({ ...current }),
        findFirst: async () => { assert.ok(lockTaken, "collision checked under transaction lock"); return collision ? { id: "other" } : null; },
        updateMany: async ({ data }) => { writes++; current = { ...current, status: data.status }; return { count: 1 }; },
        findMany: async ({ select }) => { selections = select; return []; },
        create: async ({ select }) => { writes++; return Object.fromEntries(Object.entries({ ...current, chiefComplaint: "private", patientName: "existing private name" }).filter(([key]) => select[key])); },
    },
    doctor: { findUnique: async () => ({ isActive: true }), findFirst: async () => ({ id: "doctor", name: "Doctor", isActive: true }) },
    service: { findUnique: async () => ({ isActive: true }), findFirst: async () => ({ id: "service", name: "Service", durationMin: 30 }) },
    doctorSchedule: { findUnique: async () => ({ startTime: "09:00", endTime: "18:00", isDayOff: false, isActive: true }) },
    doctorAvailabilityException: { findMany: async () => [] },
    patient: { upsert: async ({ update }) => { patientUpdates = update; return { id: "patient", fullName: "Private existing name" }; } },
    auditLog: { create: async () => { audits++; } },
    $transaction: async (fn) => fn(db),
};
mock.module("../../lib/prisma", () => ({ prisma: db }));
mock.module("../../lib/auth", () => ({ requireRole: async () => ({ id: "staff", role }) }));
mock.module("../../lib/security/rate-limit", () => ({ rateLimit: async () => { } }));
mock.module("../../lib/telegram", () => ({ notifyDoctorOnTelegram: async () => false }));
// Availability checks are exercised separately; the service test must retain its own locked collision check.
mock.module("../../lib/availability", () => ({
    parseDateInput: (value) => new Date(`${value}T00:00:00Z`),
    ensureAppointmentSlotIsAvailable: async () => { },
    getDoctorDaySchedule: async () => ({ startTime: "09:00", endTime: "18:00", isDayOff: false, blockedRanges: [] }),
    isPastSlot: () => false, toMinutes: (s) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3)), withinRange: () => false,
}));
const { changeAppointmentStatus } = await import("../../lib/appointments/service");
const { GET } = await import("../../app/api/admin/appointments/route");
const { DELETE } = await import("../../app/api/admin/appointments/[id]/route");
const { POST: book } = await import("../../app/api/appointments/route");
await assert.rejects(changeAppointmentStatus({ id: "staff", role }, "visit", "CONFIRMED"), error => error.status === 409);
assert.equal(writes, 0, "occupied cancelled appointment must not reopen");
collision = false;
await changeAppointmentStatus({ id: "staff", role }, "visit", "CONFIRMED");
assert.equal(writes, 1);
assert.equal(audits, 1);
const before = writes;
await changeAppointmentStatus({ id: "staff", role }, "visit", "CONFIRMED");
assert.equal(writes, before, "same-status retry is idempotent");
await changeAppointmentStatus({ id: "staff", role }, "visit", "COMPLETED");
await assert.rejects(changeAppointmentStatus({ id: "staff", role }, "visit", "PENDING"));
current.status = "PENDING";
const response = await DELETE(new Request("http://localhost/api/admin/appointments/visit", { method: "DELETE" }), { params: Promise.resolve({ id: "visit" }) });
assert.equal(response.status, 200);
assert.equal(current.status, "CANCELLED", "DELETE retains the record through cancellation");
await GET(new Request("http://localhost/api/admin/appointments"));
const select = selections;
assert.equal(select.notes, undefined);
assert.equal(select.note, undefined);
assert.equal(select.chiefComplaint, undefined);
role = "ADMIN";
await GET(new Request("http://localhost/api/admin/appointments"));
assert.equal(selections.notes, true, "admin retains clinical access");
const booking = { phoneConfirmed: true, fullName: "Submitted Name", phone: "99112233", serviceId: "service", doctorId: "doctor", appointmentDate: "2099-01-02", startTime: "10:00" };
const create = () => new Request("http://localhost/api/appointments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(booking) });
const booked = await book(create());
assert.equal(booked.status, 201);
assert.deepEqual(patientUpdates, {}, "public booking never overwrites existing demographics");
const payload = await booked.json();
assert.equal(payload.data.chiefComplaint, undefined);
assert.equal(payload.data.patientName, undefined);
booking.phoneConfirmed = false;
assert.equal((await book(create())).status, 400);
console.info("Appointment API regression scenarios passed (mocked database; not a PostgreSQL concurrency test).");

// Patient resource authorization and field policies use the actual route handlers.
let patientOwned = true;
let patientQuery;
let visitQuery;
let duplicatePatient = false;
db.patient.findFirst = async query => { patientQuery = query; return patientOwned ? { id: "patient", fullName: "Patient", phone: "99112233" } : null; };
db.patient.findUnique = async () => ({ id: "patient" });
db.patient.update = async ({ data }) => { patientUpdates = data; return { id: "patient", ...data }; };
db.patient.create = async ({ data }) => { if (duplicatePatient) throw { code: "P2002" }; return { id: "patient", ...data }; };
db.appointment.count = async () => 0;
db.appointment.findMany = async query => { visitQuery = query; return []; };
mock.module("../../lib/auth", () => ({ requireRole: async (...roles) => roles.includes(role) ? { id: "staff", role, doctorId: role === "DOCTOR" ? "doctor" : null } : null }));
const { GET: patientDetail, PATCH: editPatient } = await import("../../app/api/patients/[id]/route");
const { POST: registerPatient } = await import("../../app/api/patients/route");
const patientParams = { params: Promise.resolve({ id: "patient" }) };
role = "RECEPTION";
assert.equal((await patientDetail(new Request("http://localhost/api/patients/patient"), patientParams)).status, 200);
assert.equal(visitQuery.select.notes, undefined);
assert.equal(visitQuery.select.chiefComplaint, undefined);
role = "DOCTOR";
assert.equal((await patientDetail(new Request("http://localhost/api/patients/patient"), patientParams)).status, 200);
assert.equal(patientQuery.where.appointments.some.doctorId, "doctor");
assert.equal(visitQuery.where.doctorId, "doctor", "doctor cannot receive another doctor's visits");
patientOwned = false;
assert.equal((await patientDetail(new Request("http://localhost/api/patients/patient"), patientParams)).status, 404);
assert.equal((await editPatient(new Request("http://localhost/api/patients/patient", { method: "PATCH", body: JSON.stringify({ fullName: "Changed" }) }), patientParams)).status, 403);
role = "RECEPTION";
const register = () => new Request("http://localhost/api/patients", { method: "POST", body: JSON.stringify({ fullName: "New Patient", phone: "99112233" }) });
assert.equal((await registerPatient(register())).status, 201);
duplicatePatient = true;
assert.equal((await registerPatient(register())).status, 409);
role = "PATIENT";
assert.equal((await patientDetail(new Request("http://localhost/api/patients/patient"), patientParams)).status, 403);

role = "ADMIN";
let archiveUpdate;
db.service.update = async input => { archiveUpdate = input; return { id: "service" }; };
const { DELETE: archiveService } = await import("../../app/api/services/route");
assert.equal((await archiveService(new Request("http://localhost/api/services", { method: "DELETE", body: JSON.stringify({ serviceId: "service" }) }))).status, 200);
assert.deepEqual(archiveUpdate.data, { isActive: false }, "service history is preserved without physical deletion");
console.info("Patient ownership, duplicate handling and service archival regression scenarios passed.");
