"use client";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { today } from "@/lib/domain";
import { Feedback, useResource } from "../erp/ui";
import { calendarKeyNavigation } from "./calendar-keyboard";

export default function AvailabilityCalendar({
  serviceId,
  doctorId,
  date,
  onChange,
}: {
  serviceId: string;
  doctorId: string;
  date: string;
  onChange: (date: string) => void;
}) {
  const [view, setView] = useState<{ selected: string; month: string } | null>(
    null,
  );
  const month = view?.selected === date ? view.month : date.slice(0, 7);
  const first = `${month}-01`;
  const count = new Date(
    Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0),
  ).getUTCDate();
  const last = `${month}-${String(count).padStart(2, "0")}`;
  const from = first < today() ? today() : first;
  const days =
    Math.round(
      (Date.parse(`${last}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) /
        86400000,
    ) + 1;
  const { data, loading, error, retry } = useResource<{ dates: string[] }>(
    days > 0
      ? `/api/public/calendar?${new URLSearchParams({ serviceId, ...(doctorId ? { doctorId } : {}), from, days: String(days) })}`
      : null,
  );
  const offset = (new Date(`${first}T12:00:00Z`).getUTCDay() + 6) % 7;
  function move(delta: number) {
    const next = new Date(`${first}T12:00:00Z`);
    next.setUTCMonth(next.getUTCMonth() + delta);
    setView({ selected: date, month: next.toISOString().slice(0, 7) });
  }
  return (
    <div className="availability-calendar">
      <div className="availability-calendar-heading">
        <button
          type="button"
          aria-label="Өмнөх сар"
          disabled={month <= today().slice(0, 7)}
          onClick={() => move(-1)}
        >
          <ChevronLeft size={18} />
        </button>
        <strong>{month}</strong>
        <button type="button" aria-label="Дараах сар" onClick={() => move(1)}>
          <ChevronRight size={18} />
        </button>
      </div>
      <p>
        {doctorId
          ? "Сонгосон эмчийн сул цагтай өдрүүд тодорсон байна."
          : "Цаг авах боломжтой өдрөө сонгоно уу."}
      </p>
      {error && <Feedback retry={retry}>{error}</Feedback>}
      <div
        className="availability-calendar-grid"
        role="group"
        aria-label="Цаг авах боломжтой өдрүүд"
        aria-busy={loading}
        onKeyDown={(e) => calendarKeyNavigation(e, offset)}
      >
        {["Да", "Мя", "Лх", "Пү", "Ба", "Бя", "Ня"].map((d) => (
          <span key={d}>{d}</span>
        ))}
        {Array.from({ length: offset }, (_, i) => (
          <span key={`gap-${i}`} />
        ))}
        {Array.from({ length: count }, (_, i) => {
          const value = `${month}-${String(i + 1).padStart(2, "0")}`;
          const available = !!data?.dates.includes(value);
          return (
            <button
              type="button"
              key={value}
              disabled={loading || !available}
              className={`${available ? "available" : ""} ${date === value ? "selected" : ""}`}
              aria-label={`${value}: ${available ? "сул цагтай" : "боломжгүй"}`}
              aria-pressed={date === value}
              aria-current={value === today() ? "date" : undefined}
              onClick={() => onChange(value)}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
      <p role="status">
        {loading
          ? "Сул өдөр, цагийг шалгаж байна…"
          : !error && !data?.dates.length
            ? "Энэ сард сул цаг алга. Дараах сарыг шалгана уу."
            : "Идэвхгүй өдрүүдэд цаг авах боломжгүй."}
      </p>
    </div>
  );
}
