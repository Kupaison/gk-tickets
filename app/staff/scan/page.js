import { redirect } from "next/navigation";
import { getStaffSession } from "@/lib/auth";
import { query } from "@/db";
import ScannerShell from "@/components/staff/ScannerShell";

export const dynamic = "force-dynamic";

async function getActiveEvents() {
  const res = await query(
    `SELECT e.id, e.name, e.match_label, e.event_date, v.id AS venue_id, v.name AS venue_name
     FROM events e
     JOIN venues v ON v.id = e.venue_id
     WHERE e.status = 'active'
     ORDER BY e.event_date ASC
     LIMIT 10`
  );
  return res.rows;
}

export default async function ScanPage() {
  const session = await getStaffSession();
  if (!session) {
    redirect("/staff/login");
  }

  const events = await getActiveEvents();

  return (
    <main className="min-h-screen bg-brand-black flex flex-col">
      {/* Header */}
      <header className="border-b border-white/5 px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div className="font-bold tracking-wider text-sm">
          <span className="text-[#39FF14]">GK</span>
          <span className="text-white ml-1">SCANNER</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-[#888888] hidden sm:block">{session.name}</span>
          <ScannerLogoutButton />
        </div>
      </header>

      {/* Scanner shell (client, handles event selection + scanner) */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <ScannerShell
          staffName={session.name}
          staffRole={session.role}
          events={events}
        />
      </div>
    </main>
  );
}

// Tiny logout button client component
function ScannerLogoutButton() {
  return (
    <form action="/api/staff/logout" method="POST">
      <button
        type="submit"
        className="text-xs text-[#888888] hover:text-white transition-colors font-mono tracking-wider px-3 py-1 border border-white/10 hover:border-white/30 rounded-sm"
      >
        Logout
      </button>
    </form>
  );
}
