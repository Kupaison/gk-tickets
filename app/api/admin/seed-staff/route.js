import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  return NextResponse.json({ ok: true, route: "seed-staff" });
}

export async function GET() {
  return NextResponse.json({ error: "POST only" }, { status: 405 });
}