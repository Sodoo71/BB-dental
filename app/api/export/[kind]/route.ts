import { createClinicPdf } from "@/lib/pdf";
import { pdfBranding } from "@/lib/pdf-branding";
import ExcelJS from "exceljs";
import { db } from "@/lib/db";
import {
  audit,
  patientAccess,
  clinicalScope,
  requireUser,
  rateLimit,
} from "@/lib/auth";
import { exportClinicData } from "@/lib/data-export";
import { exportMetadata, exportMetadataRows } from "@/lib/export-template";
import { ApiError, safe } from "@/lib/http";
import { reportData } from "@/lib/reports";
import {
  methodNames,
  money,
  statusNames,
  today,
  clinicTimestamp,
} from "@/lib/domain";
const download = (bytes: Uint8Array, type: string, filename: string) =>
  new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": type,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
export async function GET(
  req: Request,
  ctx: { params: Promise<{ kind: string }> },
) {
  return safe(async () => {
    const user = await requireUser();
    const { kind } = await ctx.params;
    if (user.role === "RECEPTION")
      throw new ApiError(
        403,
        "Ресепшний баримт, тайлангийн хэсгийг ашиглана уу.",
      );
    const q = new URL(req.url).searchParams;
    const generatedAt = new Date().toISOString();
    if (kind === "data") {
      if (user.role !== "ADMIN")
        throw new ApiError(403, "Зөвхөн админ өгөгдөл экспортлоно.");
      await rateLimit(`data-export:${user.id}`, 3, 3600);
      const data = await exportClinicData();
      await audit(user, "CLINIC_DATA_EXPORTED", "system", user.id);
      return download(
        new TextEncoder().encode(JSON.stringify(data, null, 2)),
        "application/json; charset=utf-8",
        `bb-dental-data-${today()}.json`,
      );
    }
    if (kind === "patient") {
      const id = q.get("id");
      if (!id) throw new ApiError(400, "Өвчтөн сонгоно уу.");
      const scope = await clinicalScope(user, id);
      const patient = await db.patient.findUniqueOrThrow({
        where: { id },
        include: {
          appointments: {
            where: scope,
            include: { service: true, doctor: true },
            orderBy: { date: "desc" },
          },
          treatments: {
            where: scope,
            include: { doctor: true, service: true },
            orderBy: { date: "desc" },
          },
        },
      });
      const bytes = await createClinicPdf(
        "Өвчтөний мэдээллийн карт",
        (pdf) => {
          pdf.facts([
            ["Өвчтөний нэр", patient.name],
            ["Утасны дугаар", patient.phone],
            ["Төрсөн огноо", patient.birthDate || "Бүртгэлгүй"],
            ["Хаяг", patient.address || "Бүртгэлгүй"],
          ]);
          pdf.paragraph("Харшил", patient.allergies || "Бүртгэлгүй");
          pdf.paragraph("Өвчний түүх", patient.medicalHistory || "Бүртгэлгүй");
          pdf.heading("Үзлэгийн түүх");
          pdf.table(
            [
              { label: "Огноо / цаг", weight: 1.3 },
              { label: "Үйлчилгээ", weight: 2 },
              { label: "Эмч", weight: 1.5 },
              { label: "Төлөв", weight: 1.3 },
            ],
            patient.appointments.map((a) => [
              `${a.date}\n${a.startTime}–${a.endTime}`,
              a.service.name,
              a.doctor.name,
              statusNames[a.status],
            ]),
          );
          pdf.heading("Эмчилгээний түүх");
          for (const t of patient.treatments) {
            pdf.facts([
              ["Огноо / Эмч", `${t.date} · ${t.doctor.name}`],
              ["Үйлчилгээ / Шүд", `${t.service.name} · ${t.tooth || "—"}`],
            ]);
            pdf.paragraph("Онош", t.diagnosis);
            pdf.paragraph("Хийсэн эмчилгээ", t.procedure);
            if (t.note) pdf.paragraph("Эмчилгээний тэмдэглэл", t.note);
            pdf.table(
              [
                { label: "Үйлчилгээ", weight: 3 },
                { label: "Дүн", weight: 1, align: "right" },
              ],
              [[t.service.name, money(t.amount)]],
            );
          }
          if (!patient.treatments.length)
            pdf.paragraph("Эмчилгээний бүртгэл", "Одоогоор бүртгэлгүй.");
        },
        await pdfBranding(),
        `Карт ${patient.id.slice(0, 8).toUpperCase()}`,
        {
          period: "Бүртгэлтэй үзлэг, эмчилгээний түүх",
          exportedBy: user.name,
          generatedAt,
        },
      );
      await audit(user, "EXPORT", "patient", id);
      return download(bytes, "application/pdf", "patient-card.pdf");
    }
    if (kind === "document") {
      const id = q.get("id");
      if (!id) throw new ApiError(400, "Баримт сонгоно уу.");
      const item = await db.document.findUniqueOrThrow({
        where: { id },
        include: { patient: true },
      });
      await patientAccess(user, item.patientId);
      const bytes = await createClinicPdf(
        item.title,
        (pdf) => {
          pdf.facts([
            ["Өвчтөний нэр", item.patient.name],
            ["Утасны дугаар", item.patient.phone],
            ["Бүртгэсэн огноо", clinicTimestamp(item.createdAt.toISOString())],
            [
              "Баримтын төрөл",
              (
                {
                  CONSENT: "Зөвшөөрөл",
                  NOTE: "Тэмдэглэл",
                  REFERRAL: "Илгээх бичиг",
                } as Record<string, string>
              )[item.type] || item.type,
            ],
          ]);
          pdf.paragraph("Баримтын агуулга", item.content);
          pdf.signature(item.consentName);
        },
        await pdfBranding(),
        `Баримт ${item.id.slice(0, 8).toUpperCase()}`,
        {
          period: `Баримт бүртгэсэн: ${clinicTimestamp(item.createdAt.toISOString())}`,
          exportedBy: user.name,
          generatedAt,
        },
      );
      await audit(user, "EXPORT", "document", id);
      return download(bytes, "application/pdf", "document.pdf");
    }
    if (user.role !== "ADMIN") throw new ApiError(403, "Тайлангийн эрхгүй.");
    const report = await reportData(q);
    const reportTitle =
      (await db.setting.findUnique({ where: { key: "reportTitle" } }))?.value ||
      "BB Dental Clinic тайлан";
    const reportDocumentTitle = `${reportTitle} · Санхүүгийн нэгдсэн тайлан`;
    const period = q.get("period") || "month";
    const year = q.get("year") || today().slice(0, 4),
      month = q.get("month") || today().slice(5, 7);
    const periodLabel =
      period === "all"
        ? "Бүх хугацаа"
        : period === "day"
          ? today()
          : period === "year"
            ? `${year} он`
            : `${year} оны ${Number(month)}-р сар`;
    const label = report.serviceName
      ? `${periodLabel} · ${report.serviceName}`
      : periodLabel;
    if (kind === "excel") {
      const brand = await pdfBranding();
      const meta = exportMetadata(
        {
          ...brand,
          logoUrl: new URL(brand.logoUrl || "/images/default-logo.png", req.url)
            .href,
        },
        {
          title: reportDocumentTitle,
          period: label,
          exportedBy: user.name,
          generatedAt,
        },
      );
      const book = new ExcelJS.Workbook();
      book.creator = user.name;
      book.created = new Date(generatedAt);
      book.modified = new Date(generatedAt);
      book.subject = `${reportDocumentTitle} · ${label}`;
      const summary = book.addWorksheet("Нэгдсэн тайлан");
      summary.addRows([
        ["Үзүүлэлт", "Дүн"],
        ["Орлого", report.revenue],
        ["Зардал", report.expense],
        ["Цэвэр дүн", report.net],
        ["Эмчилгээний дүн", report.charges],
        ["Захиалга", report.appointmentCount],
        ["Өвчтөн", report.patientCount],
      ]);
      const services = book.addWorksheet("Үйлчилгээгээр");
      services.addRow([
        "Үйлчилгээ",
        "Захиалга",
        "Дууссан",
        "Эмчилгээ",
        "Эмчилгээний дүн",
        "Хүлээн авсан төлбөр",
      ]);
      report.byService.forEach((s) =>
        services.addRow([
          s.name,
          s.count,
          s.completed,
          s.treatments,
          s.charges,
          s.revenue,
        ]),
      );
      services.addRow([
        "Захиалгад холбоогүй шууд төлбөрийг үйлчилгээнд хуваарилахгүй. Үйлчилгээний шүүлтүүртэй тайланд нийтлэг зардлыг оруулахгүй.",
      ]);
      const payments = book.addWorksheet("Төлбөр");
      payments.addRow([
        "Огноо",
        "Өвчтөн",
        "Утас",
        "Үйлчилгээ",
        "Эмч",
        "Төлбөрийн хэлбэр",
        "Дүн",
      ]);
      report.payments.forEach((p) =>
        payments.addRow([
          p.date,
          p.patient.name,
          p.patient.phone,
          p.appointment?.service.name || "Шууд төлбөр",
          p.appointment?.doctor.name || "—",
          p.methodName || methodNames[p.method],
          p.amount,
        ]),
      );
      const expenses = book.addWorksheet("Зардал");
      expenses.addRow(["Огноо", "Гүйлгээ", "Ангилал", "Дүн"]);
      report.expenses.forEach((e) =>
        expenses.addRow([e.date, e.title, e.category, e.amount]),
      );
      const doctors = book.addWorksheet("Эмчийн ачаалал");
      doctors.addRow(["Эмч", "Захиалгын тоо"]);
      report.byDoctor.forEach((d) => doctors.addRow([d.name, d.count]));
      book.eachSheet((sheet) => {
        const metadataRows = exportMetadataRows({
          ...meta,
          title: `${reportDocumentTitle} · ${sheet.name}`,
        });
        const columnCount = Math.max(2, sheet.columnCount);
        sheet.spliceRows(1, 0, ...metadataRows, []);
        const headerRow = metadataRows.length + 2;
        metadataRows.forEach(([, value], index) => {
          if (columnCount > 2)
            sheet.mergeCells(index + 1, 2, index + 1, columnCount);
          const row = sheet.getRow(index + 1);
          row.height = Math.max(
            22,
            Math.min(
              100,
              Math.ceil(String(value).length / (22 * (columnCount - 1))) * 16,
            ),
          );
          row.getCell(1).font = { bold: true, color: { argb: "FF164E53" } };
          row.getCell(2).alignment = { vertical: "middle", wrapText: true };
          if (index === metadataRows.length - 1 && value)
            row.getCell(2).value = {
              text: String(value),
              hyperlink: String(value),
            };
        });
        sheet.views = [{ state: "frozen", ySplit: headerRow }];
        sheet.getRow(headerRow).font = {
          bold: true,
          color: { argb: "FFFFFFFF" },
        };
        sheet.getRow(headerRow).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF007F83" },
        };
        sheet.pageSetup = {
          paperSize: 9,
          orientation: columnCount > 4 ? "landscape" : "portrait",
          fitToPage: true,
          fitToWidth: 1,
          fitToHeight: 0,
          printTitlesRow: `1:${headerRow}`,
        };
        sheet.headerFooter.oddFooter = `&L${brand.name.replaceAll("&", "&&")}&C&P / &N`;
        sheet.columns.forEach((col) => {
          col.width = 25;
        });
      });
      const bytes = await book.xlsx.writeBuffer();
      await audit(user, "EXPORT", "report", label);
      return download(
        new Uint8Array(bytes),
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "bb-dental-report.xlsx",
      );
    }
    if (kind === "pdf") {
      const bytes = await createClinicPdf(
        reportDocumentTitle,
        (pdf) => {
          pdf.facts([
            ["Тайлант хугацаа", label],
            ["Тайлангийн валют", "Монгол төгрөг · MNT"],
          ]);
          pdf.metrics([
            ["НИЙТ ОРЛОГО", money(report.revenue)],
            ["НИЙТ ЗАРДАЛ", money(report.expense)],
            ["ЦЭВЭР ДҮН", money(report.net)],
          ]);
          pdf.facts([
            ["Нийт захиалга", String(report.appointmentCount)],
            ["Давхардалгүй өвчтөн", String(report.patientCount)],
          ]);
          pdf.heading("Төлбөрийн хэлбэр");
          pdf.table(
            [
              { label: "Төлбөрийн хэлбэр", weight: 3 },
              { label: "Дүн", weight: 1, align: "right" },
            ],
            Object.entries(report.methods).map(([method, value]) => [
              methodNames[method],
              money(value),
            ]),
          );
          pdf.heading("Үйлчилгээ тус бүрийн тайлан");
          pdf.table(
            [
              { label: "Үйлчилгээ", weight: 2 },
              { label: "Захиалга", weight: 1 },
              { label: "Дууссан", weight: 1 },
              { label: "Эмчилгээний дүн", weight: 1.4 },
              { label: "Төлбөр", weight: 1.4 },
            ],
            report.byService.map((s) => [
              s.name,
              String(s.count),
              String(s.completed),
              money(s.charges),
              money(s.revenue),
            ]),
          );
          pdf.paragraph(
            "Тайлбар",
            "Захиалгад холбоогүй шууд төлбөрийг үйлчилгээнд хуваарилахгүй. Үйлчилгээгээр шүүсэн тайланд нийтлэг зардлыг оруулахгүй.",
          );
          pdf.heading("Эмчийн ачаалал");
          pdf.table(
            [
              { label: "Эмч", weight: 3 },
              { label: "Захиалгын тоо", weight: 1, align: "right" },
            ],
            report.byDoctor.map((d) => [d.name, String(d.count)]),
          );
          pdf.heading("Төлбөрийн журнал");
          pdf.table(
            [
              { label: "Огноо", weight: 1.1 },
              { label: "Өвчтөн / Үйлчилгээ", weight: 2.3 },
              { label: "Хэлбэр", weight: 1 },
              { label: "Дүн", weight: 1.1, align: "right" },
            ],
            report.payments.map((p) => [
              p.date,
              `${p.patient.name}\n${p.appointment?.service.name || "Шууд төлбөр"}`,
              p.methodName || methodNames[p.method],
              money(p.amount),
            ]),
          );
          pdf.heading("Зардлын журнал");
          pdf.table(
            [
              { label: "Огноо", weight: 1.1 },
              { label: "Зардал / Ангилал", weight: 2.5 },
              { label: "Дүн", weight: 1.1, align: "right" },
            ],
            report.expenses.map((e) => [
              e.date,
              `${e.title}\n${e.category}`,
              money(e.amount),
            ]),
          );
        },
        await pdfBranding(),
        label,
        { period: label, exportedBy: user.name, generatedAt },
      );
      await audit(user, "EXPORT", "report", label);
      return download(bytes, "application/pdf", "bb-dental-report.pdf");
    }
    throw new ApiError(404, "Экспорт олдсонгүй.");
  });
}
