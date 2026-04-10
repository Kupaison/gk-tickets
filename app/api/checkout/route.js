import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { query } from "@/db";

export async function POST(req) {
  try {
    const body = await req.json();
    const { eventId, ticketTypeId, quantity = 1 } = body;

    if (!eventId || !ticketTypeId) {
      return NextResponse.json({ error: "Missing eventId or ticketTypeId" }, { status: 400 });
    }

    const qty = Math.max(1, Math.min(8, parseInt(quantity, 10)));

    // 1. Fetch event and ticket type from DB
    const res = await query(
      `SELECT
         tt.id             AS tt_id,
         tt.name           AS tt_name,
         tt.price_cents,
         tt.quantity_total,
         tt.quantity_sold,
         tt.active,
         e.id              AS event_id,
         e.name            AS event_name,
         e.status          AS event_status,
         e.event_date
       FROM ticket_types tt
       JOIN events e ON e.id = tt.event_id
       WHERE tt.id = $1 AND e.id = $2`,
      [ticketTypeId, eventId]
    );

    if (res.rowCount === 0) {
      return NextResponse.json({ error: "Event or ticket type not found" }, { status: 404 });
    }

    const tt = res.rows[0];

    // 2. Availability checks
    if (!tt.active) {
      return NextResponse.json({ error: "This ticket type is no longer available" }, { status: 400 });
    }
    if (tt.event_status !== "active") {
      return NextResponse.json({ error: "This event is not currently on sale" }, { status: 400 });
    }
    const remaining = tt.quantity_total - tt.quantity_sold;
    if (remaining < qty) {
      return NextResponse.json(
        { error: `Only ${remaining} ticket(s) remaining` },
        { status: 400 }
      );
    }

    // 3. Create a pending order record BEFORE Stripe session
    const orderRes = await query(
      `INSERT INTO orders
         (event_id, ticket_type_id, quantity, total_cents, status)
       VALUES ($1, $2, $3, $4, 'pending')
       RETURNING id`,
      [eventId, ticketTypeId, qty, tt.price_cents * qty]
    );
    const orderId = orderRes.rows[0].id;

    // 4. Create Stripe Checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: tt.price_cents,
            product_data: {
              name: `${tt.tt_name} — ${tt.event_name}`,
              description: `World Cup Watch Party · ${new Date(tt.event_date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}`,
            },
          },
          quantity: qty,
        },
      ],
      metadata: {
        orderId,
        eventId,
        ticketTypeId,
        quantity: qty.toString(),
      },
      customer_email: undefined, // Stripe collects it
      success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/?cancelled=1`,
    });

    // 5. Save the session ID on the order
    await query(
      `UPDATE orders SET stripe_session_id = $1 WHERE id = $2`,
      [session.id, orderId]
    );

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[checkout]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
