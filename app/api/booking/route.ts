import { NextResponse } from "next/server";
// Booking notifications are dispatched only after an actual appointment is persisted.
export async function POST() {
  return NextResponse.json({ error: "Use /api/appointments to create a booking." }, { status: 410 });
}
