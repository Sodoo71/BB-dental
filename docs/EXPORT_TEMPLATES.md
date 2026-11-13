# Clinic export template

PDFs, printable invoices/receipts, CSV reports and Excel worksheets share clinic/document metadata through `lib/export-template.ts`.

Every report identifies the clinic, document/report title, reporting period or record date, the downloading staff member, and the download/print time in Asia/Ulaanbaatar (UTC+08:00). Existing document/receipt references are included where available. Transaction/record dates remain separate from the export timestamp.

## Coverage

| Output | Template |
| --- | --- |
| Patient-card PDF | Circular clinic logo, clinic/contact header, patient-card title, history scope, downloading staff/time, card reference; repeated header and page numbers |
| Clinical document PDF | Same header; actual document title, creation date, staff/time and document reference |
| Admin financial-report PDF | Same header; configured report title plus explicit financial-report type, period/service filters, staff/time and page numbers |
| Printable invoice / Save as PDF | `ExportDocument` header with circular logo, invoice title/number, creation/due date, downloading staff/time |
| Printable payment receipt / Save as PDF | Same header; receipt number, actual transaction date, downloading staff/time; original cashier remains in receipt data |
| Reception consolidated CSV | Clinic identity/contact, report title, selected date range, staff/time and logo URL before existing report rows |
| Receivables CSV | Same metadata; explicitly describes the balance as a snapshot at download time |
| Own cash-session CSV | Same metadata plus session ID and opened/closed period |
| Admin financial Excel | Same metadata on each worksheet; descriptive sheet title, repeated print headings, frozen data headers and logo hyperlink |

CSV is a text format and cannot embed a graphic logo. Its template contains a logo link. Excel includes that same link. PDF and printable documents render the logo with a circular clip/border, using the configured clinic logo and existing bundled fallback. The logo asset itself is not modified.

The portable Admin JSON data export retains its existing machine-readable format; it is not a printed report.

## Implementation

- `lib/export-template.ts`: common metadata and CSV serialization, with UTF-8 BOM, quoted fields and spreadsheet-formula protection. Negative numeric amounts remain numeric.
- `lib/pdf.ts`: common circular-logo PDF header, document metadata, local export timestamp and page footer on every page.
- `app/erp/export-document.tsx` and `.css`: shared printable document shell and CSV download hook. Printing waits for the logo and refreshes its timestamp when the print action is invoked. Only the selected document is printed, including when another invoice/receipt is present on screen.
- `/api/branding`: exposes only the public clinic name, phone, address and validated logo URL used by the templates.
- Existing PDF/Excel routes and Reception export buttons retain their authorization and data scope.

## Executed checks

- 26 unit tests passed, including Mongolian CSV encoding/escaping, metadata/timezone rollover, PDF branding/font embedding, long-content pagination and PDF exporter/timestamp metadata.
- 29 browser/API verification groups passed against an isolated migrated database. This includes real downloads of all three PDF kinds, five Excel worksheets, all three CSV report types, and the printable payment receipt.
- The browser verifies circular logo styling, current clinic settings, staff/time metadata and a one-page receipt PDF.
- Next.js build, TypeScript and Cloudflare/OpenNext build passed. Lint has zero errors and the three existing unused-variable warnings in ERP/Telegram routes.
- Sample PDF: `/private/tmp/bb-dental-pdf-preview.pdf`; rendered preview: `/private/tmp/bb-dental-pdf-template.png`; downloaded CSV examples: `/private/tmp/bb-reception-qa/*-template.csv`.

No hosted database changes or deployment were performed for this template update. Physical-printer output was not exercised; browser printing and PDF generation were verified.
