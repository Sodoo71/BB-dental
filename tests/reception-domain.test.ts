import { test } from "node:test";
import assert from "node:assert/strict";
import {
  collectionSchema,
  expectedCash,
  invoiceBalance,
  queueTransitions,
} from "../lib/reception-domain";
const id = "11111111-1111-4111-8111-111111111111";
test("partial collections and legacy deposits do not produce negative receivables", () => {
  assert.deepEqual(
    invoiceBalance({
      total: 200000,
      payments: [
        { amount: 50000, voidedAt: null },
        { amount: 100000, voidedAt: "void" },
      ],
    }),
    { paid: 50000, balance: 150000, credit: 0, paymentStatus: "PARTIAL" },
  );
  assert.equal(
    invoiceBalance({ total: 0, payments: [{ amount: 10000, voidedAt: null }] })
      .credit,
    10000,
  );
});
test("split allocations must equal payment and identify a method; reference policy is validated by the server", () => {
  const data = {
    invoiceId: id,
    idempotencyKey: id,
    amount: 200000,
    allocations: [
      { method: "CASH", amount: 50000 },
      { method: "QPAY", amount: 100000, reference: "bank-123" },
      { method: "TRANSFER", amount: 50000, reference: "bank-456" },
    ],
  };
  assert.equal(collectionSchema.safeParse(data).success, true);
  assert.equal(
    collectionSchema.safeParse({ ...data, amount: 199999 }).success,
    false,
  );
  assert.equal(
    collectionSchema.safeParse({
      ...data,
      allocations: [{ amount: 200000 }],
    }).success,
    false,
  );
  assert.equal(
    collectionSchema.safeParse({
      ...data,
      allocations: [{ paymentMethodId: id, amount: 200000 }],
    }).success,
    true,
  );
  assert.equal(
    collectionSchema.safeParse({ ...data, amount: -1 }).success,
    false,
  );
});
test("physical cash excludes card, transfer and QPay settlements", () => {
  const payments = ["CASH", "CARD", "TRANSFER", "QPAY"].map((method) => ({
    method,
    amount: 50000,
    voidedAt: null,
  }));
  assert.equal(expectedCash(10000, payments, [{ amount: 5000 }]), 55000);
});
test("queue terminal states cannot reopen or skip waiting directly into treatment", () => {
  assert.equal(queueTransitions.WAITING.includes("IN_PROGRESS"), false);
  assert.equal(queueTransitions.CALLED.includes("IN_PROGRESS"), true);
  assert.deepEqual(queueTransitions.COMPLETED, []);
  assert.deepEqual(queueTransitions.CANCELLED, []);
});
