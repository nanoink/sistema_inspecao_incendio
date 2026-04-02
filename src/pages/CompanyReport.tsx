import { useEffect, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  FileCheck,
  Loader2,
  Printer,
  RefreshCcw,
  Save,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  formatCpf,
  loadCompanyReportSignatures,
  parseCompanyReportSignatures,
  type ChecklistExecutionSummary,
  type CompanyReportSignatureRow,
} from "@/lib/company-members";
import {
  buildChecklistSnapshot,
  type ChecklistSnapshot,
  type ChecklistSnapshotItem,
} from "@/lib/checklist";
import { loadChecklistData } from "@/lib/checklist-source";
import {
  normalizeEquipmentChecklistSnapshot,
  type EquipmentChecklistSnapshot,
} from "@/lib/checklist-equipment";
import {
  isMissingFunctionError,
  isMissingRelationError,
} from "@/lib/supabase-errors";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type ReportMode = "operacional" | "tecnico";

type Company = Pick<
  Database["public"]["Tables"]["empresa"]["Row"],
  | "id"
  | "razao_social"
  | "nome_fantasia"
  | "cnpj"
  | "responsavel"
  | "telefone"
  | "email"
  | "rua"
  | "numero"
  | "bairro"
  | "cidade"
  | "estado"
  | "cep"
  | "divisao"
  | "grupo"
  | "ocupacao_uso"
  | "area_m2"
  | "area_maior_pavimento_m2"
  | "area_depositos_m2"
  | "numero_ocupantes"
  | "altura_denominacao"
  | "altura_descricao"
  | "altura_real_m"
  | "grau_risco"
  | "possui_atrio"
>;

type ReportRow = Database["public"]["Tables"]["empresa_relatorios"]["Row"];
type ReportStatus = "rascunho" | "finalizado";
type NonConformityRow =
  Database["public"]["Tables"]["empresa_checklist_nao_conformidades"]["Row"];
type ExtinguisherRow = Pick<
  Database["public"]["Tables"]["empresa_extintores"]["Row"],
  "id" | "numero" | "localizacao" | "tipo" | "carga_nominal" | "checklist_snapshot"
>;
type HydrantRow = Pick<
  Database["public"]["Tables"]["empresa_hidrantes"]["Row"],
  "id" | "numero" | "localizacao" | "tipo_hidrante" | "checklist_snapshot"
>;
type LuminaireRow = Pick<
  Database["public"]["Tables"]["empresa_luminarias"]["Row"],
  "id" | "numero" | "localizacao" | "tipo_luminaria" | "status" | "checklist_snapshot"
>;

interface ReportRequirement {
  atende: boolean;
  categoria: string;
  codigo: string;
  criterioStatus: string | null;
  criterioTexto: string | null;
  id: string;
  nome: string;
  observacoes: string | null;
}

interface ReportRequirementRow {
  atende: boolean;
  criterio_status: string | null;
  criterio_texto: string | null;
  exigencia_id: string;
  observacoes: string | null;
  exigencias_seguranca:
    | {
        categoria: string;
        codigo: string;
        id: string;
        nome: string;
      }
    | Array<{
        categoria: string;
        codigo: string;
        id: string;
        nome: string;
      }>;
}

interface ReportFormState {
  reportMode: ReportMode;
  titulo: string;
  artRrtNumero: string;
  numeroRelatorio: string;
  dataInspecao: string;
  dataEmissao: string;
  horaInicio: string;
  horaFim: string;
  inspetorNome: string;
  inspetorCargo: string;
  representanteNome: string;
  representanteCargo: string;
  objetivo: string;
  escopo: string;
  observacoesGerais: string;
  recomendacoes: string;
  conclusao: string;
}

interface ItemContext {
  inspectionCode: string;
  inspectionName: string;
  item: ChecklistSnapshotItem;
}

interface EquipmentCatalogEntry {
  key: string;
  type: "extintor" | "hidrante" | "luminaria";
  recordId: string;
  label: string;
  subtitle: string;
  snapshot: EquipmentChecklistSnapshot;
}

interface ReportNonConformityEntry {
  id: string;
  checklistItemId: string;
  inspectionCode: string;
  inspectionName: string;
  section: string;
  itemDisplay: string;
  itemReference: string;
  itemDescription: string;
  detailDescription: string;
  imageDataUrl: string | null;
  sourceType: "principal" | "extintor" | "hidrante" | "luminaria";
  sourceLabel: string;
  sourceSubtitle: string;
  contextLabel: string;
  correctionAction: string;
  startDate: string;
  dueDate: string;
  riskLevel: "ALTA" | "MEDIA" | "BAIXA";
  riskPriority: string;
  riskTone: "danger" | "warning" | "neutral";
}

interface CorrectionPlanEntry {
  id: string;
  contextLabel: string;
  itemDisplay: string;
  correctionAction: string;
  startDate: string;
  dueDate: string;
  riskLevel: "ALTA" | "MEDIA" | "BAIXA";
  riskPriority: string;
  riskTone: "danger" | "warning" | "neutral";
}

interface InspectionSummaryLine {
  code: string;
  name: string;
  total: number;
  conforme: number;
  naoConforme: number;
  naoAplicavel: number;
  pendentes: number;
}

interface ReportRequirementMeasureEntry {
  id: string;
  sequence: number;
  code: string;
  category: string;
  name: string;
  detail: string | null;
  requiredLabel: string;
  existingLabel: string;
  statusLabel: string;
  statusTone: ReportBadgeTone;
}

interface GeneralChecklistReportLine {
  code: string;
  name: string;
  totalRelevant: number;
  checked: number;
  conforme: number;
  naoConforme: number;
  naoAplicavel: number;
  pendentes: number;
  operationalStatusLabel: string;
  operationalStatusTone: "success" | "warning" | "danger";
}

interface ChecklistPrintSection {
  key: string;
  title: string;
  subtitle: string;
  generatedAt: string | null;
  items: ChecklistSnapshotItem[];
  signers: CompanyReportSignatureRow[];
}

interface TechnicalSnapshotSummary {
  total: number;
  checked: number;
  conforme: number;
  naoConforme: number;
  naoAplicavel: number;
  pendentes: number;
}

type ReportBadgeTone = "neutral" | "success" | "danger" | "warning";

const getToday = () => new Date().toISOString().slice(0, 10);

const OPERATIONAL_REPORT_TITLE = "Relatorio de Inspecao Preventiva";
const TECHNICAL_REPORT_TITLE = "Relatorio Tecnico de Inspecao Contra Incendio";
const OPERATIONAL_LEGAL_NOTICE =
  "Documento de uso interno, sem validade tecnica legal. Este relatorio nao substitui inspecao tecnica realizada por profissional habilitado.";
const TECHNICAL_LEGAL_NOTICE =
  "Documento tecnico oficial condicionado a responsavel tecnico habilitado, ART/RRT vinculada e rastreabilidade completa da inspecao.";

const getDefaultReportTitle = (mode: ReportMode) =>
  mode === "tecnico" ? TECHNICAL_REPORT_TITLE : OPERATIONAL_REPORT_TITLE;

const emptyForm = (): ReportFormState => ({
  reportMode: "operacional",
  titulo: OPERATIONAL_REPORT_TITLE,
  artRrtNumero: "",
  numeroRelatorio: "",
  dataInspecao: getToday(),
  dataEmissao: getToday(),
  horaInicio: "",
  horaFim: "",
  inspetorNome: "",
  inspetorCargo: "",
  representanteNome: "",
  representanteCargo: "",
  objetivo:
    "Registrar o resultado da inspecao tecnica preventiva dos elementos do sistema global de seguranca contra incendios e emergencias da edificacao.",
  escopo:
    "Avaliacao das condicoes de funcionamento, conformidade e eficiencia dos dispositivos e medidas de seguranca contra incendios e emergencias existentes.",
  observacoesGerais: "",
  recomendacoes: "",
  conclusao: "",
});

const normalizeNullable = (value: string) => {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const getJsonRecord = (value: Json | null | undefined) =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, Json>)
    : null;

const getJsonString = (
  source: Record<string, Json> | null,
  key: string,
) => {
  const value = source?.[key];
  return typeof value === "string" ? value : null;
};

const isChecklistSnapshot = (value: unknown): value is ChecklistSnapshot => {
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

const getReportStatusBadge = (status: ReportStatus) =>
  status === "finalizado"
    ? {
        label: "Finalizado",
        className: "border-emerald-200 bg-emerald-50 text-emerald-700",
      }
    : {
        label: "Rascunho",
        className: "border-amber-200 bg-amber-50 text-amber-700",
      };

const buildDefaultForm = (company: Company, report: ReportRow | null): ReportFormState => {
  const defaults = emptyForm();
  const additionalData = getJsonRecord(report?.dados_adicionais);
  const persistedMode = getJsonString(additionalData, "report_mode");
  const reportMode: ReportMode =
    persistedMode === "tecnico" ? "tecnico" : defaults.reportMode;

  if (!report) {
    return {
      ...defaults,
      reportMode,
      titulo: getDefaultReportTitle(reportMode),
      representanteNome: company.responsavel || "",
      representanteCargo: "Responsavel pela empresa",
    };
  }

  return {
    reportMode,
    titulo: report.titulo || getDefaultReportTitle(reportMode),
    artRrtNumero: getJsonString(additionalData, "art_rrt_numero") || "",
    numeroRelatorio: report.numero_relatorio || "",
    dataInspecao: report.data_inspecao || defaults.dataInspecao,
    dataEmissao: report.data_emissao || defaults.dataEmissao,
    horaInicio: report.hora_inicio || "",
    horaFim: report.hora_fim || "",
    inspetorNome: report.inspetor_nome || "",
    inspetorCargo: report.inspetor_cargo || "",
    representanteNome: report.representante_nome || company.responsavel || "",
    representanteCargo: report.representante_cargo || "Responsavel pela empresa",
    objetivo: report.objetivo || defaults.objetivo,
    escopo: report.escopo || defaults.escopo,
    observacoesGerais: report.observacoes_gerais || "",
    recomendacoes: report.recomendacoes || "",
    conclusao: report.conclusao || "",
  };
};

const formatDate = (value?: string | null) => {
  if (!value) {
    return "-";
  }

  const normalized = new Date(`${value}T00:00:00`);
  if (Number.isNaN(normalized.getTime())) {
    return "-";
  }

  return normalized.toLocaleDateString("pt-BR");
};

const formatDateTime = (value?: string | null) => {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleString("pt-BR");
};

const formatNumber = (value?: number | null, suffix?: string) => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "-";
  }

  const formatted = value.toLocaleString("pt-BR", {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
  });
  return suffix ? `${formatted} ${suffix}` : formatted;
};

const formatTimeRange = (start?: string | null, end?: string | null) => {
  if (start && end) {
    return `De ${start} as ${end}`;
  }

  if (start) {
    return `Inicio ${start}`;
  }

  if (end) {
    return `Fim ${end}`;
  }

  return "-";
};

const addDaysToDate = (dateValue: string, days: number) => {
  const date = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return getToday();
  }

  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

const chunkArray = <T,>(items: T[], size: number) => {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

const buildCompanyAddress = (company: Company) =>
  [company.rua, company.numero && `n${company.numero}`, company.bairro]
    .filter(Boolean)
    .join(", ");

const buildOccupationLabel = (company: Company) => {
  const group = company.grupo?.trim();
  const division = company.divisao?.trim() || company.ocupacao_uso?.trim();

  if (group && division) {
    return `${group} - ${division}`;
  }

  return group || division || "-";
};

const getEquipmentTypeLabel = (equipmentType: "extintor" | "hidrante" | "luminaria") =>
  equipmentType === "extintor"
    ? "Extintor"
    : equipmentType === "hidrante"
      ? "Hidrante"
      : "Luminaria";

const buildPrincipalItemLookup = (snapshot: ChecklistSnapshot) => {
  const lookup = new Map<string, ItemContext>();

  snapshot.inspections.forEach((inspection) => {
    inspection.itens.forEach((item) => {
      lookup.set(item.checklist_item_id, {
        inspectionCode: inspection.codigo,
        inspectionName: inspection.nome,
        item,
      });
    });
  });

  return lookup;
};

const buildEquipmentCatalog = ({
  extinguishers,
  hydrants,
  luminaires,
}: {
  extinguishers: ExtinguisherRow[];
  hydrants: HydrantRow[];
  luminaires: LuminaireRow[];
}) => {
  const catalog = new Map<string, EquipmentCatalogEntry>();

  extinguishers.forEach((record) => {
    catalog.set(`extintor:${record.id}`, {
      key: `extintor:${record.id}`,
      type: "extintor",
      recordId: record.id,
      label: `Extintor ${record.numero}`,
      subtitle: `${record.localizacao} | ${record.tipo} ${record.carga_nominal}`,
      snapshot: normalizeEquipmentChecklistSnapshot(record.checklist_snapshot),
    });
  });

  hydrants.forEach((record) => {
    catalog.set(`hidrante:${record.id}`, {
      key: `hidrante:${record.id}`,
      type: "hidrante",
      recordId: record.id,
      label: `Hidrante ${record.numero}`,
      subtitle: `${record.localizacao} | ${record.tipo_hidrante}`,
      snapshot: normalizeEquipmentChecklistSnapshot(record.checklist_snapshot),
    });
  });

  luminaires.forEach((record) => {
    catalog.set(`luminaria:${record.id}`, {
      key: `luminaria:${record.id}`,
      type: "luminaria",
      recordId: record.id,
      label: `Luminaria ${record.numero}`,
      subtitle: `${record.localizacao} | ${record.tipo_luminaria} | ${record.status}`,
      snapshot: normalizeEquipmentChecklistSnapshot(record.checklist_snapshot),
    });
  });

  return catalog;
};

const buildCorrectionAction = ({
  sourceLabel,
  itemDescription,
  detailDescription,
}: {
  sourceLabel: string;
  itemDescription: string;
  detailDescription: string;
}) => {
  const cleanItem = itemDescription.replace(/\s+/g, " ").trim();
  const cleanDetail = detailDescription.replace(/\s+/g, " ").trim();

  return `Regularizar ${sourceLabel.toLowerCase()} referente ao item "${cleanItem}", executando a correcao descrita no registro de nao conformidade${cleanDetail ? ` (${cleanDetail}).` : "."} Validar novamente a conformidade apos a execucao.`;
};

const buildReportNonConformityEntries = ({
  records,
  snapshot,
  equipmentCatalog,
  form,
}: {
  records: NonConformityRow[];
  snapshot: ChecklistSnapshot;
  equipmentCatalog: Map<string, EquipmentCatalogEntry>;
  form: ReportFormState;
}) => {
  const principalItemLookup = buildPrincipalItemLookup(snapshot);
  const startDate = form.dataInspecao || form.dataEmissao || getToday();
  const entries: ReportNonConformityEntry[] = [];

  records.forEach((record) => {
    const hasEquipmentScope =
      record.equipment_type &&
      record.equipment_type !== "principal" &&
      record.equipment_record_id;

    if (hasEquipmentScope) {
      const equipmentKey = `${record.equipment_type}:${record.equipment_record_id}`;
      const equipmentEntry = equipmentCatalog.get(equipmentKey);
      if (!equipmentEntry) {
        return;
      }

      const item = equipmentEntry.snapshot.items.find(
        (snapshotItem) => snapshotItem.checklist_item_id === record.checklist_item_id,
      );
      if (!item || item.status !== "NC") {
        return;
      }

      const riskAssessment = getRiskAssessment({
        itemDescription: item.descricao,
        detailDescription: record.descricao,
        sourceType: equipmentEntry.type,
      });

      entries.push({
        id: record.id,
        checklistItemId: record.checklist_item_id,
        inspectionCode: equipmentEntry.snapshot.inspection_code || "-",
        inspectionName: equipmentEntry.snapshot.inspection_name || getEquipmentTypeLabel(equipmentEntry.type),
        section: item.secao || "Sem secao",
        itemDisplay: item.item_exibicao || "-",
        itemReference: item.item_numero || "-",
        itemDescription: item.descricao,
        detailDescription: record.descricao,
        imageDataUrl: record.imagem_data_url,
        sourceType: equipmentEntry.type,
        sourceLabel: equipmentEntry.label,
        sourceSubtitle: equipmentEntry.subtitle,
        contextLabel: `${equipmentEntry.label} | ${equipmentEntry.subtitle}`,
        correctionAction: buildCorrectionAction({
          sourceLabel: equipmentEntry.label,
          itemDescription: item.descricao,
          detailDescription: record.descricao,
        }),
        startDate,
        dueDate: addDaysToDate(startDate, 30),
        riskLevel: riskAssessment.level,
        riskPriority: riskAssessment.priority,
        riskTone: riskAssessment.tone,
      });
      return;
    }

    const principalItem = principalItemLookup.get(record.checklist_item_id);
    if (!principalItem || principalItem.item.status !== "NC") {
      return;
    }

    const riskAssessment = getRiskAssessment({
      itemDescription: principalItem.item.descricao,
      detailDescription: record.descricao,
      sourceType: "principal",
    });

    entries.push({
      id: record.id,
      checklistItemId: record.checklist_item_id,
      inspectionCode: principalItem.inspectionCode,
      inspectionName: principalItem.inspectionName,
      section: principalItem.item.secao || "Sem secao",
      itemDisplay: principalItem.item.item_exibicao || "-",
      itemReference: principalItem.item.item_numero || "-",
      itemDescription: principalItem.item.descricao,
      detailDescription: record.descricao,
      imageDataUrl: record.imagem_data_url,
      sourceType: "principal",
      sourceLabel: "Checklist principal",
      sourceSubtitle: principalItem.inspectionName,
      contextLabel: `${principalItem.inspectionCode} - ${principalItem.inspectionName}`,
      correctionAction: buildCorrectionAction({
        sourceLabel: `o item ${principalItem.item.item_exibicao} do checklist principal`,
        itemDescription: principalItem.item.descricao,
        detailDescription: record.descricao,
      }),
      startDate,
      dueDate: addDaysToDate(startDate, 30),
      riskLevel: riskAssessment.level,
      riskPriority: riskAssessment.priority,
      riskTone: riskAssessment.tone,
    });
  });

  return entries.sort((left, right) => {
    const inspectionCompare = `${left.inspectionCode}-${left.itemDisplay}`.localeCompare(
      `${right.inspectionCode}-${right.itemDisplay}`,
      "pt-BR",
      { numeric: true, sensitivity: "base" },
    );

    if (inspectionCompare !== 0) {
      return inspectionCompare;
    }

    return left.sourceLabel.localeCompare(right.sourceLabel, "pt-BR", {
      numeric: true,
      sensitivity: "base",
    });
  });
};

const buildSnapshotCorrectionPlanEntries = ({
  snapshot,
  equipmentCatalog,
  detailedEntries,
  form,
}: {
  snapshot: ChecklistSnapshot;
  equipmentCatalog: Map<string, EquipmentCatalogEntry>;
  detailedEntries: ReportNonConformityEntry[];
  form: ReportFormState;
}): CorrectionPlanEntry[] => {
  const startDate = form.dataInspecao || form.dataEmissao || getToday();
  const principalItemLookup = buildPrincipalItemLookup(snapshot);
  const detailedEntryKeys = new Set(
    detailedEntries.map((entry) =>
      entry.sourceType === "principal"
        ? `principal:${entry.checklistItemId}`
        : `${entry.sourceType}:${entry.sourceLabel}:${entry.checklistItemId}`,
    ),
  );
  const entries: CorrectionPlanEntry[] = [];

  snapshot.non_conformities.forEach((item) => {
    const entryKey = `principal:${item.checklist_item_id}`;
    if (detailedEntryKeys.has(entryKey)) {
      return;
    }

    const context = principalItemLookup.get(item.checklist_item_id);
    const detailDescription =
      item.observacoes?.trim() ||
      "Nao conformidade identificada no checklist principal sem registro fotografico complementar.";
    const riskAssessment = getRiskAssessment({
      itemDescription: item.descricao,
      detailDescription,
      sourceType: "principal",
    });

    entries.push({
      id: `snapshot-principal-${item.checklist_item_id}`,
      contextLabel: context
        ? `${context.inspectionCode} - ${context.inspectionName}`
        : "Checklist principal",
      itemDisplay: item.item_exibicao || item.item_numero || "-",
      correctionAction: `Regularizar o item "${item.descricao}" no checklist principal.${item.observacoes ? ` Observacao registrada: ${item.observacoes}.` : " Validar novamente a conformidade apos a execucao."}`,
      startDate,
      dueDate: addDaysToDate(startDate, 30),
      riskLevel: riskAssessment.level,
      riskPriority: riskAssessment.priority,
      riskTone: riskAssessment.tone,
    });
  });

  Array.from(equipmentCatalog.values()).forEach((equipmentEntry) => {
    equipmentEntry.snapshot.items
      .filter((item) => item.status === "NC")
      .forEach((item) => {
        const entryKey = `${equipmentEntry.type}:${equipmentEntry.label}:${item.checklist_item_id}`;
        if (detailedEntryKeys.has(entryKey)) {
          return;
        }

        const detailDescription =
          item.observacoes?.trim() ||
          "Nao conformidade identificada no checklist individual sem registro fotografico complementar.";
        const riskAssessment = getRiskAssessment({
          itemDescription: item.descricao,
          detailDescription,
          sourceType: equipmentEntry.type,
        });

        entries.push({
          id: `snapshot-${equipmentEntry.type}-${equipmentEntry.recordId}-${item.checklist_item_id}`,
          contextLabel: `${equipmentEntry.label} | ${equipmentEntry.subtitle}`,
          itemDisplay: item.item_exibicao || item.item_numero || "-",
          correctionAction: `Regularizar ${equipmentEntry.label.toLowerCase()} no item "${item.descricao}".${item.observacoes ? ` Observacao registrada: ${item.observacoes}.` : " Validar novamente a conformidade apos a execucao."}`,
          startDate,
          dueDate: addDaysToDate(startDate, 30),
          riskLevel: riskAssessment.level,
          riskPriority: riskAssessment.priority,
          riskTone: riskAssessment.tone,
        });
      });
  });

  return entries.sort((left, right) =>
    `${left.contextLabel}-${left.itemDisplay}`.localeCompare(
      `${right.contextLabel}-${right.itemDisplay}`,
      "pt-BR",
      { numeric: true, sensitivity: "base" },
    ),
  );
};

const buildInspectionSummaryLines = (snapshot: ChecklistSnapshot): InspectionSummaryLine[] =>
  snapshot.inspections.map((inspection) => ({
    code: inspection.codigo,
    name: inspection.nome,
    total: inspection.total,
    conforme: inspection.conforme,
    naoConforme: inspection.nao_conforme,
    naoAplicavel: inspection.nao_aplicavel,
    pendentes: inspection.pendentes,
  }));

const buildRequirementMeasureEntries = (
  requirements: ReportRequirement[],
  generalChecklistLines: GeneralChecklistReportLine[],
): ReportRequirementMeasureEntry[] => {
  const checklistLinesByCode = new Map(
    generalChecklistLines.map((line) => [line.code, line] as const),
  );

  return requirements
    .slice()
    .sort((left, right) => {
      const categoryCompare = left.categoria.localeCompare(right.categoria, "pt-BR", {
        sensitivity: "base",
      });

      if (categoryCompare !== 0) {
        return categoryCompare;
      }

      const codeCompare = left.codigo.localeCompare(right.codigo, "pt-BR", {
        numeric: true,
        sensitivity: "base",
      });

      if (codeCompare !== 0) {
        return codeCompare;
      }

      return left.nome.localeCompare(right.nome, "pt-BR", {
        sensitivity: "base",
      });
    })
    .map((requirement, index) => {
      const operationalStatus = getRequirementOperationalStatus(
        requirement,
        checklistLinesByCode,
      );
      const detailParts = [
        requirement.criterioTexto,
        requirement.observacoes,
        operationalStatus.detail,
      ].filter(Boolean);

      return {
        id: requirement.id,
        sequence: index + 1,
        code: requirement.codigo,
        category: requirement.categoria,
        name: requirement.nome,
        detail: detailParts.length > 0 ? detailParts.join(" ") : null,
        requiredLabel: "SIM",
        existingLabel: requirement.atende ? "EXISTENTE" : "NAO EXISTENTE",
        statusLabel: operationalStatus.label,
        statusTone: operationalStatus.tone,
      };
    });
};

const buildRequirementCorrectionPlanEntries = ({
  requirementMeasureEntries,
  form,
}: {
  requirementMeasureEntries: ReportRequirementMeasureEntry[];
  form: ReportFormState;
}): CorrectionPlanEntry[] => {
  const startDate = form.dataInspecao || form.dataEmissao || getToday();

  return requirementMeasureEntries
    .filter(
      (entry) =>
        entry.existingLabel === "NAO EXISTENTE" ||
        entry.statusLabel === "NAO ATENDE",
    )
    .map((entry) => {
      const riskAssessment = getRiskAssessment({
        itemDescription: entry.name,
        detailDescription: entry.detail || "",
        sourceType: "principal",
      });
      const isNonExisting = entry.existingLabel === "NAO EXISTENTE";
      const correctionAction = isNonExisting
        ? `Providenciar a implantacao e a regularizacao da medida de seguranca "${entry.name}" (${entry.code}), incluindo existencia fisica, documentacao e registro formal da exigencia no empreendimento.${entry.detail ? ` ${entry.detail}` : ""}`
        : `Regularizar a medida de seguranca "${entry.name}" (${entry.code}) para que ela volte a atender tecnicamente aos criterios da inspecao.${entry.detail ? ` ${entry.detail}` : ""}`;

      return {
        id: `requirement-plan-${entry.id}`,
        contextLabel: `Medida exigida ${entry.code} - ${entry.category}`,
        itemDisplay: entry.name,
        correctionAction,
        startDate,
        dueDate: addDaysToDate(startDate, 30),
        riskLevel: riskAssessment.level,
        riskPriority: riskAssessment.priority,
        riskTone: riskAssessment.tone,
      } satisfies CorrectionPlanEntry;
    });
};

const REPORT_EXTINGUISHER_INSPECTION_CODE = "A.23";
const REPORT_HYDRANT_INSPECTION_CODE = "A.25";
const REPORT_LUMINAIRE_INSPECTION_CODE = "A.19";

const REPORT_REQUIREMENT_TO_CHECKLIST_CODES: Record<string, string[]> = {
  "1.1": ["A.7"],
  "1.2": ["A.9"],
  "1.3": ["A.37"],
  "1.4": ["A.35"],
  "2.1": ["A.23"],
  "2.2": ["A.25"],
  "2.3": ["A.27"],
  "3.1": ["A.31"],
  "3.2": ["A.29"],
  "4.1": ["A.11", "A.13", "A.15", "A.17"],
  "4.2": ["A.19"],
  "4.3": ["A.21"],
  "5.1": ["A.4"],
};

const normalizeChecklistSectionTitleKey = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const buildChecklistSectionTitleSet = (titles: string[]) =>
  new Set(titles.map(normalizeChecklistSectionTitleKey));

const REPORT_PRINCIPAL_ONLY_EQUIPMENT_SECTIONS: Record<string, Set<string>> = {
  [REPORT_EXTINGUISHER_INSPECTION_CODE]: buildChecklistSectionTitleSet([
    "Documentacoes",
  ]),
  [REPORT_HYDRANT_INSPECTION_CODE]: buildChecklistSectionTitleSet([
    "Reserva Tecnica de Incendio (RTI)",
    "Tubulacao da RTI a entrada da BCI - Succao",
    "Bombas de Combate a Incendio (BCI)",
    "Recalque (tubulacao da BCI aos hidrantes de parede/recalque)",
    "Procedimento de Testes",
    "Procedimento de teste quando houver uma unica BCI",
    "Procedimento de teste quando houver uma BCI e uma bomba de pressurizacao (joquei)",
    "Procedimento de teste apenas quando houver uma BCI Principal, uma BCI Reserva e uma bomba de pressurizacao (joquei)",
    "Notas Fiscais",
  ]),
  [REPORT_LUMINAIRE_INSPECTION_CODE]: buildChecklistSectionTitleSet([
    "Sistema centralizado com baterias recarregaveis",
    "Sistema centralizado com grupo moto gerador (GMG)",
    "Teste do sistema centralizado com grupo moto gerador (GMG)",
    "ART/RRT",
    "Notas Fiscais",
    "Documentacoes especificos",
  ]),
};

const isGeneralEquipmentInspectionSection = (
  inspectionCode: string,
  sectionTitle: string,
) => {
  const normalizedSectionTitle = normalizeChecklistSectionTitleKey(sectionTitle);

  if (!normalizedSectionTitle) {
    return false;
  }

  if (
    normalizedSectionTitle.startsWith("documentacao") &&
    normalizedSectionTitle.includes("art/rrt") &&
    (inspectionCode === REPORT_HYDRANT_INSPECTION_CODE ||
      inspectionCode === REPORT_LUMINAIRE_INSPECTION_CODE)
  ) {
    return true;
  }

  return (
    REPORT_PRINCIPAL_ONLY_EQUIPMENT_SECTIONS[inspectionCode]?.has(
      normalizedSectionTitle,
    ) || false
  );
};

const buildGeneralChecklistLines = (
  snapshot: ChecklistSnapshot,
): GeneralChecklistReportLine[] =>
  snapshot.inspections
    .map((inspection) => {
      const relevantItems = inspection.itens.filter((item) => {
        if (
          inspection.codigo === REPORT_EXTINGUISHER_INSPECTION_CODE ||
          inspection.codigo === REPORT_HYDRANT_INSPECTION_CODE ||
          inspection.codigo === REPORT_LUMINAIRE_INSPECTION_CODE
        ) {
          return isGeneralEquipmentInspectionSection(
            inspection.codigo,
            item.secao || "",
          );
        }

        return true;
      });

      const checkedItems = relevantItems.filter((item) => item.status !== "P");
      const naoConforme = checkedItems.filter((item) => item.status === "NC").length;
      const pendentes = relevantItems.length - checkedItems.length;
      const operationalStatus =
        naoConforme > 0
          ? {
              label: "NAO ATENDE",
              tone: "danger" as const,
            }
          : pendentes > 0
            ? {
                label: "AVALIACAO PARCIAL",
                tone: "warning" as const,
              }
            : {
                label: "ATENDE",
                tone: "success" as const,
              };

      return {
        code: inspection.codigo,
        name: inspection.nome,
        totalRelevant: relevantItems.length,
        checked: checkedItems.length,
        conforme: checkedItems.filter((item) => item.status === "C").length,
        naoConforme,
        naoAplicavel: checkedItems.filter((item) => item.status === "NA").length,
        pendentes,
        operationalStatusLabel: operationalStatus.label,
        operationalStatusTone: operationalStatus.tone,
      };
    })
    .filter((inspection) => inspection.checked > 0)
    .sort((left, right) =>
      `${left.code} - ${left.name}`.localeCompare(
        `${right.code} - ${right.name}`,
        "pt-BR",
        { numeric: true, sensitivity: "base" },
      ),
    );

const buildTechnicalSnapshotSummary = (
  snapshot: ChecklistSnapshot,
): TechnicalSnapshotSummary =>
  snapshot.inspections.reduce<TechnicalSnapshotSummary>(
    (summary, inspection) => {
      summary.total += inspection.total;
      summary.checked +=
        inspection.conforme + inspection.nao_conforme + inspection.nao_aplicavel;
      summary.conforme += inspection.conforme;
      summary.naoConforme += inspection.nao_conforme;
      summary.naoAplicavel += inspection.nao_aplicavel;
      summary.pendentes += inspection.pendentes;
      return summary;
    },
    {
      total: 0,
      checked: 0,
      conforme: 0,
      naoConforme: 0,
      naoAplicavel: 0,
      pendentes: 0,
    },
  );

const getRequirementOperationalStatus = (
  requirement: ReportRequirement,
  checklistLinesByCode: Map<string, GeneralChecklistReportLine>,
) => {
  const linkedCodes = REPORT_REQUIREMENT_TO_CHECKLIST_CODES[requirement.codigo] || [];
  const linkedLines = linkedCodes
    .map((code) => checklistLinesByCode.get(code))
    .filter((line): line is GeneralChecklistReportLine => Boolean(line));

  if (!requirement.atende) {
    return {
      label: "NAO ATENDE",
      tone: "danger" as const,
      detail: "A medida nao esta registrada como existente nas exigencias da empresa.",
    };
  }

  if (linkedLines.some((line) => line.naoConforme > 0)) {
    const failingCodes = linkedLines
      .filter((line) => line.naoConforme > 0)
      .map((line) => `${line.code} (${line.naoConforme} NC)`)
      .join(", ");

    return {
      label: "NAO ATENDE",
      tone: "danger" as const,
      detail: `Desempenho operacional reprovado no checklist ${failingCodes}.`,
    };
  }

  if (linkedLines.some((line) => line.pendentes > 0)) {
    const partialCodes = linkedLines
      .filter((line) => line.pendentes > 0)
      .map((line) => `${line.code} (${line.checked}/${line.totalRelevant})`)
      .join(", ");

    return {
      label: "ATENDE COM RESSALVAS",
      tone: "warning" as const,
      detail: `A avaliacao operacional ainda esta parcial no checklist ${partialCodes}.`,
    };
  }

  return {
    label: "ATENDE",
    tone: "success" as const,
    detail:
      linkedLines.length > 0
        ? `Medida validada operacionalmente pelos checklist(s) ${linkedCodes.join(", ")}.`
        : null,
  };
};

const getRiskAssessment = ({
  itemDescription,
  detailDescription,
  sourceType,
}: {
  itemDescription: string;
  detailDescription: string;
  sourceType: ReportNonConformityEntry["sourceType"];
}) => {
  const normalized = `${itemDescription} ${detailDescription}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (
    (sourceType === "extintor" &&
      (normalized.includes("venc") || normalized.includes("recarga"))) ||
    normalized.includes("nao funciona") ||
    normalized.includes("não funciona") ||
    normalized.includes("nao acende") ||
    normalized.includes("autonomia") ||
    normalized.includes("15 min") ||
    normalized.includes("brigada")
  ) {
    return {
      level: "ALTA" as const,
      priority: "Correcao imediata",
      tone: "danger" as const,
    };
  }

  if (
    normalized.includes("fixa") ||
    normalized.includes("fixacao") ||
    normalized.includes("fixada") ||
    normalized.includes("sinaliza") ||
    normalized.includes("vazamento") ||
    normalized.includes("pressao")
  ) {
    return {
      level: "MEDIA" as const,
      priority: "Correcao prioritaria",
      tone: "warning" as const,
    };
  }

  return {
    level: "BAIXA" as const,
    priority: "Correcao programada",
    tone: "neutral" as const,
  };
};

const buildCompactSignatureExecutionLines = (
  executions: ChecklistExecutionSummary[],
) => {
  const groupedExecutions = new Map<
    string,
    {
      inspectionCode: string;
      inspectionName: string;
      hasPrincipal: boolean;
      extinguishers: number;
      hydrants: number;
      luminaires: number;
    }
  >();

  executions.forEach((execution) => {
    const key = `${execution.inspection_code}:${execution.inspection_name}`;
    const current =
      groupedExecutions.get(key) || {
        inspectionCode: execution.inspection_code,
        inspectionName: execution.inspection_name,
        hasPrincipal: false,
        extinguishers: 0,
        hydrants: 0,
        luminaires: 0,
      };

    if (execution.context_type === "principal") {
      current.hasPrincipal = true;
    } else if (execution.equipment_type === "extintor") {
      current.extinguishers += 1;
    } else if (execution.equipment_type === "hidrante") {
      current.hydrants += 1;
    } else if (execution.equipment_type === "luminaria") {
      current.luminaires += 1;
    }

    groupedExecutions.set(key, current);
  });

  return Array.from(groupedExecutions.values())
    .sort((left, right) =>
      `${left.inspectionCode} - ${left.inspectionName}`.localeCompare(
        `${right.inspectionCode} - ${right.inspectionName}`,
        "pt-BR",
        { numeric: true, sensitivity: "base" },
      ),
    )
    .map((execution) => {
      const detailParts: string[] = [];

      if (execution.hasPrincipal) {
        detailParts.push("checklist geral");
      }

      if (execution.extinguishers > 0) {
        detailParts.push(`${execution.extinguishers} extintor(es)`);
      }

      if (execution.hydrants > 0) {
        detailParts.push(`${execution.hydrants} hidrante(s)`);
      }

      if (execution.luminaires > 0) {
        detailParts.push(`${execution.luminaires} luminaria(s)`);
      }

      return {
        key: `${execution.inspectionCode}-${execution.inspectionName}`,
        label: `${execution.inspectionCode} - ${execution.inspectionName}: ${detailParts.join(" + ") || "sem detalhamento"}`,
      };
    });
};

const getSignatureRoleLabel = (signer: CompanyReportSignatureRow) =>
  signer.is_gestor ? "Gestor responsavel pela empresa" : "Usuario executor de checklist";

const formatSignatureExecutionLabel = (execution: ChecklistExecutionSummary) => {
  const inspectionLabel = `${execution.inspection_code} - ${execution.inspection_name}`;

  if (execution.context_type === "principal") {
    return `${inspectionLabel} | Checklist principal`;
  }

  const equipmentLabel =
    execution.equipment_type === "extintor" ||
    execution.equipment_type === "hidrante" ||
    execution.equipment_type === "luminaria"
      ? getEquipmentTypeLabel(execution.equipment_type)
      : "Equipamento";

  return execution.source_label
    ? `${inspectionLabel} | ${equipmentLabel} | ${execution.source_label}`
    : `${inspectionLabel} | ${equipmentLabel}`;
};

const getChecklistStatusMeta = (status: ChecklistSnapshotItem["status"]) => {
  if (status === "C") {
    return { label: "Conforme", tone: "success" as const };
  }

  if (status === "NC") {
    return { label: "Nao conforme", tone: "danger" as const };
  }

  if (status === "NA") {
    return { label: "Nao aplicavel", tone: "neutral" as const };
  }

  return { label: "Pendente", tone: "neutral" as const };
};

const hasChecklistConclusiveItems = (
  items: Array<Pick<ChecklistSnapshotItem, "status">>,
) => items.some((item) => item.status === "C" || item.status === "NC");

const getChecklistItemsEligibleForReportAnnex = (
  items: ChecklistSnapshotItem[],
) => {
  const answeredItems = items.filter((item) => item.status !== "P");

  if (!hasChecklistConclusiveItems(answeredItems)) {
    return [];
  }

  return answeredItems;
};

const buildChecklistPrintSections = ({
  snapshot,
  equipmentCatalog,
  signers,
}: {
  snapshot: ChecklistSnapshot;
  equipmentCatalog: Map<string, EquipmentCatalogEntry>;
  signers: CompanyReportSignatureRow[];
}) => {
  const sections: ChecklistPrintSection[] = [];

  snapshot.inspections.forEach((inspection) => {
    const answeredItems = getChecklistItemsEligibleForReportAnnex(
      inspection.itens,
    );

    if (answeredItems.length === 0) {
      return;
    }

    sections.push({
      key: `principal:${inspection.codigo}`,
      title: `${inspection.codigo} - ${inspection.nome}`,
      subtitle: "Checklist principal da empresa",
      generatedAt: snapshot.generated_at,
      items: answeredItems,
      signers: signers.filter((signer) =>
        signer.executed_checklists.some(
          (execution) =>
            execution.context_type === "principal" &&
            execution.inspection_code === inspection.codigo,
        ),
      ),
    });
  });

  Array.from(equipmentCatalog.values()).forEach((entry) => {
    const answeredItems = getChecklistItemsEligibleForReportAnnex(
      entry.snapshot.items,
    );

    if (answeredItems.length === 0) {
      return;
    }

    sections.push({
      key: `${entry.type}:${entry.recordId}`,
      title: `${entry.snapshot.inspection_code || "-"} - ${entry.snapshot.inspection_name || getEquipmentTypeLabel(entry.type)}`,
      subtitle: `${entry.label} | ${entry.subtitle}`,
      generatedAt: entry.snapshot.generated_at,
      items: answeredItems,
      signers: signers.filter((signer) =>
        signer.executed_checklists.some(
          (execution) =>
            execution.context_type === "equipamento" &&
            execution.equipment_type === entry.type &&
            execution.equipment_record_id === entry.recordId,
        ),
      ),
    });
  });

  return sections;
};

const PageFrame = ({
  children,
  pageNumber,
  totalPages,
  title,
  subtitle,
  legalNotice,
}: {
  children: ReactNode;
  pageNumber: number;
  totalPages: number;
  title: string;
  subtitle: string;
  legalNotice: string;
}) => (
  <article
    className="report-page relative mx-auto bg-white text-black shadow-[0_20px_50px_rgba(15,23,42,0.18)] print:shadow-none print:mx-0 print:my-0"
    style={{ width: "210mm", height: "297mm" }}
  >
    <div className="box-border flex h-full flex-col px-[18mm] pb-[18mm] pt-[14mm]">
      <header className="mb-6 border-b border-zinc-300 pb-4 text-center">
        <div className="flex-1 text-center">
          <h1 className="text-[17px] font-semibold uppercase leading-tight tracking-[0.02em] text-zinc-800">
            {title}
          </h1>
          <p className="mt-2 text-[9.5px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
            {subtitle}
          </p>
          <p className="mt-2 text-[10px] leading-5 text-zinc-600">{legalNotice}</p>
        </div>
      </header>

      <div className="flex-1">{children}</div>

      <footer className="mt-6 text-right text-[11px] font-semibold text-zinc-700">
        Pagina {pageNumber} de {totalPages}
      </footer>
    </div>
  </article>
);

const SectionHeading = ({
  index,
  title,
  className = "",
}: {
  index: string;
  title: string;
  className?: string;
}) => (
  <h2 className={`text-[15px] font-bold uppercase text-zinc-900 ${className}`}>
    {index}. {title}
  </h2>
);

const DataCell = ({
  label,
  value,
  className = "",
}: {
  label: string;
  value: ReactNode;
  className?: string;
}) => (
  <div className={`border-b border-zinc-300 px-3 py-2 ${className}`}>
    <div className="text-[9px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
      {label}
    </div>
    <div className="mt-1 text-[13px] font-semibold uppercase text-zinc-900">{value}</div>
  </div>
);

const RequirementStatusBadge = ({
  label,
  tone,
}: {
  label: string;
  tone: ReportBadgeTone;
}) => (
  <span
    className={
      tone === "success"
        ? "inline-flex items-center rounded-full border border-emerald-300 bg-emerald-50 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.08em] text-emerald-800"
        : tone === "danger"
          ? "inline-flex items-center rounded-full border border-red-300 bg-red-50 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.08em] text-red-800"
          : tone === "warning"
            ? "inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.08em] text-amber-800"
          : "inline-flex items-center rounded-full border border-zinc-300 bg-zinc-100 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.08em] text-zinc-700"
    }
  >
    {label}
  </span>
);

const getDigitalSignatureHeading = (
  signer: CompanyReportSignatureRow,
  context: "summary" | "checklist",
) => {
  if (context === "checklist") {
    return "Checklist executado e assinado por";
  }

  if (signer.total_checklists > 1) {
    return "Checklists executados e assinados por";
  }

  if (signer.total_checklists === 1) {
    return "Checklist executado e assinado por";
  }

  if (signer.is_gestor) {
    return "Relatorio validado e assinado pelo gestor responsavel";
  }

  return "Assinatura digital registrada por";
};

const getDigitalSignatureDateLabel = (
  signer: CompanyReportSignatureRow,
  context: "summary" | "checklist",
) => {
  if (context === "checklist") {
    return "Data e hora da finalizacao";
  }

  if (signer.total_checklists > 0) {
    return signer.total_checklists > 1
      ? "Data e hora da ultima finalizacao"
      : "Data e hora da finalizacao";
  }

  if (signer.is_gestor) {
    return "Data e hora da validacao";
  }

  return "Data e hora do registro";
};

const ChecklistDigitalSignatureStamp = ({
  signer,
  timestamp,
  context,
}: {
  signer: CompanyReportSignatureRow;
  timestamp: string | null;
  context: "summary" | "checklist";
}) => (
  <div className="overflow-hidden rounded-sm border border-zinc-300 bg-white">
    <div className="grid grid-cols-[0.95fr_1.35fr]">
      <div className="flex min-h-[108px] items-center border-r border-zinc-300 bg-zinc-50 px-4 py-4">
        <p className="text-[24px] font-semibold leading-[1.08] tracking-[-0.02em] text-zinc-900 break-words">
          {signer.assinatura_nome}
        </p>
      </div>

      <div className="relative px-4 py-4">
        <div className="pointer-events-none absolute inset-y-3 left-4 w-16 text-red-200/70">
          <svg viewBox="0 0 80 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-full w-full">
            <path
              d="M20 104C35 82 28 54 41 31C47 21 60 20 61 31C62 43 43 54 33 60C24 65 16 73 18 84C19 94 28 101 42 104"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <div className="relative space-y-1 pl-14 text-[11px] leading-5 text-zinc-800">
          <p className="font-semibold text-zinc-900">
            {getDigitalSignatureHeading(signer, context)}: {signer.assinatura_nome}
          </p>
          <p>CPF: {formatCpf(signer.cpf)}</p>
          <p>Cargo: {signer.cargo || "Nao informado"}</p>
          <p>
            {getDigitalSignatureDateLabel(signer, context)}: {formatDateTime(timestamp)}
          </p>
        </div>
      </div>
    </div>
  </div>
);

const RiskMatrix = () => (
  <table className="w-full table-fixed border-collapse text-center text-[11px] font-semibold text-zinc-900">
    <tbody>
      <tr>
        <td className="w-[50px] border border-zinc-400 p-2 text-[10px]" rowSpan={3}>
          <div className="-rotate-90 whitespace-nowrap">Grau de Inconformidade</div>
        </td>
        <td className="border border-zinc-400 p-3 text-left align-top leading-5">
          Inconformidades <strong>GRAVE</strong> que apresentam risco iminente a seguranca dos ocupantes.
        </td>
        <td className="border border-zinc-400 bg-yellow-300 p-3">Correcao prioritaria</td>
        <td className="border border-zinc-400 bg-red-500 p-3 text-white">Correcao imediata</td>
        <td className="border border-zinc-400 bg-red-500 p-3 text-white">Correcao imediata</td>
      </tr>
      <tr>
        <td className="border border-zinc-400 p-3 text-left align-top leading-5">
          Inconformidades <strong>MODERADA</strong> que podem comprometer a seguranca em medio prazo.
        </td>
        <td className="border border-zinc-400 bg-emerald-500 p-3 text-white">Correcao programada</td>
        <td className="border border-zinc-400 bg-yellow-300 p-3">Correcao prioritaria</td>
        <td className="border border-zinc-400 bg-red-500 p-3 text-white">Correcao imediata</td>
      </tr>
      <tr>
        <td className="border border-zinc-400 p-3 text-left align-top leading-5">
          Inconformidades <strong>LEVE</strong> que nao impactam diretamente na seguranca.
        </td>
        <td className="border border-zinc-400 bg-emerald-500 p-3 text-white">Correcao programada</td>
        <td className="border border-zinc-400 bg-emerald-500 p-3 text-white">Correcao programada</td>
        <td className="border border-zinc-400 bg-yellow-300 p-3">Correcao prioritaria</td>
      </tr>
      <tr>
        <td className="border border-zinc-400 p-2 text-[10px]" colSpan={2}>
          Nivel de Probabilidade
        </td>
        <td className="border border-zinc-400 p-2">Baixa</td>
        <td className="border border-zinc-400 p-2">Media</td>
        <td className="border border-zinc-400 p-2">Alta</td>
      </tr>
    </tbody>
  </table>
);

const ReportToolbar = ({
  navigateBack,
  onSync,
  onPrint,
  onSaveDraft,
  onFinalize,
  saving,
  snapshotIsCurrent,
  statusLabel,
  finalizeLabel,
}: {
  navigateBack: () => void;
  onSync: () => void;
  onPrint: () => void;
  onSaveDraft: () => void;
  onFinalize: () => void;
  saving: boolean;
  snapshotIsCurrent: boolean;
  statusLabel: string;
  finalizeLabel: string;
}) => (
  <div className="report-controls flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="ghost" size="sm" onClick={navigateBack}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Voltar
      </Button>
      <Badge variant="outline">{statusLabel}</Badge>
      <Badge variant="outline">{snapshotIsCurrent ? "Checklist sincronizado" : "Checklist desatualizado"}</Badge>
    </div>
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={onSync} disabled={saving}>
        <RefreshCcw className="mr-2 h-4 w-4" />
        Atualizar com checklist
      </Button>
      <Button variant="outline" onClick={onPrint} disabled={saving}>
        <Printer className="mr-2 h-4 w-4" />
        Imprimir / PDF
      </Button>
      <Button variant="outline" onClick={onSaveDraft} disabled={saving}>
        {saving ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Salvando
          </>
        ) : (
          <>
            <Save className="mr-2 h-4 w-4" />
            Salvar rascunho
          </>
        )}
      </Button>
      <Button onClick={onFinalize} disabled={saving}>
        {saving ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Salvando
          </>
        ) : (
          <>
            <FileCheck className="mr-2 h-4 w-4" />
            {finalizeLabel}
          </>
        )}
      </Button>
    </div>
  </div>
);

const CompanyReport = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isSystemAdmin, email } = useAuth();
  const [company, setCompany] = useState<Company | null>(null);
  const [report, setReport] = useState<ReportRow | null>(null);
  const [reportRequirements, setReportRequirements] = useState<ReportRequirement[]>([]);
  const [form, setForm] = useState<ReportFormState>(emptyForm());
  const [liveSnapshot, setLiveSnapshot] = useState<ChecklistSnapshot | null>(null);
  const [snapshot, setSnapshot] = useState<ChecklistSnapshot | null>(null);
  const [reportStatus, setReportStatus] = useState<ReportStatus>("rascunho");
  const [reportStorageAvailable, setReportStorageAvailable] = useState(true);
  const [nonConformityRecords, setNonConformityRecords] = useState<NonConformityRow[]>([]);
  const [extinguishers, setExtinguishers] = useState<ExtinguisherRow[]>([]);
  const [hydrants, setHydrants] = useState<HydrantRow[]>([]);
  const [luminaires, setLuminaires] = useState<LuminaireRow[]>([]);
  const [reportSignatures, setReportSignatures] = useState<CompanyReportSignatureRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [validationQrCodeDataUrl, setValidationQrCodeDataUrl] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!id) {
        return;
      }

      try {
        setLoading(true);

        const [
          companyResult,
          reportResult,
          requirementsResult,
          checklistData,
          nonConformitiesResult,
          extinguishersResult,
          hydrantsResult,
          luminairesResult,
          reportSignaturesResult,
        ] = await Promise.all([
          supabase
            .from("empresa")
            .select("id, razao_social, nome_fantasia, cnpj, responsavel, telefone, email, rua, numero, bairro, cidade, estado, cep, divisao, grupo, ocupacao_uso, area_m2, area_maior_pavimento_m2, area_depositos_m2, numero_ocupantes, altura_denominacao, altura_descricao, altura_real_m, grau_risco, possui_atrio")
            .eq("id", id)
            .maybeSingle(),
          supabase
            .from("empresa_relatorios")
            .select("*")
            .eq("empresa_id", id)
            .maybeSingle(),
          supabase
            .from("empresa_exigencias")
            .select(`
              atende,
              criterio_status,
              criterio_texto,
              exigencia_id,
              observacoes,
              exigencias_seguranca!inner (
                categoria,
                codigo,
                id,
                nome
              )
            `)
            .eq("empresa_id", id),
          loadChecklistData(supabase, id),
          supabase
            .from("empresa_checklist_nao_conformidades")
            .select("*")
            .eq("empresa_id", id)
            .order("updated_at", { ascending: false }),
          supabase
            .from("empresa_extintores")
            .select("id, numero, localizacao, tipo, carga_nominal, checklist_snapshot")
            .eq("empresa_id", id)
            .order("numero", { ascending: true }),
          supabase
            .from("empresa_hidrantes")
            .select("id, numero, localizacao, tipo_hidrante, checklist_snapshot")
            .eq("empresa_id", id)
            .order("numero", { ascending: true }),
          supabase
            .from("empresa_luminarias")
            .select("id, numero, localizacao, tipo_luminaria, status, checklist_snapshot")
            .eq("empresa_id", id)
            .order("numero", { ascending: true }),
          loadCompanyReportSignatures(supabase, id).catch((error) => {
            if (isMissingFunctionError(error, "get_empresa_relatorio_assinaturas")) {
              return null;
            }

            throw error;
          }),
        ]);

        if (companyResult.error) {
          throw companyResult.error;
        }
        if (reportResult.error && !isMissingRelationError(reportResult.error, "empresa_relatorios")) {
          throw reportResult.error;
        }
        if (requirementsResult.error) {
          throw requirementsResult.error;
        }
        if (nonConformitiesResult.error) {
          throw nonConformitiesResult.error;
        }
        if (extinguishersResult.error) {
          throw extinguishersResult.error;
        }
        if (hydrantsResult.error) {
          throw hydrantsResult.error;
        }
        if (luminairesResult.error) {
          throw luminairesResult.error;
        }
        if (!companyResult.data) {
          throw new Error("Empresa nao encontrada");
        }

        const reportData = reportResult.error ? null : reportResult.data;
        const persistedSignatureValue =
          reportData?.status === "finalizado" &&
          reportData.dados_adicionais &&
          typeof reportData.dados_adicionais === "object" &&
          !Array.isArray(reportData.dados_adicionais)
            ? ((reportData.dados_adicionais as Record<string, Json>).report_signatures ??
              null)
            : null;
        const persistedSignatures = parseCompanyReportSignatures(
          persistedSignatureValue,
        );
        const computedSnapshot = buildChecklistSnapshot(
          checklistData.models,
          checklistData.groupsByModel,
          checklistData.responses,
        );
        const persistedSnapshot = isChecklistSnapshot(reportData?.checklist_snapshot)
          ? reportData.checklist_snapshot
          : null;
        const mappedRequirements =
          (requirementsResult.data as ReportRequirementRow[] | null)?.flatMap((item) => {
            const requirement = Array.isArray(item.exigencias_seguranca)
              ? item.exigencias_seguranca[0]
              : item.exigencias_seguranca;

            if (!requirement) {
              return [];
            }

            return [
              {
                atende: item.atende,
                categoria: requirement.categoria,
                codigo: requirement.codigo,
                criterioStatus: item.criterio_status,
                criterioTexto: item.criterio_texto,
                id: item.exigencia_id,
                nome: requirement.nome,
                observacoes: item.observacoes,
              },
            ];
          }) ?? [];

        setCompany(companyResult.data);
        setReport(reportData);
        setReportRequirements(mappedRequirements);
        setLiveSnapshot(computedSnapshot);
        setSnapshot(persistedSnapshot || computedSnapshot);
        setReportStatus(reportData?.status === "finalizado" ? "finalizado" : "rascunho");
        setReportStorageAvailable(!reportResult.error);
        setForm(buildDefaultForm(companyResult.data, reportData));
        setNonConformityRecords(nonConformitiesResult.data || []);
        setExtinguishers(extinguishersResult.data || []);
        setHydrants(hydrantsResult.data || []);
        setLuminaires(luminairesResult.data || []);
        setReportSignatures(
          persistedSignatures.length > 0
            ? persistedSignatures
            : reportSignaturesResult || [],
        );
      } catch (error) {
        console.error("Error loading report page:", error);
        toast({
          title: "Erro ao carregar relatorio",
          description: "Nao foi possivel carregar os dados do relatorio.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, toast]);

  useEffect(() => {
    const gestor = reportSignatures.find((signer) => signer.is_gestor);

    if (!gestor) {
      return;
    }

    setForm((current) => ({
      ...current,
      representanteNome:
        current.representanteNome || gestor.assinatura_nome || gestor.nome || "",
      representanteCargo:
        !current.representanteCargo ||
        current.representanteCargo === "Responsavel pela empresa"
          ? gestor.cargo || current.representanteCargo
          : current.representanteCargo,
    }));
  }, [reportSignatures]);

  useEffect(() => {
    const generateValidationQrCode = async () => {
      if (!id || form.reportMode !== "tecnico") {
        setValidationQrCodeDataUrl(null);
        return;
      }

      const reference = encodeURIComponent(
        report?.updated_at || snapshot?.generated_at || new Date().toISOString(),
      );
      const validationUrl = `${window.location.origin}/relatorios/${id}?validacao=${reference}`;

      try {
        const { toDataURL } = await import("qrcode");
        const qrCodeDataUrl = await toDataURL(validationUrl, {
          margin: 1,
          width: 180,
        });
        setValidationQrCodeDataUrl(qrCodeDataUrl);
      } catch (error) {
        console.error("Error generating report validation QR code:", error);
        setValidationQrCodeDataUrl(null);
      }
    };

    void generateValidationQrCode();
  }, [form.reportMode, id, report?.updated_at, snapshot?.generated_at]);

  const handleInputChange = (field: keyof ReportFormState, value: string) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleReportModeChange = (nextMode: ReportMode) => {
    setForm((current) => {
      const currentTitle = current.titulo.trim();
      const shouldSyncTitle =
        !currentTitle ||
        currentTitle === OPERATIONAL_REPORT_TITLE ||
        currentTitle === TECHNICAL_REPORT_TITLE;

      return {
        ...current,
        reportMode: nextMode,
        titulo: shouldSyncTitle ? getDefaultReportTitle(nextMode) : current.titulo,
      };
    });
  };

  const handleSyncChecklistSnapshot = () => {
    if (!liveSnapshot) {
      return;
    }

    setSnapshot(liveSnapshot);
    toast({
      title: "Resumo sincronizado",
      description: "O relatorio agora usa o resultado mais recente do checklist.",
    });
  };

  const handlePrint = () => {
    window.print();
  };

  const handleSave = async (nextStatus: ReportStatus = "rascunho") => {
    if (!id || !company || !snapshot) {
      return;
    }

    if (!reportStorageAvailable) {
      toast({
        title: "Relatorio sem persistencia",
        description:
          "A tabela empresa_relatorios ainda nao existe no Supabase. Aplique a migration para salvar o relatorio.",
        variant: "destructive",
      });
      return;
    }

    if (
      nextStatus === "finalizado" &&
      (!form.inspetorNome.trim() || !form.inspetorCargo.trim())
    ) {
      toast({
        title: "Responsavel tecnico obrigatorio",
        description:
          "Informe nome e cargo do inspetor/responsavel tecnico antes de finalizar o relatorio.",
        variant: "destructive",
      });
      return;
    }

    if (nextStatus === "finalizado" && form.reportMode === "tecnico") {
      if (!isSystemAdmin) {
        toast({
          title: "Emissao tecnica restrita",
          description:
            "A versao tecnica oficial so pode ser finalizada por um responsavel tecnico da FIRE TETRAEDRO.",
          variant: "destructive",
        });
        return;
      }

      if (!form.artRrtNumero.trim()) {
        toast({
          title: "ART/RRT obrigatoria",
          description:
            "Informe o numero da ART/RRT antes de emitir o relatorio tecnico oficial.",
          variant: "destructive",
        });
        return;
      }

      if (missingExecutionTraceabilityCount > 0) {
        toast({
          title: "Rastreabilidade incompleta",
          description:
            "Nao e possivel emitir o relatorio tecnico enquanto existirem checklists sem autoria registrada.",
          variant: "destructive",
        });
        return;
      }
    }

    try {
      setSaving(true);

      let latestReportSignatures = reportSignatures;

      try {
        latestReportSignatures = await loadCompanyReportSignatures(supabase, id);
      } catch (signatureError) {
        if (
          !isMissingFunctionError(
            signatureError,
            "get_empresa_relatorio_assinaturas",
          )
        ) {
          console.error(
            "Error refreshing report signatures before save:",
            signatureError,
          );
        }
      }

      const persistedSignatures =
        latestReportSignatures.length > 0
          ? latestReportSignatures
          : [
              {
                user_id: "gestor-fallback",
                nome: company.responsavel || "Gestor responsavel",
                email: company.email || "-",
                cpf: null,
                cargo: null,
                papel: "gestor",
                is_gestor: true,
                assinatura_nome: company.responsavel || "Gestor responsavel",
                executed_checklists: [],
                first_activity_at: null,
                last_activity_at: null,
                total_checklists: 0,
              } satisfies CompanyReportSignatureRow,
            ];
      const previousAdditionalData =
        report?.dados_adicionais &&
        typeof report.dados_adicionais === "object" &&
        !Array.isArray(report.dados_adicionais)
          ? (report.dados_adicionais as Record<string, Json>)
          : {};

      const payload: Database["public"]["Tables"]["empresa_relatorios"]["Insert"] = {
        empresa_id: id,
        titulo: normalizeNullable(form.titulo) || getDefaultReportTitle(form.reportMode),
        numero_relatorio: normalizeNullable(form.numeroRelatorio),
        data_inspecao: form.dataInspecao || null,
        data_emissao: form.dataEmissao || null,
        hora_inicio: form.horaInicio || null,
        hora_fim: form.horaFim || null,
        inspetor_nome: normalizeNullable(form.inspetorNome),
        inspetor_cargo: normalizeNullable(form.inspetorCargo),
        representante_nome: normalizeNullable(form.representanteNome),
        representante_cargo: normalizeNullable(form.representanteCargo),
        objetivo: normalizeNullable(form.objetivo),
        escopo: normalizeNullable(form.escopo),
        observacoes_gerais: normalizeNullable(form.observacoesGerais),
        recomendacoes: normalizeNullable(form.recomendacoes),
        conclusao: normalizeNullable(form.conclusao),
        status: nextStatus,
        checklist_snapshot: snapshot,
        dados_adicionais: {
          ...previousAdditionalData,
          empresa_responsavel: company.responsavel,
          empresa_telefone: company.telefone,
          empresa_email: company.email,
          report_model:
            form.reportMode === "tecnico"
              ? "fire-rtci-oficial"
              : "fire-rip-operacional",
          report_mode: form.reportMode,
          art_rrt_numero: normalizeNullable(form.artRrtNumero),
          report_legal_notice:
            form.reportMode === "tecnico"
              ? TECHNICAL_LEGAL_NOTICE
              : OPERATIONAL_LEGAL_NOTICE,
          report_validation_url:
            form.reportMode === "tecnico" && id
              ? `${window.location.origin}/relatorios/${id}`
              : null,
          report_validated_by:
            form.reportMode === "tecnico" ? normalizeNullable(email) : null,
          non_conformities_count: nonConformityRecords.length,
          report_signatures: persistedSignatures,
          report_signatures_generated_at: new Date().toISOString(),
        },
      };

      const { data, error } = await supabase
        .from("empresa_relatorios")
        .upsert(payload, { onConflict: "empresa_id" })
        .select("*")
        .single();

      if (error) {
        throw error;
      }

      setReport(data);
      setReportStatus(nextStatus);
      setReportSignatures(persistedSignatures);
      toast({
        title: "Relatorio salvo",
        description:
          nextStatus === "finalizado"
            ? "O relatorio foi salvo e marcado como finalizado."
            : "Os dados do relatorio foram atualizados com sucesso.",
      });
    } catch (error) {
      console.error("Error saving report:", error);
      toast({
        title: "Erro ao salvar relatorio",
        description: "Nao foi possivel salvar o relatorio.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!company || !snapshot) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-xl">
          <CardContent className="py-12">
            <p className="text-center text-muted-foreground">
              Nao foi possivel localizar os dados da empresa para gerar o relatorio.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusMeta = getReportStatusBadge(reportStatus);
  const snapshotIsCurrent = liveSnapshot?.generated_at === snapshot.generated_at;
  const equipmentCatalog = buildEquipmentCatalog({
    extinguishers,
    hydrants,
    luminaires,
  });
  const reportEntries = buildReportNonConformityEntries({
    records: nonConformityRecords,
    snapshot,
    equipmentCatalog,
    form,
  });
  const annexChunks = chunkArray(
    reportEntries.length > 0
      ? reportEntries
      : [
          {
            id: "placeholder-annex",
            checklistItemId: "",
            inspectionCode: "-",
            inspectionName: "Sem registros",
            section: "Sem secao",
            itemDisplay: "-",
            itemReference: "-",
            itemDescription: "Nenhuma nao conformidade com registro fotograficado foi encontrada.",
            detailDescription:
              "O relatorio atual nao possui imagens ou comentarios detalhados de nao conformidade salvos nos checklists.",
            imageDataUrl: null,
            sourceType: "principal" as const,
            sourceLabel: "Sem registros",
            sourceSubtitle: "Relatorio sem anexos fotograficos",
            contextLabel: "Sem registros",
            correctionAction: "Nao ha medida corretiva detalhada registrada para este relatorio.",
            startDate: form.dataInspecao || form.dataEmissao || getToday(),
            dueDate: form.dataEmissao || getToday(),
            riskLevel: "BAIXA" as const,
            riskPriority: "Correcao programada",
            riskTone: "neutral" as const,
          },
        ],
    2,
  );
  const generalChecklistLines = buildGeneralChecklistLines(snapshot);
  const technicalSummary = buildTechnicalSnapshotSummary(snapshot);
  const checkedGeneralItems = generalChecklistLines.reduce(
    (total, line) => total + line.checked,
    0,
  );

  const requirementMeasureEntries = buildRequirementMeasureEntries(
    reportRequirements,
    generalChecklistLines,
  );
  const requirementsAttendedCount = requirementMeasureEntries.filter(
    (item) => item.statusLabel === "ATENDE",
  ).length;
  const requirementsWithWarningCount = requirementMeasureEntries.filter(
    (item) => item.statusTone === "warning",
  ).length;
  const requirementMeasureChunks = chunkArray(
    requirementMeasureEntries.length > 0
      ? requirementMeasureEntries
      : [
          {
            id: "placeholder-requirement",
            sequence: 1,
            code: "-",
            category: "Sem exigencias registradas",
            name: "Nenhuma exigencia aplicavel foi encontrada para esta empresa.",
            detail:
              "Cadastre ou sincronize as exigencias da empresa para que a secao 3 seja preenchida no relatorio.",
            requiredLabel: "NAO",
            existingLabel: "-",
            statusLabel: "PENDENTE",
            statusTone: "warning" as const,
          },
        ],
    6,
  );
  const snapshotCorrectionPlanEntries = buildSnapshotCorrectionPlanEntries({
    snapshot,
    equipmentCatalog,
    detailedEntries: reportEntries,
    form,
  });
  const requirementCorrectionPlanEntries = buildRequirementCorrectionPlanEntries({
    requirementMeasureEntries,
    form,
  });
  const correctionPlanEntries: CorrectionPlanEntry[] =
    reportEntries.length > 0 ||
    snapshotCorrectionPlanEntries.length > 0 ||
    requirementCorrectionPlanEntries.length > 0
      ? [
          ...reportEntries,
          ...snapshotCorrectionPlanEntries,
          ...requirementCorrectionPlanEntries,
        ]
      : [
          {
            id: "placeholder-plan",
            contextLabel: "Checklist consolidado",
            itemDisplay: "-",
            correctionAction:
              "Nao ha medidas corretivas a registrar para o relatorio atual.",
            startDate: form.dataInspecao || form.dataEmissao || getToday(),
            dueDate: form.dataEmissao || getToday(),
            riskLevel: "BAIXA",
            riskPriority: "Correcao programada",
            riskTone: "neutral",
          },
        ];
  const planChunks = chunkArray(correctionPlanEntries, 3);

  const riskSummary = reportEntries.reduce(
    (summary, entry) => {
      if (entry.riskLevel === "ALTA") {
        summary.high += 1;
      } else if (entry.riskLevel === "MEDIA") {
        summary.medium += 1;
      } else {
        summary.low += 1;
      }
      return summary;
    },
    { high: 0, medium: 0, low: 0 },
  );
  const missingTechnicalResponsible =
    !form.inspetorNome.trim() || !form.inspetorCargo.trim();
  const isTechnicalReport = form.reportMode === "tecnico";
  const reportTitle = form.titulo.trim() || getDefaultReportTitle(form.reportMode);
  const reportSubtitle = isTechnicalReport
    ? "Relatorio tecnico oficial com potencial validade juridica"
    : "Relatorio operacional para uso interno e acompanhamento preventivo";
  const reportLegalNotice = isTechnicalReport
    ? TECHNICAL_LEGAL_NOTICE
    : OPERATIONAL_LEGAL_NOTICE;
  const technicalValidationUrl =
    isTechnicalReport && id
      ? `${window.location.origin}/relatorios/${id}`
      : null;
  const signatureRows =
    reportSignatures.length > 0
      ? reportSignatures
      : [
          {
            user_id: "gestor-fallback",
            nome: company.responsavel || "Gestor responsavel",
            email: company.email || "-",
            cpf: null,
            cargo: null,
            papel: "gestor",
            is_gestor: true,
            assinatura_nome: company.responsavel || "Gestor responsavel",
            executed_checklists: [],
            first_activity_at: null,
            last_activity_at: null,
            total_checklists: 0,
          } satisfies CompanyReportSignatureRow,
        ];
  const signatureChunks = chunkArray(signatureRows, 4);
  const checklistPrintSections = buildChecklistPrintSections({
    snapshot,
    equipmentCatalog,
    signers: signatureRows,
  });
  const annexNaoAplicavelCount = checklistPrintSections.reduce(
    (total, section) =>
      total + section.items.filter((item) => item.status === "NA").length,
    0,
  );
  const missingExecutionTraceabilityCount = checklistPrintSections.filter(
    (section) => section.signers.length === 0,
  ).length;

  const conclusionParagraphs = form.conclusao.trim()
    ? form.conclusao
        .split(/\n{2,}/)
        .map((paragraph) => paragraph.trim())
        .filter(Boolean)
    : [
        `A inspecao tecnica preventiva realizada consolidou ${technicalSummary.total} item(ns), sendo ${technicalSummary.conforme} conforme(s), ${technicalSummary.naoConforme} nao conformidade(s), ${technicalSummary.naoAplicavel} nao aplicavel(is) e ${technicalSummary.pendentes} pendente(s).`,
        annexNaoAplicavelCount !== technicalSummary.naoAplicavel
          ? `${annexNaoAplicavelCount} item(ns) nao aplicavel(is) permaneceram considerados no relatorio por integrarem checklists com ao menos um item conforme ou nao conforme.`
          : null,
        riskSummary.high > 0
          ? `${riskSummary.high} nao conformidade(s) foi(foram) classificada(s) como de risco alto, exigindo tratamento imediato para preservar a seguranca da vida e do patrimonio.`
          : "Nao foram identificadas nao conformidades classificadas como risco alto nos registros detalhados anexos.",
        missingTechnicalResponsible
          ? "Este documento permanece com validade tecnica limitada ate a identificacao completa do responsavel tecnico e de sua funcao na inspecao."
          : "Os registros detalhados com comentarios e imagens foram incorporados ao presente relatorio e estruturados em anexo fotografico e plano de correcao, permitindo rastreabilidade das medidas corretivas recomendadas.",
        `A adocao tempestiva das acoes propostas e a reavaliacao tecnica dos itens corrigidos sao essenciais para a manutencao das condicoes de seguranca contra incendios e emergencias da edificacao.`,
      ].filter((paragraph): paragraph is string => Boolean(paragraph));
  const resultObservationLines = [
    isTechnicalReport
      ? "Modo do documento: relatorio tecnico oficial."
      : "Modo do documento: relatorio operacional sem validade tecnica legal.",
    `Consolidacao tecnica: ${technicalSummary.conforme} C + ${technicalSummary.naoConforme} NC + ${technicalSummary.naoAplicavel} NA + ${technicalSummary.pendentes} P = ${technicalSummary.total} item(ns).`,
    `Nao aplicaveis considerados nos anexos e no resumo operacional: ${annexNaoAplicavelCount}.`,
    `${generalChecklistLines.length} checklist(s) gerais tiveram ao menos um item verificado nesta emissao, considerando somente o checklist principal de extintores, hidrantes e luminarias.`,
    `Medidas com atendimento tecnico pleno: ${requirementsAttendedCount} de ${requirementMeasureEntries.length}.`,
  ];

  if (reportEntries.length > 0) {
    resultObservationLines.push(
      `${reportEntries.length} registro(s) detalhado(s) com imagem e comentario foram incorporados aos anexos e ao plano de correcao, com classificacao de risco.`,
    );
  }

  if (requirementsWithWarningCount > 0) {
    resultObservationLines.push(
      `${requirementsWithWarningCount} medida(s) exigida(s) permanecem com avaliacao operacional parcial e exigem conclusao do checklist para julgamento tecnico definitivo.`,
    );
  }

  if (form.observacoesGerais.trim()) {
    resultObservationLines.push(form.observacoesGerais.trim());
  }

  if (missingExecutionTraceabilityCount > 0) {
    resultObservationLines.push(
      `Rastreabilidade incompleta: ${missingExecutionTraceabilityCount} checklist(s) executado(s) nao possuem autoria registrada no relatorio final.`,
    );
  }

  if (missingTechnicalResponsible) {
    resultObservationLines.push(
      "Responsavel tecnico/inspetor ainda nao identificado completamente. O documento nao deve ser tratado como laudo tecnico final ate a regularizacao.",
    );
  }

  const pages: ReactNode[] = [];

  const renderSignatureCard = (signer: CompanyReportSignatureRow) => {
    const signerExecutionLines = buildCompactSignatureExecutionLines(
      signer.executed_checklists,
    );
    const visibleExecutionLines = signerExecutionLines.slice(0, 4);

    return (
      <div key={signer.user_id} className="overflow-hidden border border-zinc-300">
        <div className="flex items-start justify-between gap-3 border-b border-zinc-300 bg-zinc-50 px-4 py-3">
          <div>
            <p className="text-[12px] font-semibold uppercase text-zinc-900">
              {signer.assinatura_nome}
            </p>
            <p className="mt-1 text-[10.5px] text-zinc-600">
              {getSignatureRoleLabel(signer)} | {signer.email || "-"}
            </p>
            <p className="mt-1 text-[10px] text-zinc-500">
              CPF {formatCpf(signer.cpf)} | Cargo {signer.cargo || "-"}
            </p>
          </div>
          <RequirementStatusBadge
            label={signer.is_gestor ? "Gestor" : "Executor"}
            tone={signer.is_gestor ? "success" : "neutral"}
          />
        </div>

        <div className="space-y-3 px-4 py-4">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-sm border border-zinc-300 px-3 py-2">
              <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
                Checklists
              </p>
              <p className="mt-1 text-[15px] font-bold text-zinc-900">
                {signer.total_checklists}
              </p>
            </div>
            <div className="rounded-sm border border-zinc-300 px-3 py-2">
              <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
                Ultima atividade
              </p>
              <p className="mt-1 text-[10.5px] font-semibold text-zinc-800">
                {formatDateTime(signer.last_activity_at)}
              </p>
            </div>
          </div>

          <div className="rounded-sm border border-zinc-300 bg-white px-3 py-3">
            <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
              Checklists executados por este colaborador
            </p>
            {visibleExecutionLines.length > 0 ? (
              <ul className="mt-2 space-y-1.5 text-[10.5px] leading-5 text-zinc-800">
                {visibleExecutionLines.map((line) => (
                  <li key={`${signer.user_id}-${line.key}`}>{line.label}</li>
                ))}
              </ul>
            ) : (
                <p className="mt-2 text-[10.5px] leading-5 text-zinc-700">
                  {signer.is_gestor
                  ? "Assinatura institucional do gestor responsavel pela empresa."
                  : "Nenhum checklist com autoria registrada foi localizado para este usuario."}
                </p>
              )}
              {signerExecutionLines.length > visibleExecutionLines.length ? (
                <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
                  + {signerExecutionLines.length - visibleExecutionLines.length} checklist(s) adicional(is)
              </p>
            ) : null}
          </div>

          <div className="pt-6">
            <ChecklistDigitalSignatureStamp
              signer={signer}
              timestamp={signer.last_activity_at}
              context="summary"
            />
          </div>
        </div>
      </div>
    );
  };

  pages.push(
    <div className="space-y-8">
      <section className="space-y-3">
        <SectionHeading index="1" title="Objetivo e Aplicacao da Inspecao" />
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-sm border border-zinc-300 bg-zinc-50 px-4 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
              Objetivo
            </p>
            <p className="mt-3 text-[13px] leading-7 text-zinc-800">
              {form.objetivo}
            </p>
          </div>
          <div className="rounded-sm border border-zinc-300 bg-zinc-50 px-4 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
              Aplicacao / Escopo
            </p>
            <p className="mt-3 text-[13px] leading-7 text-zinc-800">
              {form.escopo}
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <SectionHeading
          index="2"
          title={'Caracteristicas da Unidade Vistoriada, Confirmadas "In Loco"'}
        />
        <div className="border border-zinc-300">
          <div className="grid grid-cols-[1.7fr_1fr_1fr]">
            <DataCell label="Nome do Estabelecimento" value={company.razao_social} />
            <DataCell label="Responsavel" value={company.responsavel || "-"} />
            <DataCell label="CNPJ" value={company.cnpj || "-"} />
          </div>
          <div className="grid grid-cols-[1fr_1fr_1fr]">
            <DataCell label="Telefone" value={company.telefone || "-"} />
            <DataCell label="E-mail" value={company.email || "-"} />
            <DataCell label="CNAE" value={company.ocupacao_uso || "-"} />
          </div>
          <div className="grid grid-cols-[3fr_1fr]">
            <DataCell label="Endereco Completo" value={buildCompanyAddress(company)} />
            <DataCell label="N" value={company.numero || "-"} />
          </div>
          <div className="grid grid-cols-[1.5fr_1.5fr_1fr]">
            <DataCell label="Cidade" value={company.cidade || "-"} />
            <DataCell label="Bairro" value={company.bairro || "-"} />
            <DataCell label="CEP" value={company.cep || "-"} />
          </div>
          <div className="grid grid-cols-[1fr_1fr_2fr_1fr]">
            <DataCell label="Area" value={formatNumber(company.area_m2, "m2")} className="border-b-0" />
            <DataCell
              label="Altura"
              value={company.altura_real_m ? formatNumber(company.altura_real_m, "m") : company.altura_descricao || "-"}
              className="border-b-0"
            />
            <DataCell label="Grupo-Divisao da Ocupacao" value={buildOccupationLabel(company)} className="border-b-0" />
            <DataCell label="Risco Incendio" value={(company.grau_risco || "-").toUpperCase()} className="border-b-0" />
          </div>
        </div>
      </section>
    </div>,
  );

  requirementMeasureChunks.forEach((chunk, chunkIndex) => {
    pages.push(
      <div className="space-y-5">
        <section className="space-y-3">
          <SectionHeading index="3" title="Medidas de Seguranca Contra Incendios da Edificacao" />
          {chunkIndex === 0 ? (
            <div className="rounded-sm border border-zinc-300 bg-zinc-50 px-4 py-4 text-[12px] leading-6 text-zinc-800">
              <p>
                As medidas abaixo correspondem as exigencias aplicaveis da empresa e indicam, de forma objetiva,
                se cada medida existe na edificacao e se atende ao enquadramento registrado no sistema.
              </p>
            </div>
          ) : null}
        </section>

        <div className="overflow-hidden border border-zinc-300">
          <table className="w-full border-collapse text-[10.5px] leading-5 text-zinc-900">
            <thead>
              <tr className="bg-zinc-100 text-center uppercase">
                <th className="w-[34px] border border-zinc-300 px-2 py-3 font-bold">No</th>
                <th className="border border-zinc-300 px-3 py-3 font-bold">
                  Medidas de Seguranca Contra Incendios
                </th>
                <th className="w-[70px] border border-zinc-300 px-2 py-3 font-bold">Exigida</th>
                <th className="w-[92px] border border-zinc-300 px-2 py-3 font-bold">Existente</th>
                <th className="w-[82px] border border-zinc-300 px-2 py-3 font-bold">Status</th>
              </tr>
            </thead>
            <tbody>
              {chunk.map((entry) => (
                <tr key={entry.id} className="align-top">
                  <td className="border border-zinc-300 px-2 py-3 text-center font-bold">
                    {entry.sequence}
                  </td>
                  <td className="border border-zinc-300 px-3 py-3">
                    <div className="space-y-2">
                      <div className="space-y-1">
                        <p className="text-[11px] font-bold uppercase text-zinc-900">
                          {entry.name}
                        </p>
                        <p className="text-[9px] font-semibold uppercase tracking-[0.06em] text-zinc-500">
                          {entry.code} | {entry.category}
                        </p>
                      </div>
                      {entry.detail ? (
                        <div className="rounded-sm border border-zinc-200 bg-zinc-50 px-2.5 py-2 text-[9.5px] leading-4 text-zinc-700">
                          {entry.detail}
                        </div>
                      ) : null}
                    </div>
                  </td>
                  <td className="border border-zinc-300 px-2 py-3 text-center">
                    <RequirementStatusBadge label={entry.requiredLabel} tone="neutral" />
                  </td>
                  <td className="border border-zinc-300 px-2 py-3 text-center">
                    <RequirementStatusBadge
                      label={entry.existingLabel}
                      tone={entry.existingLabel === "EXISTENTE" ? "success" : "danger"}
                    />
                  </td>
                  <td className="border border-zinc-300 px-2 py-3 text-center">
                    <RequirementStatusBadge
                      label={entry.statusLabel}
                      tone={entry.statusTone}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>,
    );
  });

  pages.push(
    <div className="space-y-8">
      <section className="space-y-4">
        <SectionHeading index="4" title="Resultado da Avaliacao" />
        <div className="grid grid-cols-6 gap-3">
          <div className="rounded-sm border border-zinc-300 bg-zinc-50 px-3 py-4">
            <div className="text-[9px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
              Itens avaliados
            </div>
            <div className="mt-2 text-[24px] font-bold text-zinc-900">{technicalSummary.total}</div>
          </div>
          <div className="rounded-sm border border-zinc-300 bg-emerald-50 px-3 py-4">
            <div className="text-[9px] font-semibold uppercase tracking-[0.08em] text-emerald-700">
              Conformes
            </div>
            <div className="mt-2 text-[24px] font-bold text-emerald-800">{technicalSummary.conforme}</div>
          </div>
          <div className="rounded-sm border border-zinc-300 bg-red-50 px-3 py-4">
            <div className="text-[9px] font-semibold uppercase tracking-[0.08em] text-red-700">
              Nao conformes
            </div>
            <div className="mt-2 text-[24px] font-bold text-red-800">{technicalSummary.naoConforme}</div>
          </div>
          <div className="rounded-sm border border-zinc-300 bg-amber-50 px-3 py-4">
            <div className="text-[9px] font-semibold uppercase tracking-[0.08em] text-amber-700">
              Nao aplicaveis
            </div>
            <div className="mt-2 text-[24px] font-bold text-amber-800">{annexNaoAplicavelCount}</div>
          </div>
          <div className="rounded-sm border border-zinc-300 bg-slate-50 px-3 py-4">
            <div className="text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-600">
              Pendentes
            </div>
            <div className="mt-2 text-[24px] font-bold text-slate-800">{technicalSummary.pendentes}</div>
          </div>
          <div className="rounded-sm border border-zinc-300 bg-amber-50 px-3 py-4">
            <div className="text-[9px] font-semibold uppercase tracking-[0.08em] text-amber-700">
              Risco alto
            </div>
            <div className="mt-2 text-[24px] font-bold text-amber-800">{riskSummary.high}</div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="rounded-sm border border-zinc-300 bg-zinc-50 px-4 py-4 text-[12px] leading-6 text-zinc-800">
            <p>
              O quadro abaixo considera apenas checklists com ao menos um item marcado. Nos sistemas de extintores,
              hidrantes e luminarias, a sintese contempla somente o checklist geral do sistema, sem listar os
              checklists individuais por equipamento.
            </p>
          </div>
          <div className="border border-zinc-300">
            <table className="w-full border-collapse text-[11px]">
              <thead>
                <tr className="bg-zinc-100">
                  <th className="border border-zinc-300 px-3 py-2 text-left font-semibold">Checklist geral</th>
                  <th className="border border-zinc-300 px-2 py-2 text-center font-semibold">Itens checados</th>
                  <th className="border border-zinc-300 px-2 py-2 text-center font-semibold">C</th>
                  <th className="border border-zinc-300 px-2 py-2 text-center font-semibold">NC</th>
                  <th className="border border-zinc-300 px-2 py-2 text-center font-semibold">NA</th>
                  <th className="border border-zinc-300 px-2 py-2 text-center font-semibold">Status tecnico</th>
                </tr>
              </thead>
              <tbody>
                {generalChecklistLines.length > 0 ? (
                  generalChecklistLines.map((line) => (
                    <tr key={line.code}>
                      <td className="border border-zinc-300 px-3 py-2">{`${line.code} - ${line.name}`}</td>
                      <td className="border border-zinc-300 px-2 py-2 text-center">
                        {line.checked}/{line.totalRelevant}
                      </td>
                      <td className="border border-zinc-300 px-2 py-2 text-center">{line.conforme}</td>
                      <td className="border border-zinc-300 px-2 py-2 text-center">{line.naoConforme}</td>
                      <td className="border border-zinc-300 px-2 py-2 text-center">{line.naoAplicavel}</td>
                      <td className="border border-zinc-300 px-2 py-2 text-center">
                        <RequirementStatusBadge
                          label={line.operationalStatusLabel}
                          tone={line.operationalStatusTone}
                        />
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="border border-zinc-300 px-3 py-3 text-center text-zinc-600" colSpan={6}>
                      Nenhum checklist geral teve item marcado neste relatorio.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="grid grid-cols-[1fr_200px] gap-4">
            <div className="space-y-2 border border-zinc-300 p-4 text-[12px] leading-6 text-zinc-800">
              <p className="font-semibold uppercase text-zinc-900">Observacoes das Medidas</p>
              {resultObservationLines.map((line) => (
                <p key={line}>- {line}</p>
              ))}
            </div>
            <div className="space-y-3">
              <div className="rounded-sm border border-zinc-300 bg-white px-4 py-4">
                <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
                  Itens gerais checados
                </p>
                <p className="mt-2 text-[24px] font-bold text-zinc-900">{checkedGeneralItems}</p>
              </div>
              <div className="rounded-sm border border-zinc-300 bg-white px-4 py-4">
                <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
                  Registros anexados
                </p>
                <p className="mt-2 text-[24px] font-bold text-zinc-900">{reportEntries.length}</p>
              </div>
              <div className="rounded-sm border border-zinc-300 bg-white px-4 py-4">
                <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
                  Exigencias atendidas
                </p>
                <p className="mt-2 text-[24px] font-bold text-zinc-900">
                  {requirementsAttendedCount}
                </p>
              </div>
              <div className="rounded-sm border border-zinc-300 bg-white px-4 py-4">
                <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
                  Checklists gerais
                </p>
                <p className="mt-2 text-[24px] font-bold text-zinc-900">{generalChecklistLines.length}</p>
              </div>
            </div>
          </div>

        </div>
      </section>
    </div>,
  );

  pages.push(
    <div className="space-y-6">
      <section className="space-y-4">
        <SectionHeading index="4" title="Resultado da Avaliacao - Matriz de Criticidade" />
        <div className="grid grid-cols-[minmax(0,1fr)_220px] items-start gap-4">
          <div className="min-w-0 overflow-hidden rounded-sm border border-zinc-300 bg-zinc-50 px-4 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
              Matriz de criticidade
            </p>
            <div className="mt-3">
              <RiskMatrix />
            </div>
          </div>
          <div className="min-w-0 space-y-3">
            <div className="rounded-sm border border-red-200 bg-red-50 px-4 py-4">
              <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-red-700">
                Risco alto
              </p>
              <p className="mt-2 text-[24px] font-bold text-red-800">{riskSummary.high}</p>
            </div>
            <div className="rounded-sm border border-amber-200 bg-amber-50 px-4 py-4">
              <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-amber-700">
                Risco medio
              </p>
              <p className="mt-2 text-[24px] font-bold text-amber-800">{riskSummary.medium}</p>
            </div>
            <div className="rounded-sm border border-zinc-200 bg-zinc-50 px-4 py-4">
              <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-zinc-600">
                Risco baixo
              </p>
              <p className="mt-2 text-[24px] font-bold text-zinc-900">{riskSummary.low}</p>
            </div>
          </div>
        </div>
      </section>
    </div>,
  );

  annexChunks.forEach((chunk, chunkIndex) => {
    pages.push(
      <div className="space-y-6">
        <SectionHeading index="5" title="Anexos da Avaliacao" />
        {chunk.map((entry) => (
          <div key={entry.id} className="overflow-hidden border border-zinc-300">
            <div className="flex min-h-[250px] items-center justify-center bg-white p-5">
              {entry.imageDataUrl ? (
                <img
                  src={entry.imageDataUrl}
                  alt={entry.detailDescription || entry.itemDescription}
                  className="max-h-[230px] max-w-full object-contain"
                />
              ) : (
                <div className="flex h-[230px] w-full items-center justify-center border border-dashed border-zinc-300 bg-zinc-50 text-center text-[12px] text-zinc-500">
                  Imagem nao registrada para esta nao conformidade.
                </div>
              )}
            </div>
            <div className="border-t border-zinc-300 bg-zinc-50 px-4 py-3 text-center">
              <div className="flex items-center justify-center gap-2">
                <p className="text-[10px] font-bold uppercase text-zinc-900">
                  {entry.contextLabel} | Item {entry.itemDisplay}
                </p>
                <RequirementStatusBadge label={`Risco ${entry.riskLevel}`} tone={entry.riskTone} />
              </div>
              <p className="mt-1 text-[10.5px] font-semibold leading-5 text-zinc-800">
                {entry.itemDescription}
              </p>
              <p className="mt-1 text-[10px] leading-5 text-zinc-700">
                {entry.detailDescription || "Nao conformidade registrada sem comentario adicional."}
              </p>
            </div>
          </div>
        ))}
        {chunkIndex === annexChunks.length - 1 && form.recomendacoes.trim() && (
          <div className="rounded-sm border border-zinc-300 bg-zinc-50 p-4 text-[12px] leading-6 text-zinc-800">
            <p className="font-semibold uppercase text-zinc-900">Recomendacoes complementares</p>
            <p className="mt-2 whitespace-pre-wrap">{form.recomendacoes.trim()}</p>
          </div>
        )}
      </div>,
    );
  });

  planChunks.forEach((chunk) => {
    pages.push(
      <div className="space-y-5">
        <SectionHeading index="6" title="Plano de Correcao" />
        <div className="overflow-hidden border border-zinc-300">
          <table className="w-full border-collapse text-[11px] leading-5 text-zinc-800">
            <thead>
              <tr className="bg-zinc-100 text-center uppercase">
                <th className="border border-zinc-300 px-3 py-2 font-bold">Medidas Corretivas</th>
                <th className="w-[78px] border border-zinc-300 px-2 py-2 font-bold">Risco</th>
                <th className="w-[98px] border border-zinc-300 px-2 py-2 font-bold">Prioridade</th>
                <th className="w-[70px] border border-zinc-300 px-2 py-2 font-bold">Data Inicio</th>
                <th className="w-[70px] border border-zinc-300 px-2 py-2 font-bold">Data Prazo</th>
              </tr>
            </thead>
            <tbody>
              {chunk.map((entry) => (
                <tr key={entry.id} className="align-top">
                  <td className="border border-zinc-300 px-3 py-3">
                    <p className="font-semibold">
                      {entry.contextLabel} | Item {entry.itemDisplay}
                    </p>
                    <p className="mt-1">{entry.correctionAction}</p>
                  </td>
                  <td className="border border-zinc-300 px-2 py-3 text-center">
                    <RequirementStatusBadge label={entry.riskLevel} tone={entry.riskTone} />
                  </td>
                  <td className="border border-zinc-300 px-2 py-3 text-center font-semibold">
                    {entry.riskPriority}
                  </td>
                  <td className="border border-zinc-300 px-2 py-3 text-center font-semibold">
                    {formatDate(entry.startDate)}
                  </td>
                  <td className="border border-zinc-300 px-2 py-3 text-center font-semibold">
                    {formatDate(entry.dueDate)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>,
    );
  });

  pages.push(
    <div className="space-y-8">
      <section className="space-y-4">
        <SectionHeading index="7" title="Parecer Final e Assinaturas" />
        {missingTechnicalResponsible || missingExecutionTraceabilityCount > 0 ? (
          <div className="rounded-sm border border-red-200 bg-red-50 px-4 py-4 text-[12px] leading-6 text-red-800">
            <p className="font-semibold uppercase">Alerta de consistencia tecnica</p>
            <div className="mt-2 space-y-1">
              {missingTechnicalResponsible ? (
                <p>
                  - O relatorio nao possui identificacao completa do responsavel tecnico/inspetor e, por isso, nao deve ser tratado como documento tecnico final.
                </p>
              ) : null}
              {missingExecutionTraceabilityCount > 0 ? (
                <p>
                  - {missingExecutionTraceabilityCount} checklist(s) executado(s) permanecem sem autoria registrada no relatorio consolidado.
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
        <div className="grid grid-cols-[1.2fr_1fr] gap-4">
          <div className="rounded-sm border border-zinc-300 bg-zinc-50 px-4 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
              Parecer final
            </p>
            <div className="mt-3 space-y-3 text-[12px] leading-6 text-zinc-800">
              {conclusionParagraphs.slice(0, 3).map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </div>
          <div className="border border-zinc-300">
            <div className="grid grid-cols-1">
              <DataCell label="Responsavel tecnico" value={form.inspetorNome || "-"} />
              <DataCell label="Cargo / Funcao" value={form.inspetorCargo || "-"} />
              <DataCell
                label="Tipo de documento"
                value={isTechnicalReport ? "Relatorio tecnico oficial" : "Relatorio operacional"}
              />
              <DataCell
                label="ART / RRT"
                value={isTechnicalReport ? form.artRrtNumero || "-" : "Nao se aplica"}
              />
              <DataCell label="Representante da empresa" value={form.representanteNome || "-"} />
              <DataCell label="Cargo do representante" value={form.representanteCargo || "-"} />
              <DataCell label="Data da inspecao" value={formatDate(form.dataInspecao)} />
              <DataCell label="Horario" value={formatTimeRange(form.horaInicio, form.horaFim)} />
              <DataCell
                label="Numero do relatorio"
                value={form.numeroRelatorio || formatDate(form.dataEmissao)}
              />
              <DataCell
                label="Validade tecnica"
                value={missingTechnicalResponsible ? "Pendente de identificacao do responsavel tecnico" : "Apta para emissao tecnica"}
                className="border-b-0"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-[1.2fr_1fr] gap-4">
          <div className="rounded-sm border border-zinc-300 bg-zinc-50 px-4 py-4 text-[12px] leading-6 text-zinc-800">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
              Aviso legal e enquadramento
            </p>
            <p className="mt-3">{reportLegalNotice}</p>
            {isTechnicalReport ? (
              <p className="mt-3">
                Emissao tecnica condicionada a validacao final por responsavel tecnico vinculado a FIRE TETRAEDRO.
              </p>
            ) : (
              <p className="mt-3">
                Este documento foi estruturado para rotina preventiva, brigada, sindico, bombeiro civil e acompanhamento operacional.
              </p>
            )}
          </div>
          <div className="rounded-sm border border-zinc-300 bg-white px-4 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
              Validacao
            </p>
            {isTechnicalReport && validationQrCodeDataUrl ? (
              <div className="mt-3 flex items-center gap-4">
                <img
                  src={validationQrCodeDataUrl}
                  alt="QR Code de validacao do relatorio"
                  className="h-28 w-28 border border-zinc-200 p-1"
                />
                <div className="space-y-2 text-[10.5px] leading-5 text-zinc-700">
                  <p className="font-semibold text-zinc-900">QR Code de validacao</p>
                  <p>{technicalValidationUrl || "-"}</p>
                </div>
              </div>
            ) : (
              <div className="mt-3 text-[10.5px] leading-5 text-zinc-700">
                {isTechnicalReport
                  ? "QR Code de validacao sera gerado apos a emissao tecnica."
                  : "Relatorio operacional: sem QR Code de validacao juridica."}
              </div>
            )}
          </div>
        </div>

      </section>
    </div>,
  );

  signatureChunks.forEach((chunk, chunkIndex) => {
    pages.push(
      <div className="space-y-5">
        <SectionHeading
          index="7"
          title={
            chunkIndex === 0
              ? "Assinaturas do Relatorio"
              : "Assinaturas do Relatorio - Continuacao"
          }
        />
        <div className="grid grid-cols-2 gap-4">
          {chunk.map((signer) => renderSignatureCard(signer))}
        </div>
      </div>,
    );
  });

  checklistPrintSections.forEach((section, sectionIndex) => {
    const itemChunks = chunkArray(section.items, 10);

    itemChunks.forEach((itemChunk, chunkIndex) => {
      const isLastChunk = chunkIndex === itemChunks.length - 1;

      pages.push(
        <div className="space-y-4">
          <SectionHeading
            index="8"
            title={
              sectionIndex === 0 && chunkIndex === 0
                ? "Anexos dos Checklists Executados"
                : "Anexos dos Checklists Executados - Continuacao"
            }
          />

          <div className="rounded-sm border border-zinc-300">
            <div className="border-b border-zinc-300 bg-zinc-50 px-4 py-3">
              <p className="text-[13px] font-semibold uppercase text-zinc-900">
                {section.title}
              </p>
              <p className="mt-1 text-[11px] text-zinc-600">{section.subtitle}</p>
              <p className="mt-1 text-[9.5px] uppercase tracking-[0.08em] text-zinc-500">
                Snapshot {formatDateTime(section.generatedAt)}
              </p>
            </div>

            <table className="w-full border-collapse text-[10.5px] text-zinc-900">
              <thead>
                <tr className="bg-zinc-100 text-left uppercase tracking-[0.08em] text-zinc-600">
                  <th className="w-[38px] border border-zinc-300 px-2 py-2">Item</th>
                  <th className="w-[110px] border border-zinc-300 px-2 py-2">Secao</th>
                  <th className="border border-zinc-300 px-2 py-2">Descricao</th>
                  <th className="w-[120px] border border-zinc-300 px-2 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {itemChunk.map((item) => {
                  const statusMeta = getChecklistStatusMeta(item.status);

                  return (
                    <tr key={`${section.key}-${item.checklist_item_id}`} className="align-top">
                      <td className="border border-zinc-300 px-2 py-2 font-semibold">
                        {item.item_exibicao}
                      </td>
                      <td className="border border-zinc-300 px-2 py-2">{item.secao}</td>
                      <td className="border border-zinc-300 px-2 py-2 whitespace-pre-line">
                        {item.descricao}
                      </td>
                      <td className="border border-zinc-300 px-2 py-2">
                        <RequirementStatusBadge
                          label={statusMeta.label}
                          tone={statusMeta.tone}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {isLastChunk ? (
            <div className="border-t border-zinc-300 bg-zinc-50 px-4 py-4">
              {section.signers.length > 0 ? (
                <div className="grid gap-3">
                  {section.signers.map((signer) => (
                    <ChecklistDigitalSignatureStamp
                      key={`${section.key}-${signer.user_id}`}
                      signer={signer}
                      timestamp={signer.last_activity_at}
                      context="checklist"
                    />
                  ))}
                </div>
              ) : (
                <p className="text-[10.5px] text-zinc-700">
                  Nenhum executor com autoria registrada foi localizado para este checklist.
                </p>
              )}
            </div>
          ) : null}
        </div>,
      );
    });
  });

  return (
    <div className="min-h-screen bg-[#edf0f5]">
      <style>{`
        @page {
          size: A4;
          margin: 0;
        }

        @media print {
          body {
            background: #ffffff;
          }

          .report-controls,
          .report-editor {
            display: none !important;
          }

          .report-print-wrapper {
            padding: 0 !important;
            margin: 0 !important;
            max-width: none !important;
          }

          .report-print-wrapper > * + * {
            margin-top: 0 !important;
          }

          .report-pages > * + * {
            margin-top: 0 !important;
          }

          .report-page {
            box-sizing: border-box;
            break-after: page;
            page-break-after: always;
            break-inside: avoid;
            page-break-inside: avoid;
            margin: 0 auto !important;
          }

          .report-page:last-child {
            break-after: auto;
            page-break-after: auto;
          }
        }
      `}</style>

      <div className="report-print-wrapper mx-auto max-w-[1400px] space-y-6 px-4 py-6">
        <ReportToolbar
          navigateBack={() => navigate(`/checklists/${id}`)}
          onSync={handleSyncChecklistSnapshot}
          onPrint={handlePrint}
          onSaveDraft={() => void handleSave("rascunho")}
          onFinalize={() => void handleSave("finalizado")}
          saving={saving}
          snapshotIsCurrent={snapshotIsCurrent}
          statusLabel={statusMeta.label}
          finalizeLabel={
            isTechnicalReport
              ? "Emitir relatorio tecnico"
              : "Finalizar relatorio operacional"
          }
        />

        <div className="report-editor grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
          <Card>
            <CardHeader>
              <CardTitle>Dados do relatorio</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label>Tipo do relatorio</Label>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant={form.reportMode === "operacional" ? "default" : "outline"}
                    onClick={() => handleReportModeChange("operacional")}
                  >
                    Relatorio operacional
                  </Button>
                  <Button
                    type="button"
                    variant={form.reportMode === "tecnico" ? "default" : "outline"}
                    onClick={() => handleReportModeChange("tecnico")}
                    disabled={!isSystemAdmin && form.reportMode !== "tecnico"}
                  >
                    Relatorio tecnico oficial
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {!isSystemAdmin
                    ? "Somente o responsavel tecnico da FIRE TETRAEDRO pode emitir a versao tecnica oficial."
                    : "Como administrador tecnico, voce pode revisar o pre-relatorio operacional e emitir a versao oficial."}
                </p>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="titulo">Titulo</Label>
                <Input id="titulo" value={form.titulo} onChange={(event) => handleInputChange("titulo", event.target.value)} />
              </div>
              {form.reportMode === "tecnico" ? (
                <div className="space-y-2">
                  <Label htmlFor="artRrtNumero">Numero da ART / RRT</Label>
                  <Input
                    id="artRrtNumero"
                    value={form.artRrtNumero}
                    onChange={(event) => handleInputChange("artRrtNumero", event.target.value)}
                    placeholder="Informe a ART/RRT vinculada"
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>Aviso legal</Label>
                  <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    {OPERATIONAL_LEGAL_NOTICE}
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="numeroRelatorio">Numero do relatorio</Label>
                <Input id="numeroRelatorio" value={form.numeroRelatorio} onChange={(event) => handleInputChange("numeroRelatorio", event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dataEmissao">Data da emissao</Label>
                <Input id="dataEmissao" type="date" value={form.dataEmissao} onChange={(event) => handleInputChange("dataEmissao", event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dataInspecao">Data da inspecao</Label>
                <Input id="dataInspecao" type="date" value={form.dataInspecao} onChange={(event) => handleInputChange("dataInspecao", event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="horaInicio">Hora inicio</Label>
                <Input id="horaInicio" type="time" value={form.horaInicio} onChange={(event) => handleInputChange("horaInicio", event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="horaFim">Hora fim</Label>
                <Input id="horaFim" type="time" value={form.horaFim} onChange={(event) => handleInputChange("horaFim", event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="inspetorNome">Nome do inspetor</Label>
                <Input id="inspetorNome" value={form.inspetorNome} onChange={(event) => handleInputChange("inspetorNome", event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="inspetorCargo">Cargo do inspetor</Label>
                <Input id="inspetorCargo" value={form.inspetorCargo} onChange={(event) => handleInputChange("inspetorCargo", event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="representanteNome">Representante presente</Label>
                <Input id="representanteNome" value={form.representanteNome} onChange={(event) => handleInputChange("representanteNome", event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="representanteCargo">Cargo do representante</Label>
                <Input id="representanteCargo" value={form.representanteCargo} onChange={(event) => handleInputChange("representanteCargo", event.target.value)} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Textos do relatorio</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="objetivo">Objeto</Label>
                <Textarea id="objetivo" rows={4} value={form.objetivo} onChange={(event) => handleInputChange("objetivo", event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="escopo">Escopo</Label>
                <Textarea id="escopo" rows={4} value={form.escopo} onChange={(event) => handleInputChange("escopo", event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="observacoesGerais">Observacoes das medidas</Label>
                <Textarea id="observacoesGerais" rows={4} value={form.observacoesGerais} onChange={(event) => handleInputChange("observacoesGerais", event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="recomendacoes">Recomendacoes complementares</Label>
                <Textarea id="recomendacoes" rows={4} value={form.recomendacoes} onChange={(event) => handleInputChange("recomendacoes", event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="conclusao">Conclusao</Label>
                <Textarea id="conclusao" rows={5} value={form.conclusao} onChange={(event) => handleInputChange("conclusao", event.target.value)} />
              </div>
            </CardContent>
          </Card>
        </div>

        {!reportStorageAvailable && (
          <div className="report-editor rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            O layout do relatorio esta funcional, mas a persistencia ainda depende da tabela
            <span className="mx-1 font-semibold">empresa_relatorios</span>
            no Supabase.
          </div>
        )}

        <div className="report-editor grid gap-4 md:grid-cols-4">
          <Card><CardContent className="pt-6"><div className="text-xs uppercase text-muted-foreground">Itens avaliados</div><div className="mt-2 text-3xl font-bold">{technicalSummary.total}</div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="text-xs uppercase text-muted-foreground">Nao conformes ativos</div><div className="mt-2 text-3xl font-bold text-red-600">{technicalSummary.naoConforme}</div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="text-xs uppercase text-muted-foreground">Registros detalhados</div><div className="mt-2 text-3xl font-bold text-primary">{reportEntries.length}</div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="text-xs uppercase text-muted-foreground">Checklist base</div><div className="mt-2 text-sm font-semibold">{formatDateTime(snapshot.generated_at)}</div><div className="mt-2 text-xs text-muted-foreground">{missingTechnicalResponsible ? "Validade tecnica pendente" : "Validade tecnica apta"}</div></CardContent></Card>
        </div>

        <div className="report-pages space-y-8">
          {pages.map((page, index) => (
            <PageFrame
              key={`report-page-${index + 1}`}
              pageNumber={index + 1}
              totalPages={pages.length}
              title={reportTitle}
              subtitle={reportSubtitle}
              legalNotice={reportLegalNotice}
            >
              {page}
            </PageFrame>
          ))}
        </div>

        <div className="report-editor flex items-center justify-between text-sm text-muted-foreground">
          <span>{report ? `Relatorio salvo no banco com status ${reportStatus}.` : "Relatorio ainda nao salvo no banco."}</span>
          <span>Snapshot em {formatDateTime(snapshot.generated_at)} | {snapshotIsCurrent ? "Atual" : "Defasado em relacao ao checklist"}</span>
        </div>
      </div>
    </div>
  );
};

export default CompanyReport;
