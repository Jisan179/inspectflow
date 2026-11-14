import { createHash, randomBytes, timingSafeEqual } from "crypto";

export const sha256 = (value: string) =>
  createHash("sha256").update(value).digest("hex");

/** Random URL-safe secret, used for refresh tokens and webhook secrets. */
export const randomSecret = (bytes = 32) =>
  randomBytes(bytes).toString("base64url");

/**
 * Widget project key. It is a public identifier (it sits in a script tag), so
 * only a SHA-256 hash and a short lookup prefix are stored in the database.
 */
export function generateWidgetKey() {
  const key = `if_pk_${randomBytes(18).toString("base64url")}`;
  return { key, prefix: key.slice(0, 14), hash: sha256(key) };
}

/** Constant-time string comparison to avoid timing leaks. */
export function safeEqual(a: string, b: string) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}
