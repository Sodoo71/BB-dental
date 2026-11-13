import { clinicTimestamp } from "./domain";

export type ExportBrand = {
  name: string;
  phone: string;
  address: string;
  logoUrl: string;
};
export type ExportDetails = {
  title: string;
  period: string;
  exportedBy: string;
  reference?: string;
  generatedAt?: string;
};
export type ExportMetadata = ExportBrand &
  ExportDetails & {
    generatedAt: string;
    generatedLabel: string;
  };

export function exportMetadata(
  brand: ExportBrand,
  details: ExportDetails,
): ExportMetadata {
  const generatedAt = details.generatedAt || new Date().toISOString();
  return {
    ...brand,
    ...details,
    generatedAt,
    generatedLabel: `${clinicTimestamp(generatedAt)} · Улаанбаатар (UTC+08:00)`,
  };
}

/** The same metadata appears in PDFs, print documents and spreadsheet headers. */
export function exportMetadataRows(
  meta: ExportMetadata,
): (string | number)[][] {
  return [
    ["Эмнэлэг", meta.name],
    ["Тайлан / Баримт", meta.title],
    ["Хамрах хугацаа", meta.period],
    ["Татсан / Хэвлэсэн огноо", meta.generatedLabel],
    ["Татсан ажилтан", meta.exportedBy],
    ...(meta.reference ? [["Баримтын дугаар", meta.reference]] : []),
    ["Утас", meta.phone],
    ["Хаяг", meta.address],
    ["Лого (холбоос)", meta.logoUrl],
  ];
}

export function clinicCsv(meta: ExportMetadata, rows: (string | number)[][]) {
  // Keep numeric values numeric, and prevent spreadsheet formulas in text cells.
  const cell = (value: string | number) =>
    `"${(typeof value === "string"
      ? value.replace(/^[\s\u0000-\u0020]*[=+@\-]/, "'$&")
      : String(value)
    ).replaceAll('"', '""')}"`;
  return (
    "\uFEFF" +
    [...exportMetadataRows(meta), [], ...rows]
      .map((row) => row.map(cell).join(","))
      .join("\r\n")
  );
}
