import Link from "next/link";
export default function NotFound() {
  return (
    <main className="route-feedback">
      <h1>Хуудас олдсонгүй</h1>
      <p>Хаягаа шалгах эсвэл нүүр хуудас руу буцна уу.</p>
      <Link className="button" href="/">
        Нүүр хуудас
      </Link>
    </main>
  );
}
