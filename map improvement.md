Dynamic live map: seller tracking, navigation, learned shortcuts, weather safety

Turns the current static-ish map into a live delivery map: the buyer watches the seller move, the seller gets a walking route they can re-route, the app remembers real shortcuts sellers actually use, and both sides get severe-weather warnings.

1. Live seller tracking

While a seller is delivering, their phone shares its position every few seconds.

The buyer's map shows the seller's dot moving smoothly (animated between updates), with live distance and "arriving in about X min".

Buyer's own pin also updates from their real location; the map keeps both pins in view.

Positions arrive through live database updates, so both phones stay in sync within about a second.

Sharing starts when an order is accepted and stops on delivery or completion — no background tracking outside an active delivery.

2. Seller navigation

Seller sees a walking route line from their position to the buyer, plus a step list ("turn left into...", distance to next step).

Route comes from free open-source routing (OSRM) with a walking profile; no account needed.

The route recalculates automatically when the seller drifts off it by more than ~40 m, and there is a manual "Re-route" button.

If routing is unreachable, the map falls back to a straight guide line and a compass-style bearing so the seller is never stuck.

3. Learned shortcuts

Every delivery quietly records the actual path walked (a trimmed trail of points).

When a recorded path between a similar start and end area is shorter or faster than the routed one, and has been walked more than once, it is stored as a known shortcut.

Next time, that shortcut is offered first: "Sellers usually cut through here — 3 min shorter", with a tap to follow it.

Shortcuts show as faint dashed lines on the seller's map. They are area-based, never tied to a person, and only surface after repeat use so one odd walk cannot mislead others.

4. Weather safety warnings

Weather is checked for the delivery area from a free open-data weather service (no key required).

Warning banner and in-app alert for heavy rain, thunderstorms, flooding, and extreme cold: "Heavy rain in your area — stay safe, delay if you need to."

Heat is treated more softly: a hydration reminder rather than a warning.

Warnings are advisory only: deliveries continue, and the buyer also sees a note that weather may slow their delivery.

5. Map UX

Map height adapts: tall while tracking a delivery, compact during checkout so it never blocks the pay button.

Recenter button, "follow the seller" toggle, and clear states for "waiting for the seller's location" and "location off".

Technical notes

New tables: courier_positions (order_id, trader_id, lat, lng, heading, speed, accuracy, recorded_at) for the live feed; delivery_traces (order_id, points jsonb, distance, duration) for completed walks; learned_paths (start/end geohash cells, points jsonb, distance, duration, uses, last_used) for shortcuts. RLS: seller writes only their own active order's positions; buyer and assigned seller read that order; learned paths readable by authenticated sellers, written only via a security-definer function. GRANTs with every table.

Realtime: ALTER PUBLICATION supabase_realtime ADD TABLE public.courier_positions, subscribed in a useEffect channel keyed to the active order and torn down on unmount.

Position writes go through a createServerFn with requireSupabaseAuth, throttled client-side to one write per ~5 s plus a minimum-movement filter, so battery and write volume stay sane.

Routing: OSRM public walking endpoint called from a server function (keeps the URL server-side and lets us cache identical route requests briefly); returns a decoded polyline plus steps as a plain DTO.

Shortcut learning: on delivery completion a server function compares the traced path to the routed baseline, snaps start/end into coarse geohash cells, and upserts learned_paths incrementing uses when a matching path already exists.

Weather: Open-Meteo forecast fetched in a server function by coordinates, mapped to severity levels, cached ~10 minutes per coarse cell.

Frontend: extend VeggieMap.tsx with a courier marker, route polyline and shortcut layers (still lazy-loaded, client-only); extend use-geolocation.ts with a throttled reporting mode; add hooks in use-mdeko.ts for courier feed, route, and weather.
