import Link from "next/link";
import { ArrowLeft, CalendarDays, ShieldCheck, Users } from "lucide-react";
import { Brand } from "./Brand";
import type { ReactNode } from "react";
export function AuthShell({ children }: { children: ReactNode }) {
  return <main className="grid min-h-dvh bg-background lg:grid-cols-[.95fr_1.05fr]">
    <aside className="relative hidden flex-col justify-between overflow-hidden bg-brand-700 p-12 text-white lg:flex xl:p-16">
      <Link href="/" className="w-fit"><Brand dark /></Link>
      <div className="relative z-10 max-w-lg py-16"><div className="mb-8 h-px w-16 bg-accent" /><p className="mb-5 text-xs tracking-[.2em] text-accent">BB DENTAL ERP</p><h2 className="font-serif text-4xl font-normal leading-snug xl:text-5xl">Сайн тусламж.<br />Цэгцтэй удирдлага.</h2><p className="mt-6 max-w-sm text-base leading-relaxed text-brand-100">Эмнэлгийн өдөр тутмын ажлыг нэг дороос, илүү хялбар удирдаарай.</p>
        <div className="mt-10 space-y-5">{[{ icon: CalendarDays, text: "Цаг захиалга, эмчийн хуваарь" }, { icon: Users, text: "Үйлчлүүлэгчийн мэдээлэл" }, { icon: ShieldCheck, text: "Ажилтны эрхийн удирдлага" }].map(({ icon: Icon, text }) => <div key={text} className="flex items-center gap-3 text-sm text-brand-100"><Icon size={18} className="text-accent" />{text}</div>)}</div>
      </div>
      <p className="text-xs text-brand-200">Эмнэлгийн ажилтнуудад зориулсан систем</p>
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-40 -right-44 h-[480px] w-[480px] rounded-full border border-white/10" />
    </aside>
    <section className="flex min-w-0 flex-col p-5 sm:p-10 lg:p-12"><Link href="/" className="inline-flex min-h-11 w-fit items-center gap-2 text-sm text-slate-500 hover:text-brand-700"><ArrowLeft size={16} />Нүүр хуудас</Link><div className="flex flex-1 flex-col items-center justify-center py-8"><div className="mb-8 lg:hidden"><Brand /></div>{children}</div><p className="text-center text-xs text-slate-500">BB Dental · Эмнэлгийн удирдлагын систем</p></section>
  </main>;
}
