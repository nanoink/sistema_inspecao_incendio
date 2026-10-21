import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSpreadsheetEmails } from "./import-email-contacts-from-xlsx.mjs";

test("normaliza espaços e mailto sem alterar o endereço", () => {
  assert.deepEqual(parseSpreadsheetEmails("mailto:COMERCIAL@ exemplo.com. br").valid, ["comercial@exemplo.com.br"]);
  assert.deepEqual(parseSpreadsheetEmails("financeiro@exemplo.com.br.").valid, ["financeiro@exemplo.com.br"]);
});

test("separa múltiplos endereços e elimina repetições na célula", () => {
  assert.deepEqual(parseSpreadsheetEmails("a@exemplo.com.br; b@exemplo.com / c@exemplo.net OU a@exemplo.com.br").valid,
    ["a@exemplo.com.br", "b@exemplo.com", "c@exemplo.net"]);
});

test("não incorpora cabeçalhos ao domínio de e-mail", () => {
  assert.deepEqual(parseSpreadsheetEmails("a@exemplo.com LEADS").valid, ["a@exemplo.com"]);
  assert.deepEqual(parseSpreadsheetEmails("a@exemplo.com BELÉM PRATINHA. CEP: 66.816-840", ["Belém"]).valid, ["a@exemplo.com"]);
  assert.deepEqual(parseSpreadsheetEmails("a@exemplo.com Transformação").valid, ["a@exemplo.com"]);
  const wrapped = parseSpreadsheetEmails("a@exemplo. ANANINDEUA com.br", ["Ananindeua"]);
  assert.deepEqual(wrapped.valid, ["a@exemplo.com.br"]);
  assert.deepEqual(wrapped.removed_inline_headings, ["ANANINDEUA"]);
});

test("separa células malformadas sem adivinhar domínio ou endereço", () => {
  for (const raw of ["Atividade Econômica: Construção", "seana.@.supridad.com.br", "usinãouronegro@gmail.com", "supec@nassau", "nome@exemplo,com", "nome@yahoo.com,br", "forte castelo"]) {
    assert.equal(parseSpreadsheetEmails(raw).valid.length, 0, raw);
    assert.ok(parseSpreadsheetEmails(raw).invalid.length);
  }
  assert.deepEqual(parseSpreadsheetEmails("").valid, []);
});
