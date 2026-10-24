# Mdeko · Veggie Wave

Mdeko Veggie Wave is a township produce marketplace that connects buyers with nearby veggie traders through a map-based, mobile-first flow: a buyer raises a "wave", the closest trader accepts, an order is fulfilled, payment is completed, and the settlement is recorded in the finance profile.

Built with React 19, TanStack Start, Leaflet, Tailwind CSS v4, and a Supabase backend.

---

## The flow

```text
Buyer → Wave → Trader accepts → Order → MTN MoMo payment → Delivery → Complete → Settlement → Finance profile updated
```

---

## Architecture & UML

> These diagrams are generated from the live codebase structure and update automatically as the system evolves. They represent the current state of the application at the time of the last commit.

### System Architecture — Component Diagram

```mermaid
flowchart TB
    subgraph Client["Client (PWA — React 19 + TanStack Router)"]
        BuyerPage["/ — Buyer page\n(wave, map, order, pay)"]
        TraderPage["/runner — Trader dashboard\n(stock, waves, deliver, earn)"]
        FinancePage["/finance — My Money\n(score, savings, AI tip, record)"]
        AuthPage["/auth — Sign in / Sign up"]
    end

    subgraph ServerFns["Server Functions (TanStack Start)"]
        WaveFns["mdeko.functions.ts\ncreateWave · acceptWave\nadvanceOrder · listMyOrders"]
        PayFns["momo.functions.ts\nstartMomoPayment\nverifyMomoPayment"]
        FinanceFns["finance.functions.ts\ngetMoneyProfile · getSavingsJar\ndepositToJar · getSmartTip"]
        AIFns["ai-order.functions.ts\nparseOrderDescription"]
    end

    subgraph External["External Services"]
        MoMo["MTN MoMo Collections API\nproduction · ZAR · mtnsouthafrica"]
        AIGateway["Lovable AI Gateway\nopenai/gpt-4o-mini\nOrder parsing · Smart tips"]
        OSM["OpenStreetMap / OSRM\nMap tiles · Walking routes"]
    end

    subgraph DB["Supabase (Postgres + Realtime + Auth)"]
        AuthDB["auth.users\nJWT · RLS"]
        CoreTables["waves · wave_orders\npayments · settlements\nprofiles · stock · wallets"]
        FinanceTable["savings_pots\nbalance · target · auto-save"]
        DemandTable["demand\ncatalogue items requested"]
    end

    subgraph Webhook["Webhook Handler"]
        MoMoCB["/api/public/momo-callback\nverify -> finalize -> settle\n-> auto-save 5%"]
    end

    BuyerPage -->|server fn calls| WaveFns
    BuyerPage -->|server fn calls| PayFns
    BuyerPage -->|server fn calls| AIFns
    TraderPage -->|server fn calls| WaveFns
    FinancePage -->|server fn calls| FinanceFns

    WaveFns --> CoreTables
    PayFns --> MoMo
    PayFns --> CoreTables
    FinanceFns --> CoreTables
    AIFns --> AIGateway

    MoMo -->|webhook POST| MoMoCB
    MoMoCB --> CoreTables

    BuyerPage --> OSM
    TraderPage --> OSM
```

---

### Core Order Flow — Sequence Diagram

```mermaid
sequenceDiagram
    actor Buyer
    actor Trader
    participant App as Mdeko PWA
    participant Server as Server Functions
    participant DB as Supabase
    participant MoMo as MTN MoMo
    participant Finance as Finance Module

    Buyer->>App: Picks items / describes order
    App->>Server: createWave(items, location)
    Server->>DB: INSERT waves (status=created)
    DB-->>Server: wave row
    Server-->>App: wave created

    Trader->>App: Sees wave on map
    App->>Server: acceptWave(waveId)
    Server->>DB: RPC accept_wave -> INSERT wave_orders
    DB-->>Server: order row (status=accepted)
    Server-->>App: order accepted

    Trader->>App: Marks delivering
    App->>Server: advanceOrder(delivering)
    Server->>DB: RPC advance_order
    Note over App: Live GPS tracking starts

    Trader->>App: Marks delivered
    Buyer->>App: Pays with MTN MoMo
    App->>Server: startMomoPayment(orderId, msisdn)
    Server->>MoMo: POST /requesttopay
    MoMo-->>Server: 202 Accepted
    Server->>DB: INSERT payments (status=pending)

    MoMo->>App: Webhook callback (status=SUCCESSFUL)
    App->>Server: verifyMomoPayment (re-verify with MoMo)
    Server->>MoMo: GET /requesttopay/{ref}
    MoMo-->>Server: SUCCESSFUL
    Server->>DB: RPC finalize_payment -> INSERT settlements
    Server->>Finance: depositToJar(net x 5%)
    Finance->>DB: UPSERT savings_pots (balance += 5%)
    DB-->>App: Realtime update -> order completed

    Buyer->>App: Views /finance
    App->>Finance: getMoneyProfile()
    Finance->>DB: Query orders + payments + savings
    Finance-->>App: Profile + score + savings jar
```

---

### Database Schema — Entity Relationship Diagram

```mermaid
erDiagram
    USERS {
        uuid id PK
        text email
        timestamptz created_at
    }

    PROFILES {
        uuid id PK
        text name
        app_role role
        numeric lat
        numeric lng
        boolean online
        numeric rating
        text avatar
        timestamptz created_at
    }

    WALLETS {
        uuid user_id PK
        numeric balance
        text pin_hash
    }

    SAVINGS_POTS {
        uuid user_id PK
        numeric balance
        numeric target_amount
        text name
        timestamptz updated_at
    }

    WAVES {
        uuid id PK
        uuid buyer_id FK
        uuid trader_id FK
        json items
        text wish
        wave_status status
        timestamptz expires_at
    }

    WAVE_ORDERS {
        uuid id PK
        uuid wave_id FK
        uuid buyer_id FK
        uuid trader_id FK
        json items
        numeric amount
        order_status status
        timestamptz completed_at
    }

    PAYMENTS {
        uuid id PK
        uuid order_id FK
        uuid buyer_id FK
        text reference
        numeric amount
        text currency
        payment_status status
        text payer_msisdn
        timestamptz verified_at
    }

    SETTLEMENTS {
        uuid id PK
        uuid order_id FK
        uuid payment_id FK
        uuid trader_id FK
        numeric gross
        numeric net
        numeric commission
        settlement_status status
        timestamptz settled_at
    }

    STOCK {
        uuid id PK
        uuid trader_id FK
        text item_id
        numeric price
        numeric quantity
        boolean available
    }

    DEMAND {
        text key PK
        text item_id
        text label
        integer requests
        integer unfilled
        timestamptz last_at
    }

    USERS ||--|| PROFILES : "has"
    USERS ||--o| WALLETS : "has"
    USERS ||--o| SAVINGS_POTS : "has"
    PROFILES ||--o{ WAVES : "raises (buyer)"
    PROFILES ||--o{ WAVES : "accepts (trader)"
    WAVES ||--o| WAVE_ORDERS : "creates"
    WAVE_ORDERS ||--o| PAYMENTS : "paid via"
    WAVE_ORDERS ||--o| SETTLEMENTS : "settled into"
    PROFILES ||--o{ STOCK : "stocks"
```

---

### Mdeko Finance — State Machine

```mermaid
stateDiagram-v2
    [*] --> NewUser: Signs up

    NewUser --> JustStarting: First order completed
    JustStarting --> GettingGoing: 10+ orders OR savings > R50
    GettingGoing --> Trusted: 20+ orders AND active AND MoMo rate > 70%
    Trusted --> Champion: 30+ orders AND savings goal reached AND active

    state "Just Starting" as JustStarting {
        [*] --> Scoring
        Scoring --> Score025
        state "Score 0-25\nSlogan: Every legend started here" as Score025
    }

    state "Getting Going" as GettingGoing {
        [*] --> Scoring2
        Scoring2 --> Score050
        state "Score 26-50\nSlogan: You're building. Keep going." as Score050
    }

    state "Trusted" as Trusted {
        [*] --> Scoring3
        Scoring3 --> Score075
        state "Score 51-75\nSlogan: Clock it — you're trusted." as Score075
    }

    state "Champion" as Champion {
        [*] --> Scoring4
        Scoring4 --> Score100
        state "Score 76-100\nSlogan: You're winning. Stack more." as Score100
    }

    state "5% Auto-Save" as AutoSave {
        [*] --> MoMoPayment
        MoMoPayment --> FinalizePayment
        FinalizePayment --> CreateSettlement
        CreateSettlement --> DepositToSavingsJar
        DepositToSavingsJar --> UpdateScore
    }

    Trusted --> AutoSave: MoMo payment received
    GettingGoing --> AutoSave: MoMo payment received
    Champion --> AutoSave: MoMo payment received
```

---

### Finance Score Algorithm — Activity Diagram

```mermaid
flowchart TD
    A([User opens My Money]) --> B[Fetch wave_orders\nwhere buyer_id OR trader_id = userId]
    B --> C[Fetch payments\nwhere buyer_id = userId]
    C --> D[Fetch savings_pots\nwhere user_id = userId]
    D --> E{Savings pot\nexists?}
    E -->|No| F[Auto-create\nsavings_pots row\nbalance=0, target=500]
    E -->|Yes| G[Use existing row]
    F --> G

    G --> H[Compute score factors]

    subgraph Score["Score Computation — browser-side, no API call"]
        H --> I["orderVolumePts\n= min(completedOrders, 30)"]
        I --> J["paymentReliabilityPts\n= round(momoSuccessRate * 30)"]
        J --> K["activityConsistencyPts\n= anyOrderInLast30Days ? 20 : 0"]
        K --> L["savingsBehaviourPts\n= min(round(balance / target * 20), 20)"]
        L --> M["total = sum of all four\n(max 100)"]
    end

    M --> N{total}
    N -->|0-25| O["Tier: Just Starting\nEvery legend started here."]
    N -->|26-50| P["Tier: Getting Going\nYou're building. Keep going."]
    N -->|51-75| Q["Tier: Trusted\nClock it — you're trusted."]
    N -->|76-100| R["Tier: Champion\nYou're winning. Stack more."]

    O --> S[Generate next-step tip]
    P --> S
    Q --> S
    R --> S

    S --> T[Call AI gateway\ngetSmartTip — personalised tip\nbased on trading patterns]
    T --> U{AI available?}
    U -->|Yes| V["AI-generated tip\nmax 200 chars"]
    U -->|No| W[Static fallback tip]
    V --> X([Render My Money page])
    W --> X
```

---

## Features

### Buyer experience (`/`)

- Browse a produce catalogue with icons, quantities, and trader prices.
- Describe your order in words — an AI assistant converts a free-text description into an itemised order; unrecognised items are logged as demand.
- See nearby traders on a live OpenStreetMap, ranked by stock match and distance, with walking-time estimates.
- Real browser geolocation with a manual pin-drop fallback.
- Raise a wave and track it through a status stepper: waving → on the way → delivered → paid.
- Pay with MTN MoMo (request-to-pay to the buyer's phone).

### Trader experience (`/runner`)

- Stall dashboard with online/offline availability toggle.
- Profile with photo upload.
- Full stock management — per-item availability, price, and quantity.
- Incoming waves with accept / deliver / request-payment actions.
- Demand insights — see what buyers are asking for that nobody stocks.
- Earnings and settlement tracking.

### Mdeko Finance (`/finance`)

- Community Credit Score (0–100) computed from real order and payment data — four factors: volume, reliability, activity, savings.
- Tiers with youth-first slogans: Just Starting → Getting Going → Trusted ("Clock it") → Champion ("Stack more").
- Stack it — savings jar that auto-grows by 5% of every MoMo settlement, no action needed.
- AI Smart Tip — personalised weekly money advice generated from your actual trading patterns.
- Your Record — a shareable financial identity card: orders done, total traded, member since.
- How Mdeko works — transparent breakdown of revenue streams and break-even numbers.
- Multilingual: English / Zulu / Sesotho — full page translates instantly.

### Backend & integrations

- Supabase (Lovable Cloud): auth, profiles, wallets, savings_pots, catalogue, stock, waves, orders, payments, settlements, demand — all protected by row-level security.
- MTN MoMo Collections (production, `mtnsouthafrica`, ZAR): server-side token management, idempotent request-to-pay, webhook re-verification before settlement. 5% auto-save fires in the webhook callback.
- AI order parsing + Smart Tips: Lovable AI gateway → order parsing and personalised finance coaching.
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
│   │   ├── ai-order.functions.ts    # AI describe-to-order server fn
│   │   ├── ai-order.server.ts
│   │   ├── finance.functions.ts     # Finance: savings jar, money profile, AI tip
│   │   ├── finance-score.ts         # Community Credit Score algorithm
│   │   ├── use-finance.ts           # React Query hooks for finance
│   │   ├── mdeko.functions.ts       # wave/order/payment server API
│   │   ├── momo.server.ts           # MTN MoMo client
│   │   ├── momo.functions.ts
│   │   ├── veggie-store-supabase.ts
│   │   ├── veggie-store.ts          # legacy local demo store
│   │   ├── veggie-data.ts           # catalogue, icons, distance helpers
│   │   ├── use-geolocation.ts       # watchPosition-based GPS hook
│   │   └── ...                      # weather, routing, tracking, session hooks
│   ├── routes/
│   │   ├── __root.tsx
│   │   ├── index.tsx                # buyer page
│   │   ├── runner.tsx               # trader dashboard
│   │   ├── finance.tsx              # My Money — financial inclusion feature
│   │   ├── auth.tsx                 # sign in / sign up
│   │   └── api/public/              # MoMo webhook callback (+ auto-save)
│   ├── router.tsx
│   ├── start.ts
│   └── styles.css
├── supabase/
│   └── migrations/
│       └── 20261023000000_add_savings_pots.sql
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
bun install
bun run dev
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
| `LOVABLE_API_KEY` | AI gateway — order parsing and Smart Tips |

MoMo secrets are read inside server handlers only — never exposed to the browser.

---

## Payments: MTN MoMo flow

1. Token — `POST /collection/token/` with Basic auth (base64 of `API_USER:API_KEY`) plus the subscription key and `X-Target-Environment`. Tokens are cached server-side and refreshed before expiry.
2. Request to pay — `POST /collection/v1_0/requesttopay` with a unique UUID `X-Reference-Id` per transaction, amount in ZAR, MSISDN normalised to `27XXXXXXXXX`.
3. Status — `GET /collection/v1_0/requesttopay/{referenceId}`; the webhook re-verifies with MTN before settling. On success, 5% of the net settlement is automatically deposited into the trader's savings jar.

---

## Deployment

A GitHub Actions workflow (`.github/workflows/deploy.yml`) deploys to Netlify on every push to `main`. Set `NETLIFY_AUTH_TOKEN` and `NETLIFY_SITE_ID` as GitHub repository secrets.

---

## License

This project is provided as-is for demonstration and development use.

