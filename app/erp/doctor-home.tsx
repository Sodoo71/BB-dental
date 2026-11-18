"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import {
  ArrowUpRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  NotebookPen,
  Plus,
  RefreshCw,
  Stethoscope,
  UsersRound,
} from "lucide-react";
import { clinicTimestamp, today } from "@/lib/domain";
import { patientAge } from "@/lib/patient-demographics";
import { useUser } from "./shell";
import { api, Badge, Feedback, useResource, type Entity } from "./ui";

type Visit = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  note: string;
  patient: { id: string; name: string };
  service: { name: string };
};

type Summary = {
  appointmentCount: number;
  newPatients: number;
  returningPatients: number;
  upcoming: Pick<Visit, "id" | "date" | "startTime" | "patient" | "service">[];
};

const weekdays = [
  "Даваа",
  "Мягмар",
  "Лхагва",
  "Пүрэв",
  "Баасан",
  "Бямба",
  "Ням",
];
const asDate = (value: string) => new Date(value + "T12:00:00Z");
function shortDate(value: string) {
  return Number(value.slice(5, 7)) + "-р сарын " + Number(value.slice(8));
}
function dayLabel(value: string) {
  return (
    shortDate(value) + " · " + weekdays[(asDate(value).getUTCDay() + 6) % 7]
  );
}
const calendarHref = (date: string) => "/erp/calendar?date=" + date;
const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

export default function DoctorHome() {
  const user = useUser();
  const currentDay = today();
  const [day, setDay] = useState(currentDay);
  const [month, setMonth] = useState(currentDay.slice(0, 7));
  const [selected, setSelected] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [year, monthIndex] = month.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(year, monthIndex, 0)).getUTCDate();
  const first = (asDate(month + "-01").getUTCDay() + 6) % 7;
  const summary = useResource<Summary>(
    "/api/erp/dashboard?period=day&view=doctor-home",
    refresh,
  );
  const calendar = useResource<{ items: Visit[] }>(
    "/api/erp/appointments?view=calendar&from=" +
      month +
      "-01&to=" +
      month +
      "-" +
      daysInMonth,
    refresh,
  );
  const visits = (calendar.data?.items ?? []).filter(
    (visit) => !["CANCELLED", "NO_SHOW"].includes(visit.status),
  );
  const busyDays = new Set(visits.map((visit) => visit.date));
  const available = visits.filter((visit) => visit.date === day);
  const visit = available.find((item) => item.id === selected) ?? available[0];
  const patient = useResource<Entity>(
    visit ? "/api/erp/patients/" + visit.patient.id : null,
  );
  const treatment = patient.data?.treatments?.[0];
  const age = patientAge(patient.data?.birthDate ?? "");

  function moveMonth(offset: number) {
    const next = new Date(Date.UTC(year, monthIndex - 1 + offset, 1))
      .toISOString()
      .slice(0, 7);
    setMonth(next);
    setDay(next === currentDay.slice(0, 7) ? currentDay : next + "-01");
    setSelected("");
  }

  function chooseDay(value: string) {
    setDay(value);
    setSelected("");
  }

  return (
    <div className="doctor-home-dashboard">
      <header className="doctor-home-heading">
        <div>
          <p>{dayLabel(currentDay)}</p>
          <h1>Сайн байна уу, {user.name}</h1>
        </div>
        <button
          type="button"
          className="doctor-home-icon-button"
          onClick={() => setRefresh((value) => value + 1)}
          aria-label="Шинэчлэх"
          title="Шинэчлэх"
        >
          <RefreshCw size={18} aria-hidden="true" />
          <span>Шинэчлэх</span>
        </button>
      </header>

      <div className="doctor-home-layout">
        <div className="doctor-home-column">
          <section
            className="doctor-home-hero"
            aria-labelledby="doctor-overview-heading"
          >
            <Image
              src="/images/doctor-overview.webp"
              alt=""
              fill
              unoptimized
              sizes="(max-width: 700px) 95vw, 55vw"
              className="doctor-home-hero-image"
            />
            <div className="doctor-home-hero-content">
              <h2 id="doctor-overview-heading">Өнөөдрийн үзлэг</h2>
              <div className="doctor-home-hero-total">
                <strong>{summary.data?.appointmentCount ?? "—"}</strong>
                <span>үзлэг</span>
              </div>
              {summary.error && (
                <p role="alert">Үзлэгийн тоог ачаалж чадсангүй.</p>
              )}
              <div className="doctor-home-hero-metrics">
                <div>
                  <span>Шинэ өвчтөн</span>
                  <strong>{summary.data?.newPatients ?? "—"}</strong>
                </div>
                <div>
                  <span>Давтан өвчтөн</span>
                  <strong>{summary.data?.returningPatients ?? "—"}</strong>
                </div>
              </div>
            </div>
          </section>

          <div className="doctor-home-clinical">
            <section
              className="doctor-home-card"
              aria-labelledby="doctor-visits-heading"
            >
              <div className="doctor-home-card-heading">
                <div>
                  <h2 id="doctor-visits-heading">Өвчтөний жагсаалт</h2>
                  <p>{dayLabel(day)}</p>
                </div>
                <UsersRound size={20} aria-hidden="true" />
              </div>
              {calendar.error ? (
                <Feedback retry={calendar.retry}>{calendar.error}</Feedback>
              ) : calendar.loading ? (
                <p className="doctor-home-empty" role="status">
                  Үзлэгүүдийг ачаалж байна…
                </p>
              ) : available.length ? (
                <ul className="doctor-home-patient-list">
                  {available.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        aria-pressed={visit?.id === item.id}
                        onClick={() => setSelected(item.id)}
                      >
                        <span
                          className="doctor-home-initials"
                          aria-hidden="true"
                        >
                          {initials(item.patient.name)}
                        </span>
                        <span className="doctor-home-patient-text">
                          <strong>{item.patient.name}</strong>
                          <small>{item.service.name}</small>
                        </span>
                        <span className="doctor-home-visit-action">
                          <time>{item.startTime}</time>
                          <small>Үзлэг харах</small>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="doctor-home-empty">
                  Сонгосон өдөр үзлэг товлоогүй байна.
                </p>
              )}
            </section>

            <section
              className="doctor-home-card"
              aria-labelledby="doctor-consultation-heading"
            >
              <div className="doctor-home-card-heading">
                <h2 id="doctor-consultation-heading">Үзлэгийн мэдээлэл</h2>
                <Stethoscope size={20} aria-hidden="true" />
              </div>
              {visit ? (
                <>
                  <div className="doctor-home-patient-identity">
                    <span className="doctor-home-initials" aria-hidden="true">
                      {initials(visit.patient.name)}
                    </span>
                    <div>
                      <strong>{visit.patient.name}</strong>
                      {age !== null && <small>{age} настай</small>}
                    </div>
                  </div>
                  <dl className="doctor-home-detail">
                    <div>
                      <dt>Үйлчилгээ</dt>
                      <dd>{visit.service.name}</dd>
                    </div>
                    <div>
                      <dt>Үзлэгийн цаг</dt>
                      <dd>
                        {visit.startTime}–{visit.endTime}
                      </dd>
                    </div>
                    <div>
                      <dt>Төлөв</dt>
                      <dd>
                        <Badge value={visit.status} />
                      </dd>
                    </div>
                    {visit.note && (
                      <div>
                        <dt>Захиалгын тайлбар</dt>
                        <dd>{visit.note}</dd>
                      </div>
                    )}
                    {treatment && (
                      <div>
                        <dt>Сүүлийн эмчилгээ</dt>
                        <dd>
                          {treatment.diagnosis ||
                            treatment.procedure ||
                            treatment.service?.name}
                          <small>{treatment.date}</small>
                        </dd>
                      </div>
                    )}
                  </dl>
                  <Link
                    className="doctor-home-text-link"
                    href={`/erp/patients?patient=${encodeURIComponent(visit.patient.id)}`}
                  >
                    <ArrowUpRight size={15} aria-hidden="true" />
                    Өвчтөний карт
                  </Link>
                </>
              ) : (
                <p className="doctor-home-empty">
                  Үзлэг сонгоход дэлгэрэнгүй харагдана.
                </p>
              )}
            </section>
          </div>
        </div>

        <div className="doctor-home-column">
          <section
            className="doctor-home-card"
            aria-labelledby="doctor-calendar-heading"
          >
            <div className="doctor-home-card-heading">
              <h2 id="doctor-calendar-heading">Миний хуваарь</h2>
              <CalendarDays size={20} aria-hidden="true" />
            </div>
            <div className="doctor-home-month">
              <strong aria-live="polite">
                {year} оны {monthIndex}-р сар
              </strong>
              <div>
                <button
                  className="doctor-home-icon-button"
                  type="button"
                  onClick={() => moveMonth(-1)}
                  aria-label="Өмнөх сар"
                >
                  <ChevronLeft size={17} aria-hidden="true" />
                  <span>Өмнөх сар</span>
                </button>
                <button
                  className="doctor-home-icon-button"
                  type="button"
                  onClick={() => moveMonth(1)}
                  aria-label="Дараах сар"
                >
                  <ChevronRight size={17} aria-hidden="true" />
                  <span>Дараах сар</span>
                </button>
              </div>
            </div>
            <div className="doctor-home-calendar" aria-label="Сарын огноо">
              {weekdays.map((weekday) => (
                <span
                  key={weekday.slice(0, 2)}
                  className="doctor-home-weekday"
                  aria-hidden="true"
                >
                  {weekday.slice(0, 2)}
                </span>
              ))}
              {Array.from({ length: first }, (_, i) => (
                <span key={i} aria-hidden="true" />
              ))}
              {Array.from({ length: daysInMonth }, (_, i) => {
                const date = month + "-" + String(i + 1).padStart(2, "0");
                const busy = busyDays.has(date);
                return (
                  <button
                    key={date}
                    type="button"
                    aria-label={dayLabel(date) + (busy ? " · үзлэгтэй" : "")}
                    aria-current={date === currentDay ? "date" : undefined}
                    aria-pressed={date === day}
                    data-busy={busy || undefined}
                    onClick={() => chooseDay(date)}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>

            <div className="doctor-home-upcoming">
              <div className="doctor-home-card-heading">
                <h3>Удахгүй болох үзлэг</h3>
                <Link
                  className="doctor-home-text-link"
                  href={calendarHref(day)}
                >
                  <ArrowUpRight size={15} aria-hidden="true" />
                  Календарь нээх
                </Link>
              </div>
              {summary.data?.upcoming.length ? (
                <ul>
                  {summary.data.upcoming.map((item) => (
                    <li key={item.id}>
                      <Link href={calendarHref(item.date)}>
                        <span
                          className="doctor-home-upcoming-icon"
                          aria-hidden="true"
                        >
                          <Clock3 size={16} />
                        </span>
                        <span>
                          <strong>{item.patient.name}</strong>
                          <small>
                            {item.service.name} · {shortDate(item.date)},{" "}
                            {item.startTime}
                          </small>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="doctor-home-empty">
                  {summary.loading
                    ? "Ачаалж байна…"
                    : summary.error
                      ? "Товлолыг ачаалж чадсангүй."
                      : "Удахгүй болох товлол алга."}
                </p>
              )}
            </div>
          </section>

          <section
            className="doctor-home-card"
            aria-labelledby="doctor-notes-heading"
          >
            <div className="doctor-home-card-heading">
              <h2 id="doctor-notes-heading">Эмчийн тэмдэглэл</h2>
              <NotebookPen size={20} aria-hidden="true" />
            </div>
            {patient.error ? (
              <Feedback retry={patient.retry}>{patient.error}</Feedback>
            ) : patient.data ? (
              <DoctorNotes
                key={patient.data.id}
                patient={patient.data}
                refresh={patient.retry}
              />
            ) : (
              <p className="doctor-home-empty">
                {patient.loading
                  ? "Тэмдэглэлийг ачаалж байна…"
                  : "Өвчтөн сонгоод тэмдэглэлээ харах эсвэл нэмээрэй."}
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function DoctorNotes({
  patient,
  refresh,
}: {
  patient: Entity;
  refresh: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!content.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      await api("/api/erp/patient-notes", "POST", {
        patientId: patient.id,
        content,
      });
      setContent("");
      setOpen(false);
      refresh();
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="doctor-home-notes-patient">
        <strong>{patient.name}</strong>
        <button
          type="button"
          className="doctor-home-text-link"
          aria-expanded={open}
          aria-controls="doctor-note-editor"
          onClick={() => setOpen((value) => !value)}
          disabled={busy}
        >
          <Plus size={16} aria-hidden="true" /> Тэмдэглэл нэмэх
        </button>
      </div>
      {open && (
        <form
          id="doctor-note-editor"
          className="doctor-home-note-form"
          onSubmit={save}
        >
          <textarea
            aria-label="Дотоод тэмдэглэл"
            placeholder="Дотоод тэмдэглэл…"
            rows={3}
            maxLength={10000}
            required
            value={content}
            onChange={(event) => setContent(event.target.value)}
          />
          {error && <p role="alert">{error}</p>}
          <button
            type="submit"
            className="erp-primary"
            disabled={!content.trim() || busy}
          >
            {busy ? "Хадгалж байна…" : "Хадгалах"}
          </button>
        </form>
      )}
      {patient.notes?.length ? (
        <ul className="doctor-home-notes-list">
          {patient.notes.slice(0, 3).map((note) => (
            <li key={note.id}>
              <p>{note.content}</p>
              <small>
                {note.author?.name}
                {note.createdAt && " · " + clinicTimestamp(note.createdAt)}
              </small>
            </li>
          ))}
        </ul>
      ) : (
        <p className="doctor-home-empty">Тэмдэглэл бүртгэгдээгүй байна.</p>
      )}
    </>
  );
}
