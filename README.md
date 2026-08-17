# Mdeko · Veggie Wave

**Mdeko Veggie Wave** is a real-time township produce delivery platform. It connects local fruit and vegetable buyers directly with nearby mobile traders ("runners") using live geolocation, interactive Leaflet maps, stock management, and seamless payments via **Mdeko Pay**.

---

## Key Features

### Buyer View (`/`)
* **Interactive Live Map:** Real-time visual representation of nearby veggie traders, your pinned/detected location, and active order delivery routes.
* **Dynamic Map Layout:** Automatically shrinks when an active wave or order/checkout card is active to keep the checkout experience smooth, with a quick collapse/expand toggle button.
* **Geolocation & Manual Pinning:** Detect your GPS location or long-press on the map to manually set your delivery pin.
* **Item Selection & Custom Wishes:** Browse local produce items with dynamic pricing based on nearby trader stock, or submit custom produce requests.
* **"Raise My Hand" Wave Flow:** Signal nearby traders when you need produce. Nearest stocked traders are prioritized.
* **Order Tracking & Payment:** Track order status in real time (Waving → Accepted → Delivered → Paid) and settle payment via Mdeko Pay balance or cash.

### Trader Stall (`/runner`)
* **Stall & Stock Management:** Toggle online availability, upload stall profile pictures, and adjust stock availability and item prices.
* **Live Nearby Waves:** View active incoming customer waves, estimated distance, walk times, and item availability matches.
* **Order Fulfillment:** Accept waves, navigate to buyers, and request/confirm payments directly from the trader dashboard.
* **Demand Insights:** Analyze items requested by local buyers that are currently out of stock to expand inventory.

---

## Tech Stack & Architecture

* **Framework:** [TanStack Start](https://tanstack.com/router/latest) + [TanStack Router](https://tanstack.com/router)
* **Frontend Library:** React 19
* **Mapping:** Leaflet & React-Leaflet with OpenStreetMap tiles
* **Styling:** Tailwind CSS v4, Lucide React icons, and Radix UI primitives
* **Build Tool & Server:** Vite + Nitro SSR engine
* **Runtime & Package Manager:** [Bun](https://bun.sh/)
* **Database / Backend Integration:** Supabase (optional client integration)

---

## Project Structure

```
.
├── src/
│   ├── components/
│   │   ├── ui/               # Radix UI and Tailwind component primitives
│   │   ├── VeggieMap.tsx      # Interactive Leaflet map component
│   │   ├── StockEditor.tsx    # Trader inventory editor
│   │   ├── WavePayDialog.tsx  # Payment modal
│   │   ├── OrderStepper.tsx   # Order progress stepper
│   │   └── BrandMark.tsx      # App header and branding component
│   ├── lib/
│   │   ├── veggie-data.ts     # Types, mock data, catalog definitions, distance formulas
│   │   ├── veggie-store.ts    # React state management & persistence
│   │   └── use-geolocation.ts # Custom hook for browser geolocation
│   ├── routes/
│   │   ├── __root.tsx         # TanStack Root route & layout
│   │   ├── index.tsx          # Buyer page route
│   │   └── runner.tsx         # Trader stall route
│   ├── styles.css             # Global CSS and Tailwind directives
│   └── start.ts               # TanStack Start entrypoint
├── public/                    # Static assets & map marker icons
├── vite.config.ts             # Vite configuration
├── package.json               # Dependencies and script definitions
└── README.md                  # Project documentation
```

---

## Getting Started

### Prerequisites
Make sure you have [Bun](https://bun.sh/) installed on your machine.

### Installation
```bash
bun install
```

### Development Server
Start the development server with live reload:
```bash
bun run dev
```
Open [http://localhost:8080](http://localhost:8080) (or the port indicated in terminal) in your browser.

### Building for Production
Compile client and server bundles for production:
```bash
bun run build
```

### Running Quality Checks & Linter
To run code formatting and ESLint checks:
```bash
bun run lint
```

---

## License

MIT License.
