import Link from "next/link";
import { CalendarDays, ShieldCheck, Users } from "lucide-react";
import { ClinicLogo } from "./clinic-branding";

export default function AuthStory() {
  return (
    <aside className="login-story">
      <Link href="/" className="auth-brand" aria-label="BB Dental нүүр хуудас">
        <ClinicLogo alt="BB Dental" width={56} height={56} />
        <span>
          BB Dental<small>CLINIC & CARE</small>
        </span>
      </Link>
      <div className="auth-story-copy">
        <span className="login-eyebrow">BB DENTAL ERP</span>
        <h1>
          Сайн тусламж.
          <br />
          Цэгцтэй удирдлага.
        </h1>
        <p>Эмнэлгийн өдөр тутмын ажлыг нэг дороос, илүү хялбар удирдаарай.</p>
        <ul className="auth-features">
          <li>
            <CalendarDays size={18} />
            Цаг захиалга, эмчийн хуваарь
          </li>
          <li>
            <Users size={18} />
            Үйлчлүүлэгчийн мэдээлэл
          </li>
          <li>
            <ShieldCheck size={18} />
            Ажилтны эрхийн удирдлага
          </li>
        </ul>
      </div>
      <p className="auth-story-footer">
        Эмнэлгийн ажилтнуудад зориулсан систем
      </p>
    </aside>
  );
}

export function AuthMobileBrand() {
  return (
    <Link
      href="/"
      className="auth-brand auth-mobile-brand"
      aria-label="BB Dental нүүр хуудас"
    >
      <ClinicLogo alt="BB Dental" width={48} height={48} />
      <span>
        BB Dental<small>CLINIC & CARE</small>
      </span>
    </Link>
  );
}
