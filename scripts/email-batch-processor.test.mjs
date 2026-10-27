import { test } from "node:test";
import assert from "node:assert/strict";
import { processClaimedEmailBatch } from "../supabase/functions/process-email-campaigns/batch-processor.ts";
import { SmtpCommandError, UncertainEmailDeliveryError } from "../supabase/functions/process-email-campaigns/uol-smtp.ts";

const deliveries = Array.from({ length: 4 }, (_, index) => ({ delivery_id: String(index), campaign_id: "campaign" }));
const fixture = () => {
  const events = [];
  const options = {
    deliveries,
    send: async (row) => { events.push(["send", row.delivery_id]); return `message-${row.delivery_id}`; },
    persist: async (result) => { events.push(["persist", result.delivery_id, result.status]); return { status: "running" }; },
    halt: async (...args) => { events.push(["halt", ...args]); },
  };
  return { events, options };
};

test("each recipient is checkpointed before the next SMTP send", async () => {
  const { events, options } = fixture();
  const result = await processClaimedEmailBatch(options);
  assert.equal(result.sent, 4);
  assert.deepEqual(events.slice(0, 4), [["send", "0"], ["persist", "0", "sent"], ["send", "1"], ["persist", "1", "sent"]]);
});
test("535 stops immediately and releases only unsubmitted recipients, with no failed mass cascade", async () => {
  const { events, options } = fixture();
  options.send = async () => { throw new SmtpCommandError(535, "senha"); };
  const result = await processClaimedEmailBatch(options);
  assert.equal(result.stopped, "authentication");
  assert.equal(result.processed, 0);
  assert.deepEqual(events, [["halt", ["0", "1", "2", "3"], "SMTP senha falhou (código 535).", true]]);
});
test("recipient rejection is recorded without inventing acceptance", async () => {
  const { events, options } = fixture();
  options.send = async (row) => { if (row.delivery_id === "0") throw new SmtpCommandError(450, "destinatário"); return "ok"; };
  const result = await processClaimedEmailBatch(options);
  assert.equal(result.failed, 1);
  assert.equal(result.sent, 3);
  assert.deepEqual(events[0], ["persist", "0", "failed"]);
});
test("connection loss after DATA quarantines the current message and blocks the campaign", async () => {
  const { events, options } = fixture();
  options.send = async () => { throw new UncertainEmailDeliveryError(); };
  const result = await processClaimedEmailBatch(options);
  assert.equal(result.uncertain, 1);
  assert.deepEqual(events[0], ["persist", "0", "uncertain"]);
  assert.deepEqual(events[1].slice(0, 2), ["halt", ["1", "2", "3"]]);
  assert.equal(events[1][3], true);
});
test("checkpoint failure never requeues the current already-submitted message", async () => {
  const { events, options } = fixture();
  options.persist = async () => { throw new Error("database timeout"); };
  await assert.rejects(processClaimedEmailBatch(options), /database timeout/);
  assert.deepEqual(events[0], ["send", "0"]);
  assert.deepEqual(events[1].slice(0, 2), ["halt", ["1", "2", "3"]]);
  assert.equal(events[1][3], true);
});
test("soft time budget releases only the never-attempted tail and preserves schedule", async () => {
  const { events, options } = fixture();
  let clock = 0;
  options.now = () => clock;
  options.budgetMs = 60;
  options.persist = async () => { clock = 61; return { status: "running" }; };
  const result = await processClaimedEmailBatch(options);
  assert.equal(result.sent, 1);
  assert.equal(result.stopped, "time_budget");
  assert.deepEqual(events[1], ["halt", ["1", "2", "3"], null, false]);
});
test("administrator pause during a batch prevents starting the next message", async () => {
  const { events, options } = fixture();
  options.persist = async () => ({ status: "paused" });
  const result = await processClaimedEmailBatch(options);
  assert.equal(result.sent, 1);
  assert.equal(result.stopped, "paused");
  assert.deepEqual(events[1], ["halt", ["1", "2", "3"], null, false]);
});
