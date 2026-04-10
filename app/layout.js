import "./globals.css";

export const metadata = {
  title: "GLOBAL KICKOFF™ — Tickets",
  description: "Purchase tickets to GLOBAL KICKOFF™ World Cup watch parties.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-brand-black text-white antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
