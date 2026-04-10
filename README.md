# GLOBAL KICKOFF™ — Ticketing System

> First-party QR ticketing with Stripe payments, Postgres, and mobile phone scanning.

---

## Architecture Overview

```
Buyer visits /           →  Event + ticket type listing
Buyer clicks "Buy"       →  POST /api/checkout  →  Stripe Checkout Session
Stripe redirects buyer   →  /checkout/success?session_id=...  (display only)
Stripe fires webhook     →  POST /api/webhooks/stripe  →  tickets issued in DB
Buyer views ticket       →  /ticket/[qr_token]  →  QR code displayed
Staff logs in            →  /staff/login
Staff scans at door      →  /staff/scan  →  POST /api/checkin
Admin views dashboard    →  /admin
```

**CRITICAL**: Tickets are ONLY issued from the webhook — never from the success page redirect.

---

## Tech Stack

| Layer | Tool |
|---|---|
| Framework | Next.js 14 App Router |
| Styling | Tailwind CSS |
| Payments | Stripe Checkout |
| Database | Postgres (Neon / Supabase / Railway) |
| Auth | JWT in httpOnly cookie (jose) |
| QR Codes | `qrcode` npm package |
| QR Scanning | Browser `BarcodeDetector` API |
| Deployment | Vercel |

---

## Local Development

### 1. Prerequisites
- Node.js 18+
- A Postgres database (Neon free tier recommended for dev)
- Stripe account (free)
- Stripe CLI (for webhook forwarding)

### 2. Install
```bash
npm install
```

### 3. Set up environment variables
```bash
cp .env.local.example .env.local
# Edit .env.local with your values
```

### 4. Run the schema
In your Postgres client (psql, Neon console, TablePlus, etc.):
```sql
-- Run the entire schema.sql file
\i schema.sql
```
Or paste the contents of `schema.sql` into your DB console.

### 5. Start the dev server
```bash
npm run dev
```

### 6. Forward Stripe webhooks locally
In a second terminal:
```bash
# Install Stripe CLI: https://stripe.com/docs/stripe-cli
stripe login
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```
Copy the `whsec_...` secret it gives you into `.env.local` as `STRIPE_WEBHOOK_SECRET`.

### 7. Create your first admin staff user
```bash
curl -X POST http://localhost:3000/api/admin/seed-staff \
  -H "Content-Type: application/json" \
  -d '{
    "secret": "YOUR_ADMIN_SEED_SECRET",
    "email": "admin@globalkickoff.com",
    "name": "Kupa Admin",
    "pin": "1234",
    "role": "admin"
  }'
```
Then log in at `/staff/login`.

---

## GitHub Setup

```bash
git init
git add .
git commit -m "feat: GK ticketing system"
git remote add origin https://github.com/YOUR_USERNAME/gk-tickets.git
git branch -M main
git push -u origin main
```

---

## Vercel Deployment

### 1. Import project
Go to [vercel.com](https://vercel.com) → New Project → Import your `gk-tickets` repo.  
Leave **Root Directory** blank.

### 2. Add environment variables
In Vercel → Project → Settings → Environment Variables, add all variables from `.env.local.example`:

| Variable | Value |
|---|---|
| `DATABASE_URL` | Your production Postgres connection string |
| `STRIPE_SECRET_KEY` | `sk_live_...` (use live key in production) |
| `STRIPE_WEBHOOK_SECRET` | From Stripe webhook dashboard (see step 3) |
| `NEXT_PUBLIC_BASE_URL` | `https://your-domain.vercel.app` |
| `STAFF_JWT_SECRET` | `openssl rand -hex 32` |
| `ADMIN_SEED_SECRET` | Another random secret |

### 3. Set up Stripe webhook in production
1. Go to [Stripe Dashboard → Webhooks](https://dashboard.stripe.com/webhooks)
2. Click **Add endpoint**
3. URL: `https://your-domain.vercel.app/api/webhooks/stripe`
4. Events to listen for:
   - `checkout.session.completed`
   - `charge.refunded`
5. Copy the `whsec_...` signing secret → add to Vercel as `STRIPE_WEBHOOK_SECRET`

### 4. Deploy
Click **Deploy** in Vercel, or push to `main` — Vercel auto-deploys.

### 5. Run schema on production DB
Connect to your production Postgres and run `schema.sql` once.

### 6. Create production admin user
```bash
curl -X POST https://your-domain.vercel.app/api/admin/seed-staff \
  -H "Content-Type: application/json" \
  -d '{
    "secret": "YOUR_ADMIN_SEED_SECRET",
    "email": "admin@globalkickoff.com",
    "name": "Kupa",
    "pin": "YOUR_SECURE_PIN",
    "role": "admin"
  }'
```

---

## Customization Guide

### 📅 Edit Events, Venues, and Ticket Types
The seed data lives in `schema.sql` — but for production, manage via SQL directly:

```sql
-- Add a new event
INSERT INTO events (venue_id, name, slug, match_label, event_date, doors_open, status)
VALUES (
  'a0000000-0000-0000-0000-000000000001',  -- venue id
  'GLOBAL KICKOFF™ — Final Watch Party',
  'world-cup-final-2026',
  'World Cup Final',
  '2026-07-19 16:00:00+00',
  '2026-07-19 14:00:00+00',
  'active'
);

-- Add ticket types for the event
INSERT INTO ticket_types (event_id, name, description, price_cents, quantity_total)
VALUES
  ('<event_id>', 'General Admission', 'Standing room', 2500, 300),
  ('<event_id>', 'VIP', 'Reserved table + bottle service', 9900, 30);
```

### 👥 Add Scanner Staff
```bash
curl -X POST https://your-domain.vercel.app/api/admin/seed-staff \
  -H "Content-Type: application/json" \
  -d '{
    "secret": "YOUR_ADMIN_SEED_SECRET",
    "email": "scanner1@globalkickoff.com",
    "name": "Door Staff 1",
    "pin": "5678",
    "role": "scanner",
    "venueId": "a0000000-0000-0000-0000-000000000001"
  }'
```

### 🔒 Void or Cancel a Ticket
```sql
UPDATE tickets SET status = 'void' WHERE ticket_number = 'GK-00001';
```

### 💰 Process a Manual Refund
After refunding in Stripe, the webhook auto-marks tickets. If manual:
```sql
UPDATE orders SET status = 'refunded' WHERE id = '<order_id>';
UPDATE tickets SET status = 'refunded' WHERE order_id = '<order_id>';
```

---

## Folder Structure

```
gk-tickets/
├── app/
│   ├── layout.js                      # Root layout
│   ├── globals.css                    # Global styles
│   ├── page.js                        # Event listing / ticket sales
│   ├── checkout/
│   │   └── success/page.js            # Post-payment success page
│   ├── ticket/
│   │   └── [token]/page.js            # Individual ticket + QR code
│   ├── staff/
│   │   ├── login/page.js              # Staff login
│   │   └── scan/page.js               # Scanner page (mobile)
│   ├── admin/
│   │   └── page.js                    # Admin dashboard
│   └── api/
│       ├── checkout/route.js          # Create Stripe Checkout session
│       ├── checkin/route.js           # QR scan check-in endpoint
│       ├── webhooks/
│       │   └── stripe/route.js        # Stripe webhook → issue tickets
│       ├── staff/
│       │   ├── login/route.js         # Staff PIN login
│       │   └── logout/route.js        # Staff logout
│       ├── tickets/
│       │   └── [token]/route.js       # Ticket lookup API
│       └── admin/
│           └── seed-staff/route.js    # Create staff users
├── components/
│   ├── ui/
│   │   └── CheckoutButton.js          # Stripe checkout button
│   └── staff/
│       ├── Scanner.js                 # Camera QR scanner
│       └── ScannerShell.js            # Event selector + scanner wrapper
├── db/
│   └── index.js                       # Postgres pool + query helpers
├── lib/
│   ├── stripe.js                      # Stripe singleton
│   ├── tokens.js                      # QR token + JWT helpers
│   ├── auth.js                        # Staff session helpers
│   ├── qr.js                          # QR code image generation
│   └── ticket-service.js             # Core ticket business logic
├── schema.sql                         # Database schema + seed data
├── .env.local.example                 # Environment variable template
├── jsconfig.json
├── next.config.js
├── tailwind.config.js
├── postcss.config.js
└── package.json
```

---

## Security Notes

- **Tickets are issued ONLY via Stripe webhook** — the success URL cannot be spoofed to generate tickets
- **QR tokens are 32-char random strings** — not sequential IDs, not guessable
- **Staff sessions are httpOnly JWTs** — not accessible from JavaScript
- **Webhook signature is verified** on every call using `STRIPE_WEBHOOK_SECRET`
- **Row-level locking** (`FOR UPDATE`) prevents double-scan race conditions
- **All scans are logged** with timestamp, staff user, result, IP, and user agent

---

## Scanner Browser Support

The camera scanner uses the `BarcodeDetector` API:
- ✅ Chrome 83+ (Android + Desktop)
- ✅ Edge 83+
- ✅ Samsung Internet
- ⚠️ Safari (partial — use manual entry fallback)
- ❌ Firefox (use manual entry fallback)

The Manual Entry tab works on all browsers.

---

## Database Providers (Recommended)

| Provider | Free Tier | Notes |
|---|---|---|
| [Neon](https://neon.tech) | 0.5 GB, 1 project | Best for Vercel — serverless Postgres |
| [Supabase](https://supabase.com) | 500 MB, 2 projects | Good free tier, has dashboard UI |
| [Railway](https://railway.app) | $5/mo after trial | Simple, great DX |

---

## Support

- Tickets / operations: hello@globalkickoff.com
- Partnerships: partnerships@globalkickoff.com
