BEGIN;
CREATE TABLE "PaymentMethodOption" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "kind" "PaymentMethod" NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0 CHECK ("sortOrder" >= 0),
  "referenceRequired" BOOLEAN NOT NULL DEFAULT false,
  "description" TEXT NOT NULL DEFAULT '',
  CONSTRAINT "PaymentMethodOption_name_check" CHECK (length(trim("name")) BETWEEN 1 AND 80)
);
INSERT INTO "PaymentMethodOption" (id,name,kind,"sortOrder","referenceRequired") VALUES
 ('00000000-0000-4000-8000-000000000001','Бэлэн мөнгө','CASH',0,false),
 ('00000000-0000-4000-8000-000000000002','Карт','CARD',1,true),
 ('00000000-0000-4000-8000-000000000003','Банкны шилжүүлэг','TRANSFER',2,true),
 ('00000000-0000-4000-8000-000000000004','QPay','QPAY',3,true);
-- Do not update immutable historical settlements. Their original enum label remains available.
ALTER TABLE "Payment" ADD COLUMN "paymentMethodId" TEXT,
 ADD COLUMN "methodName" TEXT NOT NULL DEFAULT '',
 ADD COLUMN "cashierName" TEXT NOT NULL DEFAULT '',
 ADD COLUMN "receiptBalance" INTEGER CHECK ("receiptBalance" >= 0);
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_paymentMethodId_fkey"
 FOREIGN KEY ("paymentMethodId") REFERENCES "PaymentMethodOption"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "Payment_paymentMethodId_date_idx" ON "Payment"("paymentMethodId",date);
COMMIT;
