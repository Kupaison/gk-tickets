import { NextResponse } from "next/server";
import { getTicketByToken } from "@/lib/ticket-service";
import { getStaffSession } from "@/lib/auth";

export async function GET(req, { params }) {
  // Require staff auth for API lookups
  const session = await getStaffSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ticket = await getTicketByToken(params.token);

  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  return NextResponse.json({ ticket });
}
