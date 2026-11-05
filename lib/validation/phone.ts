import { z } from "zod";

// Keep local and international numbers accepted by V1, with a stable spacing format.
export const phoneSchema = z.string().trim().max(32)
  .transform(value => value.replace(/[\s()-]/g, ""))
  .pipe(z.string().regex(/^\+?\d{8,15}$/, "Утасны дугаараа шалгана уу."));
