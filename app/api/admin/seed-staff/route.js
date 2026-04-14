import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

export const dynamic = "force-dynamic";

/**
 * ONE-TIME endpoint to create the first admin staff user.
 *
 * SECURITY: This route is protected by ADMIN_SEED_SECRET env var.
 * Call it like:
 *   POST /api/admin/seed-staff
 *   Body: { secret, email, name, pin, role, venueId }
 *
 * After creating your first admin, delete or disable this route.
 */
export async function POST(req) {
  try {
    const { query } = await import("@/db");

    const { secret, email, name, pin, role = "scanner", venueId } = await req.json();

    if (!process.env.ADMIN_SEED_SECRET) {
      return NextResponse.json(
        { error: "ADMIN_SEED_SECRET not configured" },
        { status: 500 }
      );
    }

    if (secret !== process.env.ADMIN_SEED_SECRET) {
      return NextResponse.json({ error: "Invalid secret" }, { status: 403 });
    }

    if (!email || !name || !pin) {
      return NextResponse.json(
        { error: "email, name, and pin are required" },
        { status: 400 }
      );
    }

    if (!["scanner", "supervisor", "admin"].includes(role)) {
      return NextResponse.json(
        { error: "role must be scanner, supervisor, or admin" },
        { status: 400 }
      );
    }

    const pinHash = await bcrypt.hash(String(pin), 12);

    const res = await query(
      `INSERT INTO staff_users (email, name, pin_hash, role, venue_id)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (email) DO UPDATE
         SET name = EXCLUDED.name,
             pin_hash = EXCLUDED.pin_hash,
             role = EXCLUDED.role,
             venue_id = EXCLUDED.venue_id
       RETURNING id, email, name, role`,
      [
        email.toLowerCase().trim(),
        name.trim(),
        pinHash,
        role,
        venueId || null,
      ]
    );

    const staff = res.rows[0];
    console.log("[seed-staff] Created/updated staff user:", staff.email);

    return NextResponse.json({
      ok: true,
      staff: {
        id: staff.id,
        email: staff.email,
        name: staff.name,
        role: staff.role,
      },
    });
  } catch (err) {
    console.error("[seed-staff]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ error: "POST only" }, { status: 405 });
}