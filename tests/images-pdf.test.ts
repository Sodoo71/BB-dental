import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import {
  imageFormat,
  isCloudinaryImage,
  uploadImage,
  MAX_IMAGE_BYTES,
} from "../lib/cloudinary";
import { createClinicPdf, defaultLogoPath } from "../lib/pdf";
test("image upload validates real formats, size and signed Cloudinary parameters", async () => {
  const bytes = await readFile(defaultLogoPath);
  assert.equal(imageFormat(bytes), "png");
  assert.throws(() =>
    imageFormat(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>')),
  );
  const old = Object.fromEntries(
    [
      "CLOUDINARY_URL",
      "CLOUDINARY_CLOUD_NAME",
      "CLOUDINARY_API_KEY",
      "CLOUDINARY_API_SECRET",
    ].map((key) => [key, process.env[key]]),
  );
  Object.assign(process.env, {
    CLOUDINARY_URL: "",
    CLOUDINARY_CLOUD_NAME: "qa-cloud",
    CLOUDINARY_API_KEY: "12345",
    CLOUDINARY_API_SECRET: "qa-secret",
  });
  try {
    const fake: typeof fetch = async (url, init) => {
      assert.equal(
        String(url),
        "https://api.cloudinary.com/v1_1/qa-cloud/image/upload",
      );
      const form = init?.body as FormData;
      assert.equal(form.get("folder"), "bb-dental/logo");
      assert.equal(form.get("format"), "png");
      const params = ["folder", "format", "timestamp", "transformation"]
        .map((key) => `${key}=${form.get(key)}`)
        .join("&");
      assert.equal(
        form.get("signature"),
        createHash("sha1")
          .update(params + "qa-secret")
          .digest("hex"),
      );
      assert.equal(form.get("api_key"), "12345");
      return Response.json({
        secure_url:
          "https://res.cloudinary.com/qa-cloud/image/upload/v1/bb-dental/logo/test.png",
        public_id: "bb-dental/logo/test",
        width: 512,
        height: 512,
      });
    };
    const image = await uploadImage(bytes, "logo", fake);
    assert.equal(image.width, 512);
    assert.equal(isCloudinaryImage(image.url), true);
    assert.equal(
      isCloudinaryImage("https://evil.example/qa-cloud/image/upload/test.png"),
      false,
    );
    assert.equal(
      isCloudinaryImage(
        "https://res.cloudinary.com/another-cloud/image/upload/test.png",
      ),
      false,
    );
    await assert.rejects(
      uploadImage(new Uint8Array(MAX_IMAGE_BYTES + 1), "logo", fake),
    );
  } finally {
    for (const [key, value] of Object.entries(old))
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
  }
});

test("branded PDF embeds the logo/font and paginates long Mongolian content", async () => {
  const brand = {
    name: "BB Dental Clinic",
    phone: "+976 9596-3531",
    address: "Улаанбаатар · Шүдний эмнэлэг",
    logo: await readFile(defaultLogoPath),
  };
  const bytes = await createClinicPdf(
    "Өвчтөний мэдээллийн карт",
    (pdf) => {
      pdf.facts([
        ["Өвчтөний нэр", "Б. Энхжин (Загвар)"],
        ["Утас", "9911-2233"],
        ["Төрсөн огноо", "1994-06-15"],
        ["Хаяг", "Улаанбаатар хот, Баянгол дүүрэг"],
      ]);
      pdf.paragraph("Харшил", "Харшлын мэдээлэл бүртгэлгүй.");
      pdf.heading("Үзлэгийн түүх");
      pdf.table(
        [
          { label: "Огноо", weight: 1 },
          { label: "Үйлчилгээ / Тэмдэглэл", weight: 3 },
          { label: "Дүн", weight: 1, align: "right" },
        ],
        Array.from({ length: 35 }, (_, i) => [
          `${i + 1}. 2026-11-06`,
          i === 3
            ? "Дэлгэрэнгүй тэмдэглэл. ".repeat(160)
            : "Шүдний үзлэг · Эмч Б. Болор",
          "45,000 ₮",
        ]),
      );
      pdf.signature("Б. Энхжин");
    },
    brand,
    "ЗАГВАР",
    {
      period: "Бүртгэлтэй үзлэг, эмчилгээний түүх",
      exportedBy: "Тест ажилтан",
      generatedAt: "2026-11-13T01:30:00.000Z",
    },
  );
  const raw = bytes.toString("latin1");
  assert.equal(bytes.subarray(0, 4).toString(), "%PDF");
  assert.match(raw, /\/Subtype \/Image/);
  assert.match(raw, /FontFile2/);
  assert.ok(bytes.includes(Buffer.from("Тест ажилтан", "utf16le").swap16()));
  assert.ok(
    bytes.includes(Buffer.from("2026-11-13 09:30", "utf16le").swap16()),
  );
  assert.ok((raw.match(/\/Type \/Page\b/g) || []).length >= 3);
  await writeFile("/private/tmp/bb-dental-pdf-preview.pdf", bytes);
});
