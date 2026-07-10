import { promisify } from "node:util";
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";

const scrypt = promisify(scryptCallback);
const SESSION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function createSessionToken() {
  return randomBytes(32).toString("base64url");
}

export function isSessionToken(value) {
  return typeof value === "string" && SESSION_TOKEN_PATTERN.test(value);
}

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const derivedKey = await scrypt(password, salt, 64);
  return `scrypt:${salt.toString("base64url")}:${derivedKey.toString("base64url")}`;
}

export async function verifyPassword(password, encoded) {
  if (typeof password !== "string" || typeof encoded !== "string") return false;

  const [algorithm, saltText, hashText, ...extra] = encoded.split(":");
  if (algorithm !== "scrypt" || !saltText || !hashText || extra.length) return false;

  try {
    const salt = Buffer.from(saltText, "base64url");
    const storedHash = Buffer.from(hashText, "base64url");
    if (salt.length !== 16 || storedHash.length !== 64) return false;
    const candidate = await scrypt(password, salt, storedHash.length);
    return timingSafeEqual(storedHash, candidate);
  } catch {
    return false;
  }
}
