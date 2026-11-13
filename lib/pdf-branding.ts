import { readFile } from "node:fs/promises";
import { db } from "./db";
import { defaultLogoPath, type PdfBrand } from "./pdf";
import { imageFormat, isCloudinaryImage } from "./cloudinary";
export async function pdfBranding(): Promise<PdfBrand> {
  const values = Object.fromEntries(
    (
      await db.setting.findMany({
        where: { key: { in: ["clinicName", "phone", "address", "logoUrl"] } },
      })
    ).map((s) => [s.key, s.value]),
  );
  let logo = await readFile(defaultLogoPath);
  if (values.logoUrl && isCloudinaryImage(values.logoUrl)) {
    try {
      const response = await fetch(values.logoUrl, {
        redirect: "error",
        signal: AbortSignal.timeout(4000),
      });
      if (
        !response.ok ||
        Number(response.headers.get("content-length") || 0) > 2 * 1024 * 1024
      )
        throw new Error();
      const reader = response.body?.getReader();
      if (!reader) throw new Error();
      const chunks: Uint8Array[] = [];
      let size = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 2 * 1024 * 1024) {
          await reader.cancel();
          throw new Error();
        }
        chunks.push(value);
      }
      const bytes = Buffer.concat(chunks);
      if (!["png", "jpg"].includes(imageFormat(bytes))) throw new Error();
      logo = bytes;
    } catch {
      /* Keep the bundled clinic logo if delivery is temporarily unavailable. */
    }
  }
  return {
    name: values.clinicName || "BB Dental Clinic",
    phone: values.phone || "+976 9596-3531",
    address: values.address || "",
    logo,
    logoUrl:
      values.logoUrl && isCloudinaryImage(values.logoUrl)
        ? values.logoUrl
        : "/images/default-logo.png",
  };
}
