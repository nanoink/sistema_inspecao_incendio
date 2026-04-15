export interface ChecklistModelShape {
  id: string;
  codigo: string;
  nome: string;
  tipo?: string;
  ordem?: number;
  titulo?: string | null;
}

export interface ChecklistGroupShape {
  id: string;
  modelId: string;
  title: string;
  type: "grupo" | "outros";
  order: number;
}

export interface ChecklistItemShape {
  id: string;
  groupId: string;
  originalNumber: string | null;
  description: string;
  complement: string | null;
  kind: "item" | "informativo";
  evaluable: boolean;
  order: number;
}

export interface ChecklistGroupWithItems extends ChecklistGroupShape {
  items: ChecklistItemShape[];
}

export interface ChecklistResponseShape {
  checklist_item_id: string;
  status: string;
  observacoes: string | null;
  preenchido_por_nome?: string | null;
  preenchido_por_user_id?: string | null;
  preenchido_em?: string | null;
}

export type ChecklistTableRow =
  | {
      type: "section";
      key: string;
      title: string;
      sectionType: ChecklistGroupShape["type"];
    }
  | {
      type: "info";
      key: string;
      description: string;
      complement: string | null;
    }
  | {
      type: "item";
      key: string;
      itemId: string;
      number: string;
      sourceItemNumber: string | null;
      description: string;
      complement: string | null;
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
  preenchido_por_nome?: string | null;
  preenchido_por_user_id?: string | null;
  preenchido_em?: string | null;
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

export interface ChecklistResponseAuditShape {
  preenchido_por_nome?: string | null;
  preenchido_por_user_id?: string | null;
  preenchido_em?: string | null;
}

const normalizeSnapshotStatus = (
  status: string | null | undefined,
): ChecklistSnapshotStatus => {
  if (status === "C" || status === "NC" || status === "NA") {
    return status;
  }

  return "P";
};

export const isChecklistSnapshot = (value: unknown): value is ChecklistSnapshot => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const snapshot = value as Partial<ChecklistSnapshot>;
  return (
    typeof snapshot.generated_at === "string" &&
    typeof snapshot.overall === "object" &&
    Array.isArray(snapshot.inspections) &&
    Array.isArray(snapshot.non_conformities)
  );
};

export const buildChecklistItemText = (
  description: string,
  complement?: string | null,
) => {
  const parts = [description.trim()];
  if (complement?.trim()) {
    parts.push(complement.trim());
  }

  return parts.join("\n\n");
};

export const buildChecklistTableRows = (
  groupsByModel: Map<string, ChecklistGroupWithItems[]>,
) => {
  const rowsByInspection = new Map<string, ChecklistTableRow[]>();
  const evaluableIds = new Set<string>();

  groupsByModel.forEach((groups, modelId) => {
    const rows: ChecklistTableRow[] = [];

    groups
      .slice()
      .sort((left, right) => left.order - right.order)
      .forEach((group) => {
        rows.push({
          type: "section",
          key: `section-${modelId}-${group.id}`,
          title: group.title,
          sectionType: group.type,
        });

        let itemCounter = 0;
        group.items
          .slice()
          .sort((left, right) => left.order - right.order)
          .forEach((item) => {
            if (!item.evaluable) {
              rows.push({
                type: "info",
                key: `info-${item.id}`,
                description: item.description,
                complement: item.complement,
              });
              return;
            }

            itemCounter += 1;
            evaluableIds.add(item.id);
            rows.push({
              type: "item",
              key: `item-${item.id}`,
              itemId: item.id,
              number: String(itemCounter),
              sourceItemNumber: item.originalNumber,
              description: item.description,
              complement: item.complement,
            });
          });
      });

    rowsByInspection.set(modelId, rows);
  });

  return { rowsByInspection, evaluableIds };
};

export const buildChecklistSnapshot = (
  inspections: ChecklistModelShape[],
  groupsByModel: Map<string, ChecklistGroupWithItems[]>,
  responses: Map<string, ChecklistResponseShape>,
): ChecklistSnapshot => {
  const { rowsByInspection } = buildChecklistTableRows(groupsByModel);
  const sortedInspections = [...inspections].sort(
    (left, right) => (left.ordem ?? 0) - (right.ordem ?? 0),
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

      if (row.type === "info") {
        return;
      }

      const response = responses.get(row.itemId);
      const status = normalizeSnapshotStatus(response?.status);
      const itemSnapshot: ChecklistSnapshotItem = {
        checklist_item_id: row.itemId,
        item_numero: row.sourceItemNumber || row.number,
        item_exibicao: row.number,
        secao: currentSection,
        descricao: buildChecklistItemText(row.description, row.complement),
        status,
        observacoes: response?.observacoes || null,
        preenchido_por_nome: response?.preenchido_por_nome || null,
        preenchido_por_user_id: response?.preenchido_por_user_id || null,
        preenchido_em: response?.preenchido_em || null,
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

export const buildChecklistSnapshotAuditMap = (
  snapshot?: ChecklistSnapshot | null,
) => {
  const auditMap = new Map<string, ChecklistResponseAuditShape>();

  if (!snapshot) {
    return auditMap;
  }

  snapshot.inspections.forEach((inspection) => {
    inspection.itens.forEach((item) => {
      auditMap.set(item.checklist_item_id, {
        preenchido_por_nome: item.preenchido_por_nome || null,
        preenchido_por_user_id: item.preenchido_por_user_id || null,
        preenchido_em: item.preenchido_em || null,
      });
    });
  });

  return auditMap;
};

export const mergeChecklistResponseWithAudit = (
  response: ChecklistResponseShape,
  audit?: ChecklistResponseAuditShape | null,
): ChecklistResponseShape => ({
  ...response,
  preenchido_por_nome:
    response.preenchido_por_nome || audit?.preenchido_por_nome || null,
  preenchido_por_user_id:
    response.preenchido_por_user_id || audit?.preenchido_por_user_id || null,
  preenchido_em: response.preenchido_em || audit?.preenchido_em || null,
});

export const formatChecklistItemAuditSummary = (
  audit?: ChecklistResponseAuditShape | ChecklistSnapshotItem | null,
) => {
  if (!audit?.preenchido_em && !audit?.preenchido_por_nome) {
    return "-";
  }

  const filledAt = audit.preenchido_em ? new Date(audit.preenchido_em) : null;
  const formattedDate =
    filledAt && !Number.isNaN(filledAt.getTime())
      ? filledAt.toLocaleString("pt-BR")
      : "-";

  if (!audit.preenchido_por_nome) {
    return formattedDate;
  }

  return `${audit.preenchido_por_nome} | ${formattedDate}`;
};
