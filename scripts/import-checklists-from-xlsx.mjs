import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import XLSX from "xlsx";

const DEFAULT_OUTPUT = path.resolve(
  process.cwd(),
  "supabase/migrations/20260308110000_a9c1b4f0-cc6f-4f4e-a750-import_checklists_from_excel.sql",
);

const MODEL_METADATA = [
  {
    code: "A.4",
    name: "Acesso de Viaturas",
    title: "CHECKLIST DE ACESSO DE VIATURAS",
  },
  {
    code: "A.7",
    name: "Compartimentacao Horizontal",
    title: "CHECKLIST DE COMPARTIMENTACAO HORIZONTAL",
  },
  {
    code: "A.9",
    name: "Compartimentacao Vertical",
    title: "CHECKLIST DE COMPARTIMENTACAO VERTICAL",
  },
  {
    code: "A.11",
    name: "Saida de Emergencia - ENE",
    title: "CHECKLIST DE SAIDA DE EMERGENCIA - ESCADA NAO ENCLAUSURADA (ENE)",
  },
  {
    code: "A.13",
    name: "Escada Enclausurada Protegida",
    title: "CHECKLIST DE ESCADA ENCLAUSURADA PROTEGIDA (EEP)",
  },
  {
    code: "A.15",
    name: "Escada a Prova de Fumaca",
    title: "CHECKLIST ESCADA A PROVA DE FUMACA (EPF - DUTOS)",
  },
  {
    code: "A.17",
    name: "Escada Pressurizada",
    title: "CHECKLIST DE ESCADA ENCLAUSURADA A PROVA DE FUMACA PRESSURIZADA (EEPFP)",
  },
  {
    code: "A.19",
    name: "Iluminacao de Emergencia",
    title: "CHECKLIST DE ILUMINACAO DE EMERGENCIA (IE)",
  },
  {
    code: "A.21",
    name: "Sinalizacao de Emergencia",
    title: "CHECKLIST DE SINALIZACAO DE EMERGENCIA (SE)",
  },
  {
    code: "A.23",
    name: "Extintores",
    title: "CHECKLIST DE EXTINTORES",
  },
  {
    code: "A.25",
    name: "Sistema de Hidrantes e Mangotinhos",
    title: "CHECKLIST DO SISTEMA DE HIDRANTES E MANGOTINHOS",
  },
  {
    code: "A.27",
    name: "Sistema de Chuveiros Automaticos",
    title: "CHECKLIST DO SISTEMA DE CHUVEIROS AUTOMATICOS (SPRINKLERS)",
  },
  {
    code: "A.29",
    name: "Sistema de Alarme de Incendio",
    title: "CHECKLIST DO SISTEMA DE ALARME DE INCENDIO",
  },
  {
    code: "A.31",
    name: "Sistema de Deteccao e Alarme de Incendio",
    title: "CHECKLIST DO SISTEMA DE DETECCAO E ALARME DE INCENDIO",
  },
  {
    code: "A.33",
    name: "Central e Rede de Distribuicao Interna de Gas LP/GN",
    title: "CHECKLIST DE CENTRAL E REDE DE DISTRIBUICAO INTERNA DE GAS LP/GN",
  },
  {
    code: "A.35",
    name: "SPDA",
    title: "CHECKLIST DO SISTEMA DE PROTECAO CONTRA DESCARGAS ATMOSFERICAS (SPDA)",
  },
  {
    code: "A.37",
    name: "CMAR",
    title: "CHECKLIST DO CMAR",
  },
];

const ACTIONABLE_PREFIXES = [
  "verificar",
  "testar",
  "selecionar",
  "inspecionar",
  "confirmar",
  "avaliar",
  "realizar",
  "solicitar",
  "recolher",
  "cumprir",
  "acionar",
  "conferir",
  "localizar",
  "simular",
  "exigir",
];

const ACTIONABLE_REGEX = new RegExp(
  `^(?:possibilidade\\s+\\d+\\s*:\\s*)?(?:${ACTIONABLE_PREFIXES.join("|")})\\b`,
  "i",
);

const sanitizeText = (value) =>
  String(value)
    .replace(/\u00a0/g, " ")
    .replace(/[“”]/g, '"')
    .replace(/[‘’´`]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/≤/g, "<=")
    .replace(/≥/g, ">=")
    .replace(/²/g, "2")
    .replace(/º/g, "o")
    .replace(/ª/g, "a")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const normalizeWhitespace = (value) => sanitizeText(value);
const normalizeTitleKey = (value) =>
  normalizeWhitespace(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();

const sqlLiteral = (value) => `'${String(value).replace(/'/g, "''")}'`;
const sqlNullable = (value) =>
  value === null || value === undefined || value === ""
    ? "NULL"
    : typeof value === "number"
      ? String(value)
      : sqlLiteral(value);
const chunk = (values, size) => {
  const groups = [];
  for (let index = 0; index < values.length; index += size) {
    groups.push(values.slice(index, index + size));
  }
  return groups;
};

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

function parseArgs(argv) {
  const args = { input: "", output: DEFAULT_OUTPUT };

  for (let index = 2; index < argv.length; index += 1) {
    const current = argv[index];
    const next = argv[index + 1];

    if (current === "--input" && next) {
      args.input = next;
      index += 1;
      continue;
    }

    if (current === "--output" && next) {
      args.output = path.resolve(process.cwd(), next);
      index += 1;
      continue;
    }

    if (!current.startsWith("--") && !args.input) {
      args.input = current;
    }
  }

  if (!args.input) {
    throw new Error("Informe o caminho do arquivo XLSX usando --input ou como primeiro argumento.");
  }

  args.input = path.resolve(process.cwd(), args.input);
  return args;
}

function extractRows(sheet) {
  const rowMap = new Map();
  let maxRow = 0;

  for (const cellAddress of Object.keys(sheet)) {
    if (cellAddress.startsWith("!")) {
      continue;
    }

    const decoded = XLSX.utils.decode_cell(cellAddress);
    const rowNumber = decoded.r + 1;
    const column = XLSX.utils.encode_col(decoded.c);
    const rawValue = sheet[cellAddress].w ?? sheet[cellAddress].v ?? "";
    const value = normalizeWhitespace(rawValue);

    if (!rowMap.has(rowNumber)) {
      rowMap.set(rowNumber, { row: rowNumber, A: "", B: "", C: "", D: "", E: "", F: "" });
    }

    if (["A", "B", "C", "D", "E", "F"].includes(column)) {
      rowMap.get(rowNumber)[column] = value;
    }

    maxRow = Math.max(maxRow, rowNumber);
  }

  const rows = [];
  for (let rowNumber = 1; rowNumber <= maxRow; rowNumber += 1) {
    rows.push(rowMap.get(rowNumber) || { row: rowNumber, A: "", B: "", C: "", D: "", E: "", F: "" });
  }

  return rows;
}

function buildMergedStatusContinuationRows(sheet) {
  const mergedRows = new Set();
  const merges = sheet["!merges"] || [];

  for (const merge of merges) {
    const startColumn = XLSX.utils.encode_col(merge.s.c);
    const endColumn = XLSX.utils.encode_col(merge.e.c);
    const startRow = merge.s.r + 1;
    const endRow = merge.e.r + 1;

    if (!["C", "D", "E"].includes(startColumn) || !["C", "D", "E"].includes(endColumn)) {
      continue;
    }

    for (let rowNumber = startRow + 1; rowNumber <= endRow; rowNumber += 1) {
      mergedRows.add(rowNumber);
    }
  }

  return mergedRows;
}

function isBlankRow(row) {
  return !row.A && !row.B && !row.C && !row.D && !row.E && !row.F;
}

function isTitleRow(row) {
  return row.A.startsWith("CHECKLIST");
}

function isSectionHeader(row) {
  const hasStatusColumns = row.C === "C" && row.D === "NC" && row.E === "NA";
  if (hasStatusColumns && (row.A === "Item" || row.A === "")) {
    return true;
  }

  return row.A === "Item" && row.B === "Outros";
}

function isNumberToken(value) {
  return /^\d+(?:\.\d+)?$/.test(value);
}

function isActionableText(value) {
  return ACTIONABLE_REGEX.test(value);
}

function isNoteText(value) {
  return /^nota\s*:/.test(value.toLowerCase());
}

function findModelMetadata(title) {
  const normalizedTitle = normalizeTitleKey(title);
  const metadata = MODEL_METADATA.find((item) => normalizedTitle.includes(item.title));

  if (!metadata) {
    throw new Error(`Nao foi possivel mapear o checklist "${title}" para um codigo conhecido.`);
  }

  return metadata;
}

function appendComplement(item, text) {
  const normalized = normalizeWhitespace(text);
  if (!normalized) {
    return;
  }

  item.complemento = item.complemento
    ? `${item.complemento}\n\n${normalized}`
    : normalized;
}

function parseWorkbook(sheet) {
  const rows = extractRows(sheet);
  const continuationRows = buildMergedStatusContinuationRows(sheet);
  const models = [];
  let currentModel = null;
  let currentGroup = null;

  for (const row of rows) {
    if (isBlankRow(row)) {
      continue;
    }

    if (isTitleRow(row)) {
      const metadata = findModelMetadata(row.A);
      currentModel = {
        id: deterministicUuid(`model:${metadata.code}`),
        code: metadata.code,
        name: metadata.name,
        title: row.A,
        type: "renovacao",
        order: models.length + 1,
        totalGroups: row.F ? Number.parseInt(row.F.replace(/\D/g, ""), 10) || null : null,
        groups: [],
      };
      models.push(currentModel);
      currentGroup = null;
      continue;
    }

    if (!currentModel) {
      continue;
    }

    if (isSectionHeader(row)) {
      currentGroup = {
        id: deterministicUuid(`group:${currentModel.code}:${currentModel.groups.length + 1}`),
        title: row.B || "Grupo sem titulo",
        type: normalizeTitleKey(row.B) === "OUTROS" ? "outros" : "grupo",
        order: currentModel.groups.length + 1,
        items: [],
      };
      currentModel.groups.push(currentGroup);
      continue;
    }

    if (!currentGroup) {
      throw new Error(`Linha ${row.row} fora de qualquer grupo em ${currentModel.title}.`);
    }

    const numberToken = row.A;
    const text = row.B;
    const previousItem = currentGroup.items[currentGroup.items.length - 1] || null;

    if (!text && isNumberToken(numberToken)) {
      continue;
    }

    if (continuationRows.has(row.row) || isNoteText(text)) {
      if (previousItem) {
        appendComplement(previousItem, text);
      } else if (text) {
        currentGroup.items.push({
          id: deterministicUuid(`item:${currentModel.code}:${currentGroup.order}:${currentGroup.items.length + 1}`),
          originalNumber: null,
          description: text,
          complement: null,
          kind: "informativo",
          evaluable: false,
          order: currentGroup.items.length + 1,
        });
      }
      continue;
    }

    if (!text) {
      continue;
    }

    const evaluable = isNumberToken(numberToken) ? true : isActionableText(text);
    currentGroup.items.push({
      id: deterministicUuid(`item:${currentModel.code}:${currentGroup.order}:${currentGroup.items.length + 1}`),
      originalNumber: isNumberToken(numberToken) ? numberToken : null,
      description: text,
      complement: null,
      kind: evaluable ? "item" : "informativo",
      evaluable,
      order: currentGroup.items.length + 1,
    });
  }

  return models;
}

function buildSql(models, inputPath) {
  const modelRows = [];
  const groupRows = [];
  const itemRows = [];

  for (const model of models) {
    modelRows.push(model);
    for (const group of model.groups) {
      groupRows.push({
        id: group.id,
        modelId: model.id,
        title: group.title,
        type: group.type,
        order: group.order,
      });

      for (const item of group.items) {
        itemRows.push({
          id: item.id,
          groupId: group.id,
          originalNumber: item.originalNumber,
          description: item.description,
          complement: item.complement,
          kind: item.kind,
          evaluable: item.evaluable,
          order: item.order,
        });
      }
    }
  }

  const lines = [];
  lines.push(`-- Generated from ${path.basename(inputPath)} on ${new Date().toISOString()}`);
  lines.push("BEGIN;");
  lines.push("");

  for (const ids of chunk(itemRows.map((item) => item.id), 200)) {
    lines.push(
      `DELETE FROM public.empresa_checklist_respostas WHERE checklist_item_id IN (${ids
        .map(sqlLiteral)
        .join(", ")});`,
    );
  }

  for (const ids of chunk(itemRows.map((item) => item.id), 200)) {
    lines.push(
      `DELETE FROM public.checklist_itens_modelo WHERE id IN (${ids.map(sqlLiteral).join(", ")});`,
    );
  }

  for (const ids of chunk(groupRows.map((group) => group.id), 200)) {
    lines.push(
      `DELETE FROM public.checklist_grupos WHERE id IN (${ids.map(sqlLiteral).join(", ")});`,
    );
  }

  lines.push(
    `DELETE FROM public.checklist_modelos WHERE id IN (${modelRows
      .map((model) => sqlLiteral(model.id))
      .join(", ")});`,
  );
  lines.push("");

  lines.push("INSERT INTO public.checklist_modelos (id, codigo, nome, titulo, tipo, ordem, total_grupos, ativo)");
  lines.push("VALUES");
  lines.push(
    modelRows
      .map(
        (model) =>
          `  (${sqlLiteral(model.id)}, ${sqlLiteral(model.code)}, ${sqlLiteral(model.name)}, ${sqlLiteral(
            model.title,
          )}, ${sqlLiteral(model.type)}, ${model.order}, ${sqlNullable(model.totalGroups)}, true)`,
      )
      .join(",\n"),
  );
  lines.push("ON CONFLICT (id) DO UPDATE SET");
  lines.push("  codigo = EXCLUDED.codigo,");
  lines.push("  nome = EXCLUDED.nome,");
  lines.push("  titulo = EXCLUDED.titulo,");
  lines.push("  tipo = EXCLUDED.tipo,");
  lines.push("  ordem = EXCLUDED.ordem,");
  lines.push("  total_grupos = EXCLUDED.total_grupos,");
  lines.push("  ativo = EXCLUDED.ativo;");
  lines.push("");

  lines.push("INSERT INTO public.checklist_grupos (id, modelo_id, titulo, tipo, ordem)");
  lines.push("VALUES");
  lines.push(
    groupRows
      .map(
        (group) =>
          `  (${sqlLiteral(group.id)}, ${sqlLiteral(group.modelId)}, ${sqlLiteral(group.title)}, ${sqlLiteral(
            group.type,
          )}, ${group.order})`,
      )
      .join(",\n"),
  );
  lines.push("ON CONFLICT (id) DO UPDATE SET");
  lines.push("  modelo_id = EXCLUDED.modelo_id,");
  lines.push("  titulo = EXCLUDED.titulo,");
  lines.push("  tipo = EXCLUDED.tipo,");
  lines.push("  ordem = EXCLUDED.ordem;");
  lines.push("");

  lines.push(
    "INSERT INTO public.checklist_itens_modelo (id, grupo_id, numero_original, descricao, complemento, tipo, avaliavel, ordem)",
  );
  lines.push("VALUES");
  lines.push(
    itemRows
      .map(
        (item) =>
          `  (${sqlLiteral(item.id)}, ${sqlLiteral(item.groupId)}, ${sqlNullable(item.originalNumber)}, ${sqlLiteral(
            item.description,
          )}, ${sqlNullable(item.complement)}, ${sqlLiteral(item.kind)}, ${item.evaluable ? "true" : "false"}, ${item.order})`,
      )
      .join(",\n"),
  );
  lines.push("ON CONFLICT (id) DO UPDATE SET");
  lines.push("  grupo_id = EXCLUDED.grupo_id,");
  lines.push("  numero_original = EXCLUDED.numero_original,");
  lines.push("  descricao = EXCLUDED.descricao,");
  lines.push("  complemento = EXCLUDED.complemento,");
  lines.push("  tipo = EXCLUDED.tipo,");
  lines.push("  avaliavel = EXCLUDED.avaliavel,");
  lines.push("  ordem = EXCLUDED.ordem;");
  lines.push("");
  lines.push("COMMIT;");

  return `${lines.join("\n")}\n`;
}

function main() {
  const { input, output } = parseArgs(process.argv);
  const workbook = XLSX.readFile(input, { cellFormula: false, cellHTML: false, cellNF: false });
  const sheetName = workbook.SheetNames[0];

  if (!sheetName) {
    throw new Error("O arquivo informado nao possui abas.");
  }

  const models = parseWorkbook(workbook.Sheets[sheetName]);
  const sql = buildSql(models, input);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, sql, "utf8");

  const totalGroups = models.reduce((sum, model) => sum + model.groups.length, 0);
  const totalItems = models.reduce(
    (sum, model) =>
      sum +
      model.groups.reduce((groupSum, group) => groupSum + group.items.length, 0),
    0,
  );
  const evaluableItems = models.reduce(
    (sum, model) =>
      sum +
      model.groups.reduce(
        (groupSum, group) => groupSum + group.items.filter((item) => item.evaluable).length,
        0,
      ),
    0,
  );

  console.log(`Arquivo analisado: ${input}`);
  console.log(`SQL gerado em: ${output}`);
  console.log(`Checklists: ${models.length}`);
  console.log(`Grupos: ${totalGroups}`);
  console.log(`Itens totais: ${totalItems}`);
  console.log(`Itens avaliaveis: ${evaluableItems}`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
