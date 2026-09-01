import crypto from "crypto";

export type CloudinaryConfig = {
  apiKey: string;
  apiSecret: string;
  cloudName: string;
};

export function getCloudinaryConfig(): CloudinaryConfig | null {
  // 1. Try parsing CLOUDINARY_URL
  const rawUrl =
    process.env.CLOUDINARY_URL ||
    "cloudinary://218191536118228:q5WxiD11WUT3ivZmlbGRPy-NXKY@dbev6dzt1";

  if (rawUrl && rawUrl.startsWith("cloudinary://")) {
    const match = rawUrl.match(/^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/);
    if (match) {
      return {
        apiKey: match[1],
        apiSecret: match[2],
        cloudName: match[3],
      };
    }
  }

  // 2. Try individual env variables
  if (
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET &&
    process.env.CLOUDINARY_CLOUD_NAME
  ) {
    return {
      apiKey: process.env.CLOUDINARY_API_KEY,
      apiSecret: process.env.CLOUDINARY_API_SECRET,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    };
  }

  return null;
}

export async function uploadToCloudinary(
  buffer: Buffer,
  mimeType: string = "image/jpeg",
  folder: string = "bb-dental",
): Promise<string> {
  const config = getCloudinaryConfig();
  if (!config) {
    throw new Error("Cloudinary configuration missing");
  }

  const base64Data = `data:${mimeType};base64,${buffer.toString("base64")}`;
  const timestamp = Math.floor(Date.now() / 1000);

  // Generate SHA-1 signature
  const toSign = `folder=${folder}&timestamp=${timestamp}${config.apiSecret}`;
  const signature = crypto.createHash("sha1").update(toSign).digest("hex");

  const formData = new FormData();
  formData.append("file", base64Data);
  formData.append("api_key", config.apiKey);
  formData.append("timestamp", String(timestamp));
  formData.append("folder", folder);
  formData.append("signature", signature);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${config.cloudName}/image/upload`,
    {
      method: "POST",
      body: formData,
    },
  );

  const data = (await res.json()) as {
    secure_url?: string;
    error?: { message?: string };
  };

  if (!res.ok || !data.secure_url) {
    throw new Error(
      data.error?.message || `Cloudinary upload failed (status ${res.status})`,
    );
  }

  return data.secure_url;
}
