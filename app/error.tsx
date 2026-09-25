"use client";
import Link from "next/link";
import { AlertCircle, RefreshCw } from "lucide-react";
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <section role="alert" className="surface mx-auto my-12 w-[calc(100%-2rem)] max-w-lg p-8 text-center"><AlertCircle className="mx-auto mb-5 h-10 w-10 text-amber-700" /><h1 className="page-title">Мэдээлэл ачаалж чадсангүй</h1><p className="my-4 text-sm text-slate-600">Холболтоо шалгаад дахин оролдоно уу.</p><div className="mt-6 flex flex-wrap justify-center gap-3"><button onClick={reset} className="button-primary"><RefreshCw size={16} />Дахин оролдох</button><Link href="/" className="button-secondary">Нүүр хуудас</Link></div></section>;
}
