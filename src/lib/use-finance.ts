/**
 * useFinanceProfile — assembles all Mdeko Finance data in one place.
 *
 * Works for both buyers and traders.
 * Score is computed client-side from real data — no extra API call.
 * Smart tip is fetched separately so the page loads fast even if AI is slow.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useSession } from "./use-session";
import {
  getMoneyProfile,
  getSmartTip,
  getSavingsJar,
  depositToJar,
  updateSavingsTarget,
  type MoneyProfile,
  type SavingsJar,
  type SmartTipInput,
} from "./finance.functions";
import { computeCommunityScore, type ScoreResult } from "./finance-score";

export type FinanceProfile = MoneyProfile & {
  score: ScoreResult;
};

export function useFinanceProfile() {
  const session = useSession();
  const enabled = Boolean(session.userId) && !session.loading;

  const profileFn = useServerFn(getMoneyProfile);

  const profileQuery = useQuery<MoneyProfile>({
    queryKey: ["finance", "profile", session.userId],
    queryFn: () => profileFn(),
    enabled,
    staleTime: 15_000,
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: "always",
    refetchOnReconnect: "always",
  });

  const score: ScoreResult | null = profileQuery.data
    ? computeCommunityScore(
        profileQuery.data.totalOrders,
        profileQuery.data.momoSuccessRate,
        profileQuery.data.hasOrderInLast30Days,
        profileQuery.data.savingsJar.balance,
        profileQuery.data.savingsJar.targetAmount,
      )
    : null;

  return {
    profile: profileQuery.data ?? null,
    score,
    isLoading: profileQuery.isLoading,
    isError: profileQuery.isError,
  };
}

export function useSmartTip(profile: MoneyProfile | null) {
  const session = useSession();
  const tipFn = useServerFn(getSmartTip);

  const tipInput: SmartTipInput | null = profile
    ? {
        totalOrders: profile.totalOrders,
        totalTraded: profile.totalTraded,
        recentOrders: profile.recentOrders,
        role: profile.role,
        savingsBalance: profile.savingsJar.balance,
        savingsTarget: profile.savingsJar.targetAmount,
        momoSuccessRate: profile.momoSuccessRate,
      }
    : null;

  return useQuery<string>({
    queryKey: ["finance", "smart-tip", session.userId, tipInput],
    queryFn: () => {
      if (!tipInput) throw new Error("Money profile is not ready.");
      return tipFn({ data: tipInput });
    },
    enabled: Boolean(session.userId) && !session.loading && tipInput !== null,
    staleTime: 60 * 60 * 1000, // 1 hour — AI calls are expensive, cache them
    retry: 1,
  });
}

export function useSavingsJar() {
  const session = useSession();
  const queryClient = useQueryClient();
  const jarFn = useServerFn(getSavingsJar);
  const depositFn = useServerFn(depositToJar);
  const updateTargetFn = useServerFn(updateSavingsTarget);

  const jarQuery = useQuery<SavingsJar>({
    queryKey: ["finance", "savings-jar", session.userId],
    queryFn: () => jarFn(),
    enabled: Boolean(session.userId) && !session.loading,
    staleTime: 15_000,
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["finance"] });
  };

  const deposit = useMutation({
    mutationFn: (amount: number) => depositFn({ data: { amount } }),
    onSuccess: refresh,
  });

  const updateTarget = useMutation({
    mutationFn: (targetAmount: number) => updateTargetFn({ data: { targetAmount } }),
    onSuccess: refresh,
  });

  return {
    jar: jarQuery.data ?? null,
    isLoading: jarQuery.isLoading,
    deposit,
    updateTarget,
  };
}

/* ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ BANKLINK HOOKS ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ */

import {
  getBankBoost,
  linkUserBankAccount,
  submitBankOtp,
  exportFinancialRecord,
  type BankBoostResult,
  type ExportRecord,
} from "./finance.functions";

export function useBankBoost() {
  const session = useSession();
  const fn = useServerFn(getBankBoost);

  return useQuery<BankBoostResult>({
    queryKey: ["finance", "bank-boost", session.userId],
    queryFn: () => fn(),
    enabled: Boolean(session.userId) && !session.loading,
    staleTime: 10 * 60 * 1000, // 10 min cache
    retry: 1,
  });
}

export function useBankLink() {
  const queryClient = useQueryClient();
  const linkFn = useServerFn(linkUserBankAccount);
  const otpFn = useServerFn(submitBankOtp);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["finance"] });
  };

  const link = useMutation({
    mutationFn: (data: {
      bankId: "fnb" | "capitec" | "nedbank" | "absa" | "standardbank" | "investec" | "tymebank";
      username: string;
      password: string;
      nickname?: string;
    }) => linkFn({ data }),
    onSuccess: refresh,
  });

  const submitOtp = useMutation({
    mutationFn: (data: { sessionToken: string; otp: string }) => otpFn({ data }),
    onSuccess: refresh,
  });

  return { link, submitOtp };
}

export function useExportRecord() {
  const session = useSession();
  const fn = useServerFn(exportFinancialRecord);

  return useQuery<ExportRecord>({
    queryKey: ["finance", "export-record", session.userId],
    queryFn: () => fn(),
    enabled: Boolean(session.userId) && !session.loading,
    staleTime: 5 * 60 * 1000,
  });
}
