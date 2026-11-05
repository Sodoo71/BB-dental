import { Suspense } from "react";
import HomePage from "./components/home-page";

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="erp-loading">BB Dental Clinic · Ачаалж байна…</div>
      }
    >
      <HomePage />
    </Suspense>
  );
}
