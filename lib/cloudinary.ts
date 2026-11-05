import { createHash } from "node:crypto";
import { ApiError } from "./http";
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export type ImagePurpose = "doctors" | "services" | "logo";
export function cloudinaryConfig() {
  let cloudName = process.env.CLOUDINARY_CLOUD_NAME,
    apiKey = process.env.CLOUDINARY_API_KEY,
    apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (process.env.CLOUDINARY_URL) {
    try {
      const url = new URL(process.env.CLOUDINARY_URL);
      if (url.protocol !== "cloudinary:") throw new Error();
      cloudName = url.hostname;
      apiKey = decodeURIComponent(url.username);
      apiSecret = decodeURIComponent(url.password);
    } catch {
      throw new ApiError(503, "Cloudinary тохиргоо буруу байна.");
    }
  }
  if (!cloudName || !apiKey || !apiSecret || !/^[\w-]+$/.test(cloudName))
    throw new ApiError(
      503,
      "Cloudinary тохируулаагүй байна. Эмнэлгийн админтай холбогдоно уу.",
    );
  return { cloudName, apiKey, apiSecret };
}
export function imageFormat(bytes: Uint8Array) {
  if (bytes.length < 12) throw new ApiError(400, "Зургийн файл гэмтсэн байна.");
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  if (
    Buffer.from(bytes.subarray(0, 8)).equals(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    )
  )
    return "png";
  if (
    Buffer.from(bytes.subarray(0, 4)).toString() === "RIFF" &&
    Buffer.from(bytes.subarray(8, 12)).toString() === "WEBP"
  )
    return "webp";
  throw new ApiError(400, "Зөвхөн JPG, PNG, WEBP зураг оруулна уу.");
}
export function isCloudinaryImage(value: string, cloudName?: string) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.hostname === "res.cloudinary.com" &&
      !url.port &&
      !url.username &&
      !url.password &&
      url.pathname.startsWith(
        `/${cloudName || cloudinaryConfig().cloudName}/image/upload/`,
      ) &&
      !url.search &&
      !url.hash
    );
  } catch {
    return false;
  }
}
export async function uploadImage(
  bytes: Uint8Array,
  purpose: ImagePurpose,
  send: typeof fetch = fetch,
) {
  if (bytes.length > MAX_IMAGE_BYTES)
    throw new ApiError(413, "Зургийн хэмжээ 5 MB-аас хэтрэхгүй байна.");
  const inputFormat = imageFormat(bytes);
  const config = cloudinaryConfig();
  const params: Record<string, string> = {
    folder: `bb-dental/${purpose}`,
    format: purpose === "logo" ? "png" : "webp",
    timestamp: String(Math.floor(Date.now() / 1000)),
    transformation:
      purpose === "logo" ? "c_limit,w_512,h_512" : "c_limit,w_1800,h_1800",
  };
  const signature = createHash("sha1")
    .update(
      Object.keys(params)
        .sort()
        .map((key) => `${key}=${params[key]}`)
        .join("&") + config.apiSecret,
    )
    .digest("hex");
  const form = new FormData();
  for (const [key, value] of Object.entries(params)) form.set(key, value);
  form.set("api_key", config.apiKey);
  form.set("signature", signature);
  form.set(
    "file",
    new Blob([new Uint8Array(bytes)], {
      type: inputFormat === "jpg" ? "image/jpeg" : `image/${inputFormat}`,
    }),
    `image.${inputFormat}`,
  );
  let result;
  try {
    const response = await send(
      `https://api.cloudinary.com/v1_1/${config.cloudName}/image/upload`,
      { method: "POST", body: form, signal: AbortSignal.timeout(20000) },
    );
    result = await response.json();
    if (
      !response.ok ||
      !isCloudinaryImage(result.secure_url, config.cloudName) ||
      typeof result.public_id !== "string"
    )
      throw new Error();
  } catch {
    throw new ApiError(
      502,
      "Cloudinary руу зураг илгээж чадсангүй. Дахин оролдоно уу.",
    );
  }
  return {
    url: String(result.secure_url),
    publicId: String(result.public_id),
    width: Number(result.width),
    height: Number(result.height),
  };
}
