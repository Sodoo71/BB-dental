import { createHash, randomBytes } from "node:crypto";
import { db } from "./db";
import {
  bookingContactSchema,
  type BookingContact,
} from "./patient-demographics";

export const BOOKING_CONTACT_COOKIE = "bb_booking_contact";
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export async function bookingContactSession(
  token: string | undefined,
  phone: string,
) {
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  return db.bookingContactSession.findFirst({
    where: { tokenHash: hash(token), phone, expiresAt: { gt: new Date() } },
    select: { id: true },
  });
}
export async function prepareBookingContact(
  input: BookingContact,
  previousToken?: string,
  remember = false,
) {
  const contact = bookingContactSchema.parse(input);
  const previous = await bookingContactSession(previousToken, contact.phone);
  const token = previous ? previousToken! : randomBytes(32).toString("hex");
  const maxAge = remember ? 30 * 86400 : 2 * 3600;
  return {
    token,
    maxAge,
    session: {
      id: previous?.id,
      tokenHash: hash(token),
      phone: contact.phone,
      profile: contact,
      expiresAt: new Date(Date.now() + maxAge * 1000),
    },
  };
}
export type BookingContactPlan = Awaited<
  ReturnType<typeof prepareBookingContact>
>["session"];
