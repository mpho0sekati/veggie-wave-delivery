/**
 * Banklink server-side client — Mdeko Financial Inclusion
 *
 * Server-side only. Never import this in browser code.
 * Banklink connects to FNB, Capitec, Nedbank, ABSA etc. and returns real
 * transaction data we use to boost Trust Scores and export lender-ready
 * financial records for unbanked traders.
 *
 * SDK: https://www.npmjs.com/package/@banklink/sdk
 */

import BankLink from "@banklink/sdk";

let _client: BankLink | null = null;

export function getBanklinkClient(): BankLink {
  if (_client) return _client;
  const apiKey = process.env["BL_KEY"];
  if (!apiKey) throw new Error("BL_KEY environment variable is not set");
  _client = new BankLink({ apiKey });
  return _client;
}

export type BanklinkAccount = {
  id: string;
  bank: string;
  accountNumber: string;
  nickname: string | null;
  currency: string;
};

export type BanklinkTransaction = {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: "credit" | "debit";
  balance: number | null;
};

/** List all linked bank accounts on the Banklink profile. */
export async function listLinkedAccounts(): Promise<BanklinkAccount[]> {
  const bl = getBanklinkClient();
  try {
    const { data: accounts } = await bl.accounts.list();
    return (accounts ?? []).map((a: Record<string, unknown>) => ({
      id: String(a.id ?? ""),
      bank: String(a.bank ?? ""),
      accountNumber: String(a.account_number ?? ""),
      nickname: a.nickname ? String(a.nickname) : null,
      currency: String(a.currency ?? "ZAR"),
    }));
  } catch {
    return [];
  }
}

/** Get the last 90 days of transactions for a linked account. */
export async function getRecentTransactions(accountId: string): Promise<BanklinkTransaction[]> {
  const bl = getBanklinkClient();
  const transactions: BanklinkTransaction[] = [];
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  try {
    for await (const txn of bl.transactions.listAutoPaginate(accountId, { limit: 100 })) {
      const t = txn as Record<string, unknown>;
      const amount = Number(t.amount ?? 0);
      transactions.push({
        id: String(t.id ?? ""),
        date: String(t.date ?? ""),
        description: String(t.description ?? ""),
        amount: Math.abs(amount),
        type: amount >= 0 ? "credit" : "debit",
        balance: t.balance != null ? Number(t.balance) : null,
      });
      if (new Date(String(t.date ?? "")) < ninetyDaysAgo) break;
    }
  } catch {
    /* non-fatal */
  }
  return transactions;
}

/**
 * Compute a verified income signal from real bank transactions.
 * Returns a boost value (0-20) added on top of the Mdeko Trust Score.
 */
export function computeBankBoost(transactions: BanklinkTransaction[]): {
  estimatedMonthlyIncome: number;
  transactionCount: number;
  boost: number;
  hasVerifiedIncome: boolean;
} {
  if (transactions.length === 0) {
    return { estimatedMonthlyIncome: 0, transactionCount: 0, boost: 0, hasVerifiedIncome: false };
  }
  const credits = transactions.filter((t) => t.type === "credit");
  const totalCredits = credits.reduce((sum, t) => sum + t.amount, 0);
  const estimatedMonthlyIncome = totalCredits / 3;
  const hasVerifiedIncome = estimatedMonthlyIncome > 500;
  let boost = 0;
  if (estimatedMonthlyIncome >= 500) boost = 5;
  if (estimatedMonthlyIncome >= 2000) boost = 10;
  if (estimatedMonthlyIncome >= 5000) boost = 15;
  if (estimatedMonthlyIncome >= 10000) boost = 20;
  return { estimatedMonthlyIncome, transactionCount: transactions.length, boost, hasVerifiedIncome };
}

/** Initiate bank account linking via Banklink. */
export async function linkBankAccount(
  bankId: string,
  username: string,
  password: string,
  nickname?: string,
): Promise<
  | { type: "success"; profileId: string }
  | { type: "mfa_required"; sessionToken: string }
  | { type: "error"; message: string }
> {
  const bl = getBanklinkClient();
  try {
    const result = await bl.link.create({ bankId, credentials: { username, password }, nickname });
    const r = result as Record<string, unknown>;
    if (r.type === "success") return { type: "success", profileId: String(r.profile_id ?? "") };
    if (r.type === "mfa_required") return { type: "mfa_required", sessionToken: String(r.session_token ?? "") };
    return { type: "error", message: "Unexpected response from Banklink" };
  } catch (err) {
    return { type: "error", message: (err as Error).message ?? "Bank link failed" };
  }
}

/** Submit OTP for MFA-protected bank linking. */
export async function submitBankLinkOtp(
  sessionToken: string,
  otp: string,
): Promise<{ type: "success"; profileId: string } | { type: "error"; message: string }> {
  const bl = getBanklinkClient();
  try {
    const result = await bl.link.submitOtp({ sessionToken, otp });
    const r = result as Record<string, unknown>;
    if (r.type === "success") return { type: "success", profileId: String(r.profile_id ?? "") };
    return { type: "error", message: "OTP verification failed" };
  } catch (err) {
    return { type: "error", message: (err as Error).message ?? "OTP failed" };
  }
}
