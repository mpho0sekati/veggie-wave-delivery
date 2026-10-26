# AGENTS.md — Development Guidelines

This repository contains **Mdeko Veggie Wave**, a web application built with TanStack Start, React 19, Vite, Tailwind CSS v4, and Leaflet.

## Key Directives

- **FNB options:** Simulate eWallet deductions locally from recorded savings, never real funds. Links are informational; exports download authenticated records locally. Never imply FNB partnership, payouts, credit approval or submission.

- **Preview recovery:** Reload only after a lost preview connection reconnects, cap the backup reload for failing server calls so a failure a reload cannot fix never blanks the screen repeatedly, and answer an expired sign-in as rejected authentication that clears the browser session once.

- **Learn-by-doing presentation:** Derive shared read-only journey strips from existing basket, saved stock, online and order states; never use them to change permissions or marketplace behavior, so guidance cannot create a second source of truth.

- **Delivery celebrations:** Keep animation client-only and presentation-only, deduplicate arrival and confirmation by order, and derive the pin from saved delivery milestones rather than payment alone; this prevents polling replays and premature delivery labels.

- **Home-screen installation:** Keep the optional install control in shared navigation and use real PNG manifest icons; never automatically prompt or register app-shell workers in preview.

- **Runtime & Package Manager:** Use `bun` (`bun run build`, `bun run dev`, `bun run lint`).
- **Code Standards:** Ensure all TypeScript, React Hook, and Prettier checks pass cleanly (`bun run lint`).
- **Testing:** Perform end-to-end testing with Playwright scripts before submitting changes.
- **Buyer produce flow:** Keep produce selection in the primary drawer and the reusable picker presentation-only, with quantities supplied by the buyer page and secondary tools in disclosures or dialogs; this keeps the wave action reachable without changing marketplace or basket rules.
- **Finance presentation:** Keep trader orders, payment-verified earnings, savings and activity score on My Money using existing finance hooks; distinguish recorded sales, pending settlement and available funds, and keep bank/score/record details in dialogs. Use Johannesburg dates and refresh visible finance data so remote payment updates appear without a confirmation tap.
- **Finance freshness:** Invalidate finance queries after marketplace mutations and terminal payment verification, retain visible-page polling and focus/reconnect refresh, and order bounded reliability reads deterministically; score and tips must follow authoritative activity rather than a payment request.
- **Location:** Keep buyer and trader coordinates independent; accept valid device coordinates and label low-accuracy fixes as approximate so GPS limitations never silently leave a default pin.
- **Seller readiness:** Read saved profile independently of map markers, use saved coordinates until GPS responds, and explicitly recenter on the seller; filter incoming waves geographically before limiting reads so remote demand cannot hide nearby requests.
- **Nearby discovery:** Share the nearby-trader selector between buyer pins, produce availability and trader lists; preserve an assigned trader during delivery and separate explicit recentering from GPS updates so distant traders and live fixes cannot pull the discovery camera away.

- **Marketplace source of truth:** Use waves/wave_orders and authenticated server actions for order changes; profiles/stock are shared Cloud data, while local storage is only a view cache and offline queue. This prevents same-device demos from masquerading as cross-phone orders.
- **Roles:** Read marketplace roles from user_roles and set them through the authenticated setup routine; never use browser storage to authorize trading.
- **MoMo configuration:** Keep copy-paste cleanup in the server-only MoMo client, remove numeric line labels only when the remainder matches the credential shape, and never log provider response bodies; this preserves valid keys and avoids exposing credentials.
- **Cell & PIN sign-in:** Buyers and traders sign up with an SA cell number and 4-digit PIN via server functions that derive the real secret server-side; the cell number doubles as the MoMo number and bank linking stays optional.
- **Navigation:** Main screens share one always-visible icon tab bar with equal minmax grid tracks and matching compact install/update controls; reserve header clearance above map drawers so every tool remains visible on narrow phones without changing marketplace behavior.
- **Startup configuration:** Resolve browser connection settings through the public-only Vite configuration helper, preserving injected values before using the connected-project fallback; this prevents missing build variables from crashing startup without editing generated clients or exposing private credentials.
- **Privileged database routines:** Only the authenticated profile setup routine is browser-executable; order, payment and delivery routines are service-only behind verified server functions to prevent caller-supplied identity impersonation.
- **Judge demo:** Public demo entry points never create, reset or enumerate auth users; demo accounts are shared test identities, not evidence of private-user isolation.
- **Money integrity:** Manual typed deposits and deprecated standalone payment endpoints cannot credit funds or charge a payer; verified stored-order payments and settlement events are the only money-changing paths. Demo approvals use the same finalize path, stamped 'demo-auto-approved'.
- **Scale by default:** Buyer discovery reads only online traders inside an indexed ~6 km box (capped) plus stock for those traders, signed in or out; static catalog is cached, the map draws at most the nearest carts plus the assigned trader, marketplace polling is slower than order polling, courier reads are bounded, and MoMo calls back off on throttling with the same reference. This keeps per-phone load flat as the trader count grows.
