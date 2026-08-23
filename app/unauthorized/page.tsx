import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-100 p-4">
      <div className="w-full max-w-lg rounded-[28px] border border-slate-200 bg-white p-8 text-center shadow-xl">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-red-600">
          403
        </p>
        <h1 className="mt-3 text-3xl font-black text-slate-900">
          Access denied
        </h1>
        <p className="mt-3 text-sm text-slate-600">
          Таны эрх энэ хуудас руу орж болохгүй байна.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link
            href="/login"
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white"
          >
            Нэвтрэх
          </Link>
          <Link
            href="/"
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700"
          >
            Нүүр хуудас
          </Link>
        </div>
      </div>
    </main>
  );
}
