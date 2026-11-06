"use client";
import { useState } from "react";
import {
  Feedback,
  LoadingSkeleton,
  Pagination,
  useResource,
  type Entity,
} from "./ui";
import { statusNames } from "@/lib/domain";
import { leaveKindNames, leaveStatusNames } from "@/lib/work-schedule";
type Detail = {
  doctor: Entity & { schedules: Entity[]; leaves: Entity[] };
  stats: { total: number; completed: number; patients: number };
  appointments: Entity[];
};
const weekdays = [
  "Ням",
  "Даваа",
  "Мягмар",
  "Лхагва",
  "Пүрэв",
  "Баасан",
  "Бямба",
];
export default function DoctorDetail({ id }: { id: string }) {
  const [page, setPage] = useState(1);
  const { data, error, retry } = useResource<Detail>(
    `/api/erp/doctor-detail/${id}?page=${page}`,
  );
  if (error) return <Feedback retry={retry}>{error}</Feedback>;
  if (!data) return <LoadingSkeleton />;
  return (
    <div className="roster-modal">
      <h2>{data.doctor.name}</h2>
      <p>{data.doctor.specialty}</p>
      <div className="doctor-detail-stats">
        <span>
          Нийт захиалга<strong>{data.stats.total}</strong>
        </span>
        <span>
          Дууссан үзлэг<strong>{data.stats.completed}</strong>
        </span>
        <span>
          Өвчтөн<strong>{data.stats.patients}</strong>
        </span>
      </div>
      <h3>Долоо хоногийн хуваарь</h3>
      {!data.doctor.schedules.length && <p>Хуваарь бүртгэгдээгүй.</p>}
      {data.doctor.schedules.map((s) => (
        <p key={s.id}>
          {weekdays[s.weekday!]} · {s.startTime}–{s.endTime}
        </p>
      ))}
      <h3>Чөлөө ба өдрийн өөрчлөлт</h3>
      {!data.doctor.leaves.length && <p>Өөрчлөлт бүртгэгдээгүй.</p>}
      {data.doctor.leaves.map((l) => (
        <p key={l.id}>
          {l.date} · {leaveKindNames[l.kind || "BLOCKED_RANGE"]} · {l.startTime}
          –{l.endTime} · {leaveStatusNames[l.status || "APPROVED"]}
        </p>
      ))}
      <h3>Үзлэгийн түүх</h3>
      {data.appointments.map((a) => (
        <p key={a.id}>
          {a.date} · {a.startTime} · {a.patient?.name} · {a.service?.name} ·{" "}
          {statusNames[a.status!]}
        </p>
      ))}
      {!data.appointments.length && <p>Үзлэг байхгүй.</p>}
      <Pagination
        page={page}
        count={data.appointments.length}
        total={data.stats.total}
        onPage={setPage}
      />
    </div>
  );
}
