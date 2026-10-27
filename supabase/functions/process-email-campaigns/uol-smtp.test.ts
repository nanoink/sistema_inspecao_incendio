import { buildUolSmtpMessage, encodeMimeHeader, readSmtpResponse, sendWithUolSmtp, isSmtpAuthenticationError, SmtpCommandError, UncertainEmailDeliveryError } from "./uol-smtp.ts";
import { getProviderConfiguration } from "./email-config.ts";

const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
};

const decodeHeader = (value: string) =>
  value.split("\r\n ").map((word) => {
    const encoded = word.slice("=?UTF-8?B?".length, -2);
    return new TextDecoder().decode(Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0)));
  }).join("");

Deno.test("SMTP aguarda a linha completa antes de aceitar uma resposta fragmentada", async () => {
  const chunks = ["250-primeira linha\r\n250", " concluído\r", "\n"];
  let reads = 0;
  const response = await readSmtpResponse({
    read(buffer: Uint8Array) {
      const text = chunks[reads++];
      if (text === undefined) return Promise.resolve(null);
      const bytes = new TextEncoder().encode(text);
      buffer.set(bytes);
      return Promise.resolve(bytes.length);
    },
  });

  assert(response.code === 250, "Código SMTP incorreto.");
  assert(reads === 3, "A resposta foi aceita antes do CRLF final.");
});

Deno.test("SMTP não expõe o conteúdo da resposta quando a conexão termina", async () => {
  const responseWithPrivateContent = "535-detalhe-privado-do-servidor\r\n";
  let reads = 0;
  let caught: unknown;
  try {
    await readSmtpResponse({
      read(buffer: Uint8Array) {
        if (reads++ > 0) return Promise.resolve(null);
        const bytes = new TextEncoder().encode(responseWithPrivateContent);
        buffer.set(bytes);
        return Promise.resolve(bytes.length);
      },
    });
  } catch (error) {
    caught = error;
  }

  assert(caught instanceof Error, "A conexão encerrada deveria produzir um erro.");
  assert(!(caught as Error).message.includes("detalhe-privado"), "O erro expôs a resposta original.");
});

Deno.test("Cabeçalhos MIME longos preservam acentos sem exceder o tamanho de cada palavra", () => {
  const subject = "Segurança contra incêndio 🔥 — ".repeat(8).trim();
  const encoded = encodeMimeHeader(subject);
  assert(encoded.split("\r\n ").every((word) => word.length <= 75), "Palavra MIME acima do limite.");
  assert(decodeHeader(encoded) === subject, "O cabeçalho perdeu caracteres Unicode.");
});

Deno.test("Nome do remetente é codificado e não permite injeção de cabeçalhos", () => {
  const encoded = encodeMimeHeader("Comercial, Fire\r\nBcc: terceiro@example.com");
  assert(decodeHeader(encoded) === "Comercial, Fire Bcc: terceiro@example.com", "Sanitização incorreta.");
  assert(!encoded.includes("\r\nBcc:"), "O nome criou um novo cabeçalho.");
});

Deno.test("Teste SMTP independe da URL pública e exige a porta TLS 465", () => {
  const values: Record<string, string | undefined> = {
    EMAIL_PROVIDER: "uol_smtp",
    EMAIL_FROM_ADDRESS: "comercial@firetetraedro.com.br",
    PUBLIC_APP_URL: "",
    UOL_SMTP_HOST: "smtps.uhserver.com",
    UOL_SMTP_PORT: "465",
    UOL_SMTP_USERNAME: "comercial@firetetraedro.com.br",
    UOL_SMTP_PASSWORD: "senha-ficticia-apenas-para-teste",
  };
  const previous = new Map(Object.keys(values).map((key) => [key, Deno.env.get(key)]));

  try {
    Object.entries(values).forEach(([key, value]) => Deno.env.set(key, value || ""));
    let config = getProviderConfiguration();
    assert(config.smtpConfigured, "O SMTP deveria estar pronto para teste.");
    assert(!config.configured, "Campanhas devem aguardar a URL pública de descadastro.");

    Deno.env.set("UOL_SMTP_PORT", "587");
    config = getProviderConfiguration();
    assert(!config.smtpConfigured, "STARTTLS não deve ser usado por este cliente de TLS direto.");
  } finally {
    previous.forEach((value, key) => {
      if (value === undefined) Deno.env.delete(key);
      else Deno.env.set(key, value);
    });
  }
});

for (const [name, lastResponse, expected] of [
  ["conexao perdida depois de DATA fica sem confirmacao", null, "uncertain"],
  ["rejeicao explicita depois de DATA continua sendo falha", "550 rejected\r\n", "failed"],
  ["aceite 250 seguido de falha no QUIT continua enviado", "250 accepted\r\n", "sent"],
] as const) {
  Deno.test(name, async () => {
    const original = Deno.connectTls;
    const responses = ["220 ready\r\n", "250 hello\r\n", "334 user\r\n", "334 password\r\n", "235 ok\r\n", "250 sender\r\n", "250 recipient\r\n", "354 data\r\n", lastResponse];
    Deno.connectTls = (() => Promise.resolve({
      async read(buffer: Uint8Array) {
        const response = responses.shift();
        if (response == null) return null;
        const bytes = new TextEncoder().encode(response); buffer.set(bytes); return bytes.length;
      },
      async write(bytes: Uint8Array) { return bytes.length; }, close() {},
    })) as unknown as typeof Deno.connectTls;
    try {
      let caught: unknown;
      let result: string | undefined;
      try {
        result = await sendWithUolSmtp({ delivery: {
          delivery_id: "fixture", campaign_id: "fixture", recipient_email: "recipient@example.invalid", recipient_name: null,
          unsubscribe_token: "fixture", subject: "No sending", preview_text: null, html_body: "<p>Fixture</p>", sender_name: "Fixture", reply_to: null,
        }, html: "<p>Fixture</p>", config: {
          ...getProviderConfiguration(), fromAddress: "sender@example.invalid", publicAppUrl: "https://example.invalid",
          uolSmtpUsername: "fixture", uolSmtpPassword: "fixture",
        } });
      } catch (error) { caught = error; }
      if (expected === "uncertain") assert(caught instanceof UncertainEmailDeliveryError, "Ambiguous send was not quarantined.");
      if (expected === "failed") assert(caught instanceof SmtpCommandError && caught.code === 550, "Explicit rejection was misclassified.");
      if (expected === "sent") assert(Boolean(result) && !caught, "Accepted message was marked failed.");
      assert(isSmtpAuthenticationError(new SmtpCommandError(535, "senha")), "535 should halt authentication.");
      assert(!isSmtpAuthenticationError(new SmtpCommandError(450, "destinatário")), "Recipient error incorrectly classified as authentication.");
    } finally { Deno.connectTls = original; }
  });
}

Deno.test("the prepared MIME archived in UOL is exactly the message submitted by SMTP", async () => {
  const original = Deno.connectTls;
  const responses = ["220 ready\r\n", "250 hello\r\n", "334 user\r\n", "334 password\r\n", "235 ok\r\n", "250 sender\r\n", "250 recipient\r\n", "354 data\r\n", "250 accepted\r\n", "221 bye\r\n"];
  const writes: string[] = [];
  Deno.connectTls = (() => Promise.resolve({
    async read(buffer: Uint8Array) { const next = responses.shift(); if (!next) return null; const bytes = new TextEncoder().encode(next); buffer.set(bytes); return bytes.length; },
    async write(bytes: Uint8Array) { writes.push(new TextDecoder().decode(bytes)); return bytes.length; }, close() {},
  })) as unknown as typeof Deno.connectTls;
  try {
    const config = { ...getProviderConfiguration(), fromAddress: "sender@example.invalid", publicAppUrl: "https://example.invalid", uolSmtpUsername: "fixture", uolSmtpPassword: "fixture" };
    const delivery = { delivery_id: "fixture", campaign_id: "fixture", recipient_email: "recipient@example.invalid", recipient_name: null, unsubscribe_token: "fixture", subject: "Sem envio real", preview_text: null, html_body: "", sender_name: "Fixture", reply_to: null };
    const prepared = buildUolSmtpMessage({ config, delivery, html: "<p>Conteudo exato ç</p>", messageId: "stable@example.invalid", date: new Date("2026-10-27T12:00:00Z") });
    const sentId = await sendWithUolSmtp({ config, delivery, html: "must not replace prepared content", prepared });
    assert(sentId === prepared.messageId, "SMTP changed Message-ID.");
    assert(writes.includes(prepared.message + ".\r\n"), "SMTP bytes differ from durable archive MIME.");
    assert(prepared.message.includes("Date: Tue, 27 Oct 2026 12:00:00 GMT\r\n"), "Prepared date changed.");
  } finally { Deno.connectTls = original; }
});
