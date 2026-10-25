/** Map MTN MoMo's status to ours. Only an explicit SUCCESSFUL counts as paid. */
export function toPaymentStatus(provider: string | null | undefined) {
  if (provider === "SUCCESSFUL") return "successful" as const;
  if (provider === "FAILED" || provider === "REJECTED" || provider === "TIMEOUT")
    return "failed" as const;
  return "pending" as const;
}

/** Savings rule: 5% of a settled amount, in cents-safe rand. */
export function savingsFor(amount: number) {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return Math.round(amount * 5) / 100;
}
