"use client";
import { useState, type FormEvent } from "react";
import { today } from "@/lib/domain";
import { api, useModalGuard, type Entity } from "./ui";
import { useUser } from "./shell";

export default function WorkDayForm({
  doctors,
  date: initialDate,
  initial,
  onCancel,
  onSaved,
}: {
  doctors: Entity[];
  date: string;
  initial?: Entity;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const user = useUser();
  const [doctorId, setDoctorId] = useState(
    initial?.doctorId || user.doctorId || doctors[0]?.id || "",
  );
  const [date, setDate] = useState(
    initialDate < today() ? today() : initialDate,
  );
  const [startTime, setStartTime] = useState(initial?.startTime || "09:00");
  const [endTime, setEndTime] = useState(initial?.endTime || "18:00");
  const [reason, setReason] = useState(initial?.reason || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const close = useModalGuard(busy);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (startTime >= endTime) {
      setError("Эхлэх цаг дуусах цагаас өмнө байна.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api(
        `/api/erp/leaves${initial?.id ? `/${initial.id}` : ""}`,
        initial?.id ? "PATCH" : "POST",
        {
          doctorId,
          date,
          startTime,
          endTime,
          kind: "SCHEDULE_OVERRIDE",
          reason: reason.trim() || "Ажиллах боломжтой өдөр, цаг",
        },
      );
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="schedule-editor" onSubmit={submit}>
      <fieldset disabled={busy}>
        <p>
          {user.role === "ADMIN"
            ? "Хадгалсан хуваарь шууд батлагдаж, цаг захиалгад харагдана."
            : "Админ баталсны дараа албан ёсны хуваарь болж, цаг захиалгад харагдана."}
        </p>
        <label>
          Эмч
          <select
            required
            value={doctorId}
            disabled={user.role === "DOCTOR" || !!initial?.id}
            onChange={(e) => setDoctorId(e.target.value)}
          >
            {doctors.map((d) => (
              <option value={d.id} key={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Ажиллах өдөр
          <input
            type="date"
            disabled={!!initial}
            required
            min={today()}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <div className="work-time-presets">
          {[
            ["09:00", "18:00"],
            ["09:00", "13:00"],
            ["14:00", "18:00"],
          ].map(([start, end]) => (
            <button
              type="button"
              key={start + end}
              aria-pressed={startTime === start && endTime === end}
              onClick={() => {
                setStartTime(start);
                setEndTime(end);
              }}
            >
              {start}–{end}
            </button>
          ))}
        </div>
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
        <label>
          Тайлбар
          <input
            value={reason}
            maxLength={2000}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
        {error && (
          <p role="alert" className="erp-alert">
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
          <button className="erp-primary" disabled={!doctorId}>
            {busy
              ? "Хадгалж байна…"
              : user.role === "ADMIN"
                ? "Хуваарь баталж хадгалах"
                : "Хүсэлт илгээх"}
          </button>
        </div>
      </fieldset>
    </form>
  );
}
