import type { ClaimedDelivery } from "./email-types.ts";
import type { EmailProviderConfiguration } from "./email-config.ts";

type SmtpConnection = Awaited<ReturnType<typeof Deno.connectTls>>;

type SmtpResponse = {
  code: number;
};

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const sanitizeHeader = (value: string) => value.replace(/[\r\n]+/g, " ").trim();

const encodeBase64 = (value: string) => {
  const bytes = textEncoder.encode(value);
  let binary = "";

  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }

  return btoa(binary);
};

export const encodeMimeHeader = (value: string) => {
  const sanitized = sanitizeHeader(value);
  const words: string[] = [];
  let chunk = "";
  let chunkBytes = 0;

  for (const character of sanitized) {
    const characterBytes = textEncoder.encode(character).length;
    if (chunkBytes + characterBytes > 42) {
      words.push(`=?UTF-8?B?${encodeBase64(chunk)}?=`);
      chunk = "";
      chunkBytes = 0;
    }
    chunk += character;
    chunkBytes += characterBytes;
  }

  if (chunk) {
    words.push(`=?UTF-8?B?${encodeBase64(chunk)}?=`);
  }

  return words.join("\r\n ");
};

const withTimeout = async <Value>(
  promise: Promise<Value>,
  timeoutMs: number,
  message: string,
) => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }
};

const writeSmtp = async (connection: SmtpConnection, value: string) => {
  const bytes = textEncoder.encode(value);
  let offset = 0;

  while (offset < bytes.length) {
    offset += await withTimeout(
      connection.write(bytes.subarray(offset)),
      15_000,
      "Tempo limite excedido ao escrever no servidor SMTP.",
    );
  }
};

export const readSmtpResponse = async (connection: Pick<SmtpConnection, "read">): Promise<SmtpResponse> => {
  const chunks: string[] = [];
  let totalBytes = 0;

  while (totalBytes < 64 * 1024) {
    const buffer = new Uint8Array(4096);
    const bytesRead = await withTimeout(
      connection.read(buffer),
      15_000,
      "Tempo limite excedido aguardando o servidor SMTP.",
    );

    if (bytesRead === null) {
      throw new Error("O servidor SMTP encerrou a conexão inesperadamente.");
    }

    totalBytes += bytesRead;
    chunks.push(textDecoder.decode(buffer.subarray(0, bytesRead), { stream: true }));
    const responseText = chunks.join("");
    const finalLine = responseText
      .split(/\r?\n/)
      .slice(0, -1)
      .find((line) => /^\d{3} /.test(line));

    if (finalLine) {
      return { code: Number(finalLine.slice(0, 3)) };
    }
  }

  throw new Error("A resposta do servidor SMTP excedeu o limite permitido.");
};

const assertSmtpCode = (
  response: SmtpResponse,
  expectedCodes: number[],
  stage: string,
) => {
  if (!expectedCodes.includes(response.code)) {
    throw new Error(`SMTP ${stage} falhou (código ${response.code}).`);
  }
};

export const runSmtpCommand = async (
  connection: SmtpConnection,
  command: string,
  expectedCodes: number[],
  stage: string,
) => {
  await writeSmtp(connection, `${command}\r\n`);
  const response = await readSmtpResponse(connection);
  assertSmtpCode(response, expectedCodes, stage);
};

export const connectAuthenticatedUolSmtp = async (
  config: EmailProviderConfiguration,
) => {
  const connection = await withTimeout(
    Deno.connectTls({
      hostname: config.uolSmtpHost,
      port: config.uolSmtpPort,
    }),
    15_000,
    "Tempo limite excedido ao conectar ao SMTP da UOL.",
  );

  try {
    assertSmtpCode(await readSmtpResponse(connection), [220], "conexão");
    await runSmtpCommand(connection, "EHLO fire360.local", [250], "EHLO");
    await runSmtpCommand(connection, "AUTH LOGIN", [334], "autenticação");
    await runSmtpCommand(
      connection,
      encodeBase64(config.uolSmtpUsername),
      [334],
      "usuário",
    );
    await runSmtpCommand(
      connection,
      encodeBase64(config.uolSmtpPassword),
      [235],
      "senha",
    );
    return connection;
  } catch (error) {
    connection.close();
    throw error;
  }
};

export const sendWithUolSmtp = async ({
  delivery,
  html,
  config,
}: {
  delivery: ClaimedDelivery;
  html: string;
  config: EmailProviderConfiguration;
}) => {
  const unsubscribeUrl = `${config.publicAppUrl.replace(/\/$/, "")}/email/descadastrar/${delivery.unsubscribe_token}`;
  const fromAddress = sanitizeHeader(config.fromAddress);
  const recipientAddress = sanitizeHeader(delivery.recipient_email);
  const replyTo = delivery.reply_to ? sanitizeHeader(delivery.reply_to) : null;
  const messageDomain = fromAddress.split("@")[1]?.replace(/[^a-z0-9.-]/gi, "") || "fire360.local";
  const messageId = `${crypto.randomUUID()}@${messageDomain}`;
  const encodedHtml = encodeBase64(html).replace(/.{1,76}/g, "$&\r\n").trimEnd();
  const message = [
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${messageId}>`,
    `From: ${encodeMimeHeader(delivery.sender_name)} <${fromAddress}>`,
    `To: ${delivery.recipient_name ? `${encodeMimeHeader(delivery.recipient_name)} ` : ""}<${recipientAddress}>`,
    `Subject: ${encodeMimeHeader(delivery.subject)}`,
    ...(replyTo ? [`Reply-To: ${replyTo}`] : []),
    `List-Unsubscribe: <${unsubscribeUrl}>`,
    "MIME-Version: 1.0",
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    `X-Fire360-Campaign-ID: ${delivery.campaign_id}`,
    `X-Fire360-Delivery-ID: ${delivery.delivery_id}`,
    "",
    encodedHtml,
  ].join("\r\n");
  const connection = await connectAuthenticatedUolSmtp(config);

  try {
    await runSmtpCommand(connection, `MAIL FROM:<${fromAddress}>`, [250], "remetente");
    await runSmtpCommand(
      connection,
      `RCPT TO:<${recipientAddress}>`,
      [250, 251],
      "destinatário",
    );
    await runSmtpCommand(connection, "DATA", [354], "conteúdo");
    await writeSmtp(connection, `${message.replace(/^\./gm, "..")}\r\n.\r\n`);
    assertSmtpCode(await readSmtpResponse(connection), [250], "entrega");

    try {
      await runSmtpCommand(connection, "QUIT", [221], "encerramento");
    } catch {
      // A entrega já foi aceita; falha no QUIT não altera o resultado.
    }

    return messageId;
  } finally {
    connection.close();
  }
};
