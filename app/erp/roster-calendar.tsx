"use client";
import { useEffect, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  Users,
  LockKeyhole,
  Clock3,
  Pencil,
  Trash2,
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
import { today } from "@/lib/domain";
import { workIntervals, leaveKindNames } from "@/lib/work-schedule";
import { schedulePolicy } from "@/lib/schedule-policy";
import WeekScheduleEditor from "./week-schedule-editor";
import WorkDayForm from "./work-day-form";

type RosterDoctor = Entity & {
  schedules: Entity[];
  leaves: Entity[];
  appointments: Entity[];
};
type Roster = {
  doctors: RosterDoctor[];
  nurses: Entity[];
  policy?: ReturnType<typeof schedulePolicy>;
};
function intervals(date: string, doctor: RosterDoctor) {
  const weekly = doctor.schedules.find(
    (s) => s.weekday === new Date(`${date}T12:00:00Z`).getUTCDay(),
  );
  return workIntervals(
    weekly ? { startTime: weekly.startTime!, endTime: weekly.endTime! } : null,
    doctor.leaves
      .filter((l) => l.date === date)
      .map((l) => ({
        startTime: l.startTime!,
        endTime: l.endTime!,
        kind: l.kind,
        status: l.status,
      })),
  );
}
const hours = (date: string, doctor: RosterDoctor) =>
  intervals(date, doctor)
    .map((i) => `${i.startTime}–${i.endTime}`)
    .join(" · ");
export default function RosterCalendar() {
  const user = useUser();
  const [month, setMonth] = useState(today().slice(0, 7));
  const [day, setDay] = useState(today());
  const [view, setView] = useState(user.role === "DOCTOR" ? "mine" : "team");
  const [version, setVersion] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [form, setForm] = useState<{ initial?: Entity } | null>(null);
  const [removing, setRemoving] = useState<{
    doctor: RosterDoctor;
    item?: Entity;
  } | null>(null);
  const [editingWeek, setEditingWeek] = useState(false);
  const [addingNurse, setAddingNurse] = useState(false);
  const count = new Date(
    Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0),
  ).getUTCDate();
  const dates = Array.from(
    { length: count },
    (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`,
  );
  const offset = (new Date(`${month}-01T12:00:00Z`).getUTCDay() + 6) % 7;
  const {
    data,
    loading,
    error: loadError,
    retry,
  } = useResource<Roster>(
    `/api/erp/roster?from=${month}-01&to=${dates.at(-1)}`,
    version,
  );
  const doctors = data?.doctors || [];
  const policy = data?.policy || schedulePolicy(7, today());
  const own = doctors.find((d) => d.id === user.doctorId);
  const canManage = user.role !== "RECEPTION";
  const canChange = (date: string) =>
    user.role === "ADMIN" ? date >= today() : date >= policy.editableFrom;
  const team = doctors.filter((d) => intervals(day, d).length);
  const nurses = data?.nurses.filter((n) => n.date === day) || [];
  const pending = doctors.flatMap((d) =>
    d.leaves
      .filter((l) => l.status === "PENDING")
      .map((item) => ({ doctor: d, item })),
  );
  const mine = own ? dates.filter((date) => intervals(date, own).length) : [];
  useEffect(() => {
    const refresh = () => setVersion((v) => v + 1);
    window.addEventListener("bb-roster-update", refresh);
    return () => window.removeEventListener("bb-roster-update", refresh);
  }, []);
  function refresh() {
    window.dispatchEvent(new Event("bb-roster-update"));
  }
  function move(delta: number) {
    const next = new Date(`${month}-01T12:00:00Z`);
    next.setUTCMonth(next.getUTCMonth() + delta);
    setMonth(next.toISOString().slice(0, 7));
    setDay(next.toISOString().slice(0, 10));
  }
  function official(doctor: RosterDoctor) {
    return (
      doctor.leaves.find(
        (l) =>
          l.date === day &&
          l.status === "APPROVED" &&
          l.kind === "SCHEDULE_OVERRIDE",
      ) ||
      doctor.leaves.find(
        (l) =>
          l.date === day && l.status === "APPROVED" && l.kind === "DAY_OFF",
      )
    );
  }
  function edit(doctor: RosterDoctor) {
    const item = official(doctor);
    const work =
      doctor.schedules.find(
        (s) => s.weekday === new Date(`${day}T12:00:00Z`).getUTCDay(),
      ) || intervals(day, doctor)[0];
    setForm({
      initial: item
        ? {
            ...item,
            ...(item.kind === "DAY_OFF"
              ? { startTime: "09:00", endTime: "18:00" }
              : {}),
          }
        : {
            id: "",
            doctorId: doctor.id,
            date: day,
            startTime: work?.startTime || "09:00",
            endTime: work?.endTime || "18:00",
          },
    });
  }
  async function review(id: string, status: "APPROVED" | "REJECTED") {
    setBusy(id);
    setError("");
    try {
      await api(`/api/erp/leave-review/${id}`, "POST", { status });
      refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  return (
    <section className="roster-panel erp-panel schedule-hub">
      <div className="roster-heading">
        <div>
          <p className="eyebrow">ТАНЫ ЦАГ · ТАНЫ БАГ</p>
          <h2>
            <CalendarDays size={24} /> Хэн, хэзээ ажиллах вэ?
          </h2>
          <p>
            Өдрөө сонгоод ажиллах цагаа тохируулж, хамт ажиллах багтайгаа
            танилцаарай.
          </p>
        </div>
        <div className="schedule-heading-actions">
          {user.role === "ADMIN" && (
            <button
              className="erp-secondary"
              onClick={() => setEditingWeek(true)}
              disabled={loading}
            >
              Долоо хоног засах
            </button>
          )}
          {canManage && (
            <button
              className="erp-primary"
              disabled={loading || !doctors.length}
              onClick={() => setForm({})}
            >
              <Plus size={16} /> Хуваарь үүсгэх
            </button>
          )}
        </div>
      </div>
      {(error || loadError) && (
        <Feedback
          retry={() => {
            setError("");
            retry();
          }}
        >
          {error || loadError}
        </Feedback>
      )}
      <div className="schedule-summary-grid">
        <div>
          <span>
            <CalendarDays size={18} />{" "}
            {own ? "Миний ажиллах өдөр" : "Багийн эмч нар"}
          </span>
          <strong>
            {own ? mine.length : doctors.length}
            <small>{own ? "өдөр / энэ сар" : "эмч"}</small>
          </strong>
        </div>
        <div>
          <span>
            <Clock3 size={18} /> Хүлээгдэж буй хүсэлт
          </span>
          <strong>
            {pending.length}
            <small>хүсэлт / энэ сар</small>
          </strong>
        </div>
        <div>
          <span>
            <LockKeyhole size={18} /> Хуваарь хамгаалах хугацаа
          </span>
          <strong>
            {policy.lockDays}
            <small>хоног</small>
          </strong>
        </div>
      </div>
      <div className="schedule-policy-note">
        <LockKeyhole size={16} />
        <span>
          Эмч {policy.editableFrom}-ээс хойших хуваариа засах, цуцлах хүсэлт
          илгээнэ. Админ батлах хүртэл өмнөх хуваарь хүчинтэй.
        </span>
      </div>
      {user.role === "ADMIN" && (
        <SchedulePolicyEditor
          key={policy.lockDays}
          days={policy.lockDays}
          onSaved={refresh}
        />
      )}
      <div className="schedule-month-layout">
        <div className="schedule-month-card">
          <div className="schedule-calendar-toolbar">
            <div className="roster-month">
              <button aria-label="Өмнөх сар" onClick={() => move(-1)}>
                <ChevronLeft size={18} />
              </button>
              <input
                type="month"
                aria-label="Хуваарийн сар"
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
            {own && (
              <div
                className="schedule-view-switch"
                aria-label="Хуваарийн харагдац"
              >
                <button
                  aria-pressed={view === "mine"}
                  onClick={() => setView("mine")}
                >
                  Минийх
                </button>
                <button
                  aria-pressed={view === "team"}
                  onClick={() => setView("team")}
                >
                  Багийнх
                </button>
              </div>
            )}
          </div>
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
            onKeyDown={(e) => calendarKeyNavigation(e, offset)}
          >
            {Array.from({ length: offset }, (_, i) => (
              <span key={`gap-${i}`} />
            ))}
            {dates.map((date, i) => {
              const working = doctors.filter((d) => intervals(date, d).length);
              const ownHours = own ? hours(date, own) : "";
              const requests = pending.some(({ item }) => item.date === date);
              const nurseCount =
                data?.nurses.filter((n) => n.date === date).length || 0;
              return (
                <button
                  key={date}
                  className={`${day === date ? "selected" : ""} ${date === today() ? "today" : ""} ${ownHours ? "has-own-hours" : ""} ${requests ? "has-request" : ""} ${date < today() ? "past-day" : ""}`}
                  onClick={() => setDay(date)}
                  aria-label={`${date}: ${working.length} эмч, ${nurseCount} сувилагч`}
                  aria-pressed={date === day}
                  aria-current={date === today() ? "date" : undefined}
                >
                  <strong>{i + 1}</strong>
                  {loading ? (
                    <small>…</small>
                  ) : (
                    <>
                      <span>
                        {view === "mine" && own
                          ? ownHours || "—"
                          : `${working.length} эмч`}
                      </span>
                      <small>
                        {requests ? "● Хүсэлт" : `${nurseCount} сувилагч`}
                      </small>
                    </>
                  )}
                </button>
              );
            })}
          </div>
          <div className="schedule-calendar-legend">
            <span>
              <i className="legend-work" /> Ажиллах өдөр
            </span>
            <span>
              <i className="legend-request" /> Хүлээгдэж буй хүсэлт
            </span>
            <span>{day}</span>
          </div>
        </div>
        <aside className="roster-day-detail">
          <p className="eyebrow">СОНГОСОН ӨДӨР</p>
          <h3>{day}</h3>
          {own && (
            <div className="schedule-own-day">
              <span>Миний ажиллах цаг</span>
              <strong>{hours(day, own) || "Хуваарьгүй"}</strong>
              {!canChange(day) && (
                <small>
                  <LockKeyhole size={13} /> Засах, цуцлах хугацаа хамгаалагдсан
                </small>
              )}
            </div>
          )}
          {canManage && (own || user.role === "ADMIN") && (
            <div className="schedule-day-actions">
              <button
                className="erp-primary"
                disabled={
                  day < today() ||
                  (!!own &&
                    (!!hours(day, own) || !!official(own)) &&
                    !canChange(day))
                }
                onClick={() => (own ? edit(own) : setForm({}))}
              >
                {own && hours(day, own)
                  ? "Ажиллах цаг засах"
                  : "Энэ өдөр хуваарь үүсгэх"}
              </button>
              {own && hours(day, own) && (
                <button
                  className="erp-secondary"
                  disabled={!canChange(day)}
                  onClick={() =>
                    setRemoving({ doctor: own, item: official(own) })
                  }
                >
                  Хуваарь цуцлах
                </button>
              )}
            </div>
          )}
          <div className="schedule-team-heading">
            <Users size={17} />
            <h4>Хамт ажиллах баг</h4>
          </div>
          {team.map((doctor) => (
            <div className="roster-person" key={doctor.id}>
              <span className="roster-avatar">{doctor.name?.slice(0, 1)}</span>
              <span>
                <strong>
                  {doctor.name}
                  {doctor.id === user.doctorId ? " · Та" : ""}
                </strong>
                <small>{hours(day, doctor)}</small>
                <small>{doctor.specialty}</small>
              </span>
              {user.role === "ADMIN" && (
                <div className="schedule-person-actions">
                  <button
                    aria-label={`${doctor.name} хуваарь засах`}
                    onClick={() => edit(doctor)}
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    aria-label={`${doctor.name} хуваарь цуцлах`}
                    disabled={day < today()}
                    onClick={() =>
                      setRemoving({ doctor, item: official(doctor) })
                    }
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              )}
            </div>
          ))}
          {!loading && !team.length && (
            <p className="roster-muted">Энэ өдөр эмчийн хуваарь алга.</p>
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
                  disabled={!!busy}
                  onClick={async () => {
                    setBusy(n.id);
                    try {
                      await api(`/api/erp/nurse-shifts/${n.id}`, "DELETE");
                      refresh();
                    } catch (e) {
                      setError((e as Error).message);
                    } finally {
                      setBusy("");
                    }
                  }}
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          ))}
          {!nurses.length && (
            <p className="roster-muted">Сувилагчийн ээлж алга.</p>
          )}
          {user.role === "ADMIN" && (
            <button
              className="erp-secondary"
              onClick={() => setAddingNurse(true)}
            >
              <Plus size={15} /> Сувилагчийн ээлж
            </button>
          )}
        </aside>
      </div>
      <div className="schedule-bottom-grid">
        <section className="schedule-request-card">
          <h3>
            Хүлээгдэж буй хүсэлт <span>{pending.length}</span>
          </h3>
          <p>Засах, цуцлах хүсэлтийг админ шийдвэрлэнэ.</p>
          <div className="schedule-scroll-list">
            {pending.map(({ doctor, item }) => (
              <article className="schedule-request-row" key={item.id}>
                <div>
                  <strong>{doctor.name}</strong>
                  <small>
                    {item.date} ·{" "}
                    {item.kind === "DAY_OFF"
                      ? "Хуваарь цуцлах / чөлөө"
                      : `${item.startTime}–${item.endTime}`}
                  </small>
                  <small>
                    {item.replacesId
                      ? "Батлагдсан хуваарийн өөрчлөлт"
                      : leaveKindNames[item.kind || "BLOCKED_RANGE"]}
                  </small>
                </div>
                <div className="schedule-row-actions">
                  {user.role === "ADMIN" ? (
                    <>
                      <button
                        className="erp-primary"
                        disabled={!!busy}
                        onClick={() => review(item.id, "APPROVED")}
                      >
                        Батлах
                      </button>
                      <button
                        className="erp-secondary"
                        disabled={!!busy}
                        onClick={() => review(item.id, "REJECTED")}
                      >
                        Татгалзах
                      </button>
                    </>
                  ) : user.role === "DOCTOR" ? (
                    <>
                      <button
                        hidden={item.kind !== "SCHEDULE_OVERRIDE"}
                        aria-label={`${item.date} хүсэлт засах`}
                        disabled={!canChange(item.date!)}
                        onClick={() => setForm({ initial: item })}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        aria-label={`${item.date} хүсэлт цуцлах`}
                        disabled={!!busy || !canChange(item.date!)}
                        onClick={async () => {
                          setBusy(item.id);
                          try {
                            await api(`/api/erp/leaves/${item.id}`, "DELETE");
                            refresh();
                          } catch (e) {
                            setError((e as Error).message);
                          } finally {
                            setBusy("");
                          }
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
          {!loading && !pending.length && (
            <p className="roster-muted">Энэ сард хүлээгдэж буй хүсэлт алга.</p>
          )}
        </section>
        <section className="schedule-request-card">
          <h3>{own ? "Миний ажиллах хуваарь" : "Сонгосон өдрийн баг"}</h3>
          <p>
            {own
              ? `${month} · ${mine.length} ажиллах өдөр`
              : `${day} · ${team.length} эмч`}
          </p>
          <div className="schedule-scroll-list">
            {own
              ? mine.map((date) => (
                  <button
                    className="schedule-my-day"
                    key={date}
                    onClick={() => {
                      setDay(date);
                      document
                        .querySelector(".schedule-month-layout")
                        ?.scrollIntoView({
                          behavior: "smooth",
                          block: "start",
                        });
                    }}
                  >
                    <span>{date}</span>
                    <strong>{hours(date, own)}</strong>
                    {canChange(date) ? (
                      <ChevronRight size={16} />
                    ) : (
                      <LockKeyhole size={14} />
                    )}
                  </button>
                ))
              : team.map((d) => (
                  <div className="schedule-my-day" key={d.id}>
                    <span>{d.name}</span>
                    <strong>{hours(day, d)}</strong>
                  </div>
                ))}
          </div>
          {own && !mine.length && (
            <p className="roster-muted">
              Календарь дээр өдрөө сонгон хуваарь үүсгээрэй.
            </p>
          )}
        </section>
      </div>
      {form && (
        <Modal
          title={form.initial ? "Ажиллах цаг засах" : "Хуваарь үүсгэх"}
          onClose={() => setForm(null)}
        >
          <WorkDayForm
            doctors={
              user.role === "DOCTOR"
                ? doctors.filter((d) => d.id === user.doctorId)
                : doctors
            }
            date={form.initial?.date || day}
            initial={form.initial}
            onCancel={() => setForm(null)}
            onSaved={() => {
              setForm(null);
              refresh();
            }}
          />
        </Modal>
      )}
      {removing && (
        <Modal title="Ажиллах хуваарь цуцлах" onClose={() => setRemoving(null)}>
          <p>
            {removing.doctor.name} · {day} · {hours(day, removing.doctor)}
          </p>
          <p>
            {user.role === "ADMIN"
              ? "Цуцалбал энэ өдрийн цаг захиалга хаагдана."
              : "Админ батлах хүртэл одоогийн хуваарь хэвээр байна."}
          </p>
          <div className="form-actions">
            <button
              className="erp-secondary"
              disabled={!!busy}
              onClick={() => setRemoving(null)}
            >
              Болих
            </button>
            <button
              className="erp-primary"
              disabled={!!busy}
              onClick={async () => {
                setBusy("remove");
                setError("");
                try {
                  if (removing.item?.id)
                    await api(`/api/erp/leaves/${removing.item.id}`, "DELETE");
                  else
                    await api("/api/erp/leaves", "POST", {
                      doctorId: removing.doctor.id,
                      date: day,
                      kind: "DAY_OFF",
                      reason: "Ажиллах хуваарь цуцлах хүсэлт",
                    });
                  setRemoving(null);
                  refresh();
                } catch (e) {
                  setError((e as Error).message);
                  setRemoving(null);
                } finally {
                  setBusy("");
                }
              }}
            >
              Цуцлах хүсэлт баталгаажуулах
            </button>
          </div>
        </Modal>
      )}
      {editingWeek && (
        <Modal
          title="Долоо хоногийн тогтмол хуваарь"
          onClose={() => setEditingWeek(false)}
        >
          <WeekScheduleEditor
            doctors={doctors}
            onCancel={() => setEditingWeek(false)}
            onSaved={() => {
              setEditingWeek(false);
              refresh();
            }}
          />
        </Modal>
      )}
      {addingNurse && (
        <Modal
          title="Сувилагчийн ээлж бүртгэх"
          onClose={() => setAddingNurse(false)}
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
            onCancel={() => setAddingNurse(false)}
            onSubmit={async (values) => {
              await api("/api/erp/nurse-shifts", "POST", values);
              setAddingNurse(false);
              refresh();
            }}
          />
        </Modal>
      )}
    </section>
  );
}
function SchedulePolicyEditor({
  days,
  onSaved,
}: {
  days: number;
  onSaved: () => void;
}) {
  const [value, setValue] = useState(String(days));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <form
      className="schedule-policy-editor"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setError("");
        try {
          await api("/api/erp/settings/scheduleLockDays", "PATCH", { value });
          onSaved();
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <label>
        Хамгаалах хоног
        <input
          type="number"
          min={0}
          max={90}
          step={1}
          required
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      </label>
      <button
        className="erp-secondary"
        disabled={busy || value === String(days)}
      >
        {busy ? "Хадгалж байна…" : "Хугацаа хадгалах"}
      </button>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
