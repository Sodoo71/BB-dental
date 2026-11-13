import { test } from "node:test";
import assert from "node:assert/strict";
import {
  clinicCsv,
  exportMetadata,
  exportMetadataRows,
} from "../lib/export-template";

const brand = {
  name: "BB Dental Clinic",
  phone: "+976 95963531",
  address: "Улаанбаатар",
  logoUrl: "https://clinic.example/images/default-logo.png",
};
const metadata = exportMetadata(brand, {
  title: "Төлөгдөөгүй төлбөрийн тайлан",
  period: "Татсан үеийн нийт үлдэгдэл",
  exportedBy: "Б. Номин",
  generatedAt: "2026-11-12T17:05:00.000Z",
  reference: "BB-TEST",
});

test("all export templates identify the clinic, document, period, exporter and Ulaanbaatar download date", () => {
  const rows = new Map(
    exportMetadataRows(metadata).map(([key, value]) => [key, value]),
  );
  assert.equal(rows.get("Эмнэлэг"), brand.name);
  assert.equal(rows.get("Тайлан / Баримт"), metadata.title);
  assert.equal(rows.get("Хамрах хугацаа"), metadata.period);
  assert.equal(rows.get("Татсан ажилтан"), "Б. Номин");
  assert.equal(rows.get("Баримтын дугаар"), "BB-TEST");
  assert.equal(rows.get("Лого (холбоос)"), brand.logoUrl);
  assert.match(String(rows.get("Татсан / Хэвлэсэн огноо")), /2026-11-13 01:05/);
  assert.match(metadata.generatedLabel, /UTC\+08:00/);
});

test("CSV preserves Mongolian text, numeric amounts and quoted multiline cells while rejecting formula execution", () => {
  const csv = clinicCsv(metadata, [
    ["Нэр", "Дүн", "Тайлбар"],
    ['Б. "Номин"', -15000, "Эхний мөр\nХоёр дахь мөр"],
    ['=HYPERLINK("https://evil.test")', 100, "\t +SUM(1,2)"],
  ]);
  assert.ok(csv.startsWith("\uFEFF"));
  assert.ok(csv.includes('"Тайлан / Баримт","Төлөгдөөгүй төлбөрийн тайлан"'));
  assert.ok(csv.includes('"Б. ""Номин""","-15000","Эхний мөр\nХоёр дахь мөр"'));
  assert.ok(csv.includes("\"'=HYPERLINK("));
  assert.ok(csv.includes('"\'\t +SUM(1,2)"'));
  assert.ok(
    csv.includes(
      '"Лого (холбоос)","https://clinic.example/images/default-logo.png"',
    ),
  );
});
