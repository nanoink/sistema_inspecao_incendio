import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import XLSX from "xlsx";

const DEFAULT_OUTPUT = path.resolve(
  process.cwd(),
  "supabase/migrations/20260310113000_reimport_exigencias_with_context_fields.sql",
);

const REQUIREMENT_CODES = [
  "1.1",
  "1.2",
  "1.3",
  "1.4",
  "2.1",
  "2.2",
  "2.3",
  "2.4",
  "2.5",
  "3.1",
  "3.2",
  "4.1",
  "4.2",
  "4.3",
  "5.1",
  "5.2",
  "6.1",
  "7.1",
  "7.2",
  "7.3",
  "7.4",
  "8.1",
];

const HEIGHT_MAP = new Map([
  [
    "EDIFICACAO TERREA",
    { tipo: "I", denominacao: "Edificacao Terrea", alturaMin: null, alturaMax: null },
  ],
  [
    "EDIFICACAO BAIXA",
    { tipo: "II", denominacao: "Edificacao de Baixa Altura", alturaMin: null, alturaMax: 6 },
  ],
  [
    "EDIFICACAO DE BAIXA-MEDIA ALTURA",
    { tipo: "III", denominacao: "Edificacao de Baixa-Media Altura", alturaMin: 6, alturaMax: 12 },
  ],
  [
    "EDIFICACAO DE MEDIA ALTURA",
    { tipo: "IV", denominacao: "Edificacao de Media Altura", alturaMin: 12, alturaMax: 30 },
  ],
  [
    "EDIFICACAO ALTA",
    { tipo: "V", denominacao: "Edificacao de Grande Altura", alturaMin: 30, alturaMax: null },
  ],
]);

const SUPPLEMENTAL_PREFIXES = [
  "alem da",
  "deve haver",
  "devem",
  "devera haver",
  "os detectores",
  "pode ser",
  "podera ser",
  "recomendado",
  "recomenda-se",
  "recomenda que",
  "estao isentos",
  "e recomendavel",
  "prever",
  "sera considerada para",
  "sera considerada",
  "pode ser substituida",
  "pode ser substituido",
  "podera ser substituida",
  "podera ser substituido",
  "mas pode ser",
  "deve-se interligar",
  "devera haver simulado",
  "devera haver densidade",
];

const MANUAL_KEYWORDS = [
  "raio de acao",
  "areas comuns",
  "quartos",
  "corredores",
  "carga de incendio",
  "instalacoes temporarias",
  "rotas de saida",
  "rotas horizontais",
  "empilhamento",
  "casa de maquinas",
  "hospitais psiquiatricos",
  "detencao",
  "penitenciarias",
  "presidios",
  "motel",
];

function parseArgs(argv) {
  const args = { inputDir: "", output: DEFAULT_OUTPUT };

  for (let index = 2; index < argv.length; index += 1) {
    const current = argv[index];
    const next = argv[index + 1];

    if (current === "--input-dir" && next) {
      args.inputDir = path.resolve(process.cwd(), next);
      index += 1;
      continue;
    }

    if (current === "--output" && next) {
      args.output = path.resolve(process.cwd(), next);
      index += 1;
      continue;
    }

    if (!current.startsWith("--") && !args.inputDir) {
      args.inputDir = path.resolve(process.cwd(), current);
    }
  }

  if (!args.inputDir) {
    throw new Error("Informe o diretorio com os arquivos XLSX usando --input-dir ou como primeiro argumento.");
  }

  return args;
}

function deterministicUuid(seed) {
  const bytes = createHash("sha1").update(seed).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}

function sanitizeText(value) {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\r/g, " ")
    .replace(/\n/g, " ")
    .replace(/[â€œâ€]/g, '"')
    .replace(/[â€˜â€™Â´`]/g, "'")
    .replace(/[â€“â€”]/g, "-")
    .replace(/–/g, "-")
    .replace(/≤/g, "<=")
    .replace(/≥/g, ">=")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeForMatch(value) {
  return sanitizeText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[()]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function normalizeDivisao(value) {
  return normalizeForMatch(value).replace(/\s*-\s*/g, "-");
}

function normalizeDivisionToken(value) {
  return normalizeDivisao(value).replace(/-/g, "");
}

function sqlLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlNullable(value) {
  if (value === null || value === undefined || value === "") {
    return "NULL";
  }

  if (Array.isArray(value)) {
    const items = value.map((item) => sqlLiteral(item)).join(", ");
    return `ARRAY[${items}]::text[]`;
  }

  if (typeof value === "number") {
    return Number.isInteger(value) ? String(value) : value.toFixed(4).replace(/\.?0+$/, "");
  }

  return sqlLiteral(value);
}

function chunk(values, size) {
  const groups = [];
  for (let index = 0; index < values.length; index += size) {
    groups.push(values.slice(index, index + size));
  }
  return groups;
}

function findInputFiles(inputDir) {
  const names = fs.readdirSync(inputDir);
  const normalized = names.map((name) => ({
    name,
    key: normalizeForMatch(name),
  }));

  const large = normalized.find(
    ({ key }) => key.includes("MAIOR") && key.includes("750") && key.endsWith(".XLSX"),
  );
  const small = normalized.find(
    ({ key }) => key.includes("MENOR") && key.includes("750") && key.endsWith(".XLSX"),
  );

  if (!large || !small) {
    throw new Error("Nao foi possivel localizar os arquivos de exigencias no diretorio informado.");
  }

  return {
    large: path.join(inputDir, large.name),
    small: path.join(inputDir, small.name),
  };
}

function parseSheetRows(filePath, sheetName) {
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[sheetName ?? workbook.SheetNames[workbook.SheetNames.length - 1]];
  if (!sheet) {
    throw new Error(`Aba nao encontrada no arquivo ${filePath}`);
  }

  return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
}

function stripSimPrefix(value) {
  return sanitizeText(value).replace(/^Sim\s*-\s*/i, "").trim();
}

function matchesAnyPrefix(value, prefixes) {
  return prefixes.some((prefix) => value.startsWith(prefix));
}

function stripRedundantDivisionQualifier(note, divisao) {
  const normalizedDivision = normalizeDivisionToken(divisao);
  const normalizedNote = note;

  const matchers = [
    /^para as ocupacoes da divisao\s+([a-z]-?\d+)(?:\s+[a-z]+)?\s*/i,
    /^para ocupacao\s+([a-z]-?\d+)\s*/i,
    /^para edificacoes de divisao\s+([a-z]-?\d+)\s+e\s+([a-z]-?\d+)\s*/i,
  ];

  for (const pattern of matchers) {
    const match = normalizedNote.match(pattern);
    if (!match) {
      continue;
    }

    const referenced = match
      .slice(1)
      .filter(Boolean)
      .map((value) => normalizeDivisionToken(value));

    if (referenced.includes(normalizedDivision)) {
      return normalizedNote.slice(match[0].length).trim();
    }
  }

  return normalizedNote;
}

function parseRiskLevels(note) {
  if (note.includes("risco medio ou alto")) {
    return ["medio", "alto"];
  }

  if (note.includes("risco alto")) {
    return ["alto"];
  }

  return null;
}

function parseConditionalRule(note) {
  const normalized = note;
  const result = {
    areaMin: null,
    areaMax: null,
    alturaRealMin: null,
    alturaRealMax: null,
    areaMaiorPavimentoMin: null,
    areaMaiorPavimentoMax: null,
    areaDepositosMin: null,
    areaDepositosMax: null,
    ocupantesMin: null,
    ocupantesMax: null,
    grausRisco: parseRiskLevels(normalized),
    requerAtrio: null,
    hasResolvedCondition: false,
    requiresManualReview: false,
  };

  const populationPatterns = [
    /populacao acima(?: de)?\s+(\d[\d.]*)/i,
    /edificacoes acima(?: de)?\s+(\d[\d.]*)\s+pessoas/i,
    /com populacao acima(?: de)?\s+(\d[\d.]*)/i,
    /populacao superior a\s+(\d[\d.]*)/i,
  ];

  for (const pattern of populationPatterns) {
    const match = normalized.match(pattern);
    if (match) {
      result.ocupantesMin = Number(match[1].replace(/\./g, "")) + 1;
      result.hasResolvedCondition = true;
      break;
    }
  }

  const areaMinPatterns = [
    /area(?: total construida| do maior pavimento)?(?: acima de| superior a| maior que)\s+(\d[\d.]*)\s*m/i,
    /areas superiores a\s+(\d[\d.]*)\s*m/i,
    /somente para areas superiores a\s+(\d[\d.]*)\s*m/i,
    /quando a edificacao possuir area superior a\s+(\d[\d.]*)\s*m/i,
  ];

  for (const pattern of areaMinPatterns) {
    const match = normalized.match(pattern);
    if (match) {
      result.areaMin = Number(match[1].replace(/\./g, "")) + 0.0001;
      result.hasResolvedCondition = true;
      break;
    }
  }

  const areaFixedPattern = /com area total construida de\s+(\d[\d.]*)\s*m/i;
  const areaFixedMatch = normalized.match(areaFixedPattern);
  if (areaFixedMatch) {
    result.areaMin = Number(areaFixedMatch[1].replace(/\./g, ""));
    result.hasResolvedCondition = true;
  }

  const areaRangePattern = /nao exigido entre\s+(\d[\d.]*)\s*m.*?(\d[\d.]*)\s*m/i;
  const areaRangeMatch = normalized.match(areaRangePattern);
  if (areaRangeMatch) {
    result.areaMin = Number(areaRangeMatch[2].replace(/\./g, "")) + 0.0001;
    result.hasResolvedCondition = true;
  }

  const alturaRealPatterns = [
    /altura(?:[^0-9]{0,40})?(?:acima de|maior que|superior a)\s+(\d[\d.]*)\s*m/i,
    /(?:edificacao|edificacoes)(?:[^0-9]{0,40})?(?:acima de|maior que|superior a)\s+(\d[\d.]*)\s*m(?:\s*de altura)?/i,
    /acima de\s+(\d[\d.]*)\s*m\s*de altura/i,
    /acima de\s+(\d[\d.]*)mde altura/i,
  ];

  for (const pattern of alturaRealPatterns) {
    const match = normalized.match(pattern);
    if (match) {
      result.alturaRealMin = Number(match[1].replace(/\./g, "")) + 0.0001;
      result.hasResolvedCondition = true;
      break;
    }
  }

  const areaMaiorPavimentoPatterns = [
    /area (?:de|do) maior pavimento(?: acima de| superior a| maior que)\s+(\d[\d.]*)\s*m/i,
  ];

  for (const pattern of areaMaiorPavimentoPatterns) {
    const match = normalized.match(pattern);
    if (match) {
      result.areaMaiorPavimentoMin = Number(match[1].replace(/\./g, "")) + 0.0001;
      result.hasResolvedCondition = true;
      break;
    }
  }

  const areaDepositosPatterns = [
    /areas? de depositos?(?: acima de| superiores? a| superior a| maior que)\s+(\d[\d.]*)\s*m/i,
  ];

  for (const pattern of areaDepositosPatterns) {
    const match = normalized.match(pattern);
    if (match) {
      result.areaDepositosMin = Number(match[1].replace(/\./g, "")) + 0.0001;
      result.hasResolvedCondition = true;
      break;
    }
  }

  if (/houver atrios?/i.test(normalized)) {
    result.requerAtrio = true;
    result.hasResolvedCondition = true;
  }

  if (result.grausRisco) {
    result.hasResolvedCondition = true;
  }

  const hasUnresolvedManualCondition =
    MANUAL_KEYWORDS.some((keyword) => normalized.includes(keyword)) ||
    /altura\s+(?:maior|acima|superior)/i.test(normalized) ||
    /se as rotas/i.test(normalized) ||
    /sera exigid[oa] quando/i.test(normalized) ||
    /somente para condominios/i.test(normalized);

  if (hasUnresolvedManualCondition && !result.hasResolvedCondition) {
    result.requiresManualReview = true;
  }

  if (/area (?:de|do) maior pavimento/i.test(normalized)) {
    result.requiresManualReview = !result.areaMaiorPavimentoMin && !result.areaMaiorPavimentoMax;
  }

  if (/areas? de deposito/i.test(normalized)) {
    result.requiresManualReview = result.requiresManualReview || (!result.areaDepositosMin && !result.areaDepositosMax);
  }

  if (/houver atrios?/i.test(normalized) && result.requerAtrio === null) {
    result.requiresManualReview = true;
  }

  return result;
}

function parseRule(rawValue, context) {
  const value = sanitizeText(rawValue);
  if (!value) {
    return null;
  }

  const normalizedRaw = normalizeForMatch(value).toLowerCase();
  const base = {
    status: "required",
    observacao: null,
    valorRaw: value,
    areaMin: context.areaMin,
    areaMax: context.areaMax,
    alturaMin: context.alturaMin,
    alturaMax: context.alturaMax,
    alturaRealMin: null,
    alturaRealMax: null,
    areaMaiorPavimentoMin: null,
    areaMaiorPavimentoMax: null,
    areaDepositosMin: null,
    areaDepositosMax: null,
    ocupantesMin: null,
    ocupantesMax: null,
    grausRisco: null,
    requerAtrio: null,
  };

  if (normalizedRaw === "nao") {
    return { ...base, status: "not_applicable" };
  }

  if (normalizedRaw === "sim") {
    return base;
  }

  const hasSimPrefix = /^sim\s*-/i.test(value);
  const noteOriginal = hasSimPrefix ? stripSimPrefix(value) : value;
  let noteNormalized = normalizeForMatch(noteOriginal).toLowerCase();
  noteNormalized = stripRedundantDivisionQualifier(noteNormalized, context.divisao);

  if (noteNormalized.includes("divisao") && noteNormalized.includes("alem da sinalizacao basica")) {
    return {
      ...base,
      status: "required",
      observacao: noteOriginal,
    };
  }

  if (matchesAnyPrefix(noteNormalized, SUPPLEMENTAL_PREFIXES)) {
    return {
      ...base,
      status: "required",
      observacao: noteOriginal,
    };
  }

  const conditional = parseConditionalRule(noteNormalized);
  const looksConditional =
    !hasSimPrefix ||
    /^(para|quando|sera exigid[oa] quando|se |somente para|nao exigido entre|acima de|com populacao acima de)/i.test(noteNormalized) ||
    conditional.hasResolvedCondition;

  if (conditional.requiresManualReview) {
    return {
      ...base,
      status: "manual_review",
      observacao: noteOriginal,
      areaMin: conditional.areaMin ?? base.areaMin,
      areaMax: conditional.areaMax ?? base.areaMax,
      alturaRealMin: conditional.alturaRealMin,
      alturaRealMax: conditional.alturaRealMax,
      areaMaiorPavimentoMin: conditional.areaMaiorPavimentoMin,
      areaMaiorPavimentoMax: conditional.areaMaiorPavimentoMax,
      areaDepositosMin: conditional.areaDepositosMin,
      areaDepositosMax: conditional.areaDepositosMax,
      ocupantesMin: conditional.ocupantesMin,
      ocupantesMax: conditional.ocupantesMax,
      grausRisco: conditional.grausRisco,
      requerAtrio: conditional.requerAtrio,
    };
  }

  if (looksConditional && conditional.hasResolvedCondition) {
    return {
      ...base,
      status: "conditional",
      observacao: noteOriginal,
      areaMin: conditional.areaMin ?? base.areaMin,
      areaMax: conditional.areaMax ?? base.areaMax,
      alturaRealMin: conditional.alturaRealMin,
      alturaRealMax: conditional.alturaRealMax,
      areaMaiorPavimentoMin: conditional.areaMaiorPavimentoMin,
      areaMaiorPavimentoMax: conditional.areaMaiorPavimentoMax,
      areaDepositosMin: conditional.areaDepositosMin,
      areaDepositosMax: conditional.areaDepositosMax,
      ocupantesMin: conditional.ocupantesMin,
      ocupantesMax: conditional.ocupantesMax,
      grausRisco: conditional.grausRisco,
      requerAtrio: conditional.requerAtrio,
    };
  }

  if (looksConditional && !hasSimPrefix) {
    return {
      ...base,
      status: "manual_review",
      observacao: noteOriginal,
    };
  }

  return {
    ...base,
    status: "required",
    observacao: noteOriginal,
  };
}

function createCriterionRow(seedPrefix, context, rule, requirementCode) {
  return {
    id: deterministicUuid(`${seedPrefix}|${context.cenario}|${context.divisao}|${context.alturaTipo ?? "SEM_ALTURA"}|${requirementCode}|${context.sourceRow}`),
    exigenciaCode: requirementCode,
    divisao: context.divisao,
    areaMin: rule.areaMin,
    areaMax: rule.areaMax,
    alturaMin: rule.alturaMin,
    alturaMax: rule.alturaMax,
    alturaRealMin: rule.alturaRealMin,
    alturaRealMax: rule.alturaRealMax,
    alturaTipo: context.alturaTipo,
    alturaDenominacao: context.alturaDenominacao,
    descricaoEdificacao: context.descricaoEdificacao,
    observacao: rule.observacao,
    valorRaw: rule.valorRaw,
    cenario: context.cenario,
    status: rule.status,
    areaMaiorPavimentoMin: rule.areaMaiorPavimentoMin,
    areaMaiorPavimentoMax: rule.areaMaiorPavimentoMax,
    areaDepositosMin: rule.areaDepositosMin,
    areaDepositosMax: rule.areaDepositosMax,
    ocupantesMin: rule.ocupantesMin,
    ocupantesMax: rule.ocupantesMax,
    grausRisco: rule.grausRisco,
    requerAtrio: rule.requerAtrio,
    fonteArquivo: context.sourceFile,
    fonteLinha: context.sourceRow,
  };
}

function parseLargeCriteria(filePath) {
  const rows = parseSheetRows(filePath, "EXIGÊNCIAS DAS MEDIDAS");
  const criteria = [];

  for (let rowIndex = 2; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    const divisao = normalizeDivisao(row[0]);
    const descricaoEdificacao = sanitizeText(row[1]);
    const alturaLabel = sanitizeText(row[2]);

    if (!divisao || !alturaLabel) {
      continue;
    }

    const height = HEIGHT_MAP.get(normalizeForMatch(alturaLabel));
    if (!height) {
      throw new Error(`Altura nao mapeada no arquivo maior: ${alturaLabel}`);
    }

    const context = {
      divisao,
      descricaoEdificacao,
      areaMin: null,
      areaMax: null,
      alturaMin: height.alturaMin,
      alturaMax: height.alturaMax,
      alturaTipo: height.tipo,
      alturaDenominacao: height.denominacao,
      cenario: "matriz_por_altura",
      sourceFile: path.basename(filePath),
      sourceRow: rowIndex + 1,
    };

    for (let columnIndex = 3; columnIndex < 25; columnIndex += 1) {
      const code = REQUIREMENT_CODES[columnIndex - 3];
      const rule = parseRule(row[columnIndex], context);
      if (!rule) {
        continue;
      }

      criteria.push(createCriterionRow("large", context, rule, code));
    }
  }

  return criteria;
}

function parseSmallCriteria(filePath) {
  const rows = parseSheetRows(filePath);
  const criteria = [];

  for (let rowIndex = 2; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    const divisao = normalizeDivisao(row[0]);
    const descricaoEdificacao = sanitizeText(row[1]);

    if (!divisao) {
      continue;
    }

    const context = {
      divisao,
      descricaoEdificacao,
      areaMin: null,
      areaMax: 750,
      alturaMin: null,
      alturaMax: 12,
      alturaTipo: null,
      alturaDenominacao: "Edificacao ate 12m",
      cenario: "ate_750_ate_12",
      sourceFile: path.basename(filePath),
      sourceRow: rowIndex + 1,
    };

    for (let columnIndex = 2; columnIndex < 24; columnIndex += 1) {
      const code = REQUIREMENT_CODES[columnIndex - 2];
      const rule = parseRule(row[columnIndex], context);
      if (!rule) {
        continue;
      }

      criteria.push(createCriterionRow("small", context, rule, code));
    }
  }

  return criteria;
}

function buildSql(criteria) {
  const lines = [];
  lines.push("-- Generated by scripts/import-exigencias-from-xlsx.mjs");
  lines.push("DELETE FROM public.exigencias_criterios;");
  lines.push("");

  const valueRows = criteria.map((criterion) => `(
  ${sqlLiteral(criterion.id)},
  (SELECT id FROM public.exigencias_seguranca WHERE codigo = ${sqlLiteral(criterion.exigenciaCode)}),
  ${sqlNullable(criterion.divisao)},
  ${sqlNullable(criterion.areaMin)},
  ${sqlNullable(criterion.areaMax)},
  ${sqlNullable(criterion.alturaMin)},
  ${sqlNullable(criterion.alturaMax)},
  ${sqlNullable(criterion.alturaRealMin)},
  ${sqlNullable(criterion.alturaRealMax)},
  ${sqlNullable(criterion.alturaTipo)},
  ${sqlNullable(criterion.observacao)},
  now(),
  ${sqlNullable(criterion.cenario)},
  ${sqlNullable(criterion.status)},
  ${sqlNullable(criterion.valorRaw)},
  ${sqlNullable(criterion.alturaDenominacao)},
  ${sqlNullable(criterion.descricaoEdificacao)},
  ${sqlNullable(criterion.areaMaiorPavimentoMin)},
  ${sqlNullable(criterion.areaMaiorPavimentoMax)},
  ${sqlNullable(criterion.areaDepositosMin)},
  ${sqlNullable(criterion.areaDepositosMax)},
  ${sqlNullable(criterion.ocupantesMin)},
  ${sqlNullable(criterion.ocupantesMax)},
  ${sqlNullable(criterion.grausRisco)},
  ${criterion.requerAtrio === null ? "NULL" : criterion.requerAtrio ? "TRUE" : "FALSE"},
  ${sqlNullable(criterion.fonteArquivo)},
  ${sqlNullable(criterion.fonteLinha)}
)`);

  for (const group of chunk(valueRows, 200)) {
    lines.push(`INSERT INTO public.exigencias_criterios (
  id,
  exigencia_id,
  divisao,
  area_min,
  area_max,
  altura_min,
  altura_max,
  altura_real_min,
  altura_real_max,
  altura_tipo,
  observacao,
  created_at,
  cenario,
  status_aplicabilidade,
  valor_raw,
  altura_denominacao,
  descricao_edificacao,
  area_maior_pavimento_min,
  area_maior_pavimento_max,
  area_depositos_min,
  area_depositos_max,
  ocupantes_min,
  ocupantes_max,
  graus_risco,
  requer_atrio,
  fonte_arquivo,
  fonte_linha
) VALUES`);
    lines.push(group.join(",\n"));
    lines.push(";");
    lines.push("");
  }

  lines.push("SELECT public.sync_empresa_exigencias(id) FROM public.empresa;");
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function logSummary(criteria) {
  const byScenario = new Map();
  const byStatus = new Map();
  const manualSamples = new Set();

  for (const criterion of criteria) {
    byScenario.set(criterion.cenario, (byScenario.get(criterion.cenario) || 0) + 1);
    byStatus.set(criterion.status, (byStatus.get(criterion.status) || 0) + 1);
    if (criterion.status === "manual_review" && manualSamples.size < 20) {
      manualSamples.add(criterion.valorRaw);
    }
  }

  console.log(`Total criteria: ${criteria.length}`);
  console.log("By scenario:", Object.fromEntries(byScenario));
  console.log("By status:", Object.fromEntries(byStatus));
  if (manualSamples.size > 0) {
    console.log("Manual review samples:");
    for (const sample of manualSamples) {
      console.log(`- ${sample}`);
    }
  }
}

function main() {
  const args = parseArgs(process.argv);
  const files = findInputFiles(args.inputDir);
  const criteria = [...parseLargeCriteria(files.large), ...parseSmallCriteria(files.small)];
  const sql = buildSql(criteria);

  fs.mkdirSync(path.dirname(args.output), { recursive: true });
  fs.writeFileSync(args.output, sql, "utf8");

  logSummary(criteria);
  console.log(`SQL written to ${args.output}`);
}

main();
