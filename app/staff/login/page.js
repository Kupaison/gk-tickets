"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function StaffLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/staff/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, pin }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Login failed");
        setLoading(false);
        return;
      }

      router.push("/staff/scan");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-brand-black flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="font-bold text-2xl tracking-wider mb-1">
            <span className="text-[#39FF14]">GLOBAL</span>{" "}
            <span className="text-white">KICKOFF</span>
            <span className="text-[#D4AF37] text-sm">™</span>
          </div>
          <p className="text-xs font-mono tracking-widest text-[#888888] uppercase">
            Staff Portal
          </p>
        </div>

        {/* Card */}
        <div className="bg-[#111111] border border-white/5 rounded-sm overflow-hidden">
          <div className="border-b border-white/5 px-6 py-4">
            <h1 className="font-bold text-white">Staff Login</h1>
            <p className="text-xs text-[#888888] mt-0.5">Enter your email and PIN to continue</p>
          </div>

          <form onSubmit={handleSubmit} className="px-6 py-6 flex flex-col gap-5">
            {error && (
              <div className="bg-red-900/20 border border-red-500/30 rounded-sm px-4 py-3">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-mono tracking-widest text-[#888888] uppercase">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="scanner@globalkickoff.com"
                required
                autoComplete="email"
                className="bg-[#0d0d0d] border border-white/10 text-white text-sm px-4 py-3 rounded-sm focus:outline-none focus:border-[#39FF14]/50 transition-colors placeholder:text-[#555]"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-mono tracking-widest text-[#888888] uppercase">
                PIN
              </label>
              <input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="••••••"
                required
                autoComplete="current-password"
                inputMode="numeric"
                maxLength={8}
                className="bg-[#0d0d0d] border border-white/10 text-white text-sm px-4 py-3 rounded-sm focus:outline-none focus:border-[#39FF14]/50 transition-colors placeholder:text-[#555] tracking-widest text-center text-lg"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-green w-full mt-1 py-4 text-base"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Signing in…
                </span>
              ) : (
                "Sign In →"
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-[#444] mt-6">
          Staff access only · GLOBAL KICKOFF™ Operations
        </p>
      </div>
    </main>
  );
}
