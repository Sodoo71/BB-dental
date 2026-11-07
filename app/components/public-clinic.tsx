"use client";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import ServiceBrowser from "./service-browser";
import BookingContactForm from "./booking-contact-form";
import AvailabilityCalendar from "./availability-calendar";
import { ArrowLeft, ArrowRight, CalendarDays, Check } from "lucide-react";
import { api, Feedback, useResource, type Entity } from "../erp/ui";
import { money, normalizePhone, statusNames, today } from "@/lib/domain";

type Catalog = {
  services: Entity[];
  doctors: Entity[];
  clinic?: Record<string, string>;
};
export default function PublicClinic() {
  const searchParams = useSearchParams();
  const initialService = searchParams.get("service");
  const initialDoctor = searchParams.get("doctor") || "";
  const initialized = useRef<string | null>(null);
  const initialQuery = searchParams.toString();
  const {
    data: catalogData,
    error,
    loading,
    retry: retryCatalog,
  } = useResource<Catalog>("/api/public/catalog");
  const catalog = catalogData || { services: [], doctors: [] };
  const [step, setStep] = useState(1);
  const [service, setService] = useState<Entity | null>(null);
  const [doctorId, setDoctorId] = useState(initialDoctor);
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
  const [complete, setComplete] = useState(false);
  const [lookup, setLookup] = useState(false);
  const [lookupPhone, setLookupPhone] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [appointments, setAppointments] = useState<Entity[] | null>(null);
  const [lookupError, setLookupError] = useState("");
  const [lookupBusy, setLookupBusy] = useState(false);
  useEffect(() => {
    if (!catalogData || initialized.current === initialQuery) return;
    initialized.current = initialQuery;
    const selected = catalogData.services.find((s) => s.id === initialService);
    const doctor = catalogData.doctors.find((d) => d.id === initialDoctor);
    setService(selected || null);
    setStep(selected ? 2 : 1);
    setComplete(false);
    setDoctorId(
      doctor &&
        (!selected?.doctorIds?.length || selected.doctorIds.includes(doctor.id))
        ? doctor.id
        : "",
    );
  }, [catalogData, initialQuery, initialService, initialDoctor]);
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
  function choose(s: Entity) {
    earliestRequest.current++;
    setFindingEarliest(false);
    setEarliest([]);
    setEarliestError("");
    setSuggestedTime("");
    setDoctorId((id) =>
      !s.doctorIds?.length || s.doctorIds.includes(id) ? id : "",
    );
    setService(s);
    setStep(2);
    setComplete(false);
    document.getElementById("booking")?.scrollIntoView({ behavior: "smooth" });
  }
  return (
    <>
      {error && <Feedback retry={retryCatalog}>{error}</Feedback>}
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
          <h1 id="booking-title">Үзлэгийн цагаа захиалаарай</h1>
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
                    <ServiceBrowser
                      services={catalog.services}
                      loading={loading}
                      onSelect={choose}
                    />
                    {error && (
                      <p className="empty-state">
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
                          onChange={(e) => {
                            earliestRequest.current++;
                            setEarliest([]);
                            setEarliestError("");
                            setFindingEarliest(false);
                            setSuggestedTime("");
                            setDoctorId(e.target.value);
                          }}
                        >
                          <option value="">Өдрөөр хайх · Бүх эмч</option>
                          {catalog.doctors
                            .filter(
                              (d) =>
                                !service?.doctorIds?.length ||
                                service.doctorIds.includes(d.id),
                            )
                            .map((d) => (
                              <option value={d.id} key={d.id}>
                                {d.name} · {d.specialty}
                              </option>
                            ))}
                        </select>
                      </label>
                    </div>
                    {service && (
                      <AvailabilityCalendar
                        serviceId={service.id}
                        doctorId={doctorId}
                        date={date}
                        onChange={(value) => {
                          setSuggestedTime("");
                          setDate(value);
                        }}
                      />
                    )}
                    <p className="booking-selected-date">
                      Сонгосон өдөр: {date}
                    </p>
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
                              `/api/public/earliest?${new URLSearchParams({ serviceId: service.id, ...(doctorId ? { doctorId } : {}), from: today() })}`,
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
                      <h4>Энэ өдөр цаг авч болох эмч нарын жагсаалт:</h4>
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
                    {doctorId && <h4>Сонгосон эмчийн боломжтой цаг</h4>}
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
                  <BookingContactForm
                    onBack={() => setStep(2)}
                    onSubmit={async (contact) => {
                      await api("/api/public/booking", "POST", {
                        ...contact,
                        serviceId: service?.id,
                        doctorId,
                        date,
                        startTime: time,
                      });
                      setComplete(true);
                    }}
                    summary={
                      <div className="public-booking-summary">
                        <span>{service?.name}</span>
                        <span>
                          {catalog.doctors.find((d) => d.id === doctorId)?.name}
                        </span>
                        <strong>
                          {date} · {time}
                        </strong>
                      </div>
                    }
                  />
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
