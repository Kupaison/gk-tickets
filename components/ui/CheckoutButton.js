"use client";

import { useState } from "react";

export default function CheckoutButton({
  eventId,
  ticketTypeId,
  ticketTypeName,
  priceCents,
  eventName,
}) {
  const [loading, setLoading] = useState(false);
  const [qty, setQty] = useState(1);

  async function handleCheckout() {
    setLoading(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, ticketTypeId, quantity: qty }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Something went wrong. Please try again.");
        setLoading(false);
        return;
      }

      // Redirect to Stripe Checkout
      window.location.href = data.url;
    } catch (err) {
      console.error(err);
      alert("Network error. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={qty}
        onChange={(e) => setQty(Number(e.target.value))}
        className="bg-[#111] border border-white/10 text-white text-sm px-2 py-2 rounded-sm focus:outline-none focus:border-[#39FF14]/50"
        disabled={loading}
      >
        {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
          <option key={n} value={n}>{n}</option>
        ))}
      </select>
      <button
        onClick={handleCheckout}
        disabled={loading}
        className="btn-green min-w-[120px]"
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            Loading...
          </span>
        ) : (
          "Buy Tickets →"
        )}
      </button>
    </div>
  );
}
