/**
 * Example usage of the logger utility
 * Copy these patterns into your components
 */

import { log, logger, createLogger, logSeparator, logGroup, logTimeStart, logTimeEnd } from "./logger";

// ============================================================================
// Example 1: Basic logging with different levels
// ============================================================================

// Simple log with default options (info level, timestamp enabled)
log("Application started");

// With explicit level
log("Debug data", { level: "debug" });
log("Something went wrong", { level: "error" });

// With custom prefix
log("Order created", { prefix: "Order" });
log("Payment processed", { prefix: "Payment", level: "info" });

// Without timestamp
log("Quick message", { timestamp: false });


// ============================================================================
// Example 2: Using the logger object (recommended)
// ============================================================================

logger.info("Initializing map...");
logger.debug("Current position:", { lat: -26.0, lng: 28.0 });
logger.warn("GPS accuracy low", { accuracy: 150 });
logger.error("Failed to fetch route", { error: "Network timeout" });


// ============================================================================
// Example 3: Module-specific loggers (best for organized output)
// ============================================================================

// Create a logger for a specific module
const mapLogger = createLogger("Map");
const orderLogger = createLogger("Order");
const paymentLogger = createLogger("Payment");

// Use in your components
mapLogger.info("Route calculated", { distance: "2.5km" });
orderLogger.debug("Runner assigned", { runnerId: "runner-123" });
paymentLogger.error("Payment failed", { error: new Error("Insufficient funds") });


// ============================================================================
// Example 4: Visual grouping with separators
// ============================================================================

logSeparator("=== Starting Delivery ===");
// ... delivery logic ...
logSeparator("=== Delivery Complete ===");

// Or without label
logSeparator();


// ============================================================================
// Example 5: Group related logs together
// ============================================================================

logGroup("Processing Order #12345", [
  { step: 1, message: "Validating items" },
  { step: 2, message: "Calculating total" },
  { step: 3, message: "Finding runners" },
]);


// ============================================================================
// Example 6: Performance timing
// ============================================================================

async function fetchRoute() {
  const timer = logTimeStart("Route calculation");
  
  // Simulate async work
  await new Promise(resolve => setTimeout(resolve, 500));
  
  logTimeEnd(timer, "Route calculation");
}

// Output: 
// [14:25:30] Timer Route calculation...
// [14:25:30] Timer Route calculation completed in 502.34ms


// ============================================================================
// Example 7: Real-world usage in VeggieMap component
// ============================================================================

// At the top of your component file:
// import { createLogger } from '@/lib/logger';
// const mapLogger = createLogger('VeggieMap');

// In your effects:
// useEffect(() => {
//   mapLogger.info('Initializing map');
//   const map = L.map(...);
//   mapLogger.debug('Map created', { zoom: map.getZoom() });
//   
//   return () => {
//     mapLogger.info('Cleaning up map');
//     map.remove();
//   };
// }, []);

// When tracking courier:
// useEffect(() => {
//   if (courierPosition) {
//     mapLogger.info('Courier position updated', {
//       lat: courierPosition.lat,
//       lng: courierPosition.lng,
//       distance: courierPosition.distanceKm
//     });
//   }
// }, [courierPosition]);


// ============================================================================
// Example 8: Conditional logging
// ============================================================================

const isDev = process.env.NODE_ENV === "development";

if (isDev) {
  logger.debug("Development-only debug info");
}

// Note: debug logs are automatically skipped in production
logger.debug("This won't appear in production");


// ============================================================================
// Terminal Output Examples
// ============================================================================

// The logger produces color-coded output like:
//
// [14:25:30] INFO [Map] Route calculated
// [14:25:31] DEBUG [Order] Runner assigned { runnerId: "runner-123" }
// [14:25:32] WARN [GPS] Accuracy low { accuracy: 150 }
// [14:25:33] ERROR [Payment] Failed { error: "Network timeout" }
//
// With separators:
// [14:25:30] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// [14:25:30]     === Starting Delivery ===   
// [14:25:30] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
