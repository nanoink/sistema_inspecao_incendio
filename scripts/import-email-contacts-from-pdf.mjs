import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const sourcePath = process.argv[2];
if (!sourcePath) throw new Error("Informe o caminho do PDF como primeiro argumento.");
const outputDirectory = path.resolve(process.argv[3] || "output/contact-imports/guia-industrial-para-2022");
const sourceName = path.basename(sourcePath);
const sourceBytes = fs.readFileSync(sourcePath);
const sourceHash = createHash("sha256").update(sourceBytes).digest("hex");
const clean = (value) => value.replace(/\u00ad/g, "").replace(/[\u200b-\u200d\ufeff]/g, "").replace(/\s+/g, " ").trim();
const fold = (value) => clean(value).normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
const labelPattern = /^(Raz[aã]o\s+Social|Nome\s+Fantasia|CNPJ|Endere[cç]o|Telefones?|E\s*-?\s*mail|Atividade\s+Econ[oô]mica|Ano\s+de\s+Funda[cç][aã]o|Site|Website)\s*:\s*(.*)$/iu;
const fieldNames = {
  "razao social": "legal_name", "nome fantasia": "trade_name", cnpj: "cnpj_raw",
  endereco: "address", telefone: "phone_raw", telefones: "phone_raw", email: "email_raw",
  "e-mail": "email_raw", "atividade economica": "economic_activity",
  "ano de fundacao": "founded_at_raw", site: "website", website: "website",
};
const isEmail = (value) => value.length <= 254 && !/^\.|\.\.|\.@/.test(value) && /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i.test(value);

function parseEmails(raw) {
  // Espaços do layout podem separar o domínio ou o nome local em duas linhas.
  const separated = raw
    .replace(/\s+OU\s+/gi, ";")
    .replace(/(\.[a-z]{2,})\s*\/\s*(?=[^;|]*@)/gi, "$1;")
    .replace(/(\.[a-z]{2,})\s+(?=[a-z0-9.!#$%&'*+_`{|}~-]+(?:\s*[a-z0-9._-]+)?@)/gi, "$1;");
  const compact = separated.replace(/\s+/g, "").replace(/[\u00ad\u200b-\u200d\ufeff]/g, "")
    .replace(/(@[a-z0-9.-]+)\/(?=[^;|]*@)/gi, "$1;");
  const pieces = compact.split(/[;|<>]+/).map((part) => part.replace(/^(?:mailto:|e-mail:)/i, "").replace(/[.,)]+$/, "").toLowerCase()).filter(Boolean);
  const valid = [];
  const invalid = [];
  for (const candidate of pieces) {
    if (isEmail(candidate)) valid.push(candidate);
    else if (candidate && candidate !== "-" && candidate !== "naoinformado") invalid.push(candidate);
  }
  return { valid: [...new Set(valid)], invalid };
}

function groupLines(items) {
  const lines = [];
  for (const item of [...items].sort((a, b) => b.y - a.y || a.x - b.x)) {
    let line = lines.find((candidate) => Math.abs(candidate.y - item.y) < 1.3);
    if (!line) { line = { y: item.y, items: [] }; lines.push(line); }
    line.items.push(item);
  }
  return lines.sort((a, b) => b.y - a.y).map((line) => ({
    y: line.y,
    height: Math.max(...line.items.map((item) => item.height)),
    text: clean(line.items.sort((a, b) => a.x - b.x).map((item, index, ordered) => {
      const previous = ordered[index - 1];
      const gap = previous ? item.x - previous.x - previous.width : 0;
      return previous && gap > 0.8 && !/\s$/.test(previous.text) && !/^\s/.test(item.text) ? " " + item.text : item.text;
    }).join("")),
  }));
}

function validateCnpj(raw) {
  const digits = raw.replace(/\D/g, "");
  if (digits.length !== 14 || /^(\d)\1{13}$/.test(digits)) return false;
  for (const length of [12, 13]) {
    const weights = length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const remainder = weights.reduce((sum, weight, index) => sum + Number(digits[index]) * weight, 0) % 11;
    if (Number(digits[length]) !== (remainder < 2 ? 0 : 11 - remainder)) return false;
  }
  return true;
}

const companies = [];
const unassociated = [];
const pages = [];
const review = [];
let currentCity = null;
let currentSector = null;
let current = null;
let currentField = null;

function finishRecord() {
  if (!current) return;
  const data = Object.fromEntries(Object.entries(current.fields).map(([key, parts]) => [key, clean(parts.join(" "))]));
  if (data.legal_name) {
    const emails = parseEmails(data.email_raw || "");
    const company = {
      ...data,
      cnpj: data.cnpj_raw?.replace(/\D/g, "").length === 14 ? data.cnpj_raw.replace(/\D/g, "") : null,
      cnpj_valid: data.cnpj_raw ? validateCnpj(data.cnpj_raw) : null,
      city: current.city, state: current.city === "OUTROS ESTADOS" ? null : "PA", sector: current.sector,
      postal_code: data.address?.match(/CEP\s*:\s*(\d{2}\.\d{3}-\s*\d{3}|\d{5}-\s*\d{3})/i)?.[1].replace(/\s/g, "") || null,
      emails: emails.valid,
      source_pages: [...current.pages].sort((a, b) => a - b),
      source_text: current.lines.join("\n"),
    };
    companies.push(company);
    for (const value of emails.invalid) review.push({ reason: "invalid_email_in_company", value, legal_name: data.legal_name, pages: company.source_pages, email_raw: data.email_raw });
    if (data.cnpj_raw && !company.cnpj_valid) review.push({ reason: "cnpj_as_printed_requires_review", value: data.cnpj_raw, legal_name: data.legal_name, pages: company.source_pages });
  } else if (data.email_raw) {
    const emails = parseEmails(data.email_raw);
    for (const email of emails.valid) unassociated.push({ email, pages: [...current.pages], source_text: current.lines.join("\n"), city: current.city });
    for (const value of emails.invalid) review.push({ reason: "unassociated_email_requires_review", value, pages: [...current.pages] });
  }
  current = null;
  currentField = null;
}

fs.mkdirSync(outputDirectory, { recursive: true });
const loadingTask = getDocument({ data: new Uint8Array(sourceBytes), useSystemFonts: true, isEvalSupported: false, verbosity: 0 });
const pdf = await loadingTask.promise;
let directoryStarted = false;
let emailLabelCount = 0;
for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
  const page = await pdf.getPage(pageNumber);
  const content = await page.getTextContent();
  const items = content.items.filter((item) => item.str?.trim()).map((item) => ({ text: item.str, x: item.transform[4], y: item.transform[5], height: item.height, width: item.width }));
  const rawText = items.map((item) => item.text).join(" ");
  const isDirectory = items.some((item) => /^Raz[aã]o\s+Social/i.test(item.text));
  if (isDirectory) directoryStarted = true;
  const header = items.filter((item) => item.y > 730 && !/GUIA INDUSTRIAL|^\d+$/i.test(item.text)).map((item) => clean(item.text)).join(" ");
  if (directoryStarted && header && header.length < 100) currentCity = header;

  if (directoryStarted) {
    const base = pageNumber % 2 === 0 ? 34 : 48.2;
    const columns = [[], [], []];
    for (const item of items.filter((item) => item.y > 49 && item.y < 725)) {
      const column = item.x < base + 162 ? 0 : item.x < base + 332 ? 1 : 2;
      columns[column].push(item);
    }
    const pageLines = [];
    for (const [column, columnItems] of columns.entries()) {
      for (const line of groupLines(columnItems)) {
        pageLines.push({ column: column + 1, ...line });
        if (line.height > 25) {
          finishRecord();
          currentCity = line.text;
          currentSector = null;
          continue;
        }
        if (line.height > 9.9) {
          if (/^(Constru[cç][aã]o(?: Civil)?|Extrativa Mineral|Transforma[cç][aã]o|Outros|Servi[cç]os Industriais de|Utilidade P[uú]blica)$/i.test(line.text)) {
            finishRecord();
            currentSector = /Servi[cç]os Industriais|Utilidade P[uú]blica/i.test(line.text) ? "Serviços Industriais de Utilidade Pública" : line.text;
          }
          continue;
        }
        const label = line.text.match(labelPattern);
        if (label) {
          const key = fieldNames[fold(label[1]).replace(/\s*-\s*/g, "-")];
          if (!key) continue;
          if (key === "email_raw") emailLabelCount++;
          if (key === "legal_name") finishRecord();
          if (!current) current = { fields: {}, pages: new Set(), city: currentCity, sector: currentSector, lines: [] };
          currentField = key;
          current.fields[key] ||= [];
          current.fields[key].push(label[2]);
        } else if (current && currentField) {
          if (currentField === "email_raw" && /:\s/.test(line.text)) {
            // A ficha seguinte está sem cabeçalho no próprio PDF. Não atribuir seus dados à anterior.
            review.push({ reason: "unlabelled_record_continuation", page: pageNumber, text: line.text });
            finishRecord();
          } else {
            current.fields[currentField].push(line.text);
          }
        }
        if (current) { current.pages.add(pageNumber); current.lines.push(line.text); }
      }
    }
    pages.push({ page: pageNumber, header, lines: pageLines, raw_text: rawText });
  } else {
    // Contatos institucionais anteriores ao diretório: não inventar vínculo com empresa.
    const candidates = rawText.match(/[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}/gi) || [];
    for (const email of candidates) if (isEmail(email)) unassociated.push({ email: email.toLowerCase(), pages: [pageNumber], source_text: rawText, city: null });
    pages.push({ page: pageNumber, raw_text: rawText });
  }
  page.cleanup();
  if (pageNumber % 100 === 0) console.log(`Leitura do PDF: ${pageNumber}/${pdf.numPages} páginas`);
}
finishRecord();

const contactsByEmail = new Map();
function addContact(email, company, occurrence) {
  if (!contactsByEmail.has(email)) contactsByEmail.set(email, { email, companies: [], occurrences: [] });
  const contact = contactsByEmail.get(email);
  if (company) contact.companies.push(company);
  if (occurrence) contact.occurrences.push(occurrence);
}
for (const company of companies) for (const email of company.emails) addContact(email, company);
for (const occurrence of unassociated) addContact(occurrence.email, null, occurrence);
const contacts = [...contactsByEmail.values()].map((contact) => {
  const distinctNames = new Set(contact.companies.map((company) => fold(company.legal_name)));
  const first = contact.companies[0];
  return {
    email: contact.email,
    name: distinctNames.size === 1 ? first.trade_name || first.legal_name : null,
    consent_source: "public_directory_pdf_2022",
    consent_at: null,
    metadata: {
      source_file: sourceName, source_sha256: sourceHash, source_year: 2022,
      email_validation: "syntax_only", consent_confirmed: false,
      source_pages: [...new Set([...contact.companies.flatMap((company) => company.source_pages), ...contact.occurrences.flatMap((occurrence) => occurrence.pages)])].sort((a, b) => a - b),
      companies: contact.companies,
      ...(contact.occurrences.length ? { other_occurrences: contact.occurrences } : {}),
      shared_between_companies: distinctNames.size > 1,
    },
  };
}).sort((a, b) => a.metadata.source_pages[0] - b.metadata.source_pages[0] || a.email.localeCompare(b.email));

const csvCell = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
const csv = [["email", "nome", "razoes_sociais", "cnpjs", "municipios", "telefones", "enderecos", "atividades", "paginas_origem"], ...contacts.map((contact) => [contact.email, contact.name, [...new Set(contact.metadata.companies.map((c) => c.legal_name))].join(" | "), [...new Set(contact.metadata.companies.map((c) => c.cnpj_raw).filter(Boolean))].join(" | "), [...new Set(contact.metadata.companies.map((c) => c.city).filter(Boolean))].join(" | "), [...new Set(contact.metadata.companies.map((c) => c.phone_raw).filter(Boolean))].join(" | "), [...new Set(contact.metadata.companies.map((c) => c.address).filter(Boolean))].join(" | "), [...new Set(contact.metadata.companies.map((c) => c.economic_activity).filter(Boolean))].join(" | "), contact.metadata.source_pages.join(", ")])].map((row) => row.map(csvCell).join(";")).join("\r\n");
const summary = {
  source_file: sourceName, source_sha256: sourceHash, source_pages: pdf.numPages,
  companies: companies.length, companies_with_email: companies.filter((company) => company.emails.length).length,
  unique_emails: contacts.length, email_labels: emailLabelCount,
  shared_emails: contacts.filter((contact) => contact.metadata.shared_between_companies).length,
  institutional_or_unassociated_emails: contacts.filter((contact) => !contact.metadata.companies.length).length,
  review_items: review.length, extracted_at: new Date().toISOString(),
};
for (const [filename, data] of [["contacts.json", contacts], ["companies.json", companies], ["pages.json", pages], ["review.json", review], ["summary.json", summary]]) fs.writeFileSync(path.join(outputDirectory, filename), JSON.stringify(data, null, 2) + "\n", "utf8");
fs.writeFileSync(path.join(outputDirectory, "contacts.csv"), "\ufeff" + csv + "\r\n", "utf8");
await loadingTask.destroy();
console.log(JSON.stringify(summary, null, 2));
console.log(`Extração salva em ${outputDirectory}`);
