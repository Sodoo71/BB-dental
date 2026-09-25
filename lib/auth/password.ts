import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import bcrypt from "bcryptjs";
const derive = promisify(scrypt);
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const key = await derive(password, salt, 64) as Buffer;
  return `${salt}:${key.toString("hex")}`;
}
export async function verifyPassword(password: string, hash: string) {
  if (password.length > 256) return false;
  // Compatibility with passwords created by the old reset-password route.
  if (/^\$2[aby]\$/.test(hash)) return bcrypt.compare(password, hash);
  const [salt, value, extra] = hash.split(":");
  if (!salt || !/^[a-f0-9]{128}$/i.test(value ?? "") || extra) return false;
  const key = await derive(password, salt, 64) as Buffer;
  return timingSafeEqual(key, Buffer.from(value, "hex"));
}
