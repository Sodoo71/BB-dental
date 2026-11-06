"use client";
import Link from "next/link";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="route-feedback">
      <h1>Мэдээлэл харуулахад алдаа гарлаа</h1>
      <p>
        Дахин оролдоно уу. Оруулсан мэдээллээ хадгалагдсан эсэхийг шалгана уу.
      </p>
      <button className="button" onClick={reset}>
        Дахин оролдох
      </button>
      <Link href="/">Нүүр хуудас</Link>
    </main>
  );
}
