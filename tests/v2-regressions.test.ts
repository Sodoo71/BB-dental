import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { shouldAutoApproveRegistration } from "../lib/auth/registration-policy";
import { mayChangeAppointment } from "../lib/appointments/policy";
import { publicDoctorSelect, receptionAppointmentSelect } from "../lib/appointments/dto";
import { phoneSchema } from "../lib/validation/phone";
import { resolveDaySchedule } from "../lib/availability-slots";
import { environmentIssues } from "../lib/config";

describe("V2 authorization and booking policy", () => {
  it("doctor auto-approval never activates reception or legacy patient roles", () => {
    for (const role of ["RECEPTION", "PATIENT", "ADMIN", "SUPER_ADMIN"]) assert.equal(shouldAutoApproveRegistration(role, { autoApproveDoctors: true }), false);
    assert.equal(shouldAutoApproveRegistration("DOCTOR", { autoApproveDoctors: true }), true);
    assert.equal(shouldAutoApproveRegistration("DOCTOR", { autoApproveDoctors: "true" }), false);
    assert.equal(shouldAutoApproveRegistration("DOCTOR", null), false);
  });
  it("terminal clinical states cannot be silently reopened", () => {
    assert.equal(mayChangeAppointment("COMPLETED", "PENDING"), false);
    assert.equal(mayChangeAppointment("NO_SHOW", "CONFIRMED"), false);
    assert.equal(mayChangeAppointment("PENDING", "COMPLETED"), false);
    assert.equal(mayChangeAppointment("CANCELLED", "CONFIRMED"), true);
  });
  it("public and reception query contracts exclude confidential fields", () => {
    for (const key of ["telegramChatId", "email", "phone"]) assert.ok(!Object.keys(publicDoctorSelect).includes(key));
    for (const key of ["note", "notes", "chiefComplaint"]) assert.ok(!Object.keys(receptionAppointmentSelect).includes(key));
  });
  it("phone validation accepts established formats and rejects arbitrary identities", () => {
    assert.equal(phoneSchema.parse(" 9911-2233 "), "99112233");
    assert.equal(phoneSchema.parse("+976 (9911) 2233"), "+97699112233");
    for (const input of ["x", "123", "<script>", "9".repeat(33)]) assert.equal(phoneSchema.safeParse(input).success, false);
  });
  it("schedule exceptions retain ordering, inactive hours and blocked ranges", () => {
    const weekly = { startTime: "09:00", endTime: "17:00", isActive: true, isDayOff: false };
    const block = { type: "BLOCKED_RANGE", startTime: "12:00", endTime: "13:00" };
    assert.deepEqual(resolveDaySchedule(weekly, [block]).blockedRanges, [block]);
    assert.equal(resolveDaySchedule(weekly, [{ type: "DAY_OFF", startTime: null, endTime: null }]).isDayOff, true);
    assert.equal(resolveDaySchedule({ ...weekly, isActive: false }, []).isDayOff, true);
    assert.equal(resolveDaySchedule(null, []).startTime, null);
  });
  it("rejects incomplete runtime configuration without exposing secrets", () => {
    assert.equal(environmentIssues({}).length, 2);
    const secret = "a".repeat(32);
    assert.deepEqual(environmentIssues({ DATABASE_URL: "postgresql://localhost/clinic", AUTH_SECRET: secret, APP_URL: "https://clinic.example", NODE_ENV: "production" }), []);
    assert.ok(environmentIssues({ AUTH_SECRET: "secret" }).every(issue => !issue.includes("secret")));
  });
  it("API privacy, reactivation, history retention and public booking regressions", () => {
    const result = spawnSync(process.execPath, ["tests/fixtures/appointment-regressions.js"], { cwd: process.cwd(), encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /regression scenarios passed/);
  });
  it("production seed execution fails before opening a connection", () => {
    const result = spawnSync(process.execPath, ["prisma/seed.ts"], { cwd: process.cwd(), encoding: "utf8", env: { ...process.env, NODE_ENV: "production", ALLOW_DEVELOPMENT_SEED: "true" } });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Development seed disabled/);
  });
});
