# Use the blueprint to improve Mdeko

Focus on the blueprint's gaps that judges will see in a live demo, without redesigning the app or breaking the "pick veggies, wave" simplicity.

## 1. Live MoMo payments (Product)
- Save the real MTN MoMo settings from your document into the backend secrets (you approve the secure form).
- Run one live token check so payments work in the demo.

## 2. Smart demand tips for traders (Intelligence)
- On the trader page, show a short tip card at the top: "3 people near you waved for spinach today — add it?" with an "Add to my stock" button.
- Built from existing wave demand records, nearest area, last 24 hours.

## 3. Traders stay visible to buyers (Product, Usability)
- While a trader is online, their location refreshes automatically every minute so they never vanish from the buyer map.
- Traders whose location is older than 15 minutes show as "last seen" instead of disappearing silently.

## 4. Clear "money journey" on My Money (Impact)
- One small progress strip: Sales recorded → Savings growing → Bank-ready record, using the existing order, savings and record data. No new finance rules.

## Out of scope
- No new screens, no buyer flow changes, no change to prices, fees, or the 5% savings rule.

## Technical details
- Secrets: MOMO_BASE_URL, MOMO_SUBSCRIPTION_KEY, MOMO_API_USER, MOMO_API_KEY, MOMO_TARGET_ENVIRONMENT, MOMO_CURRENCY via secrets form; verify with readMomoConfig + token request.
- Demand tip: authenticated server function aggregating recent wave demand within MAX_SUITABLE_DISTANCE_KM of the trader; rendered in runner.tsx above DemandInsights.
- Heartbeat: interval in runner.tsx updating the trader profile coordinates while online; nearbyTraders gains a staleness flag (test added in nearby-traders.test.ts).
- Money journey: presentation-only component in finance.tsx using useFinanceProfile/useSavingsJar.
- Verify with vitest and a two-account Playwright run (buyer waves, trader sees tip and accepts).
