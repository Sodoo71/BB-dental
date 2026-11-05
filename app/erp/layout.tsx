import BrandLoader from "../components/brand-loader";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { ErpShell } from "./shell";
import "./erp.css";
async function Protected({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  return (
    <ErpShell
      user={{
        id: user.id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        doctorId: user.doctor?.id,
      }}
    >
      {children}
    </ErpShell>
  );
}
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<BrandLoader fullScreen />}>
      <Protected>{children}</Protected>
    </Suspense>
  );
}
