// Turns a buyer's free-text description ("enough veg for a stew for 4") into
// an itemized order mapped onto the app's catalog, via Lovable AI Gateway.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type AiOrderLine = { id: string; qty: number; reason: string };
export type AiOrderResult =
  | { ok: true; items: AiOrderLine[]; extras: string[]; summary: string }
  | { ok: false; error: string };

export const describeToOrder = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        description: z.string().trim().min(3).max(500),
        catalog: z
          .array(
            z.object({
              id: z.string().max(80),
              name: z.string().max(80),
              unit: z.string().max(40),
            }),
          )
          .max(200),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<AiOrderResult> => {
    const { runOrderModel } = await import("./ai-order.server");
    return runOrderModel(data.description, data.catalog);
  });
