import { createHash, randomBytes } from "node:crypto";
export const SESSION_COOKIE = "smilecare_session";
export const SESSION_SECONDS = 12 * 60 * 60;
export const newSessionToken = () => randomBytes(32).toString("hex");
export const validSessionToken = (token: string) => /^[a-f0-9]{64}$/.test(token);
export const sessionTokenHash = (token: string) => createHash("sha256").update(token).digest("hex");
