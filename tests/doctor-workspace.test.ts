import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  appointmentPatient,
  canChangeAppointment,
  clinicDateKey,
  clinicMinutes,
  type AppointmentState,
} from "../lib/doctor-workspace";
import { hasDoctorLeaveConflict } from "../lib/doctor-leaves";
describe("doctor workspace", () => {
  it("uses the clinic day across UTC midnight and local midnight", () => {
    assert.equal(clinicDateKey(new Date("2026-09-28T17:15:00Z")), "2026-09-29");
    assert.equal(clinicMinutes(new Date("2026-09-28T17:15:00Z")), 75);
    assert.equal(clinicDateKey(new Date("2026-09-28T15:59:00Z")), "2026-09-28");
    assert.equal(clinicMinutes(new Date("2026-09-28T16:00:00Z")), 0);
  });
  it("protects completed and cancelled visits from doctor status changes", () => {
    for (const from of [
      "COMPLETED",
      "CANCELLED",
      "NO_SHOW",
    ] as AppointmentState[]) {
      for (const to of [
        "PENDING",
        "CONFIRMED",
        "CANCELLED",
        "COMPLETED",
        "NO_SHOW",
      ] as AppointmentState[])
        assert.equal(canChangeAppointment(from, to), false);
    }
    assert.equal(canChangeAppointment("PENDING", "CONFIRMED"), true);
    assert.equal(canChangeAppointment("PENDING", "COMPLETED"), false);
    assert.equal(canChangeAppointment("CONFIRMED", "NO_SHOW"), true);
  });
  it("keeps legacy bookings without a patient relation readable", () => {
    const booking = {
      patient: null,
      patientName: "Тест",
      patientPhone: "99112233",
    };
    assert.deepEqual(appointmentPatient(booking).patient, {
      fullName: "Тест",
      phone: "99112233",
    });
  });
  it("checks bookings before approving a doctor leave request", () => {
    const appointments = [{ startTime: "10:00", endTime: "10:30" }];
    assert.equal(
      hasDoctorLeaveConflict("DAY_OFF", null, null, appointments),
      true,
    );
    assert.equal(
      hasDoctorLeaveConflict("BLOCKED_RANGE", "10:15", "11:00", appointments),
      true,
    );
    assert.equal(
      hasDoctorLeaveConflict("BLOCKED_RANGE", "11:00", "12:00", appointments),
      false,
    );
    assert.equal(
      hasDoctorLeaveConflict(
        "SCHEDULE_OVERRIDE",
        "09:00",
        "11:00",
        appointments,
      ),
      false,
    );
    assert.equal(
      hasDoctorLeaveConflict(
        "SCHEDULE_OVERRIDE",
        "09:00",
        "10:15",
        appointments,
      ),
      true,
    );
  });
});
