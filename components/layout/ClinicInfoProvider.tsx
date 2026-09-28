"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { defaultClinicInfo } from "@/lib/clinic-info";
const ClinicContext = createContext(defaultClinicInfo);
export const useClinicInfo = () => useContext(ClinicContext);
export function ClinicInfoProvider({ children }: { children: ReactNode }) {
  const [info, setInfo] = useState(defaultClinicInfo);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/clinic", { cache: "no-store", signal: controller.signal })
      .then(async response => { if (response.ok) setInfo((await response.json()).data); })
      .catch(() => {});
    return () => controller.abort();
  }, []);
  return <ClinicContext.Provider value={info}>{children}</ClinicContext.Provider>;
}
