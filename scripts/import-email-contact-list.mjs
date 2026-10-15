import fs from "node:fs";
import path from "node:path";

const directory = path.resolve(process.argv[2] || "output/contact-imports/guia-industrial-para-2022");
const apply = process.argv.includes("--apply");
const contacts = JSON.parse(fs.readFileSync(path.join(directory, "contacts.json"), "utf8"));
const extraction = JSON.parse(fs.readFileSync(path.join(directory, "summary.json"), "utf8"));
const listName = path.basename(extraction.source_file, ".pdf");
if (contacts.length !== new Set(contacts.map((contact) => contact.email)).size) throw new Error("A extração contém e-mails duplicados.");
if (!contacts.length || contacts.some((contact) => !contact.email || !contact.metadata?.source_sha256)) throw new Error("Dados de extração incompletos.");
if (!apply) {
  console.log(JSON.stringify({ dry_run: true, name: listName, unique_emails: contacts.length, companies: extraction.companies, source_sha256: extraction.source_sha256 }, null, 2));
  process.exit(0);
}

const env = {};
for (const line of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
  const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
  if (match) env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2").trim();
}
const token = process.env.SUPABASE_ACCESS_TOKEN || env.SUPABASE_TOKEN;
const projectRef = env.VITE_SUPABASE_PROJECT_ID;
if (!token || !projectRef || !/^[a-z]{20}$/.test(projectRef)) throw new Error("Configuração Supabase indisponível.");
const sqlValue = (value) => value === null || value === undefined ? "NULL" : "'" + String(value).replace(/'/g, "''") + "'";

async function query(sql) {
  const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql, read_only: false }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const safe = String(payload.message || `HTTP ${response.status}`).replaceAll(token, "<redacted>");
    throw new Error(safe.slice(0, 1500));
  }
  return response.json();
}

const description = `Extraído de ${extraction.source_file}. Edição 2022; ${contacts.length} e-mails únicos e dados de empresas, com páginas de origem. Endereços com formato inválido separados para revisão.`;
const existing = await query(`select id from public.email_recipient_lists where lower(btrim(name))=lower(btrim(${sqlValue(listName)}));`);
let listId = existing[0]?.id;
if (listId) {
  const conflicts = await query(`select count(*)::int as count from public.email_recipients where list_id=${sqlValue(listId)}::uuid and metadata->>'source_sha256' is distinct from ${sqlValue(extraction.source_sha256)};`);
  if (conflicts[0]?.count) throw new Error("Já existe uma lista com esse nome e contatos de outra origem. Nenhum contato foi alterado.");
} else {
  const created = await query(`insert into public.email_recipient_lists(name,description) values (${sqlValue(listName)},${sqlValue(description)}) returning id;`);
  listId = created[0]?.id;
}
if (!listId || !/^[a-f0-9-]{36}$/i.test(listId)) throw new Error("A lista não foi identificada.");
for (let offset = 0; offset < contacts.length; offset += 150) {
  const batch = contacts.slice(offset, offset + 150);
  const sql = `
    insert into public.email_recipients as recipient
      (list_id, email, name, status, consent_source, consent_at, metadata)
    select ${sqlValue(listId)}::uuid, input.email, input.name,
      case when exists(select 1 from public.email_suppressions s where s.email_normalized=lower(btrim(input.email))) then 'unsubscribed' else 'active' end,
      input.consent_source, null, input.metadata
    from jsonb_to_recordset(${sqlValue(JSON.stringify(batch))}::jsonb)
      as input(email text, name text, consent_source text, metadata jsonb)
    on conflict (list_id,email_normalized) do update
      set name=coalesce(recipient.name, excluded.name), metadata=recipient.metadata || excluded.metadata;
  `;
  await query(sql);
  console.log(`Importação: ${Math.min(offset + batch.length, contacts.length)}/${contacts.length}`);
}
await query(`update public.email_recipient_lists set description=${sqlValue(description)} where id=${sqlValue(listId)}::uuid;`);
const results = await query(`select
  count(*)::int as saved_contacts,
  count(distinct email_normalized)::int as unique_emails,
  count(*) filter(where status='active')::int as active_contacts,
  count(*) filter(where status='unsubscribed')::int as suppressed_contacts,
  count(*) filter(where metadata->>'source_sha256'=${sqlValue(extraction.source_sha256)})::int as contacts_with_source,
  (select count(*)::int from public.email_campaigns where recipient_list_id=${sqlValue(listId)}::uuid) as campaigns_for_list
  from public.email_recipients where list_id=${sqlValue(listId)}::uuid;`);
const verified = results[0];
if (verified.saved_contacts !== contacts.length || verified.unique_emails !== contacts.length || verified.contacts_with_source !== contacts.length) throw new Error("A contagem após a importação não confere.");
const result = { list_id: listId, list_name: listName, ...verified, source_file: extraction.source_file, source_sha256: extraction.source_sha256, imported_at: new Date().toISOString() };
fs.writeFileSync(path.join(directory, "import-result.json"), JSON.stringify(result, null, 2) + "\n", "utf8");
console.log(JSON.stringify(result, null, 2));
