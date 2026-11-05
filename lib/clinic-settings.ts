import { z } from "zod";
import { ApiError } from "./http";
import { isCloudinaryImage } from "./cloudinary";
export const publicSettingKeys = [
  "clinicName",
  "phone",
  "email",
  "address",
  "hours",
  "logoUrl",
  "footerDescription",
  "footerHoursTitle",
  "footerContactTitle",
  "footerBookingTitle",
  "footerBookingLabel",
  "copyrightText",
  "facebookUrl",
  "instagramUrl",
] as const;
export const editableSettingKeys = [
  ...publicSettingKeys,
  "reportTitle",
] as const;
export function settingValue(key: string, value: string) {
  let result = z.string().max(5000).parse(value).trim();
  if (key === "email" && result)
    result = z.email("Имэйл буруу байна.").parse(result);
  if (["facebookUrl", "instagramUrl"].includes(key) && result)
    result = z
      .url()
      .refine((v) => v.startsWith("https://"), "HTTPS холбоос оруулна уу.")
      .parse(result);
  if (key === "logoUrl" && result && !isCloudinaryImage(result))
    throw new ApiError(400, "Логог Cloudinary upload-аар оруулна уу.");
  return result;
}
export const clinicBatchSchema = z
  .object(
    Object.fromEntries(
      editableSettingKeys.map((key) => [key, z.string().max(5000).optional()]),
    ),
  )
  .strict();
