import { customAlphabet } from "nanoid";
import { SignJWT, jwtVerify } from "jose";

// ── QR Token ─────────────────────────────────────────────────
// 32-char URL-safe random token (not sequential, not guessable)
const nanoid = customAlphabet(
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
  32
);

export function generateQrToken() {
  return nanoid();
}

// ── Ticket Number ─────────────────────────────────────────────
// Human-readable: GK-00001 .. GK-99999
export function generateTicketNumber(sequence) {
  return `GK-${String(sequence).padStart(5, "0")}`;
}

// ── Staff Session JWT ─────────────────────────────────────────
const JWT_SECRET = new TextEncoder().encode(
  process.env.STAFF_JWT_SECRET || "change-me-in-production-32chars!!"
);
const JWT_ALG = "HS256";
const SESSION_DURATION = "12h";

export async function signStaffToken(payload) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: JWT_ALG })
    .setIssuedAt()
    .setExpirationTime(SESSION_DURATION)
    .sign(JWT_SECRET);
}

export async function verifyStaffToken(token) {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return { valid: true, payload };
  } catch {
    return { valid: false, payload: null };
  }
}
