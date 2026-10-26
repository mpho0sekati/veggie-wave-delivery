/** Demo arithmetic only. Does not authorize or perform a withdrawal. */
export function demoBalanceCents(balance: number | undefined, withdrawnCents = 0) {
  const recorded =
    balance !== undefined && Number.isFinite(balance) ? Math.max(0, Math.round(balance * 100)) : 0;
  return Math.max(0, recorded - withdrawnCents);
}

export function demoCashOutCents(amount: string, remainingCents: number): number | null {
  if (!/^\d+(\.\d{1,2})?$/.test(amount.trim())) return null;
  const cents = Math.round(Number(amount) * 100);
  return Number.isSafeInteger(cents) && cents > 0 && cents <= remainingCents ? cents : null;
}
