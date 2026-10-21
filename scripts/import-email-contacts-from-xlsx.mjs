import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import XLSX from "xlsx";

const clean = (value) => String(value ?? "").replace(/[\u00ad\u200b-\u200d\ufeff]/g, "").replace(/\s+/g, " ").trim();
const fold = (value) => clean(value).normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const isEmail = (value) => value.length <= 254 && !/^\.|\.\.|\.@/.test(value) && /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i.test(value);

export function parseSpreadsheetEmails(raw, cities = []) {
  const original = clean(raw);
  let source = original;
  const inlineHeadings = [];
  if (cities.length) {
    // Ex.: "nome@dominio. ANANINDEUA com.br" contém um cabeçalho entre partes do domínio.
    const inline = new RegExp(`(@[a-z0-9.-]+\\.)\\s+(${cities.map(escapeRegex).join("|")})\\s+(?=[a-z]{2,}(?:\\s*\\.[a-z]{2,})?(?:$|\\s|[;/]))`, "giu");
    source = source.replace(inline, (_match, prefix, heading) => {
      inlineHeadings.push(heading);
      return prefix;
    });
  }
  const headings = [...cities, "Transformação", "Construção Civil", "Extrativa Mineral", "Serviços Industriais de Utilidade Pública", "LEADS"];
  // Cabeçalhos de município/setor foram anexados a algumas células na origem.
  const tail = new RegExp(`\\s+(?:${headings.map(escapeRegex).join("|")})(?=\\s|[.,:]|$).*$`, "iu");
  const withoutTail = source.includes("@") ? source.replace(tail, "") : source;
  const separated = withoutTail.replace(/\s+OU\s+/gi, ";")
    .replace(/(\.[a-z]{2,})\s*\/\s*(?=[^;|]*@)/gi, "$1;")
    .replace(/(\.[a-z]{2,})\s*,\s*(?=[^;|]*@)/gi, "$1;")
    .replace(/(\.[a-z]{2,})\s+(?=[a-z0-9.!#$%&'*+_`{|}~-]+(?:\s*[a-z0-9._-]+)?@)/gi, "$1;");
  const compact = separated.replace(/\s/g, "").replace(/(@[a-z0-9.-]+)\/(?=[^;|]*@)/gi, "$1;");
  const pieces = compact.split(/[;|<>]+/).map((part) => part.replace(/^(?:mailto:|e-mail:)/i, "").replace(/[.,)]+$/, "").toLowerCase()).filter(Boolean);
  return {
    valid: [...new Set(pieces.filter(isEmail))],
    invalid: pieces.filter((part) => !isEmail(part)),
    normalized_source: withoutTail,
    removed_inline_headings: inlineHeadings,
    removed_tail: withoutTail !== source ? source.slice(withoutTail.length).trim() : null,
  };
}

export function extractSpreadsheetContacts(sourcePath, outputDirectory, listName) {
  const source = fs.readFileSync(sourcePath);
  const sourceFile = path.basename(sourcePath);
  const sourceHash = createHash("sha256").update(source).digest("hex");
  const workbook = XLSX.read(source, { type: "buffer", cellDates: true });
  const companies = [];
  const review = [];
  const contactsByEmail = new Map();
  const sheets = [];

  for (const sheetName of workbook.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: "", raw: false });
    const headerIndex = rows.findIndex((row) => row.some((cell) => fold(cell).replace(/[-\s]/g, "") === "email"));
    if (headerIndex < 0) continue;
    const headers = rows[headerIndex].map(fold);
    const index = (label) => headers.indexOf(fold(label));
    const emailIndex = headers.findIndex((label) => label.replace(/[-\s]/g, "") === "email");
    const cityIndex = index("Município");
    const cities = [...new Set(rows.slice(headerIndex + 1).map((row) => clean(row[cityIndex])).filter(Boolean))];
    let companyCount = 0;
    for (let rowIndex = headerIndex + 1; rowIndex < rows.length; rowIndex++) {
      const row = rows[rowIndex];
      if (!row.some((cell) => clean(cell))) continue;
      const get = (label) => clean(row[index(label)]) || null;
      const parsed = parseSpreadsheetEmails(row[emailIndex], cities);
      const company = {
        legal_name: get("Razão Social"), trade_name: get("Nome Fantasia"), cnpj_raw: get("CNPJ"),
        city: get("Município"), address: get("Endereço"), postal_code: get("CEP"),
        phone_raw: get("Telefone"), economic_activity: get("Atividade Econômica"),
        founded_at_raw: get("Ano de Fundação"), email_raw: clean(row[emailIndex]),
        email_normalized_source: parsed.normalized_source,
        emails: parsed.valid, source_sheet: sheetName, source_row: rowIndex + 1,
        source_fields: Object.fromEntries(rows[headerIndex].map((label, column) => [clean(label), clean(row[column])])),
      };
      companies.push(company);
      companyCount++;
      for (const value of parsed.invalid) review.push({ reason: "invalid_email_cell", value, legal_name: company.legal_name, sheet: sheetName, row: rowIndex + 1, email_raw: company.email_raw });
      if (parsed.removed_tail) review.push({ reason: "source_heading_removed_from_email", removed: parsed.removed_tail, sheet: sheetName, row: rowIndex + 1, email_raw: company.email_raw });
      if (parsed.removed_inline_headings.length) review.push({ reason: "source_heading_removed_inside_email", removed: parsed.removed_inline_headings, sheet: sheetName, row: rowIndex + 1, email_raw: company.email_raw });
      for (const email of parsed.valid) {
        if (!contactsByEmail.has(email)) contactsByEmail.set(email, []);
        contactsByEmail.get(email).push(company);
      }
    }
    sheets.push({ name: sheetName, companies: companyCount, header_row: headerIndex + 1 });
  }
  if (!sheets.length) throw new Error("Nenhuma coluna de e-mail identificada na planilha.");
  const contacts = [...contactsByEmail].map(([email, linkedCompanies]) => {
    const distinctNames = new Set(linkedCompanies.map((company) => fold(company.legal_name)));
    return {
      email, name: distinctNames.size === 1 ? linkedCompanies[0].trade_name || linkedCompanies[0].legal_name : null,
      consent_source: "spreadsheet_administrative_import", consent_at: null,
      metadata: {
        source_file: sourceFile, source_sha256: sourceHash, source_type: "xlsx", email_validation: "syntax_only",
        companies: linkedCompanies,
        source_rows: linkedCompanies.map((company) => ({ sheet: company.source_sheet, row: company.source_row })),
        shared_between_companies: distinctNames.size > 1,
      },
    };
  });
  const summary = {
    list_name: listName || path.basename(sourceFile, path.extname(sourceFile)),
    source_file: sourceFile, source_sha256: sourceHash, source_type: "xlsx", sheets,
    companies: companies.length, companies_with_email: companies.filter((company) => company.emails.length).length,
    companies_without_email: companies.filter((company) => !company.email_raw).length,
    unique_emails: contacts.length,
    email_occurrences: companies.reduce((sum, company) => sum + company.emails.length, 0),
    invalid_email_cells: review.filter((entry) => entry.reason === "invalid_email_cell").length,
    cleaned_email_tails: review.filter((entry) => entry.reason === "source_heading_removed_from_email").length,
    cleaned_inline_headings: review.filter((entry) => entry.reason === "source_heading_removed_inside_email").length,
    shared_emails: contacts.filter((contact) => contact.metadata.shared_between_companies).length,
    extracted_at: new Date().toISOString(),
  };
  summary.description = `Contatos extraídos de ${sourceFile}: ${summary.companies} empresas e ${contacts.length} e-mails únicos, com dados empresariais e linhas de origem. Endereços com formato inválido separados para revisão.`;
  fs.mkdirSync(outputDirectory, { recursive: true });
  for (const [filename, data] of [["contacts.json", contacts], ["companies.json", companies], ["review.json", review], ["summary.json", summary]]) {
    fs.writeFileSync(path.join(outputDirectory, filename), JSON.stringify(data, null, 2) + "\n", "utf8");
  }
  return summary;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  if (!process.argv[2]) throw new Error("Informe o caminho do XLSX como primeiro argumento.");
  console.log(JSON.stringify(extractSpreadsheetContacts(process.argv[2], path.resolve(process.argv[3] || "output/contact-imports/empresas-rmb"), process.argv[4]), null, 2));
}
