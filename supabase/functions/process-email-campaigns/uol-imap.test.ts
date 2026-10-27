import { UolImapSession, quoteImapString, resolveSentFolder } from "./uol-imap.ts";
const assert = (value: unknown, message: string) => { if (!value) throw new Error(message); };

Deno.test("discovers UOL's actual special-use folder without creating or guessing another folder", () => {
  const lines = ['* LIST (\\HasNoChildren \\Sent) "." "Itens Enviados"', '* LIST (\\HasNoChildren) "." INBOX'];
  assert(resolveSentFolder(lines) === "Itens Enviados", "Wrong UOL folder.");
  assert(resolveSentFolder(lines, "Itens Enviados") === "Itens Enviados", "Explicit folder ignored.");
  let rejected = false;
  try { resolveSentFolder(lines, "Sent"); } catch { rejected = true; }
  assert(rejected, "Nonexistent folder should not be silently created.");
});
Deno.test("quotes IMAP credentials and rejects command injection", () => {
  assert(quoteImapString('a"b\\c') === '"a\\"b\\\\c"', "Credential escaping corrupted.");
  for (const input of ["a\r\nLOGOUT", "a\0b"]) {
    let rejected = false; try { quoteImapString(input); } catch { rejected = true; }
    assert(rejected, "IMAP command injection accepted.");
  }
});

const fixture = (responses: string[]) => {
  const commands: string[] = [];
  let remaining = "";
  const session = new UolImapSession({
    async read(buffer: Uint8Array) {
      if (!remaining) remaining = responses.shift() || "";
      if (!remaining) return null;
      // Fragment every response to verify buffering and preservation of leftovers.
      const chunk = remaining.slice(0, 7); remaining = remaining.slice(7);
      const encoded = new TextEncoder().encode(chunk); buffer.set(encoded); return encoded.length;
    },
    async write(bytes: Uint8Array) { commands.push(new TextDecoder().decode(bytes)); return bytes.length; },
    close() {},
  });
  return { session, commands };
};

Deno.test("APPEND uses byte size, preserves exact SMTP MIME and reads APPENDUID", async () => {
  const { session, commands } = fixture(['* OK ready\r\n','F1 OK login\r\n','* 0 EXISTS\r\nF2 OK [READ-ONLY] examine\r\n','* SEARCH\r\nF3 OK search\r\n','+ ready for literal\r\n','F4 OK [APPENDUID 123 456] saved\r\n']);
  try {
    await session.login("fixture", "secret");
    const message = "Message-ID: <fixture@example.invalid>\r\nSubject: Test\r\n\r\nç\r\n";
    const result = await session.save("Itens Enviados", "fixture@example.invalid", message);
    assert(result.uid === "456" && !result.alreadyPresent, "APPENDUID lost.");
    assert(commands.includes(`F4 APPEND "Itens Enviados" (\\Seen) {${new TextEncoder().encode(message).length}}\r\n`), "Wrong literal size.");
    assert(commands.includes(message + "\r\n"), "MIME content was modified.");
  } finally { session.close(); }
});

Deno.test("retry after ambiguous append searches Message-ID and never duplicates the existing copy", async () => {
  const { session, commands } = fixture(['* OK ready\r\n','F1 OK login\r\n','F2 OK [READ-ONLY] examine\r\n','* SEARCH 456\r\nF3 OK search\r\n']);
  try {
    await session.login("fixture", "secret");
    const result = await session.save("Itens Enviados", "fixture@example.invalid", "Message-ID: <fixture@example.invalid>\r\n\r\ncontent");
    assert(result.uid === "456" && result.alreadyPresent, "Existing UID ignored.");
    assert(!commands.some((line) => line.includes("APPEND")), "Retry created duplicate copy.");
  } finally { session.close(); }
});

Deno.test("authentication errors never expose a password or the server's raw reply", async () => {
  const { session } = fixture(['* OK ready\r\n','F1 NO server-private-content\r\n']);
  try {
    let caught: unknown;
    try { await session.login("fixture", "private-password"); } catch (error) { caught = error; }
    assert(caught instanceof Error && !caught.message.includes("private-password") && !caught.message.includes("server-private"), "Secret leaked.");
  } finally { session.close(); }
});
