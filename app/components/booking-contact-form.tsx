"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, Check } from "lucide-react";
import { api } from "../erp/ui";
import { normalizePhone, today } from "@/lib/domain";
import {
  bookingContactSchema,
  patientAge,
  type BookingContact,
} from "@/lib/patient-demographics";
const blank: BookingContact = {
  name: "",
  phone: "",
  birthDate: "",
  gender: "",
  guardianName: "",
  guardianPhone: "",
};
export default function BookingContactForm({
  summary,
  onBack,
  onSubmit,
}: {
  summary: ReactNode;
  onBack: () => void;
  onSubmit: (data: BookingContact & { note: string }) => Promise<void>;
}) {
  const [visited, setVisited] = useState<boolean | null>(null);
  const [contact, setContact] = useState<BookingContact>(blank);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dirty = useRef(new Set<keyof BookingContact>());
  const phone = normalizePhone(contact.phone);
  const age = patientAge(contact.birthDate);
  const minor = age !== null && age < 18;
  useEffect(() => {
    if (!visited || !/^[6-9]\d{7}$/.test(phone)) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      api<{ contact: Omit<BookingContact, "phone"> | null }>(
        "/api/public/returning-contact",
        "POST",
        { phone, previouslyVisited: true },
        controller.signal,
      )
        .then(({ contact: saved }) => {
          if (!saved || controller.signal.aborted) return;
          setContact((current) => {
            if (normalizePhone(current.phone) !== phone) return current;
            const next = { ...current };
            for (const key of [
              "name",
              "birthDate",
              "gender",
              "guardianName",
              "guardianPhone",
            ] as const) {
              if (!dirty.current.has(key))
                Object.assign(next, { [key]: saved[key] || "" });
            }
            return next;
          });
        })
        .catch(() => {
          /* Keep the manual form available when the background lookup fails. */
        });
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [phone, visited]);
  function change<K extends keyof BookingContact>(
    key: K,
    value: BookingContact[K],
  ) {
    dirty.current.add(key);
    setContact((current) => ({ ...current, [key]: value }));
  }
  return (
    <form
      className="booking-contact-form"
      onSubmit={async (event) => {
        event.preventDefault();
        const parsed = bookingContactSchema.safeParse(contact);
        if (!parsed.success) {
          setError(parsed.error.issues[0].message);
          return;
        }
        setBusy(true);
        setError("");
        try {
          await onSubmit({
            ...parsed.data,
            ...(minor ? {} : { guardianName: "", guardianPhone: "" }),
            note: note.trim(),
          });
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h3>Захиалгаа баталгаажуулах</h3>
      <p className="booking-contact-intro">
        Холбоо барих мэдээллээ оруулна уу.
      </p>
      {summary}
      <fieldset disabled={busy} className="booking-contact-fields">
        <legend>Та өмнө манайхаар үйлчлүүлж байсан уу?</legend>
        <div className="booking-visit-choices">
          <button
            type="button"
            aria-pressed={visited === true}
            onClick={() => setVisited(true)}
          >
            Тийм, өмнө үйлчлүүлж байсан
          </button>
          <button
            type="button"
            aria-pressed={visited === false}
            onClick={() => setVisited(false)}
          >
            Үгүй, анх удаа
          </button>
        </div>
        {visited !== null && (
          <>
            <div className="public-booking-fields">
              <label className="booking-phone-field">
                Утасны дугаар <span aria-hidden="true">*</span>
                <input
                  type="tel"
                  aria-label="Утасны дугаар"
                  autoComplete="tel"
                  inputMode="tel"
                  required
                  pattern="[0-9 +\-]{8,15}"
                  value={contact.phone}
                  onChange={(e) => {
                    dirty.current.clear();
                    setContact({ ...blank, phone: e.target.value });
                  }}
                />
              </label>
              <label>
                Овог, нэр <span aria-hidden="true">*</span>
                <input
                  aria-label="Овог, нэр"
                  autoComplete="name"
                  required
                  minLength={2}
                  maxLength={100}
                  value={contact.name}
                  onChange={(e) => change("name", e.target.value)}
                />
              </label>
              <label>
                Төрсөн огноо
                <input
                  type="date"
                  aria-label="Төрсөн огноо"
                  autoComplete="bday"
                  min="1900-01-01"
                  max={today()}
                  value={contact.birthDate}
                  onChange={(e) => change("birthDate", e.target.value)}
                />
                {age !== null && (
                  <output aria-label="Нас" aria-live="polite">
                    {age} настай
                  </output>
                )}
              </label>
              <label>
                Хүйс
                <select
                  aria-label="Хүйс"
                  value={contact.gender}
                  onChange={(e) =>
                    change("gender", e.target.value as BookingContact["gender"])
                  }
                >
                  <option value="">Сонгох</option>
                  <option value="MALE">Эрэгтэй</option>
                  <option value="FEMALE">Эмэгтэй</option>
                  <option value="OTHER">Бусад / Хэлэхгүй</option>
                </select>
              </label>
            </div>
            {minor && (
              <section
                className="booking-guardian-fields"
                aria-labelledby="booking-guardian-title"
              >
                <h4 id="booking-guardian-title">
                  Асран хамгаалагчийн мэдээлэл
                </h4>
                <p>
                  18-аас доош насны өвчтөний асран хамгаалагчийн мэдээллийг
                  оруулна уу.
                </p>
                <div className="public-booking-fields">
                  <label>
                    Асран хамгаалагчийн нэр <span aria-hidden="true">*</span>
                    <input
                      aria-label="Асран хамгаалагчийн нэр"
                      required
                      minLength={2}
                      maxLength={100}
                      value={contact.guardianName}
                      onChange={(e) => change("guardianName", e.target.value)}
                    />
                  </label>
                  <label>
                    Асран хамгаалагчийн утас <span aria-hidden="true">*</span>
                    <input
                      type="tel"
                      aria-label="Асран хамгаалагчийн утас"
                      required
                      inputMode="tel"
                      pattern="[0-9 +\-]{8,15}"
                      value={contact.guardianPhone}
                      onChange={(e) => change("guardianPhone", e.target.value)}
                    />
                  </label>
                </div>
              </section>
            )}
            <label className="booking-symptom-field">
              Зовиур <span>(заавал биш)</span>
              <textarea
                aria-label="Зовиур (заавал биш)"
                rows={3}
                maxLength={2000}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
            <p className="booking-privacy-note">
              Таны мэдээллийг захиалга болон эмнэлгийн үйлчилгээний зорилгоор
              ашиглана.
            </p>
          </>
        )}
        {error && (
          <p className="public-error" role="alert">
            {error}
          </p>
        )}
        <div className="booking-navigation">
          <button type="button" disabled={busy} onClick={onBack}>
            <ArrowLeft size={16} /> Буцах
          </button>
          <button className="button" disabled={busy || visited === null}>
            {busy ? "Бүртгэж байна…" : "Захиалга илгээх"}
            <Check size={17} />
          </button>
        </div>
      </fieldset>
    </form>
  );
}
