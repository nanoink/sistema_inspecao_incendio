import { archiveUolSentCopies } from "./uol-archive-worker.ts";
import { getProviderConfiguration } from "./email-config.ts";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.75.0";
const assert = (value: unknown, message: string) => { if (!value) throw new Error(message); };

for (const authenticated of [true, false]) {
  Deno.test(`archive-only worker ${authenticated ? "saves exact copies and skips duplicates" : "retries IMAP failure without touching SMTP status"}`, async () => {
    const original = Deno.connectTls;
    const responses = authenticated ? [
      '* OK ready\r\n', 'F1 OK login\r\n', '* LIST (\\Sent) "." "Itens Enviados"\r\nF2 OK listed\r\n',
      'F3 OK examine\r\n', '* SEARCH\r\nF4 OK searched\r\n', '+ literal\r\n', 'F5 OK [APPENDUID 1 19] stored\r\n',
      'F6 OK examine\r\n', '* SEARCH 20\r\nF7 OK searched\r\n',
    ] : ['* OK ready\r\n', 'F1 NO authentication failed\r\n'];
    const writes: string[] = [];
    Deno.connectTls = (() => Promise.resolve({
      async read(buffer: Uint8Array) {
        const next = responses.shift(); if (!next) return null;
        const bytes = new TextEncoder().encode(next); buffer.set(bytes); return bytes.length;
      },
      async write(bytes: Uint8Array) { writes.push(new TextDecoder().decode(bytes)); return bytes.length; }, close() {},
    })) as unknown as typeof Deno.connectTls;
    const finishes: Array<Record<string, unknown>> = [];
    const client = { async rpc(name: string, args: Record<string, unknown>) {
      if (name === "claim_uol_sent_copies") return { data: [
        { delivery_id: "first", message_id: "first@example.invalid", mime_message: "Message-ID: <first@example.invalid>\r\n\r\nfirst\r\n" },
        { delivery_id: "second", message_id: "second@example.invalid", mime_message: "Message-ID: <second@example.invalid>\r\n\r\nsecond\r\n" },
      ], error: null };
      if (name === "finish_uol_sent_copy") { finishes.push(args); return { data: true, error: null }; }
      throw new Error("Unexpected RPC outside archive boundary: " + name);
    } } as unknown as SupabaseClient;
    try {
      const result = await archiveUolSentCopies(client, {
        ...getProviderConfiguration(), provider: "uol_smtp", imapConfigured: true, uolSaveSentCopies: true,
        uolImapUsername: "fixture", uolImapPassword: "fixture", uolSentFolder: "",
      });
      assert(result.archived === (authenticated ? 2 : 0), "Wrong archived count.");
      assert(result.pending_errors === (authenticated ? 0 : 2), "Wrong pending count.");
      assert(finishes.every((row) => row.p_saved === authenticated), "Wrong archive checkpoint.");
      assert(!writes.some((line) => /MAIL FROM|RCPT TO|AUTH LOGIN/.test(line)), "Archive worker submitted SMTP commands.");
      if (authenticated) {
        assert(writes.filter((line) => line.includes("APPEND")).length === 1, "Duplicate was appended twice.");
        assert(finishes[0].p_imap_uid === "19" && finishes[1].p_imap_uid === "20", "Archive UID missing.");
      }
    } finally { Deno.connectTls = original; }
  });
}
