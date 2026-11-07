"use client";

import { useState, type FormEvent } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { today } from "@/lib/domain";
import { api, useModalGuard, type Entity } from "./ui";
import { calendarKeyNavigation } from "../components/calendar-keyboard";
import { useUser } from "./shell";

const weekdays = [
  "Ням",
  "Даваа",
  "Мягмар",
  "Лхагва",
  "Пүрэв",
  "Баасан",
  "Бямба",
];
const weekday = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay();

export default function ScheduleForm({
  doctors,
  initial,
  onCancel,
  onSaved,
}: {
  doctors: Entity[];
  initial?: Entity;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const user = useUser();
  const [month, setMonth] = useState(today().slice(0, 7));
  const [selectedDay, setSelectedDay] = useState(
    initial?.weekday ?? weekday(today()),
  );
  const [doctorId, setDoctorId] = useState(
    initial?.doctorId ||
      user.doctorId ||
      (doctors.length === 1 ? doctors[0].id : ""),
  );
  const [startTime, setStartTime] = useState(initial?.startTime || "09:00");
  const [endTime, setEndTime] = useState(initial?.endTime || "19:00");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const close = useModalGuard(busy);
  const first = new Date(`${month}-01T12:00:00Z`);
  const offset = (first.getUTCDay() + 6) % 7;
  const days = new Date(
    Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0),
  ).getUTCDate();
  function move(delta: number) {
    const next = new Date(`${month}-01T12:00:00Z`);
    next.setUTCMonth(next.getUTCMonth() + delta);
    setMonth(next.toISOString().slice(0, 7));
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!doctorId) return setError("Эмчээ сонгоно уу.");
    if (startTime >= endTime)
      return setError("Эхлэх цаг дуусах цагаас өмнө байна.");
    setBusy(true);
    try {
      await api(
        `/api/erp/schedules${initial ? `/${initial.id}` : ""}`,
        initial ? "PATCH" : "POST",
        {
          doctorId,
          weekday: selectedDay,
          startTime,
          endTime,
        },
      );
      onSaved();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Хуваарь хадгалахад алдаа гарлаа.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="schedule-editor" onSubmit={submit}>
      <fieldset disabled={busy}>
        <label>
          Эмч
          <select
            aria-label="Эмч"
            required
            value={doctorId}
            disabled={Boolean(initial) || user.role === "DOCTOR"}
            onChange={(e) => setDoctorId(e.target.value)}
          >
            <option value="">Эмч сонгох</option>
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
            {doctorId && !doctors.some((d) => d.id === doctorId) && (
              <option value={doctorId}>
                {initial?.doctor?.name ||
                  (user.role === "DOCTOR" ? user.name : "Сонгосон эмч")}
              </option>
            )}
          </select>
        </label>
        <div className="schedule-calendar">
          <div className="roster-month">
            <button
              type="button"
              aria-label="Хуваарь сонгох өмнөх сар"
              onClick={() => move(-1)}
            >
              <ChevronLeft size={18} />
            </button>
            <label>
              <input
                aria-label="Хуваарь сонгох сар"
                type="month"
                required
                value={month}
                onChange={(e) => {
                  if (e.target.value) setMonth(e.target.value);
                }}
              />
            </label>
            <button
              type="button"
              aria-label="Хуваарь сонгох дараах сар"
              onClick={() => move(1)}
            >
              <ChevronRight size={18} />
            </button>
          </div>
          <p id="schedule-calendar-help">
            Календарь дээр ажиллах гарагаа сонгоно уу. Сонгосон гараг долоо
            хоног бүр давтагдана.
          </p>
          <div className="roster-weekdays" aria-hidden="true">
            {["Да", "Мя", "Лх", "Пү", "Ба", "Бя", "Ня"].map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <div
            className="schedule-calendar-days"
            onKeyDown={(event) => calendarKeyNavigation(event, offset)}
            role="group"
            aria-label="Ажиллах гараг сонгох календарь"
            aria-describedby="schedule-calendar-help"
          >
            {Array.from({ length: offset }, (_, i) => (
              <span key={`gap-${i}`} />
            ))}
            {Array.from({ length: days }, (_, i) => {
              const date = `${month}-${String(i + 1).padStart(2, "0")}`;
              const day = weekday(date);
              return (
                <button
                  type="button"
                  key={date}
                  aria-label={`${date}, ${weekdays[day]}`}
                  aria-pressed={selectedDay === day}
                  aria-current={date === today() ? "date" : undefined}
                  onClick={() => setSelectedDay(day)}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
        </div>
        <div className="schedule-time-fields">
          <label>
            Эхлэх цаг
            <input
              type="time"
              required
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </label>
          <label>
            Дуусах цаг
            <input
              type="time"
              required
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </label>
        </div>
        <div className="schedule-summary" role="status">
          <CalendarDays size={20} />
          <span>
            Долоо хоног бүрийн <strong>{weekdays[selectedDay]}</strong>
            <small>
              {startTime}–{endTime}
            </small>
          </span>
        </div>
        {error && (
          <p className="erp-alert" role="alert">
            {error}
          </p>
        )}
        <div className="form-actions">
          <button
            type="button"
            className="erp-secondary"
            onClick={close || onCancel}
          >
            Болих
          </button>
          <button type="submit" className="erp-primary">
            {busy ? "Хадгалж байна…" : "Хадгалах"}
          </button>
        </div>
      </fieldset>
    </form>
  );
}
