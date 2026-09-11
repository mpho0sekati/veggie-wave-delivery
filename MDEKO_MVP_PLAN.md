# Mdeko Veggie Wave — MVP Implementation Plan

**Date Created:** September 2026  
**Status:** Phase 1 (PWA Scaffold) + Phase 2 (Auth Refactor) In Progress  
**Next Review:** End of Week 2

---

## 🎯 Strategic Vision

Veggie Wave is a **micro-mobility marketplace** for township produce. The MVP focuses on three layers of value:

1. **Phase 1:** Install PWA + offline resilience (enables field use)
2. **Phase 2:** Auth refactor + role separation (drives user acquisition)
3. **Phase 3:** Real payments + analytics (enables revenue)

**Success metric:** Traders can go online, accept waves, and deliver with reliable GPS + fallback routing, even on 2G/3G networks.

---

## 📋 Phase 1: PWA Core (THIS WEEK)

### What & Why

**Problem:** Field traders lose connection mid-delivery. Buyers can't access the app offline.  
**Solution:** Make the app installable and functional without network.

### Tasks

| Task | Status | Effort | Owner | Notes |
|------|--------|--------|-------|-------|
| `npm install vite-plugin-pwa` | ✅ Done | 5m | — | Added to package.json |
| Create `manifest.json` | ✅ Done | 10m | — | Icons, theme colors, display mode |
| Write service worker (`src/sw.ts`) | ✅ Done | 20m | — | Precache assets + map tiles |
| Update `vite.config.ts` | ✅ Done | 15m | — | PWA plugin config with workbox |
| Create offline order queue (`src/lib/offline-queue.ts`) | ✅ Done | 30m | — | Store orders placed offline |
| Test on iOS/Android | 🔄 TODO | 1h | Dev | Use browser DevTools or physical phone |
| Deploy to staging | 🔄 TODO | 30m | Deploy | Verify PWA install prompt |

### Key Files

```
vite.config.ts          ← PWA plugin + workbox config
public/manifest.json    ← App metadata + icons
src/sw.ts               ← Service worker logic
src/lib/offline-queue.ts ← Order persistence
```

### How It Works

1. **On first load:** Service worker precaches app shell (HTML, CSS, JS)  
2. **On return to offline:** Map tiles + API responses served from cache  
3. **On place order offline:** Order queued in localStorage  
4. **On reconnect:** Retry queue → sync to Supabase  
5. **Install prompt:** Browser offers "Add to home screen" (iOS/Android)  

### Success Criteria
- ✅ App installs on iPhone/Android
- ✅ Map tiles load from cache after first visit
- ✅ Orders placed offline queue and sync on reconnect
- ✅ Service worker updates in background

---

## 🔐 Phase 2: Auth Refactor (WEEK 2)

### What & Why

**Problem:**
- Auth route exists but no onboarding flow
- No role separation (buyer vs. trader)
- Trader signup process is opaque
- Users land in ambiguous UI (which mode?)

**Solution:** Split auth into two clear onboarding paths with role guards.

### Tasks

| Task | Status | Effort | Owner | Notes |
|------|--------|--------|-------|-------|
| Create `src/routes/auth/onboarding.tsx` | ✅ Done | 1.5h | — | Role picker → name/profile setup |
| Add `src/lib/auth-guard.ts` | ✅ Done | 30m | — | Role hooks + localStorage state |
| Protect buyer route (`/`) | 🔄 TODO | 30m | Dev | Redirect to auth if not signed in |
| Protect trader route (`/runner`) | 🔄 TODO | 30m | Dev | Redirect to auth if not signed in |
| Create trader stock wizard | 🔄 TODO | 2h | Dev | Onboarded traders pick first 5 items |
| Update sign-out flow | 🔄 TODO | 30m | Dev | Clear role on sign out |
| Add role indicator to nav | 🔄 TODO | 30m | Dev | Show "👋 Buyer" or "🛒 Trader" in header |

### New Files

```
src/routes/auth/onboarding.tsx     ← Role selection + profile setup
src/lib/auth-guard.ts              ← Role + auth state management
```

### User Flows

**Buyer Flow:**
```
Sign in → Choose "I want to buy" → Enter name → Redirect to /
```

**Trader Flow:**
```
Sign in → Choose "I'm a trader" → Enter stall name → Stock setup wizard → Redirect to /runner
```

**Sign Out:**
```
Sign out → Clear role → Redirect to /auth
```

### Success Criteria
- ✅ First-time users see role picker
- ✅ Buyers land on map (buyer experience)
- ✅ Traders land on stall dashboard (trader experience)
- ✅ Role persists across refreshes
- ✅ Switch roles requires re-onboarding

---

## 🗺️ Phase 3: Real MVE (WEEK 3-4)

### What & Why

**Problem:**
- Demand is logged but traders don't see it (why stock random items?)
- Geolocation fails → courier tracking breaks
- No trader acquisition funnel

**Solution:** Make demand visible, add fallback routing, and smooth trader signup.

### Tasks

| Priority | Task | Effort | Impact | Owner |
|----------|------|--------|--------|-------|
| **P1** | Demand dashboard (trader view) | 2h | Traders stock what buyers ask for | Dev |
| **P1** | Geolocation fallback (manual pin) | 1.5h | Delivery tracking works offline | Dev |
| **P1** | Route caching (OSM/OSRM) | 2h | Fallback directions mid-delivery | Dev |
| **P1** | Trader stock setup wizard | 2h | Seamless onboarding → first wave | Dev |
| **P2** | Order history UI | 1.5h | Buyers see past transactions | Dev |
| **P2** | Real payment integration (MoMo) | 6h | Enable real revenue | Backend |
| **P2** | Push notifications | 4h | Re-engagement (trader waves) | Dev |

### Key Insights from Data

- `veggie-store.ts` line 113-145: Demand logging already wired up ✅
- `runners.ts` line 298-335: Demand display needs builder component
- Map can cache tiles + routes → zero API calls offline
- Fallback to compass bearing if route unavailable

---

## 🚀 Rollout Strategy

### Week 1 (Phases 1-2 merge)

1. **Monday-Tuesday:** Code review + merge PWA scaffold PR
2. **Wednesday:** Test on device (iOS + Android)
3. **Thursday:** Deploy to staging + internal testing
4. **Friday:** Fix bugs + prepare for production

### Week 2 (Auth refactor)

1. **Monday-Tuesday:** Build & test auth onboarding
2. **Wednesday:** Route guards + role persists
3. **Thursday:** Trader stock setup integration
4. **Friday:** Full regression test + release candidate

### Week 3-4 (Phase 3)

1. **Demand dashboard** (Mon-Wed)
2. **Geolocation + fallback** (Thu-Fri)
3. **Route caching** (Parallel, Mon-Wed Week 4)
4. **Real payments** (Coordinated with backend)
5. **Marketing launch** (Fri Week 4)

---

## 📊 Success Metrics

### Phase 1 (PWA)
- App installs on iOS/Android
- 0 errors in Console when offline
- Map tiles render from cache
- Service worker updates without reloading

### Phase 2 (Auth)
- All new users pick a role
- 0 ambiguous UI states
- Sign out clears role + redirects
- Traders can edit stock on first login

### Phase 3 (MVE)
- Traders see demand (top 5 missing items)
- Delivery tracking works on 2G networks
- 80%+ trader activation (set stock + go online)
- Order success rate > 90% (accepted + paid)

---

## 🔴 Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Users confused by trader/buyer UI | High | Phase 2 auth flow makes it explicit |
| GPS fails mid-delivery | Critical | Fallback to manual pin + compass bearing (Phase 3) |
| App too large to cache | Medium | Code-split by route + lazy-load Leaflet |
| Offline queue grows unbounded | Medium | Auto-purge orders > 7 days old |
| Traders don't know what to stock | High | Demand dashboard shows gaps (Phase 3) |

---

## 🛠️ Tech Stack

- **Framework:** React 19 + TanStack Start
- **PWA:** `vite-plugin-pwa` + Workbox
- **Maps:** Leaflet + OpenStreetMap
- **Auth:** Supabase (JWT)
- **State:** localStorage (demo) → Supabase (prod)
- **Payments:** MTN MoMo API (Africa) or Stripe (testing)

---

## 📚 Docs & References

- [vite-plugin-pwa docs](https://vite-pwa-org.netlify.app/)
- [Workbox strategies](https://developer.chrome.com/docs/workbox/)
- [MDN: Service Workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Web.dev: Install Prompts](https://web.dev/promote-install/)
- [Leaflet offline](https://leafletjs.com/)

---

## 👥 Stakeholders

- **Product:** Define demand insights features
- **Design:** Polish trader onboarding UX
- **Backend:** Real payment API integration
- **QA:** Test offline scenarios (2G networks)
- **Marketing:** Plan Phase 3 launch campaign

---

## 📝 Notes

- Phase 1 **PWA is ready to ship immediately** (2-3 hours total effort)
- Phase 2 **auth refactor unblocks trader growth** (4-5 hours)
- Phase 3 **requires backend coordination** for real payments
- **Geolocation fallback is critical** for rural use cases
- **Demand dashboard is a differentiator** — traders compete on stocking trends

---

**Next:** Deploy Phase 1 PWA to staging and test on real devices 📱
