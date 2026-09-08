# Mdeko · Veggie Wave — Error Log

Problems found and fixed between **2 September 2026** and **5 September 2026**.

---

## 2 September 2026

### 1. Trader page refused to load (typography characters in text)
- **What broke:** The trader page failed to build, so nothing showed.
- **Cause:** Curly quotation marks sat inside page text that only accepts straight quotes.
- **Fix:** Replaced them with plain quotes in the trader page.

### 2. Payment could not run without a signed-in account
- **What broke:** Paying with MTN MoMo failed because the payment step demanded a signed-in account the demo did not have.
- **Fix:** Added a standalone payment path (`src/lib/momo.functions.ts`) that asks MTN to charge the phone and then checks the result every 2 seconds, with clear messages for success, failure and timeout.

### 3. Trader's live wave card showed old information
- **What broke:** The waiting-wave card on the trader page kept stale details and its timer restarted repeatedly.
- **Cause:** The repeating check captured an outdated copy of the order.
- **Fix:** The check now always reads the latest order, and the card clears itself when the wave is taken by someone else or expires.

### 4. Credentials were tracked in the project files
- **Risk:** The environment file holding keys was being saved with the code.
- **Fix:** Removed it from tracking and ignored it going forward.

---

## 3 September 2026

### 5. Pay button stuck on "Processing"
- **What broke:** After a payment succeeded or failed, the button stayed in the processing state.
- **Fix:** The button is released on both the success and failure paths.

### 6. Wallet amounts didn't refresh on screen
- **What broke:** Balance and community credit changed behind the scenes but the screen kept the old numbers.
- **Fix:** The screen now watches those two values individually so it redraws the moment they change.

### 7. Trader page could crash when the trader wasn't found
- **What broke:** Distance and totals were calculated before checking that the trader existed, which could crash the page.
- **Fix:** Moved the safety check above every use of the trader record.

### 8. Turning stock on or off wasn't saved
- **What broke:** Stock switches reset because the stock editor was saving to the wrong place.
- **Fix:** Pointed the stock editor at the active store, so switches persist.

### 9. Restocking didn't refresh the trader page
- **What broke:** Adding or toggling items didn't appear until a reload.
- **Fix:** The trader page now reads live values for stock, waves and buyer details, and the demand panel receives live trader data.

### 10. Price typing was lost / no way to confirm
- **What broke:** Typing a new price could snap back to the old value and there was no confirmation.
- **Fix:** The field keeps what you type, saves on Enter or when you click away, rejects invalid amounts and confirms with a message.

### 11. Wallet demo balance not taking effect
- **What broke:** A changed starting balance stayed hidden behind previously saved data on the phone.
- **Fix:** Bumped the saved-data version so the new balance applies immediately.

---

## 4 September 2026

### 12. Build failed on sign-in and trader pages
- **What broke:** The preview wouldn't build.
- **Causes:** The sign-in page still wrote a wallet PIN field that no longer exists, and the trader page didn't pass a required value to the demand panel.
- **Fix:** Removed the obsolete PIN write and supplied the missing value. Build clean afterwards.

---

## 5 September 2026

### 13. Waves and payments weren't persisting across phones
- **What broke:** Waves, acceptance and payment outcomes lived only on the device.
- **Fix:** Added signed-in session handling (`use-session.ts`) and live data hooks (`use-mdeko.ts`) that refresh every 4 seconds, and rewired the buyer page to create real waves and pay against a real order.

### 14. Type error on the buyer page (`orderId`)
- **What broke:** The build rejected an order reference that could be empty.
- **Fix:** The order reference is now only attached when a live order actually exists.

### 15. "This page didn't load" error screen
- **What broke:** A stale open tab stayed trapped on the failure screen after the app restarted mid-edit.
- **Fix:** "Try again" now performs a full reload. Home, trader and sign-in pages were all verified loading cleanly in a real browser.

---

## Current state
The latest recorded build check reports **build OK**. Remaining known noise: formatting and code-style warnings on the trader and buyer pages (they do not affect the app).
