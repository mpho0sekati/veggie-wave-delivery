# Mdeko judge-readiness review

Checked 25 October 2026. This is a tested MVP, not a security certification or proof of production capacity.

## What the app does

Buyers choose veggie icons and raise a hand. Nearby online traders accept an itemized wave, with prices and quantities taken from their stored stock. Buyers choose MTN MoMo or cash on delivery. Traders share delivery progress. Confirmed MoMo payments create a settlement record and contribute 5% of the **net settlement** to the trader's savings record. BankLink is optional and currently shows labelled sandbox bank data.

## Hardened in this review

- Order/payment/delivery database routines no longer accept direct anonymous or signed-in browser calls with a forged actor ID. Verified server functions bind actors to the signed-in user.
- The authenticated profile setup routine remains accessible; direct profile updates cannot modify role or rating.
- Demand counters are server-owned; only traders read aggregated demand. Private learned delivery paths are not browser-readable.
- Stock discovery is limited to a trader's own stock or online traders' stock. Catalog data is intentionally shared, with valid submissions restricted to traders.
- Deprecated standalone MoMo endpoints are disabled. They cannot charge arbitrary caller-supplied amounts or query unrelated payment references.
- Typed manual savings deposits are disabled because an entered amount is not proof of funds.
- Demo setup no longer enumerates, creates or resets auth users. Demo buttons use existing **shared** demo identities; these are not production isolation.
- Dependency advisory scan reports no known vulnerabilities in 56 production dependencies after patching Zod, Undici, JS-YAML and source-map-js.
- Courier reads and retained browser history are limited to 200 recent points. Stale persisted positions do not become fresh simply because polling rereads them.
- Marketplace discovery polls every 15 seconds; order polling remains four seconds. History reads have indexes and limits.
- Callback inputs have reference validation and a payload bound; terminal callbacks return without repeated provider work. Provider status is rechecked, never accepted from callback JSON.

## Verification evidence

- `bunx vitest run`: 29 tests across eight files passed, including phone/PIN rules, payment status, MoMo configuration, wave views, startup configuration, nearby traders and GPS.
- `tests/db/judge-security.sql`: privilege assertions pass against the connected database, without customer-data changes.
- `tests/db/money-rules.sql`: repeat-start payment ID, server-calculated amount, duplicate-settlement rejection, exactly R5 savings on R100 net, stranger isolation and buyer read access tested inside a rolled-back transaction.
- Browser checks: public purpose, signed-in buyer and My Money, trader access gating and invalid cell input; no page exceptions in that run.

## Honest limits before public launch

- Four-digit PINs have only 10,000 combinations; phone ownership is not verified. This is not production-grade identity verification. Proper per-source/per-account abuse controls and phone verification remain necessary. The platform has no standard backend rate-limiting primitive; an ad-hoc limiter is not silently claimed here.
- Shared judge demo accounts expose the same demo records to every judge. Use separate normal accounts when checking buyer isolation. They must be disabled or isolated before a public launch.
- No payer-approved live MoMo transaction was run in this review. A live token check is not proof of end-to-end payment, disbursement or cash settlement.
- Settlement creation is a record, not proof that a trader's wallet received a payout. Automatic payout remains unfinished.
- The public callback does not have an established provider-signature verification scheme. Direct provider re-verification prevents forged success but does not prevent resource abuse.
- No high-concurrency production load test was run. A 1,000-user capacity claim would be unsupported. Four-second order polling remains a bottleneck; discovery is bounded, not paginated geographically, and courier storage needs retention.
- Map tiles and routing depend on community/public services. Tile delays are possible, and public routing infrastructure is not a production SLA.
- Savings and community credit displays are records, not independently proven custodial balances. Historical manually credited savings were not reconciled in this review.

## Judge break-test checklist

1. Empty/invalid cell and PIN: rejected with a readable message.
2. Pick veggies, visit sign-in, return: basket retained.
3. Deny GPS: no fake live-location claim; manual location remains available.
4. Double accept: database lock prevents two traders receiving one wave.
5. Insufficient stock: acceptance rejected rather than negative stock.
6. Stranger order ID or direct payment-finalization call: access denied.
7. Tap payment twice: the existing payment is reused, not a second charge.
8. Lose internet: request is saved and submitted on reconnect, subject to authentication.
9. MoMo pending/failed: never label it paid from callback text alone.
10. Complete cash delivery: record completion separately from verified MoMo funds.

Items in this checklist describe intended checks; only the explicitly listed verification evidence above is claimed as run.