"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  Search,
  Stethoscope,
} from "lucide-react";
import { api, Feedback, useResource, type Entity } from "../erp/ui";
import { money, normalizePhone, statusNames, today } from "@/lib/domain";

type Catalog = {
  services: Entity[];
  doctors: Entity[];
  clinic?: Record<string, string>;
};
export default function PublicClinic({
  onClinic,
}: {
  onClinic?: (clinic: Record<string, string>) => void;
}) {
  const {
    data: catalogData,
    error,
    loading,
    retry: retryCatalog,
  } = useResource<Catalog>("/api/public/catalog");
  const catalog = catalogData || { services: [], doctors: [] };
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [step, setStep] = useState(1);
  const [service, setService] = useState<Entity | null>(null);
  const [doctorId, setDoctorId] = useState("");
  const [date, setDate] = useState(today());
  const [earliest, setEarliest] = useState<
    { date: string; startTime: string; doctorId: string; doctorName: string }[]
  >([]);
  const [findingEarliest, setFindingEarliest] = useState(false);
  const [earliestError, setEarliestError] = useState("");
  const earliestRequest = useRef(0);
  const [suggestedTime, setSuggestedTime] = useState("");
  const [timeSelection, setTimeSelection] = useState<{
    key: string;
    value: string;
  }>({ key: "", value: "" });
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [complete, setComplete] = useState(false);
  const [bookingError, setBookingError] = useState("");
  const [lookup, setLookup] = useState(false);
  const [lookupPhone, setLookupPhone] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [appointments, setAppointments] = useState<Entity[] | null>(null);
  const [lookupError, setLookupError] = useState("");
  const [lookupBusy, setLookupBusy] = useState(false);
  useEffect(() => {
    if (catalogData?.clinic) onClinic?.(catalogData.clinic);
  }, [catalogData, onClinic]);
  const suggestionsUrl =
    service && date
      ? `/api/public/suggestions?${new URLSearchParams({ serviceId: service.id, date })}`
      : null;
  const {
    data: suggestionData,
    error: suggestionError,
    loading: suggesting,
    retry: retrySuggestions,
  } = useResource<{ suggestions: { doctor: Entity; slots: string[] }[] }>(
    suggestionsUrl,
  );
  const suggestions = suggestionData?.suggestions || [];
  const availabilityUrl =
    service && doctorId && date
      ? `/api/public/availability?${new URLSearchParams({ serviceId: service.id, doctorId, date })}`
      : null;
  const {
    data: availability,
    error: availabilityError,
    loading: slotsLoading,
    retry: retrySlots,
  } = useResource<{ slots: string[] }>(availabilityUrl);
  const slots = availability?.slots || [];
  const time =
    timeSelection.key === availabilityUrl
      ? slots.includes(timeSelection.value)
        ? timeSelection.value
        : ""
      : slots.includes(suggestedTime)
        ? suggestedTime
        : "";
  const setTime = (value: string) =>
    setTimeSelection({ key: availabilityUrl || "", value });
  const contactTel = `tel:+976${(catalog.clinic?.phone || "95963531").replace(/\D/g, "").replace(/^976/, "")}`;
  const categories = [
    ...new Set(catalog.services.map((s) => s.category || "Бусад")),
  ];
  const filtered = catalog.services.filter(
    (s) =>
      (!category || s.category === category) &&
      (!search ||
        s.name?.toLocaleLowerCase().includes(search.toLocaleLowerCase())),
  );
  function choose(s: Entity) {
    earliestRequest.current++;
    setFindingEarliest(false);
    setEarliest([]);
    setEarliestError("");
    setSuggestedTime("");
    setDoctorId("");
    setService(s);
    setStep(2);
    setComplete(false);
    document.getElementById("booking")?.scrollIntoView({ behavior: "smooth" });
  }
  return (
    <>
      {error && <Feedback retry={retryCatalog}>{error}</Feedback>}
      <section className="public-services" id="services">
        <div className="section-heading">
          <p className="eyebrow">МАНАЙ ҮЙЛЧИЛГЭЭ</p>
          <h2>Таны инээмсэглэлд зориулсан үйлчилгээ</h2>
          <p>Үйлчилгээгээ хялбар сонгож, өөрт тохирох цагаа аваарай.</p>
        </div>
        <div className="public-category-tabs">
          <button
            className={!category ? "selected" : ""}
            onClick={() => setCategory("")}
          >
            Бүгд
          </button>
          {categories.map((c) => (
            <button
              key={c}
              className={category === c ? "selected" : ""}
              onClick={() => setCategory(c)}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="public-service-grid">
          {loading ? (
            <p className="public-empty">Үйлчилгээ ачаалж байна…</p>
          ) : filtered.length ? (
            filtered.map((s) => (
              <button
                key={s.id}
                className="public-service-card"
                onClick={() => choose(s)}
              >
                {s.imageUrl ? (
                  <span className="service-photo">
                    <Image
                      src={s.imageUrl}
                      alt={s.name || "Үйлчилгээний зураг"}
                      fill
                      unoptimized
                      sizes="(max-width:550px) 100vw, 380px"
                      style={{ objectFit: "cover" }}
                    />
                  </span>
                ) : (
                  <span className="service-symbol">
                    <Stethoscope size={23} />
                  </span>
                )}
                <small>{s.category}</small>
                <h3>{s.name}</h3>
                <p>
                  {s.description ||
                    "Мэргэжлийн багийн чанартай шүдний тусламж үйлчилгээ."}
                </p>
                <div>
                  <strong>{money(s.price || 0)}</strong>
                  <span>
                    Цаг сонгох <ArrowRight size={16} />
                  </span>
                </div>
              </button>
            ))
          ) : (
            <p className="public-empty">
              {error || "Үйлчилгээний мэдээлэл удахгүй нэмэгдэнэ."}
            </p>
          )}
        </div>
      </section>
      <section className="public-doctors" id="doctors">
        <div className="section-heading">
          <p className="eyebrow">МАНАЙ БАГ</p>
          <h2>Таны төлөө мэргэжлийн эмч нар</h2>
          <p>Эрүүл инээмсэглэлийг хамтдаа бүтээе.</p>
        </div>
        <div className="public-doctor-grid">
          {catalog.doctors.length ? (
            catalog.doctors.map((d) => (
              <article className="public-doctor-card" key={d.id}>
                {d.imageUrl ? (
                  <div
                    className="doctor-photo"
                    style={{
                      backgroundImage: `url("${d.imageUrl.replace(/["\\\n]/g, "")}")`,
                    }}
                    role="img"
                    aria-label={d.name}
                  />
                ) : (
                  <div className="doctor-placeholder">
                    <Stethoscope size={43} />
                  </div>
                )}
                <h3>{d.name}</h3>
                <small>{d.specialty}</small>
                <p>{d.bio}</p>
                <button
                  className="button button-outline"
                  onClick={() => {
                    setDoctorId(d.id);
                    document
                      .getElementById("booking")
                      ?.scrollIntoView({ behavior: "smooth" });
                  }}
                >
                  Цаг авах <ArrowRight size={16} />
                </button>
              </article>
            ))
          ) : (
            <p className="public-empty">
              {loading
                ? "Эмчийн мэдээлэл ачаалж байна…"
                : error
                  ? "Эмчийн мэдээлэл ачаалж чадсангүй."
                  : "Эмчийн мэдээлэл удахгүй нэмэгдэнэ."}
            </p>
          )}
        </div>
      </section>
      {suggestionError && (
        <Feedback retry={retrySuggestions}>{suggestionError}</Feedback>
      )}
      {availabilityError && (
        <Feedback retry={retrySlots}>{availabilityError}</Feedback>
      )}
      {slotsLoading && <p role="status">Боломжит цаг ачаалж байна…</p>}
      <section
        className="booking-section"
        id="booking"
        aria-labelledby="booking-title"
      >
        <div className="section-heading">
          <p className="eyebrow">ОНЛАЙН ЦАГ ЗАХИАЛГА</p>
          <h2 id="booking-title">Үзлэгийн цагаа захиалаарай</h2>
          <p>Үйлчилгээгээ сонгоод, өөрт тохирох цагаа баталгаажуулаарай.</p>
        </div>
        <div className="booking-panel">
          <ol className="booking-steps" aria-label="Захиалгын алхмууд">
            {["Үйлчилгээ", "Өдөр, цаг", "Баталгаажуулах"].map((label, i) => (
              <li
                key={label}
                className={step === i + 1 ? "current" : ""}
                aria-current={step === i + 1 ? "step" : undefined}
              >
                <span>{i + 1}</span>
                {label}
              </li>
            ))}
          </ol>
          <div className="booking-content">
            {complete ? (
              <div className="booking-success">
                <span>
                  <Check size={32} />
                </span>
                <h3>Таны захиалга бүртгэгдлээ</h3>
                <p>
                  {service?.name} · {date} · {time}
                </p>
                <p>Эмнэлгийн ажилтан захиалгыг баталгаажуулна.</p>
                <button
                  className="button"
                  onClick={() => {
                    setStep(1);
                    setComplete(false);
                    setService(null);
                    setTime("");
                    setName("");
                    setPhone("");
                  }}
                >
                  Дахин цаг авах
                </button>
              </div>
            ) : (
              <>
                {step === 1 && (
                  <>
                    <h3>Үйлчилгээ сонгох</h3>
                    <div className="search-field">
                      <Search size={22} />
                      <input
                        type="search"
                        aria-label="Үйлчилгээний нэрээр хайх"
                        placeholder="Үйлчилгээний нэрээр хайх..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </div>
                    <div className="category-field">
                      <label htmlFor="service-category">Ангилал</label>
                      <select
                        id="service-category"
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                      >
                        <option value="">Бүх үйлчилгээ</option>
                        {categories.map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                    <div className="booking-service-list">
                      {filtered.map((s) => (
                        <button key={s.id} onClick={() => choose(s)}>
                          <span>
                            <strong>{s.name}</strong>
                            <small>{s.category}</small>
                          </span>
                          <span>
                            {money(s.price || 0)} <ArrowRight size={17} />
                          </span>
                        </button>
                      ))}
                    </div>
                    {!filtered.length && (
                      <p className="empty-state" role="status">
                        {loading
                          ? "Ачаалж байна…"
                          : error || "Үйлчилгээ олдсонгүй."}{" "}
                        <a href={contactTel}>Утсаар цаг авах</a>
                      </p>
                    )}
                  </>
                )}
                {step === 2 && (
                  <>
                    <h3>Эмч, өдөр, цагаа сонгох</h3>
                    <p className="booking-selected-service">
                      {service?.name} · {money(service?.price || 0)}
                    </p>
                    <div className="public-booking-fields">
                      <label>
                        Эмч
                        <select
                          value={doctorId}
                          onChange={(e) => setDoctorId(e.target.value)}
                        >
                          <option value="">Эмч сонгох</option>
                          {suggestions.map(({ doctor: d }) => (
                            <option value={d.id} key={d.id}>
                              {d.name} · {d.specialty}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Үзлэгийн өдөр
                        <input
                          type="date"
                          min={today()}
                          max={`${Number(today().slice(0, 4)) + 1}-12-31`}
                          value={date}
                          onChange={(e) => {
                            setSuggestedTime("");
                            setDate(e.target.value);
                          }}
                        />
                      </label>
                    </div>
                    <div className="suggestion-list" aria-live="polite">
                      <button
                        type="button"
                        disabled={findingEarliest}
                        onClick={async () => {
                          if (!service) return;
                          const request = ++earliestRequest.current;
                          setFindingEarliest(true);
                          setEarliestError("");
                          setEarliest([]);
                          try {
                            const response = await api<{
                              items: typeof earliest;
                            }>(
                              `/api/public/earliest?${new URLSearchParams({ serviceId: service.id, from: today() })}`,
                            );
                            if (request !== earliestRequest.current) return;
                            setEarliest(response.items);
                            if (!response.items.length)
                              setEarliestError(
                                "Ойрын 31 хоногт сул цаг олдсонгүй.",
                              );
                          } catch (e) {
                            if (request === earliestRequest.current)
                              setEarliestError((e as Error).message);
                          } finally {
                            if (request === earliestRequest.current)
                              setFindingEarliest(false);
                          }
                        }}
                      >
                        {findingEarliest
                          ? "Ойрын сул цаг хайж байна…"
                          : "Ойрын 31 хоногийн сул цаг олох"}
                      </button>
                      {earliestError && <p role="status">{earliestError}</p>}
                      {earliest.length > 0 && (
                        <div
                          className="earliest-slots"
                          aria-label="Ойрын сул цагууд"
                        >
                          {earliest.map((slot) => (
                            <button
                              type="button"
                              key={`${slot.doctorId}-${slot.date}-${slot.startTime}`}
                              onClick={() => {
                                setDate(slot.date);
                                setDoctorId(slot.doctorId);
                                setSuggestedTime(slot.startTime);
                              }}
                            >
                              {slot.date} · {slot.startTime} · {slot.doctorName}
                            </button>
                          ))}
                        </div>
                      )}
                      <h4>Танд санал болгох эмч, цаг</h4>
                      {suggesting ? (
                        <p>Боломжит цагийг тооцоолж байна…</p>
                      ) : suggestions.length ? (
                        suggestions.map(({ doctor, slots }) => (
                          <article
                            key={doctor.id}
                            className={doctorId === doctor.id ? "selected" : ""}
                          >
                            <div>
                              <strong>{doctor.name}</strong>
                              <small>{doctor.specialty}</small>
                            </div>
                            <div>
                              {slots.slice(0, 4).map((slot) => (
                                <button
                                  type="button"
                                  key={slot}
                                  onClick={() => {
                                    setDoctorId(doctor.id);
                                    setSuggestedTime(slot);
                                  }}
                                  aria-label={`${doctor.name} ${slot} цагийн сонголт`}
                                >
                                  {slot}
                                </button>
                              ))}
                              <button
                                type="button"
                                onClick={() => setDoctorId(doctor.id)}
                              >
                                Бүх цаг →
                              </button>
                            </div>
                          </article>
                        ))
                      ) : (
                        <p>Энэ өдөр сул цаг алга. Өөр өдөр сонгоно уу.</p>
                      )}
                    </div>
                    <div className="public-time-slots">
                      {slots.map((s) => (
                        <button
                          className={time === s ? "selected" : ""}
                          key={s}
                          onClick={() => setTime(s)}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                    {doctorId && !slots.length && (
                      <p className="empty-state">
                        Сонгосон өдөр боломжит цаг байхгүй байна.
                      </p>
                    )}
                    <div className="booking-navigation">
                      <button onClick={() => setStep(1)}>
                        <ArrowLeft size={16} /> Буцах
                      </button>
                      <button
                        className="button"
                        disabled={!time || !doctorId || suggesting}
                        onClick={() => setStep(3)}
                      >
                        Үргэлжлүүлэх <ArrowRight size={16} />
                      </button>
                    </div>
                  </>
                )}
                {step === 3 && (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      setBusy(true);
                      setBookingError("");
                      try {
                        await api("/api/public/booking", "POST", {
                          name,
                          phone,
                          serviceId: service?.id,
                          doctorId,
                          date,
                          startTime: time,
                        });
                        setComplete(true);
                      } catch (e) {
                        setBookingError((e as Error).message);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    <h3>Захиалгаа баталгаажуулах</h3>
                    <div className="public-booking-summary">
                      <span>{service?.name}</span>
                      <span>
                        {catalog.doctors.find((d) => d.id === doctorId)?.name}
                      </span>
                      <strong>
                        {date} · {time}
                      </strong>
                    </div>
                    <div className="public-booking-fields">
                      <label>
                        Таны нэр
                        <input
                          required
                          value={name}
                          minLength={2}
                          maxLength={100}
                          onChange={(e) => setName(e.target.value)}
                          autoComplete="name"
                        />
                      </label>
                      <label>
                        Утасны дугаар
                        <input
                          type="tel"
                          required
                          pattern="[0-9 +\-]{8,15}"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          autoComplete="tel"
                        />
                      </label>
                    </div>
                    <p className="booking-privacy-note">
                      Эмнэлэг захиалгыг баталгаажуулах зорилгоор таны нэр, утсыг
                      ашиглана.
                    </p>
                    <div className="booking-navigation">
                      <button type="button" onClick={() => setStep(2)}>
                        <ArrowLeft size={16} /> Буцах
                      </button>
                      <button className="button" disabled={busy}>
                        {busy ? "Бүртгэж байна…" : "Захиалга илгээх"}
                        <Check size={17} />
                      </button>
                    </div>
                  </form>
                )}
                {bookingError && (
                  <p className="public-error" role="alert">
                    {bookingError}
                  </p>
                )}
              </>
            )}
          </div>
        </div>
        <div className="lookup-section">
          <button
            className="lookup-toggle"
            onClick={() => {
              setLookup(!lookup);
              setAppointments(null);
              setConfirmed(false);
            }}
          >
            <CalendarDays size={18} />
            Миний захиалгыг харах
          </button>
          {lookup && (
            <div className="lookup-panel">
              <h3>Захиалсан цагаа шалгах</h3>
              <label>
                Утасны дугаар
                <input
                  type="tel"
                  value={lookupPhone}
                  onChange={(e) => {
                    setLookupPhone(e.target.value);
                    setConfirmed(false);
                    setAppointments(null);
                  }}
                  placeholder="8 оронтой утас"
                  autoComplete="tel"
                />
              </label>
              {!confirmed ? (
                <button
                  className="button"
                  disabled={!/^[6-9]\d{7}$/.test(normalizePhone(lookupPhone))}
                  onClick={() => setConfirmed(true)}
                >
                  Үргэлжлүүлэх
                </button>
              ) : (
                <>
                  <p>
                    <strong>{normalizePhone(lookupPhone)}</strong> — энэ дугаар
                    зөв үү?
                  </p>
                  <button
                    className="button"
                    disabled={lookupBusy}
                    onClick={async () => {
                      setLookupBusy(true);
                      setLookupError("");
                      try {
                        const result = await api<{ appointments: Entity[] }>(
                          "/api/public/lookup",
                          "POST",
                          { phone: lookupPhone, confirmed: true },
                        );
                        setAppointments(result.appointments);
                      } catch (e) {
                        setLookupError((e as Error).message);
                      } finally {
                        setLookupBusy(false);
                      }
                    }}
                  >
                    {lookupBusy
                      ? "Шалгаж байна…"
                      : "Тийм, миний захиалгыг харуулах"}
                  </button>
                </>
              )}
              {lookupError && (
                <p role="alert" className="public-error">
                  {lookupError}
                </p>
              )}
              {appointments && (
                <div className="lookup-results">
                  {appointments.length ? (
                    appointments.map((a) => (
                      <div key={a.id}>
                        <strong>{a.service?.name}</strong>
                        <p>
                          {a.date} · {a.startTime} · {a.doctor?.name}
                        </p>
                        <span>{statusNames[a.status || ""]}</span>
                      </div>
                    ))
                  ) : (
                    <p>Энэ дугаар дээр захиалга олдсонгүй.</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
