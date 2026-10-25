# AGENTS.md — Development Guidelines

This repository contains **Mdeko Veggie Wave**, a web application built with TanStack Start, React 19, Vite, Tailwind CSS v4, and Leaflet.

## Key Directives

- **Runtime & Package Manager:** Use `bun` (`bun run build`, `bun run dev`, `bun run lint`).
- **Code Standards:** Ensure all TypeScript, React Hook, and Prettier checks pass cleanly (`bun run lint`).
- **Testing:** Perform end-to-end testing with Playwright scripts before submitting changes.
- **Buyer presentation:** Keep produce selection in the primary drawer and secondary tools in disclosures or dialogs; this keeps the wave action reachable without changing marketplace behavior.
- **Produce controls:** Keep the reusable produce picker presentation-only, with quantities and changes supplied by the buyer page; this preserves the existing basket and marketplace rules.
- **Finance presentation:** Use existing finance hooks for order summaries and savings, with bank, score and record details in dialogs; order value must remain distinct from available funds and bank creditworthiness.
- **Location:** Keep buyer and trader coordinates independent; accept valid device coordinates and label low-accuracy fixes as approximate so GPS limitations never silently leave a default pin.
- **Nearby discovery:** Share the nearby-trader selector between buyer pins, produce availability and trader lists; preserve an assigned trader during delivery and separate explicit recentering from GPS updates so distant traders and live fixes cannot pull the discovery camera away.

- **Marketplace source of truth:** Use waves/wave_orders and authenticated server actions for order changes; profiles/stock are shared Cloud data, while local storage is only a view cache and offline queue. This prevents same-device demos from masquerading as cross-phone orders.
- **Roles:** Read marketplace roles from user_roles and set them through the authenticated setup routine; never use browser storage to authorize trading.
- **MoMo configuration:** Keep copy-paste cleanup in the server-only MoMo client, remove numeric line labels only when the remainder matches the credential shape, and never log provider response bodies; this preserves valid keys and avoids exposing credentials.
- **Cell & PIN sign-in:** Buyers and traders sign up with an SA cell number and 4-digit PIN via server functions that derive the real secret server-side; the cell number doubles as the MoMo number and bank linking stays optional.
- **Navigation:** Main screens share one always-visible icon tab bar instead of a hidden menu, so every tool is one tap away.
- **Startup configuration:** Resolve browser connection settings through the public-only Vite configuration helper, preserving injected values before using the connected-project fallback; this prevents missing build variables from crashing startup without editing generated clients or exposing private credentials.
- **Privileged database routines:** Only the authenticated profile setup routine is browser-executable; order, payment and delivery routines are service-only behind verified server functions to prevent caller-supplied identity impersonation.
- **Judge demo:** Public demo entry points never create, reset or enumerate auth users; demo accounts are shared test identities, not evidence of private-user isolation.
- **Read budgets:** Bound marketplace and courier-history reads and retain recent tracking points; marketplace polling is slower than order polling to reduce repeated discovery traffic.
