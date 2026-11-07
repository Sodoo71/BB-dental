import { test } from "node:test";
import assert from "node:assert/strict";
import { bookingContactSchema, patientAge } from "../lib/patient-demographics";
import { today } from "../lib/domain";

test("age changes on the birthday and handles missing, future and leap-day dates", () => {
  assert.equal(patientAge("2008-11-08", "2026-11-07"), 17);
  assert.equal(patientAge("2008-11-07", "2026-11-07"), 18);
  assert.equal(patientAge("2008-11-06", "2026-11-07"), 18);
  assert.equal(patientAge("2026-11-07", "2026-11-07"), 0);
  assert.equal(patientAge("2008-02-29", "2026-02-28"), 17);
  assert.equal(patientAge("2008-02-29", "2026-03-01"), 18);
  for (const value of ["", "2026-02-30", "2099-01-01"])
    assert.equal(patientAge(value, "2026-11-07"), null);
});
test("minors require guardian contact while optional demographics stay optional", () => {
  const contact = { name: "Тест Өвчтөн", phone: "+976 9911-2233" };
  assert.equal(bookingContactSchema.safeParse(contact).success, true);
  const birthDate = `${Number(today().slice(0, 4)) - 10}-01-01`;
  assert.equal(
    bookingContactSchema.safeParse({ ...contact, birthDate }).success,
    false,
  );
  assert.equal(
    bookingContactSchema.safeParse({
      ...contact,
      birthDate,
      guardianName: "Асран хамгаалагч",
      guardianPhone: "12345678",
    }).success,
    false,
  );
  const minor = bookingContactSchema.parse({
    ...contact,
    birthDate,
    guardianName: "Асран хамгаалагч",
    guardianPhone: "+976 8811-2233",
  });
  assert.equal(minor.phone, "99112233");
  assert.equal(minor.guardianPhone, "88112233");
  assert.equal(
    bookingContactSchema.safeParse({ ...contact, birthDate: "2099-01-01" })
      .success,
    false,
  );
});
