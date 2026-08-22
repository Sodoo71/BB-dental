-- CreateEnum
CREATE TYPE "DoctorAvailabilityType" AS ENUM ('DAY_OFF', 'BLOCKED_RANGE', 'SCHEDULE_OVERRIDE');

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'PATIENT';

-- CreateTable
CREATE TABLE "DoctorAvailabilityException" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "type" "DoctorAvailabilityType" NOT NULL DEFAULT 'BLOCKED_RANGE',
    "startTime" TEXT,
    "endTime" TEXT,
    "reason" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DoctorAvailabilityException_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DoctorAvailabilityException_doctorId_date_idx" ON "DoctorAvailabilityException"("doctorId", "date");

-- AddForeignKey
ALTER TABLE "DoctorAvailabilityException" ADD CONSTRAINT "DoctorAvailabilityException_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
