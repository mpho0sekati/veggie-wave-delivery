# Mdeko roadmap

## Done

- eWallet demo uses recorded Mdeko savings, blocks overspending, accepts exact amounts and shows local simulated deductions without changing real funds. Eight tests and changed-file lint pass; signed-in account had R0 and correctly blocked withdrawal. Positive-balance UI completion remains unverified until an account has recorded savings.

- FNB options on My Money: eWallet guidance beside earnings/savings explicitly says not connected; First Business Zero and funding links open official FNB pages; lender record downloads locally without bank submission. Signed-in account's six-order full record downloaded successfully; desktop and 320/393px phone dialogs checked with no runtime errors. 11 targeted tests, changed-file lint and build pass; repository-wide lint still has unrelated existing failures. Live FNB payouts and credit submissions are not integrated.

- Mobile layout: all navigation icons fit equal-width tracks; buyer/seller drawers reserve header clearance, completed orders use content height, and area/dialog controls wrap within phone screens. Signed-in buyer basket and area switching checked at 320×720, 393×852, 393×600 and desktop; existing test trader and My Money checked on phones. No horizontal overflow or runtime errors; 14 targeted tests pass and build OK.

- Learn-by-doing: buyer and trader icon steps follow existing basket, stock, online and delivery states, with small live feedback and no popups. Signed-in produce selection/removal and saved trader readiness checked at 1280×1800, 390×844 and 625×543; navigation stays visible, 16 targeted tests pass, lint clean and build OK.

- Dynamic score freshness: terminal payment verification and marketplace actions refresh My Money, focus/reconnect refresh current activity, reliability samples use deterministic newest-first ordering, and tips track changed inputs. 21 targeted tests passed; signed-in My Money opened successfully, lint and build checks passed. No real MoMo payment was initiated or recorded.

- Seller saved name is editable without retyping; profile saves verify a row changed, saved coordinates keep nearby waves visible before GPS returns, location button recenters above the stock drawer, and incoming-wave queries filter by area before the read limit. Requesting seller account saved profile, received a separate buyer's spinach wave and accepted it; test order cancelled. 45 tests pass.

- Trader My Money keeps the existing layout with recent orders, payment-verified earnings, pending/settled totals, savings and Mdeko activity score. Two-account cash order verified: R22 recorded, R1.10 saved, both confetti moments shown; signed-in dashboard, score dialog and reload checked. MoMo payer-approved test remains pending.

- Delivered map pin and two short nonblocking celebrations added; two-account cash delivery, arrival/confirmation bursts, polling and reload deduplication verified. 38 tests pass; live MoMo payment remains untested.

- Added optional Install Mdeko navigation control with browser prompt support and phone home-screen instructions; supplied PNG app icons and prevented automatic worker registration.

- Judge readiness: closed direct privileged-RPC access, disabled unsafe standalone payment/manual credit paths, scoped discovery and private paths, patched dependencies; 29 tests and database money/privilege assertions passed. Signed-in phone wave/cancellation and existing trader demo verified. Limits documented in docs/judge-readiness.md.
- Judge clarity: buyer first screen says Fresh veggies, delivered without a tutorial or popup.

- Fixed missing browser connection settings at startup; compiler regression tests and signed-in buyer/money opening checks pass with no runtime errors.
- Fix typecheck build errors (auth.tsx pin field, runner.tsx missing userId).

- Buyer/seller shared profiles, stock, acceptance, cash delivery and persisted status verified across separate accounts.
- Courier position persistence verified.
- Simplified buyer selection, removed blocking welcome guide, and collapsed secondary tools; selection and layouts verified at 608×543, 390×844, and 1280×1800.
- Simplified produce picking with large tap-to-add icons, selected checkmarks, basket review and everyday wording; pick/add/remove, saved selections and optional helper verified at 608×543, 390×844 and 1280×1800. All 15 regression tests pass.
- Cleaned My Money into order value, savings and recent activity with optional bank/score/record dialogs; signed-in savings goal persistence and layouts verified. Full record service returns unavailable; account-summary fallback remains visible.
- Nearby trader pins, stock availability and lists share real-coordinate discovery; signed-in check showed the existing online stall 55 m away, distant-stall exclusion and camera stability after GPS updates verified. All 20 tests pass.

## Active / Backlog

- Current request: verify one real payer-approved MTN MoMo payment in trader My Money; blocked until the buyer selects Pay with MoMo on a real accepted order and approves the phone prompt. Dynamic score refresh is implemented and tested; a real payment-to-dashboard update remains unverified.

- Public-launch identity/abuse protection awaits phone verification and a supported rate-limit solution; four-digit PIN and shared demo identities remain unsuitable for public money accounts.
- Large-scale capacity remains unverified; needs an isolated load-test environment, regional pagination and courier retention before claiming a user capacity.

- Full financial-record service now reads successfully for the requesting account; account-summary fallback remains for service failures.
- Live MoMo payment and settlement verification waits for a payer-approved test transaction.
- Verify remaining finance screens against real MoMo settlements.
- Order status updates now poll every four seconds across phones.
- Implement trader notifications for new nearby waves.
- Add automated settlement/payout logic for traders.
- Improve location-based matching (distance + stock match).
- Address pre-existing prettier/lint noise in runner.tsx and index.tsx.
- Publish app to production.
- Error log for 02-05 Sep 2026 written to ERROR_LOG.md (done).

- [x] Presentation deck (.md) with Armando + grandmother persona journey
