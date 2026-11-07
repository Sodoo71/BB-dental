import { test } from "node:test";
import assert from "node:assert/strict";
import { schedulePolicy, scheduleLockDays } from "../lib/schedule-policy";

test("seven protected days include the boundary and preserve month/year transitions", () => {
  assert.deepEqual(schedulePolicy(7, "2026-12-27"), {
    lockDays: 7,
    protectedThrough: "2027-01-03",
    editableFrom: "2027-01-04",
  });
  assert.equal(schedulePolicy(7, "2028-02-24").editableFrom, "2028-03-03");
  assert.equal(schedulePolicy(0, "2026-11-07").editableFrom, "2026-11-08");
});
test("missing or invalid policy values retain the seven-day default", () => {
  for (const value of [undefined, "", "-1", "91", "7.5", "bad"])
    assert.equal(scheduleLockDays(value), 7);
  assert.equal(scheduleLockDays("0"), 0);
  assert.equal(scheduleLockDays("14"), 14);
});
