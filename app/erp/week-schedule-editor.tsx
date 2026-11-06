"use client";
import { useState, type FormEvent } from "react";
import { api, useModalGuard, type Entity } from "./ui";
import { useUser } from "./shell";

type Doctor = Entity & { schedules: Entity[] };
const labels = ["Ням", "Даваа", "Мягмар", "Лхагва", "Пүрэв", "Баасан", "Бямба"];
function week(doctor?: Doctor) {
  return Array.from({ length: 7 }, (_, weekday) => {
    const saved = doctor?.schedules.find((s) => s.weekday === weekday);
    return {
      weekday,
      off: !saved,
      startTime: saved?.startTime || "09:00",
      endTime: saved?.endTime || "18:00",
    };
  });
}
export default function WeekScheduleEditor({
  doctors,
  onCancel,
  onSaved,
}: {
  doctors: Doctor[];
  onCancel: () => void;
  onSaved: () => void;
}) {
  const user = useUser();
  const [doctorId, setDoctorId] = useState(
    user.doctorId || doctors[0]?.id || "",
  );
  const [days, setDays] = useState(() =>
    week(doctors.find((d) => d.id === doctorId)),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const close = useModalGuard(busy, { doctorId, days });
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/api/erp/schedule-week", "POST", { doctorId, days });
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
        <label>
          Эмч
          <select
            aria-label="Долоо хоногийн хуваарийн эмч"
            value={doctorId}
            required
            disabled={user.role === "DOCTOR"}
            onChange={(e) => {
              setDoctorId(e.target.value);
              setDays(week(doctors.find((d) => d.id === e.target.value)));
            }}
          >
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <p>
          Бүх долоо хоногт давтагдана. Ажиллахгүй гарагийг унтраана. Өмнөх
          захиалгатай зөрчилдвөл бүх өөрчлөлт буцна.
        </p>
        <div className="week-presets">
          <button
            type="button"
            className="erp-secondary"
            onClick={() =>
              setDays(
                days.map((d) => ({
                  ...d,
                  off: d.weekday === 0 || d.weekday === 6,
                  startTime: "09:00",
                  endTime: "18:00",
                })),
              )
            }
          >
            Даваа–Баасан 09:00–18:00
          </button>
          <button
            type="button"
            className="erp-secondary"
            onClick={() => {
              const monday = days[1];
              setDays(
                days.map((d) =>
                  d.off
                    ? d
                    : {
                        ...d,
                        startTime: monday.startTime,
                        endTime: monday.endTime,
                      },
                ),
              );
            }}
          >
            Даваагийн цагийг ажиллах гарагуудад хуулах
          </button>
        </div>
        <div className="week-editor-days">
          {[1, 2, 3, 4, 5, 6, 0].map((i) => (
            <div className="week-editor-row" key={i}>
              <label>
                <input
                  type="checkbox"
                  checked={!days[i].off}
                  onChange={(e) =>
                    setDays(
                      days.map((d) =>
                        d.weekday === i ? { ...d, off: !e.target.checked } : d,
                      ),
                    )
                  }
                />
                {labels[i]}
              </label>
              <input
                type="time"
                required
                disabled={days[i].off}
                aria-label={`${labels[i]} эхлэх цаг`}
                value={days[i].startTime}
                onChange={(e) =>
                  setDays(
                    days.map((d) =>
                      d.weekday === i ? { ...d, startTime: e.target.value } : d,
                    ),
                  )
                }
              />
              <input
                type="time"
                required
                disabled={days[i].off}
                aria-label={`${labels[i]} дуусах цаг`}
                value={days[i].endTime}
                onChange={(e) =>
                  setDays(
                    days.map((d) =>
                      d.weekday === i ? { ...d, endTime: e.target.value } : d,
                    ),
                  )
                }
              />
            </div>
          ))}
        </div>
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
            {busy ? "Хадгалж байна…" : "Долоо хоногийг хадгалах"}
          </button>
        </div>
      </fieldset>
    </form>
  );
}
