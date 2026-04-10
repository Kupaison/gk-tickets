import { query } from "@/db";
import CheckoutButton from "@/components/ui/CheckoutButton";

export const revalidate = 60; // ISR every 60s

async function getActiveEvents() {
  const res = await query(
    `SELECT
       e.id,
       e.name,
       e.slug,
       e.match_label,
       e.event_date,
       e.doors_open,
       e.status,
       v.name    AS venue_name,
       v.address AS venue_address,
       v.city    AS venue_city,
       v.state   AS venue_state,
       json_agg(
         json_build_object(
           'id',             tt.id,
           'name',           tt.name,
           'description',    tt.description,
           'price_cents',    tt.price_cents,
           'quantity_total', tt.quantity_total,
           'quantity_sold',  tt.quantity_sold,
           'active',         tt.active
         ) ORDER BY tt.price_cents ASC
       ) AS ticket_types
     FROM events e
     JOIN venues v ON v.id = e.venue_id
     JOIN ticket_types tt ON tt.event_id = e.id
     WHERE e.status IN ('active','sold_out')
       AND tt.active = true
     GROUP BY e.id, v.id
     ORDER BY e.event_date ASC`
  );
  return res.rows;
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "America/New_York",
  });
}

function formatTime(dateStr) {
  return new Date(dateStr).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
    timeZone: "America/New_York",
  });
}

export default async function HomePage() {
  const events = await getActiveEvents();

  return (
    <main className="min-h-screen bg-brand-black">
      {/* Header */}
      <header className="border-b border-white/5 px-6 py-4 flex items-center justify-between">
        <div className="font-bold text-lg tracking-wider">
          <span className="text-brand-green">GLOBAL</span>{" "}
          <span>KICKOFF</span>
          <span className="text-brand-gold text-sm">™</span>
        </div>
        <span className="label">Official Tickets</span>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-14">
        <div className="mb-12">
          <p className="label mb-3">World Cup 2026 · Watch Party Series</p>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-3">
            Get Your Tickets
          </h1>
          <p className="text-[#888888] text-lg">
            Select an event below to secure your spot.
          </p>
        </div>

        {events.length === 0 ? (
          <div className="card p-10 text-center text-[#888888]">
            <p className="text-xl mb-2">No events on sale yet.</p>
            <p className="text-sm">Check back soon — drops are coming.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            {events.map((event) => (
              <div key={event.id} className="card overflow-hidden">
                {/* Event header */}
                <div className="bg-gradient-to-r from-[#39FF14]/10 to-transparent border-b border-white/5 px-7 py-5">
                  <p className="label mb-1">{event.venue_name} · {event.venue_city}, {event.venue_state}</p>
                  <h2 className="text-2xl font-bold text-white">{event.name}</h2>
                  {event.match_label && (
                    <p className="text-brand-green text-sm font-mono mt-1">{event.match_label}</p>
                  )}
                </div>

                {/* Date / time */}
                <div className="px-7 py-4 border-b border-white/5 flex flex-wrap gap-6 text-sm">
                  <div>
                    <p className="label mb-1">Date</p>
                    <p className="text-white">{formatDate(event.event_date)}</p>
                  </div>
                  {event.doors_open && (
                    <div>
                      <p className="label mb-1">Doors Open</p>
                      <p className="text-white">{formatTime(event.doors_open)}</p>
                    </div>
                  )}
                  <div>
                    <p className="label mb-1">Kickoff</p>
                    <p className="text-white">{formatTime(event.event_date)}</p>
                  </div>
                </div>

                {/* Ticket types */}
                <div className="px-7 py-5 flex flex-col gap-4">
                  <p className="label">Select Tickets</p>
                  <div className="flex flex-col gap-3">
                    {event.ticket_types.map((tt) => {
                      const remaining = tt.quantity_total - tt.quantity_sold;
                      const soldOut = remaining <= 0 || event.status === "sold_out";
                      return (
                        <div
                          key={tt.id}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border border-white/5 bg-white/[0.02] rounded-sm"
                        >
                          <div className="flex flex-col gap-1">
                            <p className="font-semibold text-white">{tt.name}</p>
                            {tt.description && (
                              <p className="text-sm text-[#888888]">{tt.description}</p>
                            )}
                            <p className="text-sm text-[#888888]">
                              {soldOut ? (
                                <span className="text-red-400">Sold out</span>
                              ) : (
                                <span>{remaining} remaining</span>
                              )}
                            </p>
                          </div>
                          <div className="flex items-center gap-4 flex-shrink-0">
                            <span className="text-xl font-bold text-white">
                              ${(tt.price_cents / 100).toFixed(2)}
                            </span>
                            {soldOut ? (
                              <button disabled className="btn-outline opacity-40 cursor-not-allowed">
                                Sold Out
                              </button>
                            ) : (
                              <CheckoutButton
                                eventId={event.id}
                                ticketTypeId={tt.id}
                                ticketTypeName={tt.name}
                                priceCents={tt.price_cents}
                                eventName={event.name}
                              />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
