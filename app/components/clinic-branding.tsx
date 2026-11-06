"use client";

import Image, { type ImageProps } from "next/image";
import { createContext, useContext, useEffect, useRef, useState } from "react";

export const defaultLogoUrl = "/images/default-logo.png";
const BrandingContext = createContext({
  logoUrl: defaultLogoUrl,
  setLogoUrl: (_value: string) => {},
});

export function useClinicBranding() {
  return useContext(BrandingContext);
}

export function ClinicBrandingProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [logoUrl, setLogo] = useState(defaultLogoUrl);
  const revision = useRef(0);
  function setLogoUrl(value: string) {
    revision.current++;
    setLogo(value || defaultLogoUrl);
  }
  useEffect(() => {
    const controller = new AbortController();
    async function refresh() {
      const started = revision.current;
      try {
        const response = await fetch("/api/branding", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) return;
        const branding = await response.json();
        if (revision.current === started)
          setLogo(branding.logoUrl || defaultLogoUrl);
      } catch {
        // Keep the current logo when the connection is temporarily unavailable.
      }
    }
    void refresh();
    window.addEventListener("focus", refresh);
    return () => {
      controller.abort();
      window.removeEventListener("focus", refresh);
    };
  }, []);
  return (
    <BrandingContext.Provider value={{ logoUrl, setLogoUrl }}>
      <link rel="icon" href={logoUrl} />
      <link rel="apple-touch-icon" href={logoUrl} />
      {children}
    </BrandingContext.Provider>
  );
}

export function ClinicLogo(props: Omit<ImageProps, "src">) {
  const { logoUrl } = useClinicBranding();
  const [failedUrl, setFailedUrl] = useState("");
  return (
    <Image
      {...props}
      src={failedUrl === logoUrl ? defaultLogoUrl : logoUrl}
      unoptimized
      style={{ objectFit: "contain", ...props.style }}
      onError={() => setFailedUrl(logoUrl)}
    />
  );
}
