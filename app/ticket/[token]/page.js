import { notFound } from "next/navigation";
import { getTicketByToken } from "@/lib/ticket-service";
import { generateQrDataUrl } from "@/lib/qr";
import Link from "next/link";

export const dynamic = "force-dynamic"; // Always fresh

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
    timeZone: "America/New_York",
  });
}
function formatTime(dateStr) {
  return new Date(dateStr).toLocaleTimeString("en-US", {
    hour: "numeric", minute: "2-digit", timeZoneName: "short",
    timeZone: "America/New_York",
  });
}

const STATUS_STYLE = {
  valid:     { color: "text-[#39FF14]", bg: "bg-[#39FF14]/10 border-[#39FF14]/30", label: "VALID" },
  used:      { color: "text-red-400",   bg: "bg-red-900/20 border-red-500/30",     label: "USED" },
  refunded:  { color: "text-yellow-400",bg: "bg-yellow-900/20 border-yellow-500/30",label: "REFUNDED" },
  void:      { color: "text-[#888]",    bg: "bg-white/5 border-white/10",           label: "VOID" },
  cancelled: { color: "text-[#888]",    bg: "bg-white/5 border-white/10",           label: "CANCELLED" },
};

export default async function TicketPage({ params }) {
  const ticket = await getTicketByToken(params.token);
  if (!ticket) notFound();

  const qrDataUrl = await generateQrDataUrl(ticket.qr_token);
  const statusStyle = STATUS_STYLE[ticket.status] || STATUS_STYLE.void;

  return (
    <main className="min-h-screen bg-brand-black">
      <header className="border-b border-white/5 px-6 py-4 flex items-center justify-between">
        <div className="font-bold text-lg tracking-wider">
          <span className="text-brand-green">GLOBAL</span>{" "}
          <span>KICKOFF</span>
          <span className="text-brand-gold text-sm">™</span>
        </div>
        <Link href="/" className="text-sm text-[#888888] hover:text-white transition-colors">
          ← Events
        </Link>
      </header>

      <div className="max-w-md mx-auto px-6 py-12">
        {/* Status badge */}
        <div className={`flex items-center justify-center gap-2 py-3 px-5 border rounded-sm mb-8 ${statusStyle.bg}`}>
          <span className={`font-bold text-sm tracking-widest font-mono ${statusStyle.color}`}>
            {statusStyle.label}
          </span>
          {ticket.status === "used" && ticket.used_at && (
            <span className="text-xs text-[#888888]">
              — scanned {new Date(ticket.used_at).toLocaleTimeString()}
            </span>
          )}
        </div>

        {/* Ticket card */}
        <div className="card overflow-hidden">
          {/* Top stripe */}
          <div className="h-1.5 bg-gradient-to-r from-[#39FF14] via-[#D4AF37] to-[#39FF14]" />

          <div className="p-7">
            {/* Event info */}
            <div className="mb-6">
              <p className="label mb-1">{ticket.venue_name} · {ticket.venue_city}, {ticket.venue_state}</p>
              <h1 className="text-2xl font-bold text-white leading-tight">{ticket.event_name}</h1>
              {ticket.match_label && (
                <p className="text-brand-green text-sm font-mono mt-1">{ticket.match_label}</p>
              )}
            </div>

            {/* Date / time grid */}
            <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
              <div>
                <p className="label mb-1">Date</p>
                <p className="text-white">{formatDate(ticket.event_date)}</p>
              </div>
              {ticket.doors_open && (
                <div>
                  <p className="label mb-1">Doors</p>
                  <p className="text-white">{formatTime(ticket.doors_open)}</p>
                </div>
              )}
              <div>
                <p className="label mb-1">Ticket Type</p>
                <p className="text-white font-semibold">{ticket.ticket_type_name}</p>
              </div>
              <div>
                <p className="label mb-1">Ticket #</p>
                <p className="text-white font-mono">{ticket.ticket_number}</p>
              </div>
            </div>

            {/* QR Code */}
            {ticket.status === "valid" ? (
              <div className="flex flex-col items-center gap-3">
                <div className="bg-white p-4 rounded-sm inline-block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrDataUrl}
                    alt={`QR code for ticket ${ticket.ticket_number}`}
                    width={240}
                    height={240}
                    className="block"
                  />
                </div>
                <p className="text-xs text-[#888888] text-center font-mono">
                  {ticket.qr_token.slice(0, 8)}…{ticket.qr_token.slice(-4)}
                </p>
                <p className="text-xs text-[#888888] text-center">
                  Show this QR code at the door
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 py-6 border border-white/10 bg-white/5 rounded-sm">
                <span className="text-4xl">
                  {ticket.status === "used" ? "✅" : "🚫"}
                </span>
                <p className="text-[#888888] text-sm text-center">
                  {ticket.status === "used"
                    ? "This ticket has already been scanned for entry."
                    : "This ticket is no longer valid for entry."}
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-white/5 px-7 py-4 flex justify-between items-center">
            <span className="text-xs text-[#888888] font-mono">
              Issued {new Date(ticket.issued_at).toLocaleDateString()}
            </span>
            {ticket.attendee_name && (
              <span className="text-xs text-[#888888]">{ticket.attendee_name}</span>
            )}
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-[#555]">
          Do not share this QR code. Each ticket is valid for one entry only.
        </p>
      </div>
    </main>
  );
}
