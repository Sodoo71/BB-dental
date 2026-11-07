export function schedulePolicy(lockDays = 7, date: string) {
  const protectedThrough = new Date(
    Date.parse(`${date}T12:00:00Z`) + lockDays * 86400000,
  )
    .toISOString()
    .slice(0, 10);
  const editableFrom = new Date(
    Date.parse(`${protectedThrough}T12:00:00Z`) + 86400000,
  )
    .toISOString()
    .slice(0, 10);
  return { lockDays, protectedThrough, editableFrom };
}
export function scheduleLockDays(value?: string | null) {
  return value && /^(?:[0-9]|[1-8][0-9]|90)$/.test(value) ? Number(value) : 7;
}
