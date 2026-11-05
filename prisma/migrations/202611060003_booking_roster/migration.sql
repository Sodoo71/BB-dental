ALTER TABLE "Service" ADD COLUMN "doctorIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
CREATE TABLE "NurseShift" ("id" TEXT NOT NULL, "name" TEXT NOT NULL, "date" TEXT NOT NULL, "startTime" TEXT NOT NULL, "endTime" TEXT NOT NULL, CONSTRAINT "NurseShift_pkey" PRIMARY KEY ("id"));
CREATE INDEX "NurseShift_date_idx" ON "NurseShift"("date");
