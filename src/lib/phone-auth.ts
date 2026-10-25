/** Browser-safe helpers for the "Cell & PIN" sign-in. */

/** Turns any SA cell number (0xx, 27xx, +27xx) into 27XXXXXXXXX, or null. */
export function normaliseSaCell(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (/^0[6-8]\d{8}$/.test(digits)) return `27${digits.slice(1)}`;
  if (/^27[6-8]\d{8}$/.test(digits)) return digits;
  if (/^[6-8]\d{8}$/.test(digits)) return `27${digits}`;
  return null;
}

export function isValidPin(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}

/** Internal sign-in identity for a cell number. Never shown to the user. */
export function cellIdentity(msisdn: string): string {
  return `${msisdn}@cell.mdeko.app`;
}

/** Shows 27821234567 as 082 123 4567. */
export function formatSaCell(msisdn: string): string {
  const local = `0${msisdn.slice(2)}`;
  return `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
}
