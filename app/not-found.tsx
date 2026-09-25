import Link from "next/link";
import { Brand } from "@/components/layout/Brand";
export default function NotFound() {
  return <main className="flex min-h-dvh flex-col items-center justify-center bg-parchment p-6 text-center"><Brand /><p className="eyebrow mt-12">404 · ХУУДАС ОЛДСОНГҮЙ</p><h1 className="page-title mt-4">Энэ хуудас байхгүй байна</h1><p className="mb-8 mt-4 max-w-sm text-sm text-slate-600">Холбоос өөрчлөгдсөн эсвэл хуудасны хаяг буруу байна.</p><Link href="/" className="button-primary">Нүүр хуудас руу буцах</Link></main>;
}
