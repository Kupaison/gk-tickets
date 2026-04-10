import { stripe } from "@/lib/stripe";
import { query } from "@/db";
import Link from "next/link";

export default async function SuccessPage({ searchParams }) {
  const sessionId = searchParams?.session_id;

  if (!sessionId) {
    return <ErrorState message="No session found." />;
  }

  // Fetch the Stripe session for display only
  let session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId);
  } catch {
    return <ErrorState message="Could not retrieve your session." />;
  }

  if (session.payment_status !== "paid") {
    return <ErrorState message="Payment not confirmed yet. Please wait a moment and refresh." />;
  }

  // Fetch the order + tickets from DB
  // Webhook may take a few seconds — show pending state if not yet issued
  const orderRes = await query(
    `SELECT o.id, o.status, o.customer_email, o.customer_name, o.quantity
     FROM orders o
     WHERE o.stripe_session_id = $1`,
    [sessionId]
  );

  const order = orderRes.rows[0];

  let tickets = [];
  if (order?.status === "paid") {
    const ticketRes = await query(
      `SELECT t.id, t.ticket_number, t.qr_token, t.status,
              tt.name AS ticket_type_name,
              e.name AS event_name, e.match_label, e.event_date,
              v.name AS venue_name, v.city, v.state
       FROM tickets t
       JOIN ticket_types tt ON tt.id = t.ticket_type_id
       JOIN events e ON e.id = t.event_id
       JOIN venues v ON v.id = e.venue_id
       WHERE t.order_id = $1
       ORDER BY t.issued_at ASC`,
      [order.id]
    );
    tickets = ticketRes.rows;
  }

  return (
    <main className="min-h-screen bg-brand-black">
      <header className="border-b border-white/5 px-6 py-4 flex items-center justify-between">
        <div className="font-bold text-lg tracking-wider">
          <span className="text-brand-green">GLOBAL</span>{" "}
          <span>KICKOFF</span>
          <span className="text-brand-gold text-sm">™</span>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-6 py-14">
        {/* Success banner */}
        <div className="mb-10 flex items-center gap-4 p-5 bg-[#39FF14]/10 border border-[#39FF14]/30 rounded-sm">
          <span className="text-3xl">✅</span>
          <div>
            <p className="font-bold text-[#39FF14] text-lg">Payment Confirmed</p>
            <p className="text-sm text-white/70">
              Your tickets are below. Save this page or check your email.
            </p>
          </div>
        </div>

        {order?.status !== "paid" || tickets.length === 0 ? (
          <div className="card p-8 text-center">
            <div className="text-3xl mb-3">⏳</div>
            <p className="font-semibold text-white mb-2">Your tickets are being generated…</p>
            <p className="text-sm text-[#888888] mb-6">
              This usually takes a few seconds. Refresh the page or check your email.
            </p>
            <div className="flex gap-3 justify-center">
              <Link href={`/checkout/success?session_id=${sessionId}`} className="btn-green text-sm">
                Refresh
              </Link>
              <Link href="/" className="btn-outline text-sm">Back to Events</Link>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <h2 className="text-xl font-bold text-white mb-2">
              Your Ticket{tickets.length > 1 ? "s" : ""}
            </h2>
            {tickets.map((ticket) => (
              <div key={ticket.id} className="card p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <p className="label mb-1">{ticket.ticket_number}</p>
                  <p className="font-bold text-white">{ticket.ticket_type_name}</p>
                  <p className="text-sm text-[#888888]">{ticket.event_name}</p>
                  <p className="text-sm text-[#888888]">{ticket.venue_name} · {ticket.city}, {ticket.state}</p>
                </div>
                <Link
                  href={`/ticket/${ticket.qr_token}`}
                  className="btn-green text-sm flex-shrink-0"
                >
                  View Ticket →
                </Link>
              </div>
            ))}
            <p className="text-sm text-[#888888] mt-2 text-center">
              Each ticket has its own QR code. Show it at the door.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}

function ErrorState({ message }) {
  return (
    <main className="min-h-screen bg-brand-black flex items-center justify-center px-6">
      <div className="card p-10 text-center max-w-md w-full">
        <p className="text-2xl mb-3">❌</p>
        <p className="font-semibold text-white mb-2">Something went wrong</p>
        <p className="text-sm text-[#888888] mb-6">{message}</p>
        <Link href="/" className="btn-green text-sm">Back to Events</Link>
      </div>
    </main>
  );
}
