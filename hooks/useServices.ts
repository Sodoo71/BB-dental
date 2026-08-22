"use client";
import { useEffect, useState } from "react";
import type { Service } from "../types/booking";

export default function useServices() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    void fetch("/api/services")
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Failed to load services");
        if (live) setServices(d.data ?? []);
      })
      .catch(() => {
        if (live) setServices([]);
      })
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, []);

  return { services, loading } as const;
}
