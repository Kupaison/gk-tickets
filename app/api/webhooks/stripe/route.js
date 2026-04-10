import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { issueTicketsForSession } from "@/lib/ticket-service";

// CRITICAL: disable Next.js body parsing — Stripe needs the raw body
export const config = {
  api: { bodyParser: false },
};

export async function POST(req) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("[webhook] Signature verification failed:", err.message);
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  // ── Handle checkout.session.completed ──────────────────────
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;

    // Only process paid sessions
    if (session.payment_status !== "paid") {
      console.log("[webhook] Session not paid yet, skipping:", session.id);
      return NextResponse.json({ received: true });
    }

    try {
      const result = await issueTicketsForSession({
        stripeSessionId:     session.id,
        stripePaymentIntent: session.payment_intent,
        customerEmail:       session.customer_details?.email || session.customer_email,
        customerName:        session.customer_details?.name,
      });

      if (result.skipped) {
        console.log("[webhook] Already processed:", session.id);
      } else {
        console.log(`[webhook] Issued ${result.tickets.length} ticket(s) for session ${session.id}`);
      }
    } catch (err) {
      console.error("[webhook] Failed to issue tickets:", err);
      // Return 500 so Stripe retries
      return NextResponse.json({ error: "Failed to issue tickets" }, { status: 500 });
    }
  }

  // ── Handle refunds ─────────────────────────────────────────
  if (event.type === "charge.refunded") {
    const charge = event.data.object;
    const paymentIntent = charge.payment_intent;

    if (paymentIntent) {
      try {
        // Mark order and all its tickets as refunded
        const { query } = await import("@/db");
        await query(
          `UPDATE orders SET status = 'refunded' WHERE stripe_payment_intent = $1`,
          [paymentIntent]
        );
        await query(
          `UPDATE tickets t SET status = 'refunded'
           FROM orders o
           WHERE t.order_id = o.id
             AND o.stripe_payment_intent = $1
             AND t.status != 'used'`,
          [paymentIntent]
        );
        console.log("[webhook] Refunded tickets for payment intent:", paymentIntent);
      } catch (err) {
        console.error("[webhook] Failed to process refund:", err);
        return NextResponse.json({ error: "Failed to process refund" }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ received: true });
}
