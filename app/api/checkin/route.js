import { NextResponse } from "next/server";
import { processScan } from "@/lib/ticket-service";
import { getStaffSession } from "@/lib/auth";

export async function POST(req) {
  try {
    // 1. Require staff auth
    const session = await getStaffSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { token, eventId, venueId } = body;

    if (!token) {
      return NextResponse.json({ error: "Missing QR token" }, { status: 400 });
    }

    // Extract IP and user agent
    const ipAddress =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";
    const userAgent = req.headers.get("user-agent") || "";

    // 2. Process the scan
    const result = await processScan({
      qrToken:     token,
      staffUserId: session.staffId,
      eventId:     eventId || null,
      venueId:     venueId || session.venueId || null,
      ipAddress,
      userAgent,
    });

    // 3. Return result
    return NextResponse.json({
      result:  result.result,
      message: result.message,
      ticket:  result.ticket
        ? {
            ticketNumber:    result.ticket.ticket_number,
            ticketTypeName:  result.ticket.ticket_type_name,
            eventName:       result.ticket.event_name,
            attendeeName:    result.ticket.attendee_name,
            attendeeEmail:   result.ticket.attendee_email,
            usedAt:          result.ticket.used_at,
          }
        : null,
    });
  } catch (err) {
    console.error("[checkin]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// GET version: for QR code URL scanning from external readers
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  // Redirect to staff scanner with the token pre-filled
  const scannerUrl = `/staff/scan?prefill=${encodeURIComponent(token)}`;
  return NextResponse.redirect(new URL(scannerUrl, req.url));
}
