"use client";
import { adultRows, babyRows } from "./dentition";
import { useState } from "react";
export default function ToothPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [primary, setPrimary] = useState(Number(value) >= 51);
  const [top, bottom] = primary ? babyRows : adultRows;
  return (
    <div
      className="fdi-picker"
      role="group"
      aria-label="Шүдний FDI зураг · хажуу тийш гүйлгэх"
      tabIndex={0}
    >
      <div className="fdi-controls">
        <button
          type="button"
          className={!primary ? "selected" : ""}
          onClick={() => setPrimary(false)}
        >
          Байнгын шүд
        </button>
        <button
          type="button"
          className={primary ? "selected" : ""}
          onClick={() => setPrimary(true)}
        >
          Сүүн шүд
        </button>
        <button type="button" onClick={() => onChange("")}>
          Сонголт арилгах
        </button>
      </div>
      <div className="fdi-orientation">
        <span>Өвчтөний баруун</span>
        <span>Өвчтөний зүүн</span>
      </div>
      {[top, bottom].map((row, index) => (
        <div key={index} className={`fdi-arch ${index ? "lower" : "upper"}`}>
          {row.map((n, i) => (
            <button
              type="button"
              key={n}
              aria-label={`Шүд ${n}`}
              aria-pressed={value === String(n)}
              className={value === String(n) ? "selected" : ""}
              onClick={() => onChange(String(n))}
              style={{
                marginTop: index
                  ? 0
                  : Math.round(Math.abs(i - (row.length - 1) / 2) * 2),
                marginBottom: index
                  ? Math.round(Math.abs(i - (row.length - 1) / 2) * 2)
                  : 0,
              }}
            >
              <svg viewBox="0 0 40 56" aria-hidden="true">
                <path d="M20 7 C9 -1 2 8 5 23 C7 31 8 51 14 52 C19 53 16 34 21 34 C26 34 23 53 29 51 C34 47 32 32 36 22 C40 9 31 -1 20 7Z" />
                <path
                  d="M10 14 Q20 21 30 14 M20 18 V28"
                  className="tooth-detail"
                />
              </svg>
              <span>{n}</span>
            </button>
          ))}
        </div>
      ))}
      <p aria-live="polite">
        {value
          ? `Сонгосон шүд: ${value}`
          : "Эмчилсэн шүдээ зураг дээр дарж сонгоно уу."}
      </p>
    </div>
  );
}
