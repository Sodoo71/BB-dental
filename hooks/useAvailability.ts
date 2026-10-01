"use client";
import { useEffect, useState } from "react";

export default function useAvailability(doctorId: string, serviceId: string, date: string, refresh = 0) {
  const key = JSON.stringify([doctorId, serviceId, date, refresh]);
  const ready = Boolean(doctorId && serviceId && date);
  const [response, setResponse] = useState<{ key: string; slots: string[]; error: string | null } | null>(null);

  useEffect(() => {
    if (!doctorId || !serviceId || !date) return;
    const controller = new AbortController();
    void fetch(`/api/availability?${new URLSearchParams({ doctorId, serviceId, date })}`, { signal: controller.signal })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "Боломжит цагийг ачаалж чадсангүй.");
        const slots = Array.isArray(data.data) ? data.data : Array.isArray(data.slots) ? data.slots : [];
        if (!controller.signal.aborted) setResponse({ key, slots, error: null });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setResponse({ key, slots: [], error: error instanceof Error ? error.message : "Боломжит цагийг ачаалж чадсангүй." });
      });
    return () => controller.abort();
  }, [date, doctorId, serviceId, key]);

  const current = ready && response?.key === key ? response : null;
  return { slots: current?.slots ?? [], loading: ready && !current, error: current?.error ?? null } as const;
}
