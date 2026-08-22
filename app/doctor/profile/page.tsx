"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Mail, Phone, UserRound } from "lucide-react";

type ProfileData = {
  id: string;
  name: string;
  title?: string | null;
  phone?: string | null;
  email?: string | null;
  role: string;
};

export default function DoctorProfilePage() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const meResponse = await fetch("/api/auth/me");
        const me = await meResponse.json();

        if (!meResponse.ok) {
          throw new Error(me.error || "Unable to load profile");
        }

        const doctorId = me.data?.doctorId;
        const doctorsResponse = await fetch("/api/doctors");
        const doctorsPayload = await doctorsResponse.json();

        if (!doctorsResponse.ok) {
          throw new Error(doctorsPayload.error || "Unable to load doctor list");
        }

        const doctor = (doctorsPayload.data || []).find(
          (item: { id: string }) => item.id === doctorId,
        );

        setProfile({
          id: doctor?.id || doctorId,
          name: doctor?.name || me.data?.name || "Doctor",
          title: doctor?.title || null,
          phone: doctor?.phone || null,
          email: doctor?.email || me.data?.email || null,
          role: me.data?.role || "DOCTOR",
        });
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  if (loading) {
    return (
      <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        Loading profile…
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="rounded-[28px] border border-red-200 bg-white p-6 shadow-sm">
        Profile unavailable.
      </div>
    );
  }

  return (
    <div className="space-y-6 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-emerald-600">
            Profile
          </p>
          <h1 className="mt-1 text-2xl font-black text-slate-900">
            My profile
          </h1>
        </div>
        <Link
          href="/doctor"
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Dashboard
        </Link>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
        <div className="mb-5 flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
            <UserRound className="h-7 w-7" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-emerald-600">
              {profile.role}
            </p>
            <h2 className="mt-1 text-2xl font-black text-slate-900">
              {profile.name}
            </h2>
            <p className="text-sm text-slate-500">
              {profile.title || "General physician"}
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
              <Phone className="h-4 w-4 text-emerald-600" />
              Phone
            </div>
            <p className="mt-3 text-base font-bold text-slate-900">
              {profile.phone || "Not provided"}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
              <Mail className="h-4 w-4 text-emerald-600" />
              Email
            </div>
            <p className="mt-3 text-base font-bold text-slate-900">
              {profile.email || "Not provided"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
