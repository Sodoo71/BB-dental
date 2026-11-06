import type { CSSProperties } from "react";
import { ClinicLogo } from "./clinic-branding";
export default function BrandLoader({
  fullScreen = false,
}: {
  fullScreen?: boolean;
}) {
  return (
    <div
      className={`brand-loader${fullScreen ? " brand-loader-full" : ""}`}
      role="status"
      aria-label="BB Dental мэдээллийг бэлтгэж байна"
      aria-live="polite"
    >
      <ClinicLogo alt="" width={72} height={72} />
      <div className="brand-loader-word" aria-hidden="true">
        {Array.from("BB Dental").map((letter, index) => (
          <span key={index} style={{ "--letter": index } as CSSProperties}>
            {letter === " " ? "\u00a0" : letter}
          </span>
        ))}
      </div>
      <span className="brand-loader-caption" aria-hidden="true">
        CLINIC & CARE
      </span>
    </div>
  );
}
