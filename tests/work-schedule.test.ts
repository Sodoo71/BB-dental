import { test } from "node:test";
import assert from "node:assert/strict";
import { workIntervals, coversAppointment } from "../lib/work-schedule";
import { availableTimes } from "../lib/available-times";

test("approved exceptions split working hours while pending and rejected requests do not block", () => {
  const weekly = { startTime: "09:00", endTime: "18:00" };
  const work = workIntervals(weekly, [
    { startTime: "09:00", endTime: "10:00", status: "PENDING" },
    { startTime: "10:00", endTime: "11:00", status: "REJECTED" },
    { startTime: "12:00", endTime: "13:00", status: "APPROVED" },
    { startTime: "12:30", endTime: "14:00", status: "APPROVED" },
  ]);
  assert.deepEqual(work, [
    { startTime: "09:00", endTime: "12:00" },
    { startTime: "14:00", endTime: "18:00" },
  ]);
  assert.equal(
    coversAppointment(work, { startTime: "11:30", endTime: "12:00" }),
    true,
  );
  assert.equal(
    coversAppointment(work, { startTime: "11:45", endTime: "12:15" }),
    false,
  );
});

test("approved daily hours can open an otherwise closed day; full-day leave takes precedence", () => {
  const override = {
    startTime: "14:00",
    endTime: "16:00",
    kind: "SCHEDULE_OVERRIDE",
    status: "APPROVED",
  };
  assert.deepEqual(
    workIntervals(null, [{ ...override, status: "PENDING" }]),
    [],
  );
  assert.deepEqual(workIntervals(null, [override]), [
    { startTime: "14:00", endTime: "16:00" },
  ]);
  assert.deepEqual(
    workIntervals(null, [
      override,
      {
        startTime: "00:00",
        endTime: "23:59",
        kind: "DAY_OFF",
        status: "APPROVED",
      },
    ]),
    [],
  );
});

test("availability respects current time, whole appointment duration, lunch gaps and adjacent bookings", () => {
  const intervals = [
    { startTime: "09:00", endTime: "10:00" },
    { startTime: "11:00", endTime: "12:00" },
  ];
  const occupied = [{ startTime: "11:30", endTime: "12:00" }];
  assert.deepEqual(
    availableTimes("2026-11-06", 30, intervals, occupied, {
      date: "2026-11-06",
      time: "09:15",
    }),
    ["09:30", "11:00"],
  );
  assert.deepEqual(
    availableTimes("2026-11-05", 30, intervals, occupied, {
      date: "2026-11-06",
      time: "08:00",
    }),
    [],
  );
  assert.deepEqual(
    availableTimes("2026-11-07", 0, intervals, occupied, {
      date: "2026-11-06",
      time: "08:00",
    }),
    [],
  );
});

test("staff manual times need not follow the suggestion grid but retain every availability constraint", () => {
  const day = "2099-01-05";
  const intervals = [
    { startTime: "09:00", endTime: "12:00" },
    { startTime: "13:00", endTime: "18:00" },
  ];
  const occupied = [{ startTime: "10:00", endTime: "10:30" }];
  const now = { date: day, time: "08:00" };
  assert.equal(
    availableTimes(day, 30, intervals, occupied, now).includes("09:10"),
    false,
  );
  assert.equal(
    availableTimes(day, 30, intervals, occupied, now, "09:10").includes(
      "09:10",
    ),
    true,
  );
  for (const time of [
    "08:50",
    "09:40",
    "10:10",
    "11:45",
    "12:10",
    "17:45",
    "24:00",
  ])
    assert.equal(
      availableTimes(day, 30, intervals, occupied, now, time).includes(time),
      false,
      time,
    );
  assert.equal(
    availableTimes(
      day,
      30,
      intervals,
      occupied,
      { date: day, time: "09:11" },
      "09:10",
    ).includes("09:10"),
    false,
  );
  assert.deepEqual(availableTimes(day, 30, [], [], now, "09:10"), []);
});
