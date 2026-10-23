/**
 * Community Credit Score — Mdeko Finance
 *
 * Computed entirely in the browser from data we already fetch.
 * No extra API call needed.
 *
 * Score: 0–100
 *   Orders done         30 pts  — how much you've traded
 *   Paid on time        30 pts  — did payments go through?
 *   Active lately       20 pts  — have you traded this month?
 *   Saving money        20 pts  — are you putting money away?
 */

export type ScoreTier =
  | "Just Starting 🌱"
  | "Getting Going 🚀"
  | "Trusted Member ⭐"
  | "Champion 🏆";

export type ScoreResult = {
  total: number;
  orderVolumePts: number;
  paymentReliabilityPts: number;
  activityConsistencyPts: number;
  savingsBehaviourPts: number;
  tier: ScoreTier;
  tip: string;
};

export function computeCommunityScore(
  completedOrders: number,
  momoSuccessRate: number, // 0.0 – 1.0
  hasOrderInLast30Days: boolean,
  savingsBalance: number,
  savingsTarget: number,
): ScoreResult {
  const orderVolumePts = Math.min(completedOrders, 30);
  const paymentReliabilityPts = Math.round(Math.max(0, Math.min(1, momoSuccessRate)) * 30);
  const activityConsistencyPts = hasOrderInLast30Days ? 20 : 0;
  const safeTarget = savingsTarget > 0 ? savingsTarget : 500;
  const savingsBehaviourPts = Math.min(
    Math.round((savingsBalance / safeTarget) * 20),
    20,
  );

  const total =
    orderVolumePts + paymentReliabilityPts + activityConsistencyPts + savingsBehaviourPts;

  let tier: ScoreTier;
  if (total <= 25) tier = "Just Starting 🌱";
  else if (total <= 50) tier = "Getting Going 🚀";
  else if (total <= 75) tier = "Trusted Member ⭐";
  else tier = "Champion 🏆";

  // Always show the single most helpful next step
  let tip: string;
  if (orderVolumePts < 30) {
    const remaining = 30 - orderVolumePts;
    tip = `Do ${remaining} more order${remaining === 1 ? "" : "s"} to improve your score!`;
  } else if (!hasOrderInLast30Days) {
    tip = "Trade this month to stay active and keep your score up.";
  } else if (savingsBehaviourPts < 20) {
    const needed = Math.max(0, safeTarget - savingsBalance);
    tip = `Save R${needed.toFixed(0)} more to reach your savings goal!`;
  } else {
    tip = "You're a Champion! Keep trading to stay on top. 🏆";
  }

  return {
    total,
    orderVolumePts,
    paymentReliabilityPts,
    activityConsistencyPts,
    savingsBehaviourPts,
    tier,
    tip,
  };
}
