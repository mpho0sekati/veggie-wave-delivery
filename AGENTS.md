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
