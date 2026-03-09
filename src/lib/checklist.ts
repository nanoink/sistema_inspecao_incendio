export interface ChecklistItemShape {
  id: string;
  inspecao_id: string;
  item_numero: string;
  descricao: string;
  ordem: number;
}

export interface InspectionShape {
  id: string;
  codigo: string;
  nome: string;
  ordem?: number;
}

export interface ChecklistResponseShape {
  checklist_item_id: string;
  status: string;
  observacoes: string | null;
}

export type ChecklistTableRow =
  | {
      type: "section";
      key: string;
      title: string;
    }
  | {
      type: "item";
      key: string;
      itemId: string;
      number: string;
      sourceItemNumber: string;
      description: string;
    };

export type ChecklistSnapshotStatus = "C" | "NC" | "NA" | "P";

export interface ChecklistSnapshotItem {
  checklist_item_id: string;
  item_numero: string;
  item_exibicao: string;
  secao: string;
  descricao: string;
  status: ChecklistSnapshotStatus;
  observacoes: string | null;
}

export interface ChecklistSnapshotInspection {
  inspecao_id: string;
  codigo: string;
  nome: string;
  total: number;
  conforme: number;
  nao_conforme: number;
  nao_aplicavel: number;
  pendentes: number;
  itens: ChecklistSnapshotItem[];
}

export interface ChecklistSnapshot {
  generated_at: string;
  overall: {
    total: number;
    conforme: number;
    nao_conforme: number;
    nao_aplicavel: number;
    pendentes: number;
  };
  inspections: ChecklistSnapshotInspection[];
  non_conformities: ChecklistSnapshotItem[];
}

const ACTIONABLE_PREFIXES = [
  "verificar",
  "testar",
  "selecionar",
  "inspecionar",
  "confirmar",
  "avaliar",
];

const ACTIONABLE_REGEX = new RegExp(
  `\\b(?:${ACTIONABLE_PREFIXES.join("|")})\\b`,
  "i",
);

export const normalizeText = (value: string) => value.replace(/\s+/g, " ").trim();

export const splitChecklistDescription = (descricao: string) => {
  const normalized = normalizeText(descricao);
  const match = ACTIONABLE_REGEX.exec(normalized);
  if (!match || match.index === undefined) {
    return {
      heading: normalized,
      actionable: null as string | null,
    };
  }

  const actionable = normalized.slice(match.index).trim();
  const heading = normalized
    .slice(0, match.index)
    .replace(/[-:]\s*$/, "")
    .trim();

  return {
    heading: heading || null,
    actionable,
  };
};

export const buildParentItemNumbers = (items: ChecklistItemShape[]) => {
  const parents = new Set<string>();

  items.forEach((item) => {
    const parts = item.item_numero.trim().split(".");
    if (parts.length <= 1) {
      return;
    }

    for (let depth = 1; depth < parts.length; depth += 1) {
      parents.add(parts.slice(0, depth).join("."));
    }
  });

  return parents;
};

export const buildChecklistTableRows = (
  itemsByInspection: Map<string, ChecklistItemShape[]>,
) => {
  const rowsByInspection = new Map<string, ChecklistTableRow[]>();
  const evaluableIds = new Set<string>();

  itemsByInspection.forEach((items, inspectionId) => {
    const parentNumbers = buildParentItemNumbers(items);
    const rows: ChecklistTableRow[] = [];
    let sectionCounter = 0;
    let sectionItemCounter = 0;
    let hasSection = false;

    const pushSection = (title: string, baseKey: string) => {
      const cleanTitle = normalizeText(title).replace(/[-:]\s*$/, "").trim();
      if (!cleanTitle) {
        return;
      }

      sectionCounter += 1;
      sectionItemCounter = 0;
      hasSection = true;
      rows.push({
        type: "section",
        key: `section-${inspectionId}-${baseKey}-${sectionCounter}`,
        title: cleanTitle,
      });
    };

    const pushItem = (item: ChecklistItemShape, description: string) => {
      if (!hasSection) {
        pushSection("Itens para avaliacao", item.id);
      }

      sectionItemCounter += 1;
      rows.push({
        type: "item",
        key: `item-${item.id}`,
        itemId: item.id,
        number: String(sectionItemCounter),
        sourceItemNumber: item.item_numero.trim(),
        description,
      });
      evaluableIds.add(item.id);
    };

    items.forEach((item) => {
      const itemNumber = item.item_numero.trim();
      const isParent = parentNumbers.has(itemNumber);
      const normalizedDescription = normalizeText(item.descricao);
      const { heading, actionable } = splitChecklistDescription(normalizedDescription);

      if (isParent) {
        pushSection(heading || normalizedDescription, item.id);
        return;
      }

      if (!actionable) {
        pushSection(normalizedDescription, item.id);
        return;
      }

      if (heading) {
        pushSection(heading, item.id);
      }

      pushItem(item, actionable);
    });

    rowsByInspection.set(inspectionId, rows);
  });

  return { rowsByInspection, evaluableIds };
};

const normalizeSnapshotStatus = (status: string | null | undefined): ChecklistSnapshotStatus => {
  if (status === "C" || status === "NC" || status === "NA") {
    return status;
  }

  return "P";
};

export const buildChecklistSnapshot = (
  inspections: InspectionShape[],
  itemsByInspection: Map<string, ChecklistItemShape[]>,
  responses: Map<string, ChecklistResponseShape>,
): ChecklistSnapshot => {
  const { rowsByInspection } = buildChecklistTableRows(itemsByInspection);
  const sortedInspections = [...inspections].sort(
    (a, b) => (a.ordem ?? 0) - (b.ordem ?? 0),
  );

  const overall = {
    total: 0,
    conforme: 0,
    nao_conforme: 0,
    nao_aplicavel: 0,
    pendentes: 0,
  };

  const nonConformities: ChecklistSnapshotItem[] = [];

  const inspectionSnapshots = sortedInspections.map((inspection) => {
    const rows = rowsByInspection.get(inspection.id) || [];
    const items: ChecklistSnapshotItem[] = [];
    let currentSection = "";

    rows.forEach((row) => {
      if (row.type === "section") {
        currentSection = row.title;
        return;
      }

      const response = responses.get(row.itemId);
      const status = normalizeSnapshotStatus(response?.status);
      const itemSnapshot: ChecklistSnapshotItem = {
        checklist_item_id: row.itemId,
        item_numero: row.sourceItemNumber,
        item_exibicao: row.number,
        secao: currentSection,
        descricao: row.description,
        status,
        observacoes: response?.observacoes || null,
      };

      items.push(itemSnapshot);

      if (status === "NC") {
        nonConformities.push(itemSnapshot);
      }
    });

    const summary = {
      inspecao_id: inspection.id,
      codigo: inspection.codigo,
      nome: inspection.nome,
      total: items.length,
      conforme: items.filter((item) => item.status === "C").length,
      nao_conforme: items.filter((item) => item.status === "NC").length,
      nao_aplicavel: items.filter((item) => item.status === "NA").length,
      pendentes: items.filter((item) => item.status === "P").length,
      itens: items,
    };

    overall.total += summary.total;
    overall.conforme += summary.conforme;
    overall.nao_conforme += summary.nao_conforme;
    overall.nao_aplicavel += summary.nao_aplicavel;
    overall.pendentes += summary.pendentes;

    return summary;
  });

  return {
    generated_at: new Date().toISOString(),
    overall,
    inspections: inspectionSnapshots,
    non_conformities: nonConformities,
  };
};
