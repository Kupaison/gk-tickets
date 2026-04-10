import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { query } from "@/db";
import { signStaffToken } from "@/lib/tokens";
import { COOKIE_NAME } from "@/lib/auth";

export async function POST(req) {
  try {
    const { email, pin } = await req.json();

    if (!email || !pin) {
      return NextResponse.json({ error: "Email and PIN required" }, { status: 400 });
    }

    // Look up staff user
    const res = await query(
      `SELECT id, email, name, pin_hash, role, venue_id, active
       FROM staff_users
       WHERE email = $1`,
      [email.toLowerCase().trim()]
    );

    if (res.rowCount === 0) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const staff = res.rows[0];

    if (!staff.active) {
      return NextResponse.json({ error: "Account disabled" }, { status: 403 });
    }

    // Verify PIN
    const valid = await bcrypt.compare(String(pin), staff.pin_hash);
    if (!valid) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    // Update last login
    await query(
      `UPDATE staff_users SET last_login = now() WHERE id = $1`,
      [staff.id]
    );

    // Create JWT
    const token = await signStaffToken({
      staffId: staff.id,
      email:   staff.email,
      name:    staff.name,
      role:    staff.role,
      venueId: staff.venue_id,
    });

    // Set cookie
    const response = NextResponse.json({
      ok:   true,
      name: staff.name,
      role: staff.role,
    });

    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === "production",
      sameSite: "lax",
      path:     "/",
      maxAge:   60 * 60 * 12, // 12 hours
    });

    return response;
  } catch (err) {
    console.error("[staff-login]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
