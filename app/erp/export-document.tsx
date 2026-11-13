"use client";
import Image from "next/image";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { Printer } from "lucide-react";
import { api, Feedback, LoadingSkeleton, useResource } from "./ui";
import { useUser } from "./shell";
import { defaultLogoUrl } from "../components/clinic-branding";
import {
  clinicCsv,
  exportMetadata,
  type ExportBrand,
} from "@/lib/export-template";
import "./export-document.css";

function selectPrintDocument(preferred?: HTMLElement | null) {
  const dialog = document.querySelector("dialog[open]");
  const target =
    preferred ||
    document.querySelector<HTMLElement>("[data-clinic-print-target]") ||
    (dialog
      ? dialog.querySelector<HTMLElement>(".clinic-document")
      : document.querySelector<HTMLElement>(".clinic-document"));
  document
    .querySelectorAll("[data-clinic-print-target]")
    .forEach((el) => el.removeAttribute("data-clinic-print-target"));
  target?.setAttribute("data-clinic-print-target", "true");
  document.body.dataset.clinicPrinting = "true";
  return target;
}
function clearPrintDocument() {
  delete document.body.dataset.clinicPrinting;
  document
    .querySelectorAll("[data-clinic-print-target]")
    .forEach((el) => el.removeAttribute("data-clinic-print-target"));
}

/** One printable shell for invoices and checkout receipts. */
export function ExportDocument({
  title,
  period,
  reference,
  children,
  printable = true,
  printLabel = "Баримт хэвлэх / PDF хадгалах",
}: {
  title: string;
  period: string;
  reference?: string;
  children: ReactNode;
  printable?: boolean;
  printLabel?: string;
}) {
  const actor = useUser();
  const documentRef = useRef<HTMLElement>(null);
  const brand = useResource<ExportBrand>("/api/branding");
  const [generatedAt, setGeneratedAt] = useState(() =>
    new Date().toISOString(),
  );
  const [failedLogo, setFailedLogo] = useState("");
  const [loadedLogo, setLoadedLogo] = useState("");
  const logoUrl = brand.data?.logoUrl || defaultLogoUrl;
  const imageUrl = failedLogo === logoUrl ? defaultLogoUrl : logoUrl;
  useEffect(() => {
    const owner = documentRef.current;
    const update = () => {
      if (selectPrintDocument() === owner)
        flushSync(() => setGeneratedAt(new Date().toISOString()));
    };
    const finish = () => clearPrintDocument();
    window.addEventListener("beforeprint", update);
    window.addEventListener("afterprint", finish);
    return () => {
      window.removeEventListener("beforeprint", update);
      window.removeEventListener("afterprint", finish);
      if (owner?.hasAttribute("data-clinic-print-target"))
        clearPrintDocument();
    };
  }, [brand.data]);
  if (brand.error)
    return <Feedback retry={brand.retry}>{brand.error}</Feedback>;
  if (!brand.data) return <LoadingSkeleton />;
  const meta = exportMetadata(brand.data, {
    title,
    period,
    reference,
    exportedBy: actor.name,
    generatedAt,
  });
  return (
    <>
      <article
        ref={documentRef}
        className="reception-print clinic-document"
        aria-label={title}
      >
        <header className="clinic-document-header">
          <div className="clinic-document-brand">
            <Image
              src={imageUrl}
              alt={`${meta.name} лого`}
              width={64}
              height={64}
              unoptimized
              loading="eager"
              className="clinic-document-logo"
              onLoad={() => setLoadedLogo(imageUrl)}
              onError={() => {
                setFailedLogo(logoUrl);
                setLoadedLogo("");
              }}
            />
            <div>
              <strong>{meta.name}</strong>
              <p>{[meta.phone, meta.address].filter(Boolean).join(" · ")}</p>
            </div>
          </div>
          <h2>{meta.title}</h2>
          <dl className="clinic-document-metadata">
            <div>
              <dt>Хамрах хугацаа</dt>
              <dd>{meta.period}</dd>
            </div>
            <div>
              <dt>Татсан / Хэвлэсэн огноо</dt>
              <dd>{meta.generatedLabel}</dd>
            </div>
            <div>
              <dt>Татсан ажилтан</dt>
              <dd>{meta.exportedBy}</dd>
            </div>
            {meta.reference && (
              <div>
                <dt>Баримтын дугаар</dt>
                <dd>{meta.reference}</dd>
              </div>
            )}
          </dl>
        </header>
        <div className="clinic-document-body">{children}</div>
        <footer className="clinic-document-footer">
          {meta.name} · {meta.generatedLabel}
        </footer>
      </article>
      {printable && (
        <button
          className="erp-primary reception-no-print"
          disabled={loadedLogo !== imageUrl}
          onClick={() => {
            selectPrintDocument(documentRef.current);
            flushSync(() => setGeneratedAt(new Date().toISOString()));
            window.print();
          }}
        >
          <Printer size={17} />
          {loadedLogo === imageUrl ? printLabel : "Лого ачаалж байна…"}
        </button>
      )}
    </>
  );
}

export function useClinicCsv() {
  const actor = useUser();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function download(options: {
    name: string;
    title: string;
    period: string;
    reference?: string;
    rows: (string | number)[][];
  }) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const brand = await api<ExportBrand>("/api/branding");
      const meta = exportMetadata(
        {
          ...brand,
          logoUrl: new URL(
            brand.logoUrl || defaultLogoUrl,
            window.location.origin,
          ).href,
        },
        {
          title: options.title,
          period: options.period,
          reference: options.reference,
          exportedBy: actor.name,
        },
      );
      const url = URL.createObjectURL(
        new Blob([clinicCsv(meta, options.rows)], {
          type: "text/csv;charset=utf-8",
        }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = options.name + ".csv";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, download };
}
