export interface LegacyChecklistItemShape {
  id: string;
  inspecao_id: string;
  item_numero: string;
  descricao: string;
  ordem: number;
}

export type LegacyChecklistTableRow =
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

const normalizeText = (value: string) => value.replace(/\s+/g, " ").trim();

const splitChecklistDescription = (descricao: string) => {
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

const buildParentItemNumbers = (items: LegacyChecklistItemShape[]) => {
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

export const buildLegacyChecklistRows = (
  itemsByInspection: Map<string, LegacyChecklistItemShape[]>,
) => {
  const rowsByInspection = new Map<string, LegacyChecklistTableRow[]>();

  itemsByInspection.forEach((items, inspectionId) => {
    const parentNumbers = buildParentItemNumbers(items);
    const rows: LegacyChecklistTableRow[] = [];
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
        key: `legacy-section-${inspectionId}-${baseKey}-${sectionCounter}`,
        title: cleanTitle,
      });
    };

    const pushItem = (item: LegacyChecklistItemShape, description: string) => {
      if (!hasSection) {
        pushSection("Itens para avaliacao", item.id);
      }

      sectionItemCounter += 1;
      rows.push({
        type: "item",
        key: `legacy-item-${item.id}`,
        itemId: item.id,
        number: String(sectionItemCounter),
        sourceItemNumber: item.item_numero.trim(),
        description,
      });
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

  return { rowsByInspection };
};
