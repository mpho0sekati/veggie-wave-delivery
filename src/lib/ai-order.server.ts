import { createOpenAI } from "@ai-sdk/openai";
import { NoObjectGeneratedError, Output, streamText } from "ai";
import { z } from "zod";
import type { AiOrderResult } from "./ai-order.functions";

const MODEL = "openai/gpt-6-astra";

const schema = z.object({
  summary: z.string(),
  items: z.array(z.object({ id: z.string(), qty: z.number(), reason: z.string() })),
  extras: z.array(z.string()),
});

type Catalog = { id: string; name: string; unit: string }[];

function clean(raw: z.infer<typeof schema>, catalog: Catalog): AiOrderResult {
  const ids = new Set(catalog.map((c) => c.id));
  const merged = new Map<string, { qty: number; reason: string }>();
  for (const line of raw.items) {
    if (!ids.has(line.id)) continue;
    const qty = Math.min(20, Math.max(1, Math.round(line.qty)));
    const prev = merged.get(line.id);
    merged.set(line.id, {
      qty: Math.min(20, (prev?.qty ?? 0) + qty),
      reason: line.reason.slice(0, 80),
    });
  }
  return {
    ok: true,
    summary: raw.summary.slice(0, 200),
    items: [...merged].slice(0, 15).map(([id, v]) => ({ id, ...v })),
    extras: raw.extras
      .map((e) => e.trim().toLowerCase().slice(0, 40))
      .filter(Boolean)
      .slice(0, 5),
  };
}

export async function runOrderModel(description: string, catalog: Catalog): Promise<AiOrderResult> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) return { ok: false, error: "The helper isn't set up yet." };

  const provider = createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
  });

  const list = catalog.map((c) => `${c.id} | ${c.name} | sold per ${c.unit}`).join("\n");
  const system = `You help township shoppers in South Africa turn a description into a veggie order.
Only use item ids from this catalog (id | name | unit):
${list}

Rules:
- qty is how many of the catalog unit to buy (whole numbers, 1-20).
- Keep it practical and modest; don't add things the buyer didn't imply.
- Anything wanted that is NOT in the catalog goes in "extras" as a short lowercase name.
- "reason" is a few words (e.g. "for the stew").
- "summary" is one friendly sentence, max 25 words.`;

  try {
    const result = streamText({
      model: provider.responses(MODEL),
      system,
      prompt: description,
      maxRetries: 0,
      output: Output.object({ schema }),
      providerOptions: {
        openai: {
          forceReasoning: true,
          reasoningEffort: "low",
          reasoningSummary: "auto",
          store: false,
          include: ["reasoning.encrypted_content"],
        },
      },
    });
    const output = await result.output;
    return clean(output, catalog);
  } catch (err) {
    if (NoObjectGeneratedError.isInstance(err) && err.text) {
      try {
        const parsed = schema.safeParse(JSON.parse(err.text));
        if (parsed.success) return clean(parsed.data, catalog);
      } catch {
        /* fall through */
      }
    }
    const status = (err as { statusCode?: number }).statusCode;
    console.error("[ai-order] failed", status, err);
    if (status === 429) return { ok: false, error: "Too many requests — try again in a moment." };
    if (status === 402) return { ok: false, error: "AI credits have run out for this app." };
    if (status === 403) return { ok: false, error: "The AI helper isn't available right now." };
    return { ok: false, error: "Couldn't make your list — please pick items below." };
  }
}
