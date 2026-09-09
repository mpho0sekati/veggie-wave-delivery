# Supabase Migration Implementation Guide

## Phase 1: Deploy Database Changes

### Step 1: Apply the migration

```bash
supabase db push
```

This deploys the `refund_order` server function and updates the orders status enum to include 'refunded' and 'failed'.

**Verify**: Check that `refund_order` function exists:

```sql
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public' AND routine_name = 'refund_order';
```

---

## Phase 2: Update React Components

### Step 2: Replace imports in index.tsx

**Find these imports:**

```typescript
import {
  catalogWith,
  distanceKm,
  formatRand,
  priceFor,
  calculateDeliveryFee,
  estimateDeliveryMinutes,
  formatDistance,
  MAX_SUITABLE_DISTANCE_KM,
  type Runner,
} from "@/lib/veggie-data";
import {
  archiveRequest,
  cancelRequest,
  logDemand,
  payCash,
  refundOrder,
  setBuyerLocation,
  updateState,
  useAppState,
} from "@/lib/veggie-store";
```

**Replace with:**

```typescript
import {
  catalogWith,
  distanceKm,
  formatRand,
  priceFor,
  calculateDeliveryFee,
  estimateDeliveryMinutes,
  formatDistance,
  MAX_SUITABLE_DISTANCE_KM,
  type Runner,
} from "@/lib/veggie-data";
import {
  cancelRequest,
  logDemand,
  payCash,
  refundOrder,
  setBuyerLocation,
  waveRequest,
  useAppState,
} from "@/lib/veggie-store-supabase";
```

### Step 3: Update index.tsx wave logic

**Find this block in BuyerPage():**

```typescript
const wave = useCallback(() => {
  if (!picked.length && !wish.trim()) {
    toast.error("Pick what you need first");
    return;
  }
  updateState((prev) => ({
    ...prev,
    request: {
      id: crypto.randomUUID(),
      items: picked.map((p) => ({ id: p.id, qty: qty[p.id] ?? 0 })),
      wish: wish.trim(),
      total,
      note: `${picked.length} items`,
      status: "waving",
      runnerId: null,
      createdAt: Date.now(),
    },
  }));
  logDemand([...]);
  toast.success("Hand raised — traders nearby can see you waving");
}, [picked, wish, total, qty]);
```

**Replace with:**

```typescript
const wave = useCallback(async () => {
  if (!picked.length && !wish.trim()) {
    toast.error("Pick what you need first");
    return;
  }
  try {
    await waveRequest(
      picked.map((p) => ({ id: p.id, qty: qty[p.id] ?? 0 })),
      wish.trim(),
      total,
    );
    await logDemand([
      ...picked.map((p) => ({ itemId: p.id, label: p.name })),
      ...(wish.trim() ? [{ itemId: null, label: wish.trim().toLowerCase() }] : []),
    ]);
    toast.success("Hand raised — traders nearby can see you waving");
  } catch (error) {
    toast.error("Failed to raise hand");
  }
}, [picked, wish, total, qty]);
```

### Step 4: Update finish callback in index.tsx

**Find:**

```typescript
const finish = useCallback(() => {
  archiveRequest();
  setQty({});
  setWish("");
}, []);
```

**Replace with:**

```typescript
const finish = useCallback(() => {
  setQty({});
  setWish("");
}, []);
```

(The request auto-archives when removed from active orders)

### Step 5: Update payment handling in index.tsx

**Find:**

```typescript
const handlePayWavePay = useCallback(async (pin: string) => {
  const result = payWithWavePay(pin);
  if (result === "ok") {
    toast.success("Payment successful!");
    setPayOpen(false);
  } else if (result === "wrong-pin") {
    toast.error("Wrong PIN");
  } else if (result === "insufficient") {
    toast.error("Insufficient balance");
  } else {
    toast.error("Payment failed");
  }
}, []);
```

**Or create if missing and use:**

```typescript
const handlePayWavePay = useCallback(
  async (pin: string) => {
    if (!request) return;
    try {
      const result = await payWithWavePay(request.id, pin);
      if (result === "ok") {
        toast.success("Payment successful!");
        setPayOpen(false);
      } else if (result === "wrong-pin") {
        toast.error("Wrong PIN");
      } else if (result === "insufficient") {
        toast.error("Insufficient balance");
      } else {
        toast.error(`Payment failed: ${result}`);
      }
    } catch (error) {
      toast.error("Payment error");
    }
  },
  [request],
);
```

### Step 6: Update runner.tsx

**Replace the imports:**

```typescript
// OLD
import { setStock, setOnline, updateName, updateState, useAppState } from "@/lib/veggie-store";

// NEW
import {
  setStock,
  setOnline,
  updateName,
  acceptWave,
  markDelivered,
  useAppState,
} from "@/lib/veggie-store-supabase";
```

**Update the accept wave handler:**

```typescript
const accept = () =>
  updateState((prev) => ({
    ...prev,
    request: prev.request
      ? { ...prev.request, status: "accepted", runnerId: MY_ID, total: myTotal }
      : null,
  }));
```

**Replace with:**

```typescript
const accept = useCallback(async () => {
  if (!request) return;
  try {
    await acceptWave(request.id, myTotal);
    toast.success("Wave accepted!");
  } catch (error) {
    toast.error("Failed to accept wave");
  }
}, [request, myTotal]);
```

**Update deliver handler:**

```typescript
const deliver = () =>
  updateState((prev) => ({
    ...prev,
    request: prev.request ? { ...prev.request, status: "delivered" } : null,
  }));
```

**Replace with:**

```typescript
const deliver = useCallback(async () => {
  if (!request) return;
  try {
    await markDelivered(request.id);
    toast.success("Marked as delivered — awaiting payment");
  } catch (error) {
    toast.error("Failed to mark delivered");
  }
}, [request]);
```

### Step 7: Remove old veggie-store.ts

```bash
rm src/lib/veggie-store.ts
```

Or keep it temporarily and only switch imports when confident.

---

## Phase 3: Test the Integration

### Test Checklist

- [ ] Deploy migration successfully
- [ ] Update imports in index.tsx
- [ ] Update imports in runner.tsx
- [ ] Run `npm run build` or `bun run build` (no TS errors)
- [ ] Run `npm run lint` or `bun run lint` (no ESLint errors)
- [ ] Start dev server: `npm run dev` or `bun run dev`
- [ ] **Buyer side**: Create wave request → Verify it appears in Supabase
- [ ] **Trader side**: See the wave → Accept → Mark delivered
- [ ] **Buyer side**: Pay with cash → Verify status changes to "paid"
- [ ] **Buyer side**: Request refund → Verify wallet restored, trader earnings reversed
- [ ] **Open in two windows**: One buyer, one trader → Verify Realtime updates sync

### Common Issues & Fixes

#### Issue: "Cannot find module veggie-store-supabase"

- **Fix**: Ensure the file is saved at `src/lib/veggie-store-supabase.ts`

#### Issue: "RPC function not found"

- **Fix**: Run `supabase db push` to deploy the migration

#### Issue: Realtime not updating

- **Fix**: Verify `ALTER PUBLICATION supabase_realtime ADD TABLE` commands ran in the migration

#### Issue: Auth not working

- **Fix**: Ensure auth middleware is active and user is signed in before creating orders

---

## Phase 4: Production Checklist

- [ ] All payment logic is server-side (no client-side balance manipulation)
- [ ] Refund function is tested and working
- [ ] Realtime sync tested across multiple devices
- [ ] No localStorage dependencies remain
- [ ] Error handling on all async operations
- [ ] Loading states for pending operations
- [ ] Test with slow network (DevTools throttle)

---

## API Changes Summary

| Old (localStorage)    | New (Supabase)                                |
| --------------------- | --------------------------------------------- |
| `updateState()`       | Direct async calls + Realtime subscriptions   |
| `logDemand()`         | `await logDemand()`                           |
| `setBuyerLocation()`  | `await setBuyerLocation()`                    |
| `setStock()`          | `await setStock()`                            |
| `payWithWavePay(pin)` | `await payWithWavePay(orderId, pin)`          |
| `payCash()`           | `await payCash(orderId)`                      |
| `refundOrder()`       | `await refundOrder(orderId)`                  |
| `useAppState()`       | `useAppState()` (same API, different backend) |

---

## Benefits of This Migration

✅ **Server-enforced payment rules** - No client-side manipulation  
✅ **Multi-user sync** - Changes visible across all connected devices  
✅ **Audit trail** - All transactions stored in Supabase  
✅ **Scalable** - Supports unlimited traders and buyers  
✅ **Secure** - RLS policies control data access  
✅ **Real-time** - Instant updates via Realtime subscriptions
