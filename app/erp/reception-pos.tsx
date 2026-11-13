"use client";
import { useState } from "react";
import Link from "next/link";
import { CheckCircle, CreditCard } from "lucide-react";
import { ExportDocument } from "./export-document";
import {
  api,
  Feedback,
  LoadingSkeleton,
  PatientPicker,
  useModalGuard,
  useResource,
} from "./ui";
import { clinicTimestamp, money, methodNames } from "@/lib/domain";
import type { Invoice, Session } from "./reception";
import type { PaymentOption } from "./payment-method-settings";

type Settlement = {
  id: string;
  amount: number;
  methodName: string;
  reference: string;
  voidedAt?: string;
};
type ReceiptData = {
  number: string;
  createdAt: string;
  patient: { name: string; phone: string };
  invoiceNumber: string;
  invoiceTotal: number;
  cashier: string;
  payments: Settlement[];
  total: number;
  balance: number;
  balanceAtPayment: boolean;
};
export function Receipt({ id }: { id: string }) {
  const request = useResource<ReceiptData>(`/api/reception/receipt?id=${id}`);
  if (request.error)
    return <Feedback retry={request.retry}>{request.error}</Feedback>;
  if (!request.data) return <LoadingSkeleton />;
  const r = request.data;
  return (
    <section className="checkout-receipt" aria-label="Төлбөрийн баримт">
      <ExportDocument
        title="Төлбөрийн баримт"
        period={`Гүйлгээний огноо: ${clinicTimestamp(r.createdAt)}`}
        reference={r.number}
      >
        <dl className="checkout-summary">
          <div>
            <dt>Баримтын дугаар</dt>
            <dd className="reception-id">{r.number}</dd>
          </div>
          <div>
            <dt>Огноо, цаг</dt>
            <dd>{clinicTimestamp(r.createdAt)}</dd>
          </div>
          <div>
            <dt>Өвчтөн</dt>
            <dd>
              {r.patient.name} · {r.patient.phone}
            </dd>
          </div>
          <div>
            <dt>Нэхэмжлэх</dt>
            <dd className="reception-id">{r.invoiceNumber}</dd>
          </div>
          <div>
            <dt>Нэхэмжлэхийн дүн</dt>
            <dd>{money(r.invoiceTotal)}</dd>
          </div>
        </dl>
        <ul className="receipt-payments">
          {r.payments.map((p) => (
            <li key={p.id}>
              <div>
                <strong>{p.methodName}</strong>
                <span>{money(p.amount)}</span>
              </div>
              {p.reference && <small>Гүйлгээний дугаар: {p.reference}</small>}
              {p.voidedAt && <strong>Хүчингүй болсон гүйлгээ</strong>}
            </li>
          ))}
        </ul>
        <dl className="checkout-summary">
          <div>
            <dt>Энэ удаа төлсөн</dt>
            <dd>
              <strong>{money(r.total)}</strong>
            </dd>
          </div>
          <div>
            <dt>
              {r.balanceAtPayment
                ? "Төлөлтийн дараах үлдэгдэл"
                : "Одоогийн үлдэгдэл"}
            </dt>
            <dd>{money(r.balance)}</dd>
          </div>
          <div>
            <dt>Кассчин</dt>
            <dd>{r.cashier}</dd>
          </div>
        </dl>
        <small>Дотоод төлбөрийн баримт.</small>
      </ExportDocument>
    </section>
  );
}

export function CheckoutForm({
  invoice,
  onSaved,
  onBusyChange,
}: {
  invoice: Invoice;
  onSaved: (payments: Settlement[]) => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const [key] = useState(() => crypto.randomUUID());
  const methods = useResource<{ items: PaymentOption[] }>(
    "/api/payment-methods",
  );
  const session = useResource<{ items: Session[] }>(
    "/api/reception/cash-sessions",
  );
  const [rows, setRows] = useState([
    { paymentMethodId: "", amount: String(invoice.balance), reference: "" },
  ]);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState("");
  useModalGuard(busy);
  const options = methods.data?.items || [];
  const allocations = rows.map((r) => ({
    ...r,
    paymentMethodId: r.paymentMethodId || options[0]?.id || "",
  }));
  const total = allocations.reduce((sum, r) => sum + Number(r.amount), 0);
  const active = session.data?.items.some((s) => !s.closedAt);
  const valid =
    total > 0 &&
    total <= invoice.balance &&
    allocations.every((r) => {
      const option = options.find((m) => m.id === r.paymentMethodId);
      return (
        Number.isInteger(Number(r.amount)) &&
        Number(r.amount) > 0 &&
        option &&
        (!option.referenceRequired || r.reference.trim().length >= 3)
      );
    });
  if (methods.error || session.error)
    return (
      <Feedback
        retry={() => {
          methods.retry();
          session.retry();
        }}
      >
        {methods.error || session.error}
      </Feedback>
    );
  if (!methods.data || !session.data) return <LoadingSkeleton />;
  return (
    <form
      className="reception-collection checkout-form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy || completed) return;
        setBusy(true);
        onBusyChange?.(true);
        setError("");
        try {
          if (!valid || !confirmed)
            throw new Error(
              "Төлөх дүн, хэлбэр болон гүйлгээний мэдээллээ шалгана уу.",
            );
          const payments = await api<Settlement[]>(
            "/api/reception/collect",
            "POST",
            {
              invoiceId: invoice.id,
              idempotencyKey: key,
              amount: total,
              allocations: allocations.map((r) => ({
                ...r,
                amount: Number(r.amount),
              })),
            },
          );
          setCompleted(true);
          onSaved(payments);
        } catch (e) {
          setError((e as Error).message);
          methods.retry();
          session.retry();
        } finally {
          setBusy(false);
          onBusyChange?.(false);
        }
      }}
    >
      <h3>Төлбөр авах</h3>
      {!active && (
        <p className="reception-alert" role="status">
          Төлбөр авахын өмнө кассын ээлжээ нээнэ үү.
        </p>
      )}
      {!options.length && (
        <p className="reception-alert">
          Идэвхтэй төлбөрийн хэлбэр алга. Админд хандана уу.
        </p>
      )}
      {error && <Feedback>{error}</Feedback>}
      <fieldset
        className="checkout-allocations"
        disabled={busy || completed || !active}
      >
        <legend>Төлөх дүн ба хэлбэр</legend>
        {allocations.map((row, index) => {
          const option = options.find((m) => m.id === row.paymentMethodId);
          const update = (value: Partial<typeof row>) => {
            setConfirmed(false);
            setRows(
              allocations.map((r, n) => (n === index ? { ...r, ...value } : r)),
            );
          };
          return (
            <div className="checkout-allocation" key={index}>
              <label>
                {allocations.length === 1
                  ? "Энэ удаа төлөх дүн"
                  : `Төлөх дүн ${index + 1}`}
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={invoice.balance}
                  step={1}
                  required
                  value={row.amount}
                  onChange={(e) => update({ amount: e.target.value })}
                />
              </label>
              <label>
                Төлбөрийн хэлбэр
                <select
                  aria-label="Төлбөрийн хэлбэр"
                  required
                  value={row.paymentMethodId}
                  onChange={(e) =>
                    update({ paymentMethodId: e.target.value, reference: "" })
                  }
                >
                  {row.paymentMethodId && !option && (
                    <option value={row.paymentMethodId}>
                      Идэвхгүй болсон хэлбэр
                    </option>
                  )}
                  {!options.length && <option value="">Хэлбэр алга</option>}
                  {options.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </label>
              {option?.description && (
                <p className="checkout-method-description">
                  {option.description}
                </p>
              )}
              {(option?.kind !== "CASH" || option.referenceRequired) && (
                <label className="checkout-reference">
                  Гүйлгээний дугаар
                  {option?.referenceRequired ? " *" : " (заавал биш)"}
                  <input
                    required={option?.referenceRequired}
                    minLength={option?.referenceRequired ? 3 : undefined}
                    maxLength={200}
                    value={row.reference}
                    onChange={(e) => update({ reference: e.target.value })}
                  />
                </label>
              )}
              {allocations.length > 1 && (
                <button
                  className="erp-secondary"
                  type="button"
                  onClick={() => {
                    setRows(allocations.filter((_, n) => n !== index));
                    setConfirmed(false);
                  }}
                >
                  Хасах
                </button>
              )}
            </div>
          );
        })}
        <button
          className="erp-secondary"
          type="button"
          disabled={allocations.length >= 12 || !options.length}
          onClick={() => {
            setRows([
              ...allocations,
              {
                paymentMethodId:
                  options.find(
                    (o) => !allocations.some((a) => a.paymentMethodId === o.id),
                  )?.id || options[0].id,
                amount: String(Math.max(0, invoice.balance - total)),
                reference: "",
              },
            ]);
            setConfirmed(false);
          }}
        >
          + Төлбөр хуваах
        </button>
      </fieldset>
      {allocations.some(
        (r) => options.find((m) => m.id === r.paymentMethodId)?.kind !== "CASH",
      ) && (
        <p className="checkout-hint">
          Банк, терминал дээр төлбөр орсныг шалгаж бүртгэнэ.
        </p>
      )}
      <section
        className="checkout-confirmation"
        aria-label="Төлбөрийн хураангуй"
        aria-live="polite"
      >
        <h4>Төлбөрөө шалгах</h4>
        <strong>{invoice.patient.name}</strong>
        <p className="reception-id">{invoice.number}</p>
        <dl className="checkout-summary">
          <div>
            <dt>Нэхэмжлэхийн дүн</dt>
            <dd>{money(invoice.total)}</dd>
          </div>
          <div>
            <dt>Өмнө төлсөн</dt>
            <dd>{money(invoice.paid)}</dd>
          </div>
          {allocations.map((r, n) => (
            <div key={n}>
              <dt>
                {options.find((m) => m.id === r.paymentMethodId)?.name ||
                  "Хэлбэр сонгоно уу"}
              </dt>
              <dd>{money(Number(r.amount) || 0)}</dd>
            </div>
          ))}
          <div className="checkout-total">
            <dt>Одоо төлөх</dt>
            <dd>{money(total || 0)}</dd>
          </div>
          <div>
            <dt>Төлсний дараах үлдэгдэл</dt>
            <dd>{money(Math.max(0, invoice.balance - total))}</dd>
          </div>
        </dl>
        {total > invoice.balance && (
          <p role="alert">Төлөх дүн үлдэгдлээс их байна.</p>
        )}
        <p>
          {valid && total === invoice.balance
            ? "Бүрэн төлөгдөнө"
            : "Хэсэгчлэн төлөх боломжтой"}
        </p>
      </section>
      <label className="reception-check">
        <input
          type="checkbox"
          required
          checked={confirmed}
          disabled={busy || completed}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
        Мөнгө хүлээн авсан, гүйлгээг шалгасан
      </label>
      <button
        className="erp-primary checkout-submit"
        disabled={busy || completed || !active || !valid || !confirmed}
      >
        <CreditCard size={18} />
        {busy
          ? "Бүртгэж байна…"
          : `Төлбөр баталгаажуулах · ${money(total || 0)}`}
      </button>
    </form>
  );
}

export default function ReceptionPOS({
  version,
  onSaved,
  onInvoice,
  onNewInvoice,
  onBusyChange,
}: {
  version: number;
  onSaved: () => void;
  onInvoice: (id: string) => void;
  onNewInvoice: (patientId?: string) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const [collecting, setCollecting] = useState(false);
  const [patientId, setPatientId] = useState("");
  const [invoiceId, setInvoiceId] = useState("");
  const [receiptId, setReceiptId] = useState("");
  const invoices = useResource<{
    items: Invoice[];
    balance: number;
    total: number;
  }>(
    patientId ? `/api/reception/invoices?patientId=${patientId}` : null,
    version,
  );
  const invoice = useResource<Invoice>(
    invoiceId ? `/api/reception/invoice?id=${invoiceId}` : null,
    version,
  );
  const patient = useResource<Invoice["patient"]>(
    patientId ? `/api/erp/patients/${patientId}` : null,
    version,
  );
  return (
    <div className="reception-pos">
      <section className="reception-panel checkout-patient" inert={collecting}>
        <h2>1. Өвчтөн сонгох</h2>
        <label htmlFor="pos-patient">Өвчтөн</label>
        <PatientPicker
          id="pos-patient"
          value={patientId}
          onChange={(id) => {
            setPatientId(id);
            setInvoiceId("");
            setReceiptId("");
          }}
        />
        {patient.error && (
          <Feedback retry={patient.retry}>{patient.error}</Feedback>
        )}
        {patient.data && (
          <div className="checkout-patient-info">
            <strong>{patient.data.name}</strong>
            <p>
              {patient.data.phone} ·{" "}
              {patient.data.birthDate || "Төрсөн огноо бүртгэлгүй"}
            </p>
            {patient.data.allergies && (
              <p className="reception-alert">
                Харшил: {patient.data.allergies}
              </p>
            )}
            <Link href={`/erp/patients?q=${patientId}`}>
              Өвчтөний бүртгэл нээх
            </Link>
          </div>
        )}
        {invoices.error && (
          <Feedback retry={invoices.retry}>{invoices.error}</Feedback>
        )}
        {invoices.loading && <LoadingSkeleton />}
        {patientId && invoices.data && (
          <>
            <h3>2. Нэхэмжлэх сонгох</h3>
            <p>
              Төлөгдөөгүй төлбөр:{" "}
              <strong>{money(invoices.data.balance)}</strong>
            </p>
            <div className="checkout-invoices">
              {invoices.data.items
                .filter((i) => i.status === "FINALIZED" && i.balance > 0)
                .map((i) => (
                  <button
                    key={i.id}
                    className={`checkout-invoice${invoiceId === i.id ? " selected" : ""}`}
                    aria-pressed={invoiceId === i.id}
                    onClick={() => {
                      setInvoiceId(i.id);
                      setReceiptId("");
                    }}
                  >
                    <span className="reception-id">{i.number}</span>
                    <small>
                      {clinicTimestamp(i.createdAt)} · {i.patient.name}
                    </small>
                    <span>
                      Нийт {money(i.total)} · Төлсөн {money(i.paid)}
                    </span>
                    <strong>Үлдэгдэл {money(i.balance)}</strong>
                    <small>
                      {i.paid > 0 ? "Хэсэгчлэн төлсөн" : "Төлөгдөөгүй"}
                    </small>
                  </button>
                ))}
            </div>
            {!invoices.data.items.some(
              (i) => i.status === "FINALIZED" && i.balance > 0,
            ) && (
              <p className="checkout-empty">
                Төлбөр авах баталгаажсан нэхэмжлэх алга.
              </p>
            )}
            <button
              className="erp-secondary"
              onClick={() => onNewInvoice(patientId)}
            >
              + Нэхэмжлэх үүсгэх
            </button>
            {invoices.data.items.some((i) => i.status === "DRAFT") && (
              <details>
                <summary>Баталгаажуулаагүй нэхэмжлэх</summary>
                {invoices.data.items
                  .filter((i) => i.status === "DRAFT")
                  .map((i) => (
                    <p key={i.id}>
                      <button
                        className="reception-link"
                        onClick={() => onInvoice(i.id)}
                      >
                        {i.number} · Баталгаажуулах
                      </button>
                    </p>
                  ))}
              </details>
            )}
            <details>
              <summary>Өмнөх төлбөрүүд</summary>
              {invoices.data.items
                .flatMap((i) => i.payments)
                .map((p) => (
                  <p key={p.id}>
                    {p.date} · {p.methodName || methodNames[p.method || ""]} ·{" "}
                    {money(p.amount || 0)}
                    {p.voidedAt ? " · Хүчингүй" : ""}
                  </p>
                ))}
            </details>
            {invoices.data.total > invoices.data.items.length && (
              <p>
                Сүүлийн {invoices.data.items.length} нэхэмжлэх харагдаж байна.{" "}
                <Link href={`/erp/receivables?q=${patient.data?.phone || ""}`}>
                  Бүх үлдэгдлийг харах
                </Link>
              </p>
            )}
          </>
        )}
      </section>
      <section
        className="reception-panel checkout-payment"
        aria-label="Төлбөр авах хэсэг"
      >
        {receiptId ? (
          <>
            <p role="status" className="reception-success">
              <CheckCircle size={18} />
              Төлбөр амжилттай бүртгэгдлээ.
            </p>
            <Receipt id={receiptId} />
            <button className="erp-secondary" onClick={() => setReceiptId("")}>
              Дараагийн төлбөр авах
            </button>
          </>
        ) : invoice.error ? (
          <Feedback retry={invoice.retry}>{invoice.error}</Feedback>
        ) : invoice.loading ? (
          <LoadingSkeleton />
        ) : invoice.data ? (
          <>
            <h2>3. Төлбөр авах</h2>
            <p className="reception-id">{invoice.data.number}</p>
            <dl className="checkout-summary">
              <div>
                <dt>Нэхэмжлэхийн дүн</dt>
                <dd>{money(invoice.data.total)}</dd>
              </div>
              <div>
                <dt>Өмнө төлсөн</dt>
                <dd>{money(invoice.data.paid)}</dd>
              </div>
              <div className="checkout-total">
                <dt>Үлдэгдэл</dt>
                <dd>{money(invoice.data.balance)}</dd>
              </div>
            </dl>
            <details>
              <summary>Үйлчилгээнүүд</summary>
              {invoice.data.items.map((i) => (
                <p key={i.id}>
                  {i.description} × {i.quantity} ·{" "}
                  {money(i.quantity * i.unitPrice)}
                </p>
              ))}
            </details>
            {invoice.data.status === "FINALIZED" && invoice.data.balance > 0 ? (
              <CheckoutForm
                key={`${invoice.data.id}:${invoice.data.paid}`}
                invoice={invoice.data}
                onBusyChange={(value) => {
                  setCollecting(value);
                  onBusyChange(value);
                }}
                onSaved={(payments) => {
                  setReceiptId(payments[0].id);
                  onSaved();
                }}
              />
            ) : (
              <p className="reception-success">
                Энэ нэхэмжлэхийн төлбөр төлөгдсөн.
              </p>
            )}
          </>
        ) : (
          <div className="checkout-empty">
            <CreditCard size={32} />
            <h2>Төлбөр авахад бэлэн</h2>
            <p>Өвчтөнөө сонгоод, төлөх нэхэмжлэхийг нээнэ үү.</p>
            <p>Хэсэгчлэн болон хэд хэдэн хэлбэрээр төлөх боломжтой.</p>
          </div>
        )}
      </section>
    </div>
  );
}
