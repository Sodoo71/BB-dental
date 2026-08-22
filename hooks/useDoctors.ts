"use client";
import { useEffect, useState } from "react";
import type { Doctor } from "../types/booking";

export default function useDoctors() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    void fetch("/api/doctors")
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Failed to load doctors");
        if (live) setDoctors(d.data ?? []);
      })
      .catch(() => {
        if (live) setDoctors([]);
      })
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, []);

  return { doctors, loading } as const;
}
