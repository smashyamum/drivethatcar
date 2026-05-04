import { randomBytes } from "node:crypto";

// Crockford base32 (no I, L, O, U) — easy to read aloud.
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** Generate a human-friendly booking reference like `BK-7H3K2A`. */
export function generateBookingReference(): string {
  const bytes = randomBytes(4);
  let out = "";
  for (let i = 0; i < 6; i++) {
    out += ALPHABET[bytes[i % bytes.length] % 32];
  }
  return `BK-${out}`;
}
