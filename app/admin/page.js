import { redirect } from "next/navigation";
import { getStaffSession } from "@/lib/auth";
import { query } from "@/db";
import Link from "next/link";

export const dynamic = "force-dynamic";

async function getDashboardStats() {
  const [events, orders, tickets, scans] = await Promise.all([
    query(`SELECT COUNT(*) FROM events WHERE status = 'active'`),
    query(`SELECT COUNT(*) FROM orders WHERE status = 'paid'`),
    query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'valid') AS valid,
         COUNT(*) FILTER (WHERE status = 'used')  AS used,
         COUNT(*) FILTER (WHERE status = 'refunded') AS refunded
       FROM tickets`
    ),
    query(`SELECT COUNT(*) FROM scan_logs WHERE scanned_at > now() - interval '24 hours'`),
  ]);

  return {
    activeEvents: parseInt(events.rows[0].count, 10),
    paidOrders:   parseInt(orders.rows[0].count, 10),
    validTickets: parseInt(tickets.rows[0].valid || 0, 10),
    usedTickets:  parseInt(tickets.rows[0].used || 0, 10),
    refundedTickets: parseInt(tickets.rows[0].refunded || 0, 10),
    scans24h:     parseInt(scans.rows[0].count, 10),
  };
}

async function getRecentScans() {
  const res = await query(
    `SELECT
       sl.result,
       sl.scanned_at,
       t.ticket_number,
       su.name   AS staff_name,
       e.name    AS event_name,
       v.name    AS venue_name
     FROM scan_logs sl
     LEFT JOIN tickets      t  ON t.id  = sl.ticket_id
     LEFT JOIN staff_users  su ON su.id = sl.staff_user_id
     LEFT JOIN events       e  ON e.id  = sl.event_id
     LEFT JOIN venues       v  ON v.id  = sl.venue_id
     ORDER BY sl.scanned_at DESC
     LIMIT 20`
  );
  return res.rows;
}

async function getEventsSummary() {
  const res = await query(
    `SELECT
       e.id,
       e.name,
       e.match_label,
       e.event_date,
       e.status,
       v.name AS venue_name,
       v.city,
       COUNT(DISTINCT o.id) FILTER (WHERE o.status = 'paid') AS paid_orders,
       COUNT(t.id)                                            AS total_tickets,
       COUNT(t.id) FILTER (WHERE t.status = 'used')          AS used_tickets
     FROM events e
     JOIN venues v ON v.id = e.venue_id
     LEFT JOIN orders o ON o.event_id = e.id
     LEFT JOIN tickets t ON t.event_id = e.id
     GROUP BY e.id, v.id
     ORDER BY e.event_date DESC
     LIMIT 10`
  );
  return res.rows;
}

const RESULT_COLORS = {
  valid:        "text-[#39FF14] bg-[#39FF14]/10",
  already_used: "text-red-400 bg-red-900/20",
  invalid:      "text-red-400 bg-red-900/20",
  refunded:     "text-yellow-400 bg-yellow-900/20",
  void:         "text-[#888] bg-white/5",
  cancelled:    "text-[#888] bg-white/5",
};

export default async function AdminPage() {
  const session = await getStaffSession();
  if (!session) redirect("/staff/login");
  if (session.role !== "admin" && session.role !== "supervisor") {
    redirect("/staff/scan");
  }

  const [stats, recentScans, events] = await Promise.all([
    getDashboardStats(),
    getRecentScans(),
    getEventsSummary(),
  ]);

  return (
    <main className="min-h-screen bg-brand-black">
      {/* Header */}
      <header className="border-b border-white/5 px-6 py-4 flex items-center justify-between">
        <div className="font-bold text-lg tracking-wider">
          <span className="text-[#39FF14]">GK</span>
          <span className="text-white ml-1">ADMIN</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-[#888888]">{session.name}</span>
          <Link href="/staff/scan" className="text-xs text-[#39FF14] hover:underline font-mono">
            → Scanner
          </Link>
          <form action="/api/staff/logout" method="POST">
            <button className="text-xs text-[#888] hover:text-white border border-white/10 px-3 py-1 rounded-sm font-mono">
              Logout
            </button>
          </form>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-10 flex flex-col gap-10">
        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { label: "Active Events",   value: stats.activeEvents,    color: "text-white" },
            { label: "Paid Orders",     value: stats.paidOrders,      color: "text-white" },
            { label: "Valid Tickets",   value: stats.validTickets,    color: "text-[#39FF14]" },
            { label: "Used Tickets",    value: stats.usedTickets,     color: "text-blue-400" },
            { label: "Refunded",        value: stats.refundedTickets, color: "text-yellow-400" },
            { label: "Scans (24h)",     value: stats.scans24h,        color: "text-[#D4AF37]" },
          ].map((s) => (
            <div key={s.label} className="bg-[#111] border border-white/5 rounded-sm p-4 text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value.toLocaleString()}</p>
              <p className="text-xs text-[#888] font-mono tracking-wider mt-1 uppercase">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Events table */}
        <div>
          <h2 className="text-lg font-bold text-white mb-4">Events</h2>
          <div className="bg-[#111] border border-white/5 rounded-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  {["Event", "Venue", "Date", "Status", "Orders", "Tickets", "Used", "Rate"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-mono tracking-widest text-[#888] uppercase">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {events.map((ev) => {
                  const rate = ev.total_tickets > 0
                    ? Math.round((ev.used_tickets / ev.total_tickets) * 100)
                    : 0;
                  return (
                    <tr key={ev.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-white">{ev.name}</p>
                        {ev.match_label && <p className="text-xs text-[#888]">{ev.match_label}</p>}
                      </td>
                      <td className="px-4 py-3 text-[#888]">{ev.venue_name}, {ev.city}</td>
                      <td className="px-4 py-3 text-[#888] whitespace-nowrap">
                        {new Date(ev.event_date).toLocaleDateString("en-US", {
                          month: "short", day: "numeric", year: "numeric"
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-mono px-2 py-0.5 rounded-sm ${
                          ev.status === "active" ? "bg-[#39FF14]/10 text-[#39FF14]" :
                          ev.status === "sold_out" ? "bg-red-900/20 text-red-400" :
                          "bg-white/5 text-[#888]"
                        }`}>
                          {ev.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-white text-center">{ev.paid_orders}</td>
                      <td className="px-4 py-3 text-white text-center">{ev.total_tickets}</td>
                      <td className="px-4 py-3 text-white text-center">{ev.used_tickets}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`font-mono text-sm ${rate > 75 ? "text-[#39FF14]" : "text-[#888]"}`}>
                          {rate}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent scans */}
        <div>
          <h2 className="text-lg font-bold text-white mb-4">Recent Scans</h2>
          <div className="bg-[#111] border border-white/5 rounded-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  {["Time", "Result", "Ticket #", "Event", "Staff"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-mono tracking-widest text-[#888] uppercase">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentScans.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-[#555] text-sm">
                      No scans yet.
                    </td>
                  </tr>
                ) : (
                  recentScans.map((scan, i) => (
                    <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02]">
                      <td className="px-4 py-3 text-[#888] whitespace-nowrap font-mono text-xs">
                        {new Date(scan.scanned_at).toLocaleTimeString("en-US", {
                          hour: "2-digit", minute: "2-digit", second: "2-digit"
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-mono px-2 py-0.5 rounded-sm ${
                          RESULT_COLORS[scan.result] || "text-[#888] bg-white/5"
                        }`}>
                          {scan.result}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-white font-mono text-xs">
                        {scan.ticket_number || "—"}
                      </td>
                      <td className="px-4 py-3 text-[#888] text-xs truncate max-w-[180px]">
                        {scan.event_name || "—"}
                      </td>
                      <td className="px-4 py-3 text-[#888] text-xs">
                        {scan.staff_name || "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick links */}
        <div className="border-t border-white/5 pt-6 flex flex-wrap gap-3">
          <Link href="/api/admin/seed-staff" className="btn-outline text-xs px-4 py-2">
            → Create Staff User (see docs)
          </Link>
          <a
            href="https://dashboard.stripe.com"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-outline text-xs px-4 py-2"
          >
            → Stripe Dashboard ↗
          </a>
        </div>
      </div>
    </main>
  );
}
