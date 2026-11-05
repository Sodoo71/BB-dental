"use client";
import Link from "next/link";
import {
  ArrowUpRight,
  CalendarDays,
  CreditCard,
  FileChartColumn,
  Stethoscope,
  Users,
  UserRoundCog,
} from "lucide-react";
import { useUser } from "./shell";
import { roleNames, today } from "@/lib/domain";
export default function RoleHome() {
  const user = useUser();
  const actions =
    user.role === "ADMIN"
      ? [
          {
            href: "/erp/reports",
            name: "Тайлан, орлого",
            text: "Үйлчилгээ, сар, жилээр шинжлэх",
            icon: FileChartColumn,
          },
          {
            href: "/erp/schedules",
            name: "Багийн хуваарь",
            text: "Эмч, сувилагчийн ажиллах өдөр",
            icon: CalendarDays,
          },
          {
            href: "/erp/users",
            name: "Ажилтан, эрх",
            text: "Бүртгэл зөвшөөрөх, эрх удирдах",
            icon: UserRoundCog,
          },
        ]
      : user.role === "RECEPTION"
        ? [
            {
              href: "/erp/appointments",
              name: "Цаг бүртгэх",
              text: "Өвчтөн, үйлчилгээ, боломжит цаг",
              icon: CalendarDays,
            },
            {
              href: "/erp/patients",
              name: "Өвчтөний карт",
              text: "Үзлэгийн түүх, давтан захиалга",
              icon: Users,
            },
            {
              href: "/erp/payments",
              name: "Касс, төлбөр",
              text: "Өвчтөний төлбөр бүртгэх",
              icon: CreditCard,
            },
          ]
        : [
            {
              href: "/erp/calendar",
              name: "Миний үзлэг",
              text: "Өдрийн захиалга, багийн хуваарь",
              icon: CalendarDays,
            },
            {
              href: "/erp/treatments",
              name: "Эмчилгээ бүртгэх",
              text: "Шүдний зураг, онош, эмчилгээ",
              icon: Stethoscope,
            },
            {
              href: "/erp/patients",
              name: "Миний өвчтөн",
              text: "Карт, дотоод тэмдэглэл, шилжүүлэг",
              icon: Users,
            },
          ];
  return (
    <section className={`role-home role-${user.role.toLowerCase()}`}>
      <div className="role-welcome">
        <div>
          <span>
            {roleNames[user.role]} · {today()}
          </span>
          <h2>Сайн байна уу, {user.name}</h2>
          <p>
            {user.role === "ADMIN"
              ? "Эмнэлгийн үзүүлэлт, баг болон үйл ажиллагаагаа нэг дор удирдаарай."
              : user.role === "RECEPTION"
                ? "Өдрийн захиалга, өвчтөний бүртгэл болон кассын ажлаа эндээс эхлүүлээрэй."
                : "Өөрийн үзлэг, эмчилгээ болон өвчтөний мэдээллээ хялбар удирдаарай."}
          </p>
        </div>
        <span className="role-welcome-mark">BB</span>
      </div>
      <div className="role-actions">
        {actions.map((a) => (
          <Link key={a.href} href={a.href}>
            <span className="role-action-icon">
              <a.icon size={22} />
            </span>
            <span>
              <strong>{a.name}</strong>
              <small>{a.text}</small>
            </span>
            <ArrowUpRight size={18} />
          </Link>
        ))}
      </div>
    </section>
  );
}
