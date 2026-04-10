import { query, withTransaction } from "@/db";
import { generateQrToken, generateTicketNumber } from "./tokens";

/**
 * Issue tickets after a confirmed Stripe payment.
 * Called ONLY from the webhook handler.
 *
 * @param {object} params
 * @param {string} params.stripeSessionId
 * @param {string} params.stripePaymentIntent
 * @param {string} params.customerEmail
 * @param {string} params.customerName
 */
export async function issueTicketsForSession({
  stripeSessionId,
  stripePaymentIntent,
  customerEmail,
  customerName,
}) {
  return await withTransaction(async (client) => {
    // 1. Find the pending order
    const orderRes = await client.query(
      `SELECT o.*, tt.id AS tt_id, tt.event_id, tt.quantity_total, tt.quantity_sold
       FROM orders o
       JOIN ticket_types tt ON tt.id = o.ticket_type_id
       WHERE o.stripe_session_id = $1
         AND o.status = 'pending'
       FOR UPDATE`,
      [stripeSessionId]
    );

    if (orderRes.rowCount === 0) {
      // Already processed or not found — idempotent, no error
      console.log("[ticket-service] Order already processed or not found:", stripeSessionId);
      return { skipped: true };
    }

    const order = orderRes.rows[0];

    // 2. Mark order as paid
    await client.query(
      `UPDATE orders
       SET status = 'paid',
           stripe_payment_intent = $1,
           customer_email = $2,
           customer_name = $3,
           paid_at = now()
       WHERE id = $4`,
      [stripePaymentIntent, customerEmail, customerName, order.id]
    );

    // 3. Create attendee record
    const attendeeRes = await client.query(
      `INSERT INTO attendees (order_id, email, name)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [order.id, customerEmail, customerName || null]
    );
    const attendeeId = attendeeRes.rows[0].id;

    // 4. Get next ticket sequence number
    const seqRes = await client.query(
      `SELECT COUNT(*) AS total FROM tickets`
    );
    let seq = parseInt(seqRes.rows[0].total, 10) + 1;

    // 5. Issue one ticket per quantity
    const tickets = [];
    for (let i = 0; i < order.quantity; i++) {
      const qrToken = generateQrToken();
      const ticketNumber = generateTicketNumber(seq + i);

      const ticketRes = await client.query(
        `INSERT INTO tickets
           (order_id, event_id, ticket_type_id, attendee_id, qr_token, ticket_number, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'valid')
         RETURNING id, ticket_number, qr_token`,
        [
          order.id,
          order.event_id,
          order.ticket_type_id,
          attendeeId,
          qrToken,
          ticketNumber,
        ]
      );

      tickets.push(ticketRes.rows[0]);
    }

    // 6. Increment quantity_sold on ticket_type
    await client.query(
      `UPDATE ticket_types
       SET quantity_sold = quantity_sold + $1
       WHERE id = $2`,
      [order.quantity, order.ticket_type_id]
    );

    console.log(`[ticket-service] Issued ${tickets.length} ticket(s) for order ${order.id}`);
    return { tickets, orderId: order.id };
  });
}

/**
 * Look up a ticket by its QR token.
 * Returns full ticket details with event and ticket type.
 */
export async function getTicketByToken(qrToken) {
  const res = await query(
    `SELECT
       t.id,
       t.ticket_number,
       t.qr_token,
       t.status,
       t.issued_at,
       t.used_at,
       t.order_id,
       tt.name      AS ticket_type_name,
       tt.price_cents,
       e.name       AS event_name,
       e.slug       AS event_slug,
       e.match_label,
       e.event_date,
       e.doors_open,
       v.name       AS venue_name,
       v.address    AS venue_address,
       v.city       AS venue_city,
       v.state      AS venue_state,
       a.email      AS attendee_email,
       a.name       AS attendee_name
     FROM tickets t
     JOIN ticket_types tt ON tt.id = t.ticket_type_id
     JOIN events e        ON e.id  = t.event_id
     JOIN venues v        ON v.id  = e.venue_id
     LEFT JOIN attendees a ON a.id = t.attendee_id
     WHERE t.qr_token = $1`,
    [qrToken]
  );

  return res.rows[0] || null;
}

/**
 * Get all tickets for an order (by order ID)
 */
export async function getTicketsByOrderId(orderId) {
  const res = await query(
    `SELECT
       t.id,
       t.ticket_number,
       t.qr_token,
       t.status,
       t.issued_at,
       tt.name AS ticket_type_name,
       e.name  AS event_name,
       e.match_label,
       e.event_date,
       v.name  AS venue_name,
       v.city  AS venue_city,
       v.state AS venue_state
     FROM tickets t
     JOIN ticket_types tt ON tt.id = t.ticket_type_id
     JOIN events e        ON e.id  = t.event_id
     JOIN venues v        ON v.id  = e.venue_id
     WHERE t.order_id = $1
     ORDER BY t.issued_at ASC`,
    [orderId]
  );

  return res.rows;
}

/**
 * Process a check-in scan.
 * Returns { result, ticket, message }
 */
export async function processScan({ qrToken, staffUserId, eventId, venueId, ipAddress, userAgent }) {
  return await withTransaction(async (client) => {
    // 1. Look up ticket with row lock
    const ticketRes = await client.query(
      `SELECT t.*, e.venue_id
       FROM tickets t
       JOIN events e ON e.id = t.event_id
       WHERE t.qr_token = $1
       FOR UPDATE`,
      [qrToken]
    );

    let result, ticket, message;

    if (ticketRes.rowCount === 0) {
      result = "invalid";
      ticket = null;
      message = "Ticket not found. Invalid QR code.";
    } else {
      ticket = ticketRes.rows[0];

      if (ticket.status === "used") {
        result = "already_used";
        message = `Already scanned at ${new Date(ticket.used_at).toLocaleTimeString()}`;
      } else if (ticket.status === "refunded") {
        result = "refunded";
        message = "This ticket has been refunded.";
      } else if (ticket.status === "void" || ticket.status === "cancelled") {
        result = "void";
        message = "This ticket has been voided/cancelled.";
      } else if (ticket.status === "valid") {
        // ✅ Valid — mark as used
        await client.query(
          `UPDATE tickets SET status = 'used', used_at = now() WHERE id = $1`,
          [ticket.id]
        );
        result = "valid";
        message = "Entry granted.";
      } else {
        result = "invalid";
        message = "Unknown ticket status.";
      }
    }

    // 2. Always log the scan
    await client.query(
      `INSERT INTO scan_logs
         (ticket_id, qr_token, event_id, venue_id, staff_user_id, result, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        ticket?.id || null,
        qrToken,
        ticket?.event_id || eventId || null,
        ticket?.venue_id || venueId || null,
        staffUserId || null,
        result,
        ipAddress || null,
        userAgent || null,
      ]
    );

    return { result, ticket, message };
  });
}
