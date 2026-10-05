# Mdeko · Veggie Wave

Mdeko Veggie Wave is a township produce marketplace that connects buyers with nearby veggie traders through a map-based, mobile-first flow: a buyer raises a "wave", the closest trader accepts, an order is created, payment runs through MTN MoMo, and the trader delivers.

Built with React 19, TanStack Start, Leaflet, Tailwind CSS v4, and a Supabase backend.

---

## The flow

```text
Buyer → Wave → Trader accepts → Order → MTN MoMo payment → Delivery → Complete → Settlement
```

---

## Features

### Buyer experience (`/`)

- Browse a produce catalogue with icons, quantities, and trader prices.
- **Describe your order in words** — an AI assistant (via the AI gateway) converts a free-text description ("veg for a chakalaka for 6") into an itemized order; unrecognized items are logged as demand.
- See nearby traders on a live OpenStreetMap, ranked by stock match and distance, with walking-time estimates.
- Real browser geolocation with a manual pin-drop fallback (right-click / long-press the map).
- Raise a wave and track it through a status stepper: waving → on the way → delivered → paid.
- Pay with MTN MoMo (request-to-pay to the buyer's phone) or Mdeko Pay demo balance.

### Trader experience (`/runner`)

- Stall dashboard with online/offline availability toggle.
- Profile with photo upload.
- Full stock management: per-item availability, price, and quantity — including adding new items (e.g. blueberries) to the catalogue.
- Incoming waves with accept / deliver / request-payment actions.
- **Demand insights**: see what buyers are asking for that nobody stocks, with a one-tap "add to my stock" shortcut.
- Earnings and settlement tracking.

### Backend & integrations

- **Supabase (Lovable Cloud)**: auth (email/password + roles), profiles, wallets, catalogue, stock, waves, orders, payments, settlements, and demand logs — all protected by row-level security, with writes going through security-definer database functions.
- **MTN MoMo Collections** (production, `mtnsouthafrica`, ZAR): server-side token management with caching and 401 retry, idempotent request-to-pay with unique UUID references, status polling, and a public webhook callback that re-verifies status with MTN before settling. Credentials live in server-side secrets only.
- **AI order parsing**: server function calling the Lovable AI gateway to turn free-text into structured order lines.
- Weather alerts and walking-route guidance during delivery.

---

## Tech stack

- React 19 + TanStack Start / Router
- Vite 7
- Tailwind CSS v4
- Leaflet + OpenStreetMap tiles
- Supabase (auth, database, realtime)
- MTN MoMo Collections API
- Radix UI primitives, Lucide icons, sonner toasts

---

## Project structure

```text
.
├── src/
│   ├── components/
│   │   ├── ui/
│   │   ├── BrandMark.tsx
│   │   ├── DemandInsights.tsx
│   │   ├── DescribeOrder.tsx
│   │   ├── NavigationTracker.tsx
│   │   ├── OrderStepper.tsx
│   │   ├── StockEditor.tsx
│   │   ├── VeggieMap.tsx
│   │   └── WavePayDialog.tsx
│   ├── lib/
│   │   ├── ai-order.functions.ts   # AI describe-to-order server fn
│   │   ├── ai-order.server.ts
│   │   ├── mdeko.functions.ts      # wave/order/payment server API
│   │   ├── momo.server.ts          # MTN MoMo client (token, requesttopay, status)
│   │   ├── momo.functions.ts
│   │   ├── veggie-store-supabase.ts
│   │   ├── veggie-store.ts         # legacy local demo store
│   │   ├── veggie-data.ts          # catalogue, icons, distance helpers
│   │   ├── use-geolocation.ts      # watchPosition-based GPS hook
│   │   └── ...                     # weather, routing, tracking, session hooks
│   ├── routes/
│   │   ├── __root.tsx
│   │   ├── index.tsx               # buyer page
│   │   ├── runner.tsx              # trader dashboard
│   │   ├── auth.tsx                # sign in / sign up
│   │   └── api/public/             # MoMo webhook callback
│   ├── router.tsx
│   ├── start.ts
│   └── styles.css
├── supabase/                       # migrations
├── docs/screenshots/
├── .env.example
└── README.md
```

---

## Getting started

### Prerequisites

- Node.js or Bun
- A Supabase project (or Lovable Cloud) with the migrations in `supabase/` applied
- MTN MoMo Collections credentials (API user, API key, subscription key)

### Install & run

```bash
npm install
npm run dev
```

### Lint & build

```bash
npm run lint
npm run build
```

### Environment variables

Copy `.env.example` and fill in:

| Variable | Purpose |
| --- | --- |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` | Client-side Supabase config |
| `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` | Server-side Supabase config |
| `MOMO_BASE_URL` | `https://proxy.momoapi.mtn.com` (production) |
| `MOMO_SUBSCRIPTION_KEY` | Ocp-Apim-Subscription-Key |
| `MOMO_API_USER` / `MOMO_API_KEY` | Basic-auth credentials for token generation |
| `MOMO_TARGET_ENVIRONMENT` | `mtnsouthafrica` |
| `MOMO_CURRENCY` | `ZAR` |

MoMo secrets are read inside server handlers only — never exposed to the browser.

---

## Payments: MTN MoMo flow

1. **Token** — `POST /collection/token/` with Basic auth (base64 of `API_USER:API_KEY`) plus the subscription key and `X-Target-Environment`. Tokens are cached server-side and refreshed before expiry, with one automatic retry on 401.
2. **Request to pay** — `POST /collection/v1_0/requesttopay` with a unique UUID `X-Reference-Id` per transaction (idempotent: re-paying an order reuses its pending payment), amount formatted to two decimals, and the payer MSISDN normalized to `27XXXXXXXXX` (no `+`).
3. **Status** — `GET /collection/v1_0/requesttopay/{referenceId}`; the webhook callback re-verifies with MTN rather than trusting the payload, then settles the order and credits the trader.

---

## Deployment

A GitHub Actions workflow (`.github/workflows/deploy.yml`) deploys to Netlify on every push to `main`. Set `NETLIFY_AUTH_TOKEN` and `NETLIFY_SITE_ID` as GitHub repository secrets.

---

## License

Provided as-is for demo and prototype use.
