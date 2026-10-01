"use client";
import { useState } from "react";
import { ImageOff } from "lucide-react";
export function ClinicImage({ src, alt, className = "" }: { src: string; alt: string; className?: string }) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  if (failedSource === src) return <div role="img" aria-label={alt} className={`flex items-center justify-center bg-surface-soft text-brand-300 ${className}`}><ImageOff size={32} strokeWidth={1.2} /></div>;
  // Existing clinic media can include legacy providers; retain their URLs without a remote-image allowlist change.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} loading="lazy" className={className} onError={() => setFailedSource(src)} />;
}
