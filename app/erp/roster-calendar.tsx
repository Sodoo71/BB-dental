"use client";
import { useEffect, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  Users,
} from "lucide-react";
import {
  api,
  useResource,
  Feedback,
  EntityForm,
  Modal,
  type Entity,
} from "./ui";
import { calendarKeyNavigation } from "../components/calendar-keyboard";
import { useUser } from "./shell";
import { today, statusNames } from "@/lib/domain";
import {
  workIntervals,
  leaveKindNames,
  leaveStatusNames,
} from "@/lib/work-schedule";
import WeekScheduleEditor from "./week-schedule-editor";
type RosterDoctor = Entity & {
  schedules: Entity[];
  leaves: Entity[];
  appointments: Entity[];
};
type Roster = { doctors: RosterDoctor[]; nurses: Entity[] };
const weekdays = [
  "Ням",
  "Даваа",
  "Мягмар",
  "Лхагва",
  "Пүрэв",
  "Баасан",
  "Бямба",
];
export default function RosterCalendar() {
  const user = useUser();
  const [month, setMonth] = useState(today().slice(0, 7));
  const [day, setDay] = useState(today());
  const [doctor, setDoctor] = useState<RosterDoctor | null>(null);
  const [adding, setAdding] = useState(false);
  const [editingWeek, setEditingWeek] = useState(false);
  const [actionError, setError] = useState("");
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const refresh = () => setVersion((v) => v + 1);
    window.addEventListener("bb-roster-update", refresh);
    return () => window.removeEventListener("bb-roster-update", refresh);
  }, []);
  const count = new Date(`${month}-01T12:00:00Z`);
  count.setUTCMonth(count.getUTCMonth() + 1, 0);
  const end = count.toISOString().slice(0, 10);
  const offset = (new Date(`${month}-01T12:00:00Z`).getUTCDay() + 6) % 7;
  const {
    data: response,
    error: loadError,
    loading,
    retry,
  } = useResource<Roster>(
    `/api/erp/roster?from=${month}-01&to=${end}`,
    version,
  );
  const error = loadError || actionError;
  const data = response || { doctors: [], nurses: [] };
  function shift(date: string, d: RosterDoctor) {
    const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
    const schedule = d.schedules.find((s) => s.weekday === weekday);
    const intervals = workIntervals(
      schedule
        ? { startTime: schedule.startTime!, endTime: schedule.endTime! }
        : null,
      d.leaves
        .filter((l) => l.date === date)
        .map((l) => ({
          startTime: l.startTime!,
          endTime: l.endTime!,
          kind: l.kind,
          status: l.status,
        })),
    );
    return intervals.length
      ? intervals.map((i) => ({ start: i.startTime, end: i.endTime }))
      : null;
  }

  function move(delta: number) {
    const date = new Date(`${month}-01T12:00:00Z`);
    date.setUTCMonth(date.getUTCMonth() + delta);
    const next = date.toISOString().slice(0, 7);
    setMonth(next);
    setDay(`${next}-01`);
  }
  const doctors = data.doctors.filter((d) => shift(day, d));
  const nurses = data.nurses.filter((n) => n.date === day);
  return (
    <section className="roster-panel erp-panel">
      <div className="roster-heading">
        <div>
          <p className="eyebrow">БАГИЙН АЖЛЫН ХУВААРЬ</p>
          <h2>
            <CalendarDays size={22} /> Хэн, хэзээ ажиллах вэ?
          </h2>
          <p>
            {user.role === "DOCTOR"
              ? "Таны ажиллах өдөр, үзлэг болон чөлөөний нэгдсэн харагдац."
              : "Өдрөө сонгоод ажиллах баг, эмчийн дэлгэрэнгүй хуваарийг харна уу."}
          </p>
        </div>
        <div className="roster-month">
          {user.role !== "RECEPTION" && (
            <button
              className="erp-secondary"
              disabled={loading || !data.doctors.length}
              onClick={() => setEditingWeek(true)}
            >
              Долоо хоног засах
            </button>
          )}
          <button aria-label="Өмнөх сар" onClick={() => move(-1)}>
            <ChevronLeft size={18} />
          </button>
          <input
            aria-label="Хуваарийн сар"
            type="month"
            value={month}
            onChange={(e) => {
              if (e.target.value) {
                setMonth(e.target.value);
                setDay(`${e.target.value}-01`);
              }
            }}
          />
          <button aria-label="Дараах сар" onClick={() => move(1)}>
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
      {error && (
        <Feedback
          retry={() => {
            setError("");
            retry();
          }}
        >
          {error}
        </Feedback>
      )}
      <div className="roster-layout">
        <div>
          <div className="roster-weekdays">
            {["Да", "Мя", "Лх", "Пү", "Ба", "Бя", "Ня"].map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <div
            className="roster-days"
            role="group"
            aria-label={`${month} · Өдөр сонгох`}
            aria-busy={loading}
            onKeyDown={(event) => calendarKeyNavigation(event, offset)}
          >
            {Array.from({ length: offset }, (_, i) => (
              <span key={`gap-${i}`} />
            ))}
            {Array.from({ length: count.getUTCDate() }, (_, i) => {
              const date = `${month}-${String(i + 1).padStart(2, "0")}`;
              const ds = data.doctors.filter((d) => shift(date, d));
              const ns = new Set(
                data.nurses.filter((n) => n.date === date).map((n) => n.name),
              ).size;
              return (
                <button
                  key={date}
                  className={`${day === date ? "selected" : ""} ${date === today() ? "today" : ""}`}
                  onClick={() => setDay(date)}
                  aria-label={`${date}: ${ds.length} эмч, ${ns} сувилагч`}
                  aria-current={date === today() ? "date" : undefined}
                  aria-pressed={day === date}
                >
                  <strong>{i + 1}</strong>
                  {loading ? (
                    <small>…</small>
                  ) : (
                    <>
                      <span>
                        {ds.length} <i>эмч</i>
                      </span>
                      <small>
                        {ns} <i>сувилагч</i>
                      </small>
                    </>
                  )}
                </button>
              );
            })}
          </div>
        </div>
        <aside className="roster-day-detail">
          <div className="panel-title">
            <h3>{day}</h3>
            <Users size={18} />
          </div>
          <p>
            {loading
              ? "Хуваарь ачаалж байна…"
              : `${doctors.length} эмч · ${new Set(nurses.map((n) => n.name)).size} сувилагч`}
          </p>
          {doctors.map((d) => (
            <button
              className="roster-person"
              key={d.id}
              onClick={() => setDoctor(d)}
            >
              <span className="roster-avatar">{d.name?.slice(0, 1)}</span>
              <span>
                <strong>{d.name}</strong>
                <small>
                  {shift(day, d)
                    ?.map((i) => `${i.start}–${i.end}`)
                    .join(" · ")}
                </small>
                <small>
                  {d.appointments.filter((a) => a.date === day).length} захиалга
                </small>
              </span>
              <ChevronRight size={16} />
            </button>
          ))}
          {!loading && !doctors.length && (
            <p className="roster-muted">
              Эмчийн хуваарь бүртгэгдээгүй эсвэл амралттай.
            </p>
          )}
          <h4>Сувилагч</h4>
          {nurses.map((n) => (
            <div className="nurse-shift" key={n.id}>
              <span>
                <strong>{n.name}</strong>
                <small>
                  {n.startTime}–{n.endTime}
                </small>
              </span>
              {user.role === "ADMIN" && (
                <button
                  aria-label={`${n.name} ээлж устгах`}
                  onClick={async () => {
                    try {
                      await api(`/api/erp/nurse-shifts/${n.id}`, "DELETE");
                      setVersion((v) => v + 1);
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                >
                  Устгах
                </button>
              )}
            </div>
          ))}
          {user.role === "ADMIN" && (
            <button className="erp-secondary" onClick={() => setAdding(true)}>
              <Plus size={15} /> Сувилагчийн ээлж
            </button>
          )}
        </aside>
      </div>
      {doctor && (
        <Modal
          title={`${doctor.name} · ${day}`}
          onClose={() => setDoctor(null)}
        >
          <div className="roster-modal">
            <p>{doctor.specialty}</p>
            <h3>Тухайн өдрийн ажиллах цаг</h3>
            {shift(day, doctor)?.map((i) => (
              <p key={i.start}>
                {i.start}–{i.end}
              </p>
            ))}
            <h3>Үзлэгийн хуваарь</h3>
            {doctor.appointments
              .filter((a) => a.date === day)
              .map((a) => (
                <p key={a.id}>
                  {a.startTime}–{a.endTime} · {statusNames[a.status!]}
                </p>
              ))}
            {!doctor.appointments.some((a) => a.date === day) && (
              <p>Цаг товлоогүй</p>
            )}
            <h3>Долоо хоногийн тогтмол хуваарь</h3>
            {doctor.schedules.map((s) => (
              <p key={s.id}>
                {weekdays[s.weekday!]}{" "}
                <strong>
                  {s.startTime}–{s.endTime}
                </strong>
              </p>
            ))}
            <h3>Чөлөө, хаалт</h3>
            {doctor.leaves.map((l) => (
              <p key={l.id}>
                {l.date} · {leaveKindNames[l.kind || "BLOCKED_RANGE"]} ·{" "}
                {l.startTime}–{l.endTime} · {l.reason} ·{" "}
                {leaveStatusNames[l.status || "APPROVED"]}
              </p>
            ))}
            {!doctor.leaves.length && <p>Энэ сард чөлөө бүртгэгдээгүй.</p>}
          </div>
        </Modal>
      )}
      {adding && (
        <Modal
          title="Сувилагчийн ээлж бүртгэх"
          onClose={() => setAdding(false)}
        >
          <EntityForm
            fields={[
              { key: "name", label: "Сувилагчийн нэр", required: true },
              {
                key: "date",
                label: "Өдөр",
                type: "date",
                required: true,
                default: day,
              },
              {
                key: "startTime",
                label: "Эхлэх цаг",
                type: "time",
                required: true,
                default: "09:00",
              },
              {
                key: "endTime",
                label: "Дуусах цаг",
                type: "time",
                required: true,
                default: "18:00",
              },
            ]}
            onCancel={() => setAdding(false)}
            onSubmit={async (values) => {
              await api("/api/erp/nurse-shifts", "POST", values);
              setAdding(false);
              setVersion((v) => v + 1);
            }}
          />
        </Modal>
      )}
      {editingWeek && (
        <Modal
          title="Долоо хоногийн ажлын хуваарь"
          onClose={() => setEditingWeek(false)}
        >
          <WeekScheduleEditor
            doctors={data.doctors}
            onCancel={() => setEditingWeek(false)}
            onSaved={() => {
              setEditingWeek(false);
              setVersion((v) => v + 1);
            }}
          />
        </Modal>
      )}
    </section>
  );
}
