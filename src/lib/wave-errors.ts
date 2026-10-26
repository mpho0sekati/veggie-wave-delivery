import type { Wave } from "./mdeko.functions";

export type AcceptFailureCode = "expired" | "unavailable" | "stock" | "offline" | "retry";
export type AcceptFailure = { ok: false; code: AcceptFailureCode };

/** Only the saved deadline/status can establish expiry, never a browser clock. */
export function confirmedWaveExpired(wave: Pick<Wave, "status" | "expires_at">, now: number) {
  return wave.status === "expired" ||
    (wave.status === "created" && Date.parse(wave.expires_at) <= now);
}

export function acceptFailureCode(message: string, wave: Pick<Wave, "status" | "expires_at"> | null, now: number): AcceptFailureCode {
  if (message === "wave-expired") {
    if (wave && confirmedWaveExpired(wave, now)) return "expired";
    return wave && wave.status !== "created" ? "unavailable" : "retry";
  }
  if (message === "wave-already-accepted" || message === "invalid-wave") return "unavailable";
  if (message === "insufficient-stock" || message === "itemized-order-required") return "stock";
  if (message === "trader-offline" || message === "trader-profile-required") return "offline";
  return "retry";
}

export function acceptFailureMessage(code: AcceptFailureCode) {
  switch (code) {
    case "expired": return "This unanswered wave has ended. Refresh to see new buyers.";
    case "unavailable": return "This wave is no longer available. Refresh to see your current orders.";
    case "stock": return "Not enough saved stock for this basket. Check My stall, then try again.";
    case "offline": return "Your stall is offline. Go online, then accept the wave again.";
    case "retry": return "Couldn't confirm acceptance. Your saved details are safe — check Orders, then try again.";
  }
}