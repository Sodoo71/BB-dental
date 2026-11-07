ALTER TABLE "Patient"
  ADD COLUMN "guardianName" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "guardianPhone" TEXT NOT NULL DEFAULT '';
CREATE TABLE "BookingContactSession" (
  "id" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "profile" JSONB NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BookingContactSession_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BookingContactSession_tokenHash_key" ON "BookingContactSession"("tokenHash");
CREATE INDEX "BookingContactSession_expiresAt_idx" ON "BookingContactSession"("expiresAt");
ALTER TABLE "Appointment"
  ADD COLUMN "contactName" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "birthDate" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "gender" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "guardianName" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "guardianPhone" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "bookingContactId" TEXT;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_bookingContactId_fkey"
  FOREIGN KEY ("bookingContactId") REFERENCES "BookingContactSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
