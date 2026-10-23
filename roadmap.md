# Mdeko roadmap

## Done

- Fix typecheck build errors (auth.tsx pin field, runner.tsx missing userId).

- Buyer/seller shared profiles, stock, acceptance, cash delivery and persisted status verified across separate accounts.
- Courier position persistence verified.

## Active / Backlog

- Live MoMo payment and settlement verification waits for a payer-approved test transaction.
- Verify remaining finance screens against real MoMo settlements.
- Order status updates now poll every four seconds across phones.
- Implement trader notifications for new nearby waves.
- Add automated settlement/payout logic for traders.
- Improve location-based matching (distance + stock match).
- Address pre-existing prettier/lint noise in runner.tsx and index.tsx.
- Publish app to production.
- Error log for 02-05 Sep 2026 written to ERROR_LOG.md (done).
