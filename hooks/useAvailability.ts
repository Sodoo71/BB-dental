"use client";
import { startTransition, useEffect, useRef, useState } from "react";

export default function useAvailability(
  doctorId: string,
  serviceId: string,
  date: string,
) {
  const [slots, setSlots] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    startTransition(() => setSlots([]));
    if (!doctorId || !serviceId || !date) return;

    let live = true;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    const timeout = setTimeout(() => {
      setLoading(true);
      void fetch(
        `/api/availability?${new URLSearchParams({ doctorId, serviceId, date })}`,
        { signal: ac.signal },
      )
        .then(async (r) => {
          const d = await r.json();
          if (!r.ok) throw new Error(d.error || "Failed to load slots");
          const payload = Array.isArray(d.data)
            ? d.data
            : Array.isArray(d.slots)
              ? d.slots
              : [];
          if (live) startTransition(() => setSlots(payload));
        })
        .catch((err) => {
          if (err.name === "AbortError") return;
          if (live) startTransition(() => setSlots([]));
        })
        .finally(() => {
          if (live) setLoading(false);
        });
    }, 0);

    return () => {
      live = false;
      clearTimeout(timeout);
      ac.abort();
    };
  }, [date, doctorId, serviceId]);

  return { slots, loading } as const;
}
