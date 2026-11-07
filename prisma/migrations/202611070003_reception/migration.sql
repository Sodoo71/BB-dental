-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "cashSessionId" TEXT,
ADD COLUMN     "invoiceId" TEXT,
ADD COLUMN     "reference" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "discount" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL DEFAULT 0,
    "dueDate" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalizedAt" TIMESTAMP(3),

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceItem" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "treatmentId" TEXT,
    "serviceId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" INTEGER NOT NULL,

    CONSTRAINT "InvoiceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QueueEntry" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT,
    "patientId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'WAITING',
    "arrivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "calledAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,

    CONSTRAINT "QueueEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashSession" (
    "id" TEXT NOT NULL,
    "receptionistId" TEXT NOT NULL,
    "openingCash" INTEGER NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "actualCash" INTEGER,
    "expectedCash" INTEGER,
    "discrepancy" INTEGER,
    "explanation" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "CashSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashWithdrawal" (
    "id" TEXT NOT NULL,
    "cashSessionId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashWithdrawal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefundRequest" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "requestedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefundRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_number_key" ON "Invoice"("number");

-- CreateIndex
CREATE INDEX "Invoice_patientId_status_idx" ON "Invoice"("patientId", "status");

-- CreateIndex
CREATE INDEX "Invoice_dueDate_idx" ON "Invoice"("dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceItem_treatmentId_key" ON "InvoiceItem"("treatmentId");

-- CreateIndex
CREATE UNIQUE INDEX "QueueEntry_appointmentId_key" ON "QueueEntry"("appointmentId");

-- CreateIndex
CREATE INDEX "QueueEntry_date_status_idx" ON "QueueEntry"("date", "status");

-- CreateIndex
CREATE UNIQUE INDEX "QueueEntry_date_number_key" ON "QueueEntry"("date", "number");

-- CreateIndex
CREATE INDEX "CashSession_receptionistId_closedAt_idx" ON "CashSession"("receptionistId", "closedAt");

-- CreateIndex
CREATE INDEX "RefundRequest_paymentId_status_idx" ON "RefundRequest"("paymentId", "status");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_cashSessionId_fkey" FOREIGN KEY ("cashSessionId") REFERENCES "CashSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_treatmentId_fkey" FOREIGN KEY ("treatmentId") REFERENCES "Treatment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QueueEntry" ADD CONSTRAINT "QueueEntry_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QueueEntry" ADD CONSTRAINT "QueueEntry_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashWithdrawal" ADD CONSTRAINT "CashWithdrawal_cashSessionId_fkey" FOREIGN KEY ("cashSessionId") REFERENCES "CashSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefundRequest" ADD CONSTRAINT "RefundRequest_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Preserve historical charges and deposits in one reconciled legacy invoice per patient.
-- Existing Payment IDs, amounts, methods and audit records are retained verbatim.
INSERT INTO "Invoice" (id,number,"patientId",status,total,"dueDate","createdById","finalizedAt")
SELECT 'legacy-' || p.id, 'LEGACY-' || p.id, p.id, 'FINALIZED',
  COALESCE((SELECT SUM(t.amount) FROM "Treatment" t WHERE t."patientId"=p.id),0),
  to_char(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Ulaanbaatar','YYYY-MM-DD'), 'migration', NULL
FROM "Patient" p WHERE EXISTS (SELECT 1 FROM "Treatment" t WHERE t."patientId"=p.id)
 OR EXISTS (SELECT 1 FROM "Payment" t WHERE t."patientId"=p.id);
INSERT INTO "InvoiceItem" (id,"invoiceId","treatmentId","serviceId",description,quantity,"unitPrice")
SELECT 'legacy-' || t.id, 'legacy-' || t."patientId", t.id,t."serviceId",s.name,1,t.amount
FROM "Treatment" t JOIN "Service" s ON s.id=t."serviceId";
UPDATE "Payment" SET "invoiceId"='legacy-' || "patientId";
CREATE UNIQUE INDEX "CashSession_one_open_per_receptionist" ON "CashSession" ("receptionistId") WHERE "closedAt" IS NULL;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_amounts_check" CHECK (total >= 0 AND discount >= 0);
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_amounts_check" CHECK (quantity > 0 AND "unitPrice" >= 0);
ALTER TABLE "CashSession" ADD CONSTRAINT "CashSession_amounts_check" CHECK ("openingCash" >= 0 AND ("actualCash" IS NULL OR "actualCash" >= 0));
ALTER TABLE "CashWithdrawal" ADD CONSTRAINT "CashWithdrawal_amount_check" CHECK (amount > 0);
ALTER TABLE "RefundRequest" ADD CONSTRAINT "RefundRequest_amount_check" CHECK (amount > 0);
ALTER TABLE "QueueEntry" ADD CONSTRAINT "QueueEntry_status_check" CHECK (status IN ('WAITING','CALLED','IN_PROGRESS','COMPLETED','CANCELLED'));

-- New reception settlements are append-only. Legacy administrator void behavior
-- remains available for historical records outside a reception cash session.
CREATE FUNCTION protect_reception_settlement() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."cashSessionId" IS NOT NULL THEN
    RAISE EXCEPTION 'Reception settlements are immutable; use an audited refund workflow';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER reception_settlement_immutable BEFORE UPDATE OR DELETE ON "Payment"
FOR EACH ROW EXECUTE FUNCTION protect_reception_settlement();
