export const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;

export function getCalendarCells(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const count = new Date(
    month.getFullYear(),
    month.getMonth() + 1,
    0,
  ).getDate();
  return Array.from({ length: first.getDay() + count }, (_, i) =>
    i < first.getDay()
      ? null
      : new Date(month.getFullYear(), month.getMonth(), i - first.getDay() + 1),
  );
}

export function isPastDate(d: Date, today = new Date()) {
  return d < new Date(today.getFullYear(), today.getMonth(), today.getDate());
}
