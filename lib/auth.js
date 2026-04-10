import { cookies } from "next/headers";
import { verifyStaffToken } from "./tokens";

const COOKIE_NAME = "gk_staff_session";

/**
 * Get authenticated staff user from cookie (server-side)
 * Returns null if not authenticated
 */
export async function getStaffSession() {
  const cookieStore = cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const { valid, payload } = await verifyStaffToken(token);
  if (!valid) return null;

  return payload; // { staffId, email, name, role, venueId }
}

/**
 * Require staff session — redirect to login if missing
 * Use in Server Components
 */
export async function requireStaffSession() {
  const session = await getStaffSession();
  if (!session) {
    return null; // caller handles redirect
  }
  return session;
}

export { COOKIE_NAME };
