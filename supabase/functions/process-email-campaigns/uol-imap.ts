import type { EmailProviderConfiguration } from "./email-config.ts";

type Connection = Pick<Awaited<ReturnType<typeof Deno.connectTls>>, "read" | "write" | "close">;
const encoder = new TextEncoder();
const decoder = new TextDecoder();
export const quoteImapString = (value: string) => {
  if (/[\r\n\0]/.test(value)) throw new Error("Valor IMAP invalido.");
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
};

export const parseImapFolders = (lines: string[]) => lines.flatMap((line) => {
  const match = line.match(/^\* LIST \(([^)]*)\) (?:"(?:[^"\\]|\\.)*"|NIL) (.+)$/i);
  if (!match) return [];
  let name = match[2];
  if (name.startsWith('"') && name.endsWith('"')) name = name.slice(1, -1).replace(/\\(.)/g, "$1");
  else if (/[{}\r\n]/.test(name)) return [];
  return [{ name, flags: match[1].split(/\s+/) }];
});

export const resolveSentFolder = (lines: string[], configured = "") => {
  const folders = parseImapFolders(lines).filter((row) => !row.flags.some((flag) => flag.toLowerCase() === "\\noselect"));
  if (configured) {
    if (!folders.some((row) => row.name === configured)) throw new Error("A pasta UOL configurada nao foi encontrada.");
    return configured;
  }
  const special = folders.filter((row) => row.flags.some((flag) => flag.toLowerCase() === "\\sent"));
  if (special.length === 1) return special[0].name;
  const known = folders.filter((row) => /^(?:INBOX[./])?(?:Sent|Sent Items|Sent Messages|Itens Enviados|Enviados|Enviadas)$/i.test(row.name));
  if (known.length === 1) return known[0].name;
  throw new Error("Nao foi possivel identificar uma unica pasta de enviados. Configure UOL_SENT_FOLDER.");
};

export class UolImapSession {
  private buffer = "";
  private sequence = 0;
  private deadline: ReturnType<typeof setTimeout>;
  constructor(private connection: Connection) {
    this.deadline = setTimeout(() => this.close(), 20_000);
  }
  close() {
    clearTimeout(this.deadline);
    try { this.connection.close(); } catch { /* Already closed by deadline. */ }
  }
  private async line() {
    while (!this.buffer.includes("\r\n")) {
      const bytes = new Uint8Array(4096);
      const size = await this.connection.read(bytes);
      if (size === null || size === 0) throw new Error("A conexao IMAP foi interrompida.");
      this.buffer += decoder.decode(bytes.subarray(0, size));
      if (this.buffer.length > 128 * 1024) throw new Error("Resposta IMAP excedeu o limite.");
    }
    const end = this.buffer.indexOf("\r\n");
    const result = this.buffer.slice(0, end);
    this.buffer = this.buffer.slice(end + 2);
    return result;
  }
  private async write(value: string) {
    const bytes = encoder.encode(value);
    let offset = 0;
    while (offset < bytes.length) {
      const size = await this.connection.write(bytes.subarray(offset));
      if (size <= 0) throw new Error("Nao foi possivel escrever no IMAP.");
      offset += size;
    }
  }
  private async reply(tag: string, continuation = false) {
    const lines: string[] = [];
    let total = 0;
    while (total < 128 * 1024) {
      const line = await this.line();
      total += line.length;
      lines.push(line);
      if (continuation && line.startsWith("+")) return lines;
      if (line.startsWith(tag + " ")) {
        if (!line.startsWith(tag + " OK")) throw new Error("O servidor UOL recusou a operacao IMAP.");
        return lines;
      }
      if (line.startsWith("* BYE")) throw new Error("A UOL encerrou a sessao IMAP.");
    }
    throw new Error("Resposta IMAP excedeu o limite.");
  }
  async command(command: string) {
    const tag = "F" + (++this.sequence);
    await this.write(`${tag} ${command}\r\n`);
    return this.reply(tag);
  }
  async login(username: string, password: string) {
    if (!(await this.line()).startsWith("* OK")) throw new Error("Servidor IMAP indisponivel.");
    try { await this.command(`LOGIN ${quoteImapString(username)} ${quoteImapString(password)}`); }
    catch { throw new Error("Autenticacao IMAP recusada pela UOL."); }
  }
  async sentFolder(configured = "") {
    return resolveSentFolder(await this.command('LIST "" "*"'), configured);
  }
  async find(folder: string, messageId: string) {
    await this.command(`EXAMINE ${quoteImapString(folder)}`);
    const lines = await this.command(`UID SEARCH HEADER Message-ID ${quoteImapString(`<${messageId}>`)}`);
    const ids = lines.filter((line) => line.startsWith("* SEARCH"))
      .flatMap((line) => line.slice(8).trim().split(/\s+/).filter((id) => /^\d+$/.test(id)));
    return ids[0] || null;
  }
  async save(folder: string, messageId: string, message: string) {
    if (!message.includes(`Message-ID: <${messageId}>\r\n`)) throw new Error("Message-ID da copia difere da mensagem SMTP.");
    const existing = await this.find(folder, messageId);
    if (existing) return { uid: existing, alreadyPresent: true };
    const tag = "F" + (++this.sequence);
    await this.write(`${tag} APPEND ${quoteImapString(folder)} (\\Seen) {${encoder.encode(message).length}}\r\n`);
    const continuation = await this.reply(tag, true);
    if (!continuation.at(-1)?.startsWith("+")) throw new Error("A UOL nao autorizou o conteudo da copia.");
    await this.write(message + "\r\n");
    const result = await this.reply(tag);
    const appendUid = result.join(" ").match(/\[APPENDUID \d+ (\d+)\]/i)?.[1];
    const uid = appendUid || await this.find(folder, messageId);
    if (!uid) throw new Error("A copia foi aceita, mas ainda nao foi localizada. Sera conferida novamente sem reenviar o email.");
    return { uid, alreadyPresent: false };
  }
}

export const connectUolImap = async (config: EmailProviderConfiguration) => {
  if (!config.imapConfigured) throw new Error("Configuracao IMAP incompleta.");
  let expired = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const connecting = Deno.connectTls({ hostname: config.uolImapHost, port: config.uolImapPort });
  void connecting.then((connection) => { if (expired) connection.close(); }, () => {});
  let connection: Awaited<typeof connecting>;
  try {
    connection = await Promise.race([connecting, new Promise<never>((_, reject) => {
      timer = setTimeout(() => { expired = true; reject(new Error("Tempo limite na conexao IMAP.")); }, 10_000);
    })]);
  } finally { clearTimeout(timer); }
  const session = new UolImapSession(connection);
  try { await session.login(config.uolImapUsername, config.uolImapPassword); return session; }
  catch (error) { session.close(); throw error; }
};
