-- Keep approved hours in place while a doctor's replacement awaits review.
ALTER TABLE "Leave" ADD COLUMN "replacesId" TEXT;
CREATE INDEX "Leave_replacesId_idx" ON "Leave"("replacesId");
