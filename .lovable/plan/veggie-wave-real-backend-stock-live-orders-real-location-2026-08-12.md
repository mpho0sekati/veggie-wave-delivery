# Veggie Wave — real backend: stock, live orders, real location

This turns the single-phone demo into a real multi-phone app on Lovable Cloud (database, logins, live updates). Nothing stays in local storage.

## 1. Accounts

- Email + password sign-in on a new `/auth` page (sign up, sign in, sign out).
- At sign-up you pick your role: **buyer** or **trader**, plus your display name.
- Traders get their stall page (`/runner`), buyers get the wave page (`/`).
- Header shows who is signed in and a sign-out button.

## 2. Full stock management (traders)

Per catalog item, a trader sets:
- **In stock** on/off
- **Price** in Rands
- **Quantity available** (a number the trader edits by hand — it does not auto-deduct)

Buyers only see items where in-stock is on and quantity is above zero. Quantity shows as "3 left" and traders get a "sold out" nudge when it reaches 0. Any catalog item can be added, including new ones promoted from repeated buyer requests (so blueberries becomes tappable once it's been asked for), and traders can add it from the "What's in demand" card in one tap.

## 3. Live order status across phones

One shared order record moves through: waving → accepted → on the way → delivered → paid (or cancelled).
- Buyer waves; every nearby online trader who stocks the items sees it appear instantly.
- First trader to accept claims it; other traders see it disappear.
- Trader taps "On the way" then "Delivered"; the buyer's screen updates live without refreshing.
- Buyer pays with Wave Pay (PIN) or marks cash; both phones see the paid state and the trader's earnings go up.
- If nobody accepts within 2 minutes, the buyer gets "wave again" or "try the next trader".

Updates arrive by live database subscriptions, so two phones stay in sync in about a second.

## 4. Real location

- Buyer's real GPS position is saved with each wave, so traders see the actual pin and distance.
- Traders share their live position while "Available" is on (updated as they move), so buyers see genuine distance and walking time instead of demo offsets.
- Clear states for "location blocked" with a retry, and a friendly note that distance needs location on.

## 5. Demand insights

Demand now counts across all users, not just your phone: every wave logs requested items and marks them unfilled when no online trader nearby stocks them. Traders see the shared ranked list with one-tap "add to my stock".

## Technical notes

- Enable Lovable Cloud. Tables: `profiles` (id → auth.users, name, role, avatar, online, lat/lng, earnings, wallet balance, pin hash-free demo pin), `stock` (trader_id, item_id, price, quantity, available), `catalog_items` (promoted items), `orders` (buyer_id, trader_id, status, items jsonb, total, note, wish, paid_with, buyer lat/lng, timestamps), `demand` (item key, label, requests, unfilled, last_at).
- RLS: profiles readable by authenticated users (public fields), writable by owner; stock writable by owner trader, readable by authenticated; orders readable by buyer and by the assigned trader plus unclaimed waves visible to traders, status transitions restricted to the right party; demand readable by all authenticated, incremented via a server function. GRANTs issued with every table.
- Realtime: `supabase.channel` postgres_changes subscriptions on `orders` (buyer's own + open waves for traders) and `stock`, feeding TanStack Query cache invalidation.
- Auth: `/auth` public route; buyer and trader screens move under the managed `_authenticated` layout. Reads/writes go through `createServerFn` with `requireSupabaseAuth` where they need the signed-in user.
- Wave Pay stays demo money, now server-side: a server function moves Rands from buyer balance to trader earnings atomically after PIN check.
- `src/lib/veggie-store.ts` localStorage store is replaced by query hooks; `veggie-data.ts` keeps icons, catalog defaults and distance helpers. Geolocation hook extended to watch position for online traders.
