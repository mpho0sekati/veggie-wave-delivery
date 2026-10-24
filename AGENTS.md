# AGENTS.md — Development Guidelines

This repository contains **Mdeko Veggie Wave**, a web application built with TanStack Start, React 19, Vite, Tailwind CSS v4, and Leaflet.

## Key Directives

- **Runtime & Package Manager:** Use `bun` (`bun run build`, `bun run dev`, `bun run lint`).
- **Code Standards:** Ensure all TypeScript, React Hook, and Prettier checks pass cleanly (`bun run lint`).
- **Testing:** Perform end-to-end testing with Playwright scripts before submitting changes.
- **Buyer presentation:** Keep produce selection in the primary drawer and secondary tools in disclosures or dialogs; this keeps the wave action reachable without changing marketplace behavior.
- **Location:** Keep buyer and trader coordinates independent; accept valid device coordinates and label low-accuracy fixes as approximate so GPS limitations never silently leave a default pin.

- **Marketplace source of truth:** Use waves/wave_orders and authenticated server actions for order changes; profiles/stock are shared Cloud data, while local storage is only a view cache and offline queue. This prevents same-device demos from masquerading as cross-phone orders.
- **Roles:** Read marketplace roles from user_roles and set them through the authenticated setup routine; never use browser storage to authorize trading.
- **MoMo configuration:** Keep copy-paste cleanup in the server-only MoMo client, remove numeric line labels only when the remainder matches the credential shape, and never log provider response bodies; this preserves valid keys and avoids exposing credentials.
