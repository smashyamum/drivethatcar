import { randomBytes, createHash, timingSafeEqual } from "node:crypto";
import "server-only";

/** Generate a 256-bit URL-safe token for booking management links. */
export function generateManageToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashManageToken(token) };
}

export function hashManageToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Constant-time comparison to prevent timing attacks on token verification. */
export function verifyManageToken(token: string, expectedHash: string): boolean {
  const candidate = hashManageToken(token);
  if (candidate.length !== expectedHash.length) return false;
  return timingSafeEqual(Buffer.from(candidate, "hex"), Buffer.from(expectedHash, "hex"));
}
