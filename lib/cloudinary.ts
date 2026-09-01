import { v2 as cloudinary } from "cloudinary";

// Automatically loads credentials from process.env.CLOUDINARY_URL
if (process.env.CLOUDINARY_URL) {
  cloudinary.config({
    cloudinary_url: process.env.CLOUDINARY_URL,
  });
}

export { cloudinary };
