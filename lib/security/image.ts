export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export function detectImageMime(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null;
  const prefix = Buffer.from(bytes);
  if (prefix.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return "image/jpeg";
  if (prefix.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "image/png";
  if (prefix.toString("ascii", 0, 4) === "RIFF" && prefix.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return null;
}
