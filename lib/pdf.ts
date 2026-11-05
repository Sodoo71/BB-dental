import path from "node:path";
import { readFile } from "node:fs/promises";
import PDFDocument from "pdfkit";
import { clinicTimestamp } from "./domain";
export type PdfBrand = {
  name: string;
  phone: string;
  address: string;
  logo: Buffer;
};
export const defaultLogoPath = path.join(
  process.cwd(),
  "public/images/bb-dental-logo.jpg",
);
const colors = {
  teal: "#007F83",
  dark: "#164E53",
  ink: "#344E5B",
  muted: "#83969D",
  line: "#E2ECE9",
  wash: "#F1F8F6",
};
const LEFT = 42,
  TOP = 178,
  WIDTH = 511,
  BOTTOM = 66;
export type PdfColumn = {
  label: string;
  weight: number;
  align?: "left" | "right";
};
export class ClinicPdf {
  constructor(public doc: PDFKit.PDFDocument) {}
  private get bottom() {
    return this.doc.page.height - BOTTOM;
  }
  space(height: number) {
    if (this.doc.y + height > this.bottom) this.doc.addPage();
  }
  heading(title: string) {
    this.space(55);
    const y = this.doc.y;
    this.doc.roundedRect(LEFT, y, 3, 17, 1).fill(colors.teal);
    this.doc
      .fontSize(12)
      .fillColor(colors.dark)
      .text(title, LEFT + 13, y + 1, { width: WIDTH - 13 });
    this.doc.y = y + 31;
    this.doc.x = LEFT;
  }
  paragraph(label: string, text: string) {
    this.heading(label);
    this.doc
      .fontSize(10)
      .fillColor(colors.ink)
      .text(text || "Бүртгэлгүй", LEFT, this.doc.y, {
        width: WIDTH,
        lineGap: 5,
      });
    this.doc.y += 20;
  }
  facts(values: [string, string][]) {
    for (let i = 0; i < values.length; i += 2) {
      const pair = values.slice(i, i + 2);
      const width = (WIDTH - 14) / 2;
      this.doc.fontSize(10);
      const heights = pair.map(
        ([, value]) =>
          this.doc.heightOfString(value || "—", {
            width: width - 24,
            lineGap: 3,
          }) + 40,
      );
      const height = Math.max(65, ...heights);
      if (height > 450) {
        for (const [label, value] of pair) this.paragraph(label, value);
        continue;
      }
      this.space(height + 15);
      const y = this.doc.y;
      pair.forEach(([label, value], index) => {
        const x = LEFT + index * (width + 14);
        this.doc.roundedRect(x, y, width, height, 8).fill(colors.wash);
        this.doc
          .fontSize(8)
          .fillColor(colors.muted)
          .text(label, x + 12, y + 12, { width: width - 24 });
        this.doc
          .fontSize(10)
          .fillColor(colors.ink)
          .text(value || "—", x + 12, y + 29, {
            width: width - 24,
            lineGap: 3,
          });
      });
      this.doc.y = y + height + 12;
      this.doc.x = LEFT;
    }
    this.doc.y += 8;
  }
  metrics(values: [string, string][]) {
    this.space(85);
    const y = this.doc.y;
    const gap = 12;
    const width = (WIDTH - (values.length - 1) * gap) / values.length;
    values.forEach(([label, value], index) => {
      const x = LEFT + index * (width + gap);
      this.doc
        .roundedRect(x, y, width, 70, 8)
        .fill(index === 0 ? colors.teal : colors.wash);
      this.doc
        .fillColor(index === 0 ? "#C5E7E2" : colors.muted)
        .fontSize(8)
        .text(label, x + 12, y + 13, { width: width - 24 });
      this.doc
        .fillColor(index === 0 ? "#FFFFFF" : colors.dark)
        .fontSize(15)
        .text(value, x + 12, y + 34, { width: width - 24 });
    });
    this.doc.y = y + 91;
    this.doc.x = LEFT;
  }
  private split(
    text: string,
    width: number,
    maxHeight: number,
  ): [string, string] {
    if (!text) return ["", ""];
    this.doc.fontSize(9);
    const fits = (s: string) =>
      this.doc.heightOfString(s, { width, lineGap: 3 }) <= maxHeight;
    if (fits(text)) return [text, ""];
    const chars = Array.from(text);
    let lo = 1,
      hi = chars.length;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (fits(chars.slice(0, mid).join(""))) lo = mid;
      else hi = mid - 1;
    }
    return [chars.slice(0, lo).join(""), chars.slice(lo).join("")];
  }
  table(columns: PdfColumn[], rows: string[][]) {
    const sum = columns.reduce((n, c) => n + c.weight, 0);
    const widths = columns.map((c) => (c.weight / sum) * WIDTH);
    const header = () => {
      this.space(45);
      const y = this.doc.y;
      this.doc.rect(LEFT, y, WIDTH, 30).fill(colors.teal);
      let x = LEFT;
      columns.forEach((c, i) => {
        this.doc
          .fontSize(8)
          .fillColor("#FFFFFF")
          .text(c.label, x + 9, y + 10, {
            width: widths[i] - 18,
            align: c.align || "left",
            height: 18,
            ellipsis: true,
          });
        x += widths[i];
      });
      this.doc.y = y + 30;
      this.doc.x = LEFT;
    };
    header();
    if (!rows.length)
      rows = [["Бүртгэлгүй", ...columns.slice(1).map(() => "")]];
    rows.forEach((row, index) => {
      let remaining = columns.map((_, i) => String(row[i] || ""));
      let first = true;
      while (first || remaining.some(Boolean)) {
        first = false;
        if (this.bottom - this.doc.y < 45) {
          this.doc.addPage();
          header();
        }
        const available = Math.min(420, this.bottom - this.doc.y - 18);
        const pieces = remaining.map((text, i) =>
          this.split(text, widths[i] - 18, available),
        );
        const heights = pieces.map(([head], i) =>
          head
            ? this.doc
                .fontSize(9)
                .heightOfString(head, { width: widths[i] - 18, lineGap: 3 })
            : 0,
        );
        const height = Math.max(32, ...heights.map((h) => h + 18));
        const y = this.doc.y;
        this.doc
          .rect(LEFT, y, WIDTH, height)
          .fill(index % 2 ? "#FFFFFF" : "#F5F9F8");
        this.doc
          .moveTo(LEFT, y + height)
          .lineTo(LEFT + WIDTH, y + height)
          .strokeColor(colors.line)
          .lineWidth(0.5)
          .stroke();
        let x = LEFT;
        pieces.forEach(([text], i) => {
          if (text)
            this.doc
              .fontSize(9)
              .fillColor(colors.ink)
              .text(text, x + 9, y + 9, {
                width: widths[i] - 18,
                height: height - 14,
                lineGap: 3,
                align: columns[i].align || "left",
              });
          x += widths[i];
        });
        this.doc.y = y + height;
        this.doc.x = LEFT;
        remaining = pieces.map(([, tail]) => tail);
        if (remaining.some(Boolean)) {
          this.doc.addPage();
          header();
        }
      }
    });
    this.doc.y += 24;
    this.doc.x = LEFT;
  }
  signature(name: string) {
    this.space(105);
    const y = this.doc.y;
    this.doc
      .fontSize(9)
      .fillColor(colors.muted)
      .text("Зөвшөөрөл өгсөн хүний нэр", LEFT, y, { width: 245 });
    this.doc
      .fillColor(colors.ink)
      .fontSize(10)
      .text(name || "____________________________", LEFT, y + 19, {
        width: 245,
      });
    this.doc
      .strokeColor(colors.line)
      .moveTo(LEFT, y + 59)
      .lineTo(LEFT + 230, y + 59)
      .stroke();
    this.doc
      .moveTo(LEFT + 280, y + 59)
      .lineTo(LEFT + WIDTH, y + 59)
      .stroke();
    this.doc
      .fontSize(8)
      .fillColor(colors.muted)
      .text("Гарын үсэг", LEFT, y + 66, { width: 230 })
      .text("Огноо", LEFT + 280, y + 66, { width: 230 });
    this.doc.y = y + 98;
    this.doc.x = LEFT;
  }
}
export async function createClinicPdf(
  title: string,
  render: (pdf: ClinicPdf) => Promise<void> | void,
  brand: PdfBrand,
  reference = "",
) {
  const fallback = await readFile(defaultLogoPath);
  let logo = brand.logo;
  const font = path.join(process.cwd(), "public/fonts/NotoSans-Regular.ttf");
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: TOP, left: LEFT, right: LEFT, bottom: BOTTOM },
    font,
    bufferPages: true,
    autoFirstPage: false,
    info: { Title: title, Author: brand.name, Creator: "BB Dental ERP" },
  });
  const chunks: Buffer[] = [];
  const complete = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  const stamp = clinicTimestamp(new Date().toISOString());
  doc.on("pageAdded", () => {
    doc.save();
    doc.rect(0, 0, doc.page.width, doc.page.height).fill("#FFFFFF");
    doc.rect(0, 0, doc.page.width, 6).fill(colors.teal);
    try {
      doc.image(logo, LEFT, 26, {
        fit: [54, 54],
        align: "center",
        valign: "center",
      });
    } catch {
      logo = fallback;
      doc.image(logo, LEFT, 26, { fit: [54, 54] });
    }
    doc
      .fontSize(19)
      .fillColor(colors.dark)
      .text(brand.name.slice(0, 60), LEFT + 70, 29, {
        width: WIDTH - 70,
        height: 28,
        ellipsis: true,
      });
    doc
      .fontSize(8)
      .fillColor(colors.teal)
      .text("CLINIC & CARE  /  BB DENTAL", LEFT + 70, 60, {
        width: WIDTH - 70,
      });
    const contact = [brand.phone, brand.address].filter(Boolean).join("  ·  ");
    doc
      .fontSize(7.5)
      .fillColor(colors.muted)
      .text(contact, LEFT, 91, { width: WIDTH, height: 12, ellipsis: true });
    doc
      .strokeColor(colors.line)
      .lineWidth(1)
      .moveTo(LEFT, 112)
      .lineTo(LEFT + WIDTH, 112)
      .stroke();
    doc
      .fontSize(16)
      .fillColor(colors.dark)
      .text(title, LEFT, 126, { width: WIDTH, height: 40, ellipsis: true });
    doc.restore();
    doc.fillColor(colors.ink).fontSize(10);
    doc.x = LEFT;
    doc.y = TOP;
  });
  doc.addPage();
  const pdf = new ClinicPdf(doc);
  await render(pdf);
  const range = doc.bufferedPageRange();
  for (let page = range.start; page < range.start + range.count; page++) {
    doc.switchToPage(page);
    const y = doc.page.height - 45;
    const previous = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc
      .strokeColor(colors.line)
      .lineWidth(0.7)
      .moveTo(LEFT, y - 10)
      .lineTo(LEFT + WIDTH, y - 10)
      .stroke();
    doc
      .fontSize(7)
      .fillColor(colors.muted)
      .text(
        `Хэвлэсэн: ${stamp}${reference ? `  ·  ${reference}` : ""}`,
        LEFT,
        y,
        { width: WIDTH - 90, lineBreak: false },
      );
    doc.text(
      `${page - range.start + 1} / ${range.count}`,
      LEFT + WIDTH - 70,
      y,
      { width: 70, align: "right", lineBreak: false },
    );
    doc.page.margins.bottom = previous;
  }
  doc.end();
  return complete;
}
