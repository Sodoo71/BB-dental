"use client";
import { useState, useRef } from "react";
import { UploadCloud, X, ImageIcon } from "lucide-react";
import Image from "next/image";
export default function ImageUpload({
  value,
  onChange,
  purpose = "doctors",
  onBusyChange,
}: {
  value: string;
  onChange: (url: string) => void | Promise<void>;
  purpose?: "doctors" | "services" | "logo";
  onBusyChange?: (busy: boolean) => void;
}) {
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  return (
    <div className={`image-upload image-upload-${purpose}`}>
      <div className="image-upload-preview">
        {value ? (
          <Image
            src={value}
            alt="Оруулсан зургийн урьдчилсан харагдац"
            fill
            unoptimized
            sizes="180px"
            style={{ objectFit: purpose === "logo" ? "contain" : "cover" }}
          />
        ) : (
          <ImageIcon size={28} />
        )}
      </div>
      <div className="image-upload-controls">
        <button
          type="button"
          className="erp-secondary"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          <UploadCloud size={16} />
          {busy ? "Зураг илгээж байна…" : "Зураг сонгох"}
        </button>
        <input
          ref={inputRef}
          hidden
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={busy}
          aria-label="Зураг сонгох"
          onChange={async (e) => {
            const input = e.currentTarget;
            const file = input.files?.[0];
            if (!file) return;
            setError("");
            if (file.size > 5 * 1024 * 1024) {
              setError("Зургийн хэмжээ 5 MB-аас хэтрэхгүй байна.");
              input.value = "";
              return;
            }
            setBusy(true);
            onBusyChange?.(true);
            try {
              const data = new FormData();
              data.set("file", file);
              data.set("purpose", purpose);
              const res = await fetch("/api/upload", {
                method: "POST",
                body: data,
              });
              const result = await res.json();
              if (!res.ok)
                throw new Error(result.error || "Зураг илгээж чадсангүй.");
              await onChange(result.url);
            } catch (error) {
              setError((error as Error).message);
            } finally {
              setBusy(false);
              onBusyChange?.(false);
              input.value = "";
            }
          }}
        />

        {value && (
          <button
            type="button"
            className="erp-secondary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              onBusyChange?.(true);
              setError("");
              try {
                await onChange("");
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
                onBusyChange?.(false);
              }
            }}
          >
            <X size={14} />
            Зургийг арилгах
          </button>
        )}
        <small>JPG, PNG, WEBP · 5 MB хүртэл</small>
      </div>
      {error && (
        <p role="alert" className="upload-error">
          {error}
        </p>
      )}
    </div>
  );
}
