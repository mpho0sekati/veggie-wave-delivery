# Veggie Wave — gap fixes and improvements

Staying a single-device demo (no accounts, no backend). Everything below works on this phone, with local storage.

## What's missing today

- Traders can't say what they actually sell — the catalog is fixed and prices are hardcoded for everyone.
- A trader can only edit "runner 1"; there's no sense of "this is my stall".
- Buyer waves for items even if the closest trader doesn't have them.
- Payment is a fake Capitec QR with no real flow of its own.
- No order history, so a finished wave just disappears.
- The wave has no urgency: no timer, no "no one responded" state.

## What we'll build

### 1. Trader stall setup (runner page)
- Profile stays simple: photo, name, "Available" toggle.
- New "My stock" section: the trader ticks which fruits/veg they sell today and types their own price per item (unit stays fixed, e.g. 1kg / bunch).
- Untick = out of stock and it disappears from buyers' view of that trader.

### 2. Buyer sees prices per trader
- Trader list on the home screen shows distance, walking time, rating and how many of the buyer's picked items that trader actually has.
- Buyer picks items first; traders missing an item are marked "partial" and pushed below full matches.
- The total shown is the closest matching trader's own prices, not one global price list.

### 3. Wave Pay — our own in-app payment
Replaces the Capitec placeholder with a self-contained demo payment:
- Every user starts with a demo Wave Pay balance in Rands.
- On delivery, the buyer taps "Pay with Wave Pay", confirms with a 4-digit PIN, and the amount moves from the buyer's balance to the trader's earnings.
- Trader page gets an "Earnings" card showing today's total and paid orders.
- Cash option kept as a fallback ("Paid cash" button) so a trader without the app flow can still close an order.
- This moves demo money only. Real card/EFT money needs a backend and a payment provider — say the word and I'll wire that up later.

### 4. Order flow polish
- Wave shows a live "waiting… 0:42" timer, and after 2 minutes offers "wave again" or "try the next trader".
- Order history list on both sides (last 10 waves: items, trader, total, paid/cash).
- Clearer empty and denied-location states.

### 5. Township-fit details
- Rename "runner" to "trader" in the UI (keeping the same screens).
- Add a short note field on the wave ("gate 4, blue house") so the trader can find the buyer.
- Add staples traders commonly sell: potatoes, onions, cabbage, butternut, avocado, chillies.

## Technical notes

- `src/lib/veggie-data.ts`: extend `Runner` with `stock: { itemId, price, available }[]`; add new catalog items; keep icons only, no photos.
- `src/lib/veggie-store.ts`: add `wallet` (buyer balance, PIN) and `orders: WaveRequest[]` history to `AppState`; add actions `setStock`, `payWithWavePay`, `payCash`, `archiveRequest`. Keep the same localStorage + custom-event sync.
- `src/routes/runner.tsx`: stock editor (checkbox + price input per item), earnings card.
- `src/routes/index.tsx`: match-aware trader ranking, per-trader pricing, wave timer, Wave Pay dialog with PIN entry, history list.
- New `src/components/WavePayDialog.tsx` and `src/components/StockEditor.tsx` to keep route files small.
- Design system and Leaflet map stay as-is; new UI uses existing tokens and shadcn components.
