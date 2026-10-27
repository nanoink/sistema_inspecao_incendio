import type { ClaimedDelivery } from "./email-types.ts";
import { isSmtpAuthenticationError, UncertainEmailDeliveryError } from "./uol-smtp.ts";

export type DeliveryResult = {
  delivery_id: string;
  status: "sent" | "failed" | "uncertain";
  provider_message_id: string | null;
  error_message: string | null;
};

type CampaignState = { status?: string } | null;
export class BeforeEmailSubmissionError extends Error {}

export const processClaimedEmailBatch = async ({
  deliveries, send, persist, halt, now = Date.now, budgetMs = 60_000,
}: {
  deliveries: ClaimedDelivery[];
  send: (delivery: ClaimedDelivery) => Promise<string | null>;
  persist: (result: DeliveryResult) => Promise<CampaignState>;
  halt: (unstartedIds: string[], error: string | null, block: boolean) => Promise<unknown>;
  now?: () => number;
  budgetMs?: number;
}) => {
  const startedAt = now();
  const results: DeliveryResult[] = [];
  let stopped: string | null = null;

  for (let index = 0; index < deliveries.length; index++) {
    const remaining = (from: number) => deliveries.slice(from).map((row) => row.delivery_id);
    if (now() - startedAt >= budgetMs) {
      await halt(remaining(index), null, false);
      stopped = "time_budget";
      break;
    }
    const delivery = deliveries[index];
    let result: DeliveryResult;
    try {
      const messageId = await send(delivery);
      result = { delivery_id: delivery.delivery_id, status: "sent", provider_message_id: messageId, error_message: null };
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 2000) : "Falha desconhecida no provedor.";
      if (isSmtpAuthenticationError(error) || error instanceof BeforeEmailSubmissionError) {
        // Authentication failed before DATA: no message was submitted, so these
        // rows can safely remain queued, but only an admin may resume the campaign.
        await halt(remaining(index), message, true);
        stopped = error instanceof BeforeEmailSubmissionError ? "preparation" : "authentication";
        break;
      }
      result = {
        delivery_id: delivery.delivery_id,
        status: error instanceof UncertainEmailDeliveryError ? "uncertain" : "failed",
        provider_message_id: null, error_message: message,
      };
    }

    let campaign: CampaignState;
    try {
      // Durable checkpoint BEFORE starting the next recipient. A worker timeout
      // can no longer lose the results of an entire batch of 50 messages.
      campaign = await persist(result);
    } catch (error) {
      // Do NOT requeue the current message: SMTP might already have accepted it.
      await halt(remaining(index + 1), "Falha ao registrar o resultado de uma entrega. Verificacao necessaria antes de retomar.", true);
      throw error;
    }
    results.push(result);
    if (result.status === "uncertain" || ["paused", "blocked", "cancelled"].includes(campaign?.status || "")) {
      await halt(remaining(index + 1), result.error_message, result.status === "uncertain");
      stopped = result.status === "uncertain" ? "uncertain" : campaign?.status || "stopped";
      break;
    }
  }

  return {
    processed: results.length,
    sent: results.filter((row) => row.status === "sent").length,
    failed: results.filter((row) => row.status === "failed").length,
    uncertain: results.filter((row) => row.status === "uncertain").length,
    stopped,
  };
};
