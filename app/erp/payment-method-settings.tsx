"use client";
import { useState } from "react";
import {
  api,
  Feedback,
  LoadingSkeleton,
  useResource,
  useModalGuard,
} from "./ui";
import { methodNames } from "@/lib/domain";

export type PaymentOption = {
  id: string;
  name: string;
  kind: string;
  enabled: boolean;
  sortOrder: number;
  referenceRequired: boolean;
  description: string;
};
const blank = {
  name: "",
  kind: "CASH",
  enabled: true,
  sortOrder: 0,
  referenceRequired: false,
  description: "",
};
export default function PaymentMethodSettings() {
  const [version, setVersion] = useState(0);
  const request = useResource<{ items: PaymentOption[] }>(
    "/api/payment-methods",
    version,
  );
  const [editing, setEditing] = useState<PaymentOption | typeof blank | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useModalGuard(busy);
  return (
    <section className="settings-section payment-settings">
      <h2>Төлбөрийн хэлбэрүүд</h2>
      <p>
        Идэвхтэй хэлбэрүүд ресепшний төлбөр авах хэсэгт харагдана. Нэр солих,
        идэвхгүй болгоход өмнөх гүйлгээний мэдээлэл хадгалагдана.
      </p>
      {request.error && (
        <Feedback retry={request.retry}>{request.error}</Feedback>
      )}
      {error && <Feedback>{error}</Feedback>}
      {message && (
        <p role="status" className="reception-success">
          {message}
        </p>
      )}
      {request.loading ? (
        <LoadingSkeleton />
      ) : (
        <div className="payment-method-list">
          {request.data?.items.map((m) => (
            <article key={m.id}>
              <div>
                <strong>{m.name}</strong>
                <small>
                  {methodNames[m.kind]} · {m.enabled ? "Идэвхтэй" : "Идэвхгүй"}{" "}
                  · Эрэмбэ {m.sortOrder}
                </small>
                <small>
                  {m.referenceRequired
                    ? "Гүйлгээний дугаар шаардлагатай"
                    : "Гүйлгээний дугаар заавал биш"}
                </small>
                <p>{m.description}</p>
              </div>
              <button
                className="erp-secondary"
                disabled={busy}
                onClick={() => {
                  setEditing({ ...m });
                  setError("");
                }}
              >
                Засах · {m.name}
              </button>
            </article>
          ))}
        </div>
      )}
      {!editing && (
        <button
          className="erp-primary"
          onClick={() => {
            setEditing({
              ...blank,
              sortOrder: request.data?.items.length || 0,
            });
            setMessage("");
          }}
        >
          + Төлбөрийн хэлбэр нэмэх
        </button>
      )}
      {editing && (
        <form
          className="payment-method-editor"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              await api("/api/payment-methods", "POST", editing);
              setEditing(null);
              setVersion((v) => v + 1);
              setMessage("Төлбөрийн хэлбэр хадгалагдлаа.");
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <h3>
            {"id" in editing
              ? "Төлбөрийн хэлбэр засах"
              : "Шинэ төлбөрийн хэлбэр"}
          </h3>
          <fieldset disabled={busy}>
            <label>
              Нэр
              <input
                required
                maxLength={80}
                value={editing.name}
                onChange={(e) =>
                  setEditing({ ...editing, name: e.target.value })
                }
              />
            </label>
            <label>
              Тооцооны төрөл
              <select
                aria-label="Тооцооны төрөл"
                value={editing.kind}
                disabled={"id" in editing}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    kind: e.target.value,
                    referenceRequired: e.target.value !== "CASH",
                  })
                }
              >
                {Object.entries(methodNames).map(([k, n]) => (
                  <option key={k} value={k}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Харагдах эрэмбэ
              <input
                type="number"
                min={0}
                max={10000}
                required
                value={editing.sortOrder}
                onChange={(e) =>
                  setEditing({ ...editing, sortOrder: Number(e.target.value) })
                }
              />
            </label>
            <label>
              Тайлбар
              <textarea
                maxLength={500}
                value={editing.description}
                onChange={(e) =>
                  setEditing({ ...editing, description: e.target.value })
                }
              />
            </label>
            <label className="reception-check">
              <input
                type="checkbox"
                checked={editing.enabled}
                onChange={(e) =>
                  setEditing({ ...editing, enabled: e.target.checked })
                }
              />
              Ашиглах
            </label>
            <label className="reception-check">
              <input
                type="checkbox"
                checked={editing.referenceRequired}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    referenceRequired: e.target.checked,
                  })
                }
              />
              Гүйлгээний дугаар шаардах
            </label>
          </fieldset>
          <div className="reception-actions">
            <button className="erp-primary" disabled={busy}>
              {busy ? "Хадгалж байна…" : "Хадгалах"}
            </button>
            <button
              type="button"
              className="erp-secondary"
              disabled={busy}
              onClick={() => setEditing(null)}
            >
              Болих
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
