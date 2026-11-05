"use client";
import { useState } from "react";
export default function ToothPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [primary, setPrimary] = useState(Number(value) >= 51);
  const top = primary
    ? [55, 54, 53, 52, 51, 61, 62, 63, 64, 65]
    : [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
  const bottom = primary
    ? [85, 84, 83, 82, 81, 71, 72, 73, 74, 75]
    : [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];
  return (
    <div className="fdi-picker" role="group" aria-label="Шүдний FDI зураг">
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
