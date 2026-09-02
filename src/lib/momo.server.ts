// MTN MoMo Collections client. Server-only: credentials never leave this module.
// Required environment variables (set as backend secrets, never VITE_*):
//   MOMO_BASE_URL              e.g. https://sandbox.momodeveloper.mtn.com
//   MOMO_SUBSCRIPTION_KEY      Collections product subscription key
//   MOMO_API_USER              API user id (uuid)
//   MOMO_API_KEY               API key for that user
//   MOMO_TARGET_ENVIRONMENT    "sandbox" or your production environment name
//   MOMO_CURRENCY              optional, defaults to "ZAR" ("EUR" in sandbox)
//   MOMO_CALLBACK_URL          optional, absolute https URL of the callback route

export type MomoConfig = {
  baseUrl: string;
  subscriptionKey: string;
  apiUser: string;
  apiKey: string;
  targetEnvironment: string;
  currency: string;
  callbackUrl: string | undefined;
};

export type MomoStatus = "PENDING" | "SUCCESSFUL" | "FAILED";

export function readMomoConfig(): MomoConfig {
  const baseUrl = process.env["MOMO_BASE_URL"] ?? "https://sandbox.momodeveloper.mtn.com";
  const subscriptionKey = process.env["MOMO_SUBSCRIPTION_KEY"];
  const apiUser = process.env["MOMO_API_USER"];
  const apiKey = process.env["MOMO_API_KEY"];
  const targetEnvironment = process.env["MOMO_TARGET_ENVIRONMENT"] ?? "sandbox";
  const currency =
    process.env["MOMO_CURRENCY"] ?? (targetEnvironment === "sandbox" ? "EUR" : "ZAR");

  const missing = [
    ...(subscriptionKey ? [] : ["MOMO_SUBSCRIPTION_KEY"]),
    ...(apiUser ? [] : ["MOMO_API_USER"]),
    ...(apiKey ? [] : ["MOMO_API_KEY"]),
  ];
  if (missing.length) {
    throw new Error(`momo-not-configured: missing ${missing.join(", ")}`);
  }

  return {
    baseUrl: baseUrl.replace(/\/$/, ""),
    subscriptionKey: subscriptionKey!,
    apiUser: apiUser!,
    apiKey: apiKey!,
    targetEnvironment,
    currency,
    callbackUrl: process.env["MOMO_CALLBACK_URL"] ?? undefined,
  };
}

async function accessToken(cfg: MomoConfig): Promise<string> {
  const basic = btoa(`${cfg.apiUser}:${cfg.apiKey}`);
  const res = await fetch(`${cfg.baseUrl}/collection/token/`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Ocp-Apim-Subscription-Key": cfg.subscriptionKey,
    },
  });
  if (!res.ok) {
    throw new Error(`momo-token-failed: ${res.status}`);
  }
  const body = (await res.json()) as { access_token?: string };
  if (!body.access_token) throw new Error("momo-token-failed: no access_token");
  return body.access_token;
}

/**
 * Ask the payer to approve a collection. `reference` is our unique transaction
 * reference and doubles as MoMo's X-Reference-Id, which makes retries idempotent
 * on the provider side too.
 */
export async function requestToPay(args: {
  reference: string;
  externalId: string;
  amount: number;
  msisdn: string;
  message: string;
}): Promise<{ accepted: boolean; providerStatus: string }> {
  const cfg = readMomoConfig();
  const token = await accessToken(cfg);

  const res = await fetch(`${cfg.baseUrl}/collection/v1_0/requesttopay`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Reference-Id": args.reference,
      "X-Target-Environment": cfg.targetEnvironment,
      "Ocp-Apim-Subscription-Key": cfg.subscriptionKey,
      "Content-Type": "application/json",
      ...(cfg.callbackUrl ? { "X-Callback-Url": cfg.callbackUrl } : {}),
    },
    body: JSON.stringify({
      amount: args.amount.toFixed(2),
      currency: cfg.currency,
      externalId: args.externalId,
      payer: { partyIdType: "MSISDN", partyId: args.msisdn },
      payerMessage: args.message.slice(0, 60),
      payeeNote: "Mdeko order",
    }),
  });

  // 202 Accepted is the happy path; 409 means this reference is already in flight.
  if (res.status === 202 || res.status === 409) {
    return { accepted: true, providerStatus: `accepted:${res.status}` };
  }
  const detail = await res.text();
  console.error(`[momo] requestToPay failed ${res.status}: ${detail.slice(0, 300)}`);
  return { accepted: false, providerStatus: `error:${res.status}` };
}

/** Authoritative payment state, straight from MoMo. Never inferred from the client. */
export async function fetchPaymentStatus(
  reference: string,
): Promise<{ status: MomoStatus; providerStatus: string; reason: string | null }> {
  const cfg = readMomoConfig();
  const token = await accessToken(cfg);

  const res = await fetch(`${cfg.baseUrl}/collection/v1_0/requesttopay/${reference}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Target-Environment": cfg.targetEnvironment,
      "Ocp-Apim-Subscription-Key": cfg.subscriptionKey,
    },
  });

  if (!res.ok) {
    const detail = await res.text();
    console.error(`[momo] status lookup failed ${res.status}: ${detail.slice(0, 300)}`);
    return { status: "PENDING", providerStatus: `lookup-error:${res.status}`, reason: null };
  }

  const body = (await res.json()) as {
    status?: string;
    reason?: string | { code?: string; message?: string };
  };
  const raw = (body.status ?? "PENDING").toUpperCase();
  const status: MomoStatus =
    raw === "SUCCESSFUL" ? "SUCCESSFUL" : raw === "FAILED" ? "FAILED" : "PENDING";
  const reason =
    typeof body.reason === "string"
      ? body.reason
      : (body.reason?.message ?? body.reason?.code ?? null);
  return { status, providerStatus: raw, reason };
}
