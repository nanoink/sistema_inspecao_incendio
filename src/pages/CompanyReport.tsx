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
import type { Database } from "@/integrations/supabase/types";
import { useToast } from "@/hooks/use-toast";
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
import { isMissingRelationError } from "@/lib/supabase-errors";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

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
  titulo: string;
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

const getToday = () => new Date().toISOString().slice(0, 10);

const emptyForm = (): ReportFormState => ({
  titulo: "Relatorio de Inspecao Tecnica Preventiva - RITP",
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

  if (!report) {
    return {
      ...defaults,
      representanteNome: company.responsavel || "",
      representanteCargo: "Responsavel pela empresa",
    };
  }

  return {
    titulo: report.titulo || defaults.titulo,
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
      });
      return;
    }

    const principalItem = principalItemLookup.get(record.checklist_item_id);
    if (!principalItem || principalItem.item.status !== "NC") {
      return;
    }

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

const TopCornerArt = () => (
  <svg width="122" height="86" viewBox="0 0 122 86" fill="none" xmlns="http://www.w3.org/2000/svg">
    <polygon points="0,0 63,0 24,40 0,40" fill="#ff1616" />
    <polygon points="45,0 95,0 58,39 30,39" fill="#111111" />
    <polygon points="24,57 46,57 29,74 12,74" fill="#ff1616" />
  </svg>
);

const BottomCornerArt = () => (
  <svg width="122" height="86" viewBox="0 0 122 86" fill="none" xmlns="http://www.w3.org/2000/svg">
    <polygon points="59,86 122,86 122,46 98,46" fill="#ff1616" />
    <polygon points="27,86 77,86 92,47 64,47" fill="#111111" />
    <polygon points="76,29 98,29 109,12 92,12" fill="#ff1616" />
  </svg>
);

const FireTetraedroLogo = () => (
  <svg width="118" height="60" viewBox="0 0 118 60" fill="none" xmlns="http://www.w3.org/2000/svg">
    <text x="2" y="28" fill="#f51d1d" fontSize="22" fontWeight="700" fontFamily="Arial, sans-serif">
      fire
    </text>
    <polygon points="54,26 69,4 85,26" fill="#f51d1d" />
    <polygon points="65,26 78,10 92,26" fill="#f51d1d" opacity="0.9" />
    <rect x="0" y="31" width="96" height="24" rx="2" fill="#f51d1d" />
    <text x="8" y="48" fill="#ffffff" fontSize="20" fontWeight="700" fontFamily="Arial, sans-serif">
      Tetraedro
    </text>
  </svg>
);

const PageFrame = ({
  children,
  pageNumber,
  totalPages,
}: {
  children: ReactNode;
  pageNumber: number;
  totalPages: number;
}) => (
  <article
    className="report-page relative mx-auto bg-white text-black shadow-[0_20px_50px_rgba(15,23,42,0.18)] print:shadow-none print:mx-0 print:my-0"
    style={{ width: "210mm", minHeight: "297mm" }}
  >
    <div className="absolute left-0 top-0">
      <TopCornerArt />
    </div>
    <div className="absolute bottom-0 right-0">
      <BottomCornerArt />
    </div>
    <div className="flex min-h-[297mm] flex-col px-[18mm] pb-[18mm] pt-[14mm]">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div className="w-[120px]" />
        <div className="flex-1 text-center">
          <h1 className="text-[17px] font-semibold uppercase leading-tight tracking-[0.02em] text-zinc-800">
            Relatorio de Inspecao
            <br />
            Tecnica Preventiva - RITP
          </h1>
        </div>
        <div className="flex w-[120px] justify-end">
          <FireTetraedroLogo />
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

const RiskMatrix = () => (
  <table className="w-full border-collapse text-center text-[11px] font-semibold text-zinc-900">
    <tbody>
      <tr>
        <td className="w-[50px] border border-zinc-400 p-2 text-[10px]" rowSpan={3}>
          <div className="-rotate-90 whitespace-nowrap">Grau de Inconformidade</div>
        </td>
        <td className="border border-zinc-400 p-3 text-left">
          Inconformidades <strong>GRAVE</strong> que apresentam risco iminente a seguranca dos ocupantes.
        </td>
        <td className="border border-zinc-400 bg-yellow-300 p-3">Correcao prioritaria</td>
        <td className="border border-zinc-400 bg-red-500 p-3 text-white">Correcao imediata</td>
        <td className="border border-zinc-400 bg-red-500 p-3 text-white">Correcao imediata</td>
      </tr>
      <tr>
        <td className="border border-zinc-400 p-3 text-left">
          Inconformidades <strong>MODERADA</strong> que podem comprometer a seguranca em medio prazo.
        </td>
        <td className="border border-zinc-400 bg-emerald-500 p-3 text-white">Correcao programada</td>
        <td className="border border-zinc-400 bg-yellow-300 p-3">Correcao prioritaria</td>
        <td className="border border-zinc-400 bg-red-500 p-3 text-white">Correcao imediata</td>
      </tr>
      <tr>
        <td className="border border-zinc-400 p-3 text-left">
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
}: {
  navigateBack: () => void;
  onSync: () => void;
  onPrint: () => void;
  onSaveDraft: () => void;
  onFinalize: () => void;
  saving: boolean;
  snapshotIsCurrent: boolean;
  statusLabel: string;
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
            Finalizar relatorio
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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

  const handleInputChange = (field: keyof ReportFormState, value: string) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
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

    try {
      setSaving(true);

      const payload: Database["public"]["Tables"]["empresa_relatorios"]["Insert"] = {
        empresa_id: id,
        titulo: normalizeNullable(form.titulo) || "Relatorio de Inspecao Tecnica Preventiva - RITP",
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
          empresa_responsavel: company.responsavel,
          empresa_telefone: company.telefone,
          empresa_email: company.email,
          report_model: "fire-ritp",
          non_conformities_count: nonConformityRecords.length,
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
  const requirementsAttendedCount = reportRequirements.filter((item) => item.atende).length;
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
          },
        ],
    2,
  );
  const planChunks =
    reportEntries.length > 0
      ? chunkArray(reportEntries, 4)
      : [
          [
            {
              id: "placeholder-plan",
              checklistItemId: "",
              inspectionCode: "-",
              inspectionName: "Sem registros",
              section: "Sem secao",
              itemDisplay: "-",
              itemReference: "-",
              itemDescription: "Nao ha medidas corretivas pendentes no checklist atual.",
              detailDescription:
                "Nenhuma nao conformidade ativa foi identificada no snapshot utilizado pelo relatorio.",
              imageDataUrl: null,
              sourceType: "principal" as const,
              sourceLabel: "Sem registros",
              sourceSubtitle: "Checklist consolidado",
              contextLabel: "Checklist consolidado",
              correctionAction: "Nao ha medidas corretivas a registrar para o relatorio atual.",
              startDate: form.dataInspecao || form.dataEmissao || getToday(),
              dueDate: form.dataEmissao || getToday(),
            },
          ],
        ];
  const inspectionSummaryLines = buildInspectionSummaryLines(snapshot);
  const groupedObservationLines = snapshot.inspections
    .filter((inspection) => inspection.total > 0)
    .map((inspection) => {
      const entryCount = reportEntries.filter(
        (entry) => entry.inspectionCode === inspection.codigo,
      ).length;
      return `${inspection.codigo} - ${inspection.nome}: ${inspection.conforme} conforme(s), ${inspection.nao_conforme} nao conforme(s), ${inspection.nao_aplicavel} nao aplicavel(is), ${inspection.pendentes} pendente(s) e ${entryCount} registro(s) detalhado(s) de nao conformidade.`;
    });

  if (form.observacoesGerais.trim()) {
    groupedObservationLines.push(form.observacoesGerais.trim());
  }

  const conclusionParagraphs = form.conclusao.trim()
    ? form.conclusao
        .split(/\n{2,}/)
        .map((paragraph) => paragraph.trim())
        .filter(Boolean)
    : [
        `A inspecao tecnica preventiva realizada identificou ${snapshot.overall.nao_conforme} nao conformidade(s) entre ${snapshot.overall.total} item(ns) avaliados, envolvendo sistemas de protecao, combate, aviso e abandono da edificacao.`,
        `Os registros detalhados com comentarios e imagens foram incorporados ao presente relatorio e estruturados em anexo fotografico e plano de correcao, permitindo rastreabilidade das medidas corretivas recomendadas.`,
        `A adocao tempestiva das acoes propostas e a reavaliacao tecnica dos itens corrigidos sao essenciais para a manutencao das condicoes de seguranca contra incendios e emergencias da edificacao.`,
      ];

  const categoryBulletGroups = [
    {
      title: "I. Restricao ao surgimento e a propagacao de incendio",
      items: [
        "Compartimentacao Horizontal e Vertical",
        "Controle de Materiais de Acabamento e Revestimento (CMAR)",
        "Sistema de Protecao Contra Descargas Atmosfericas (SPDA)",
      ],
    },
    {
      title: "II. Controle de crescimento e supressao de incendio",
      items: [
        "Sistemas de Extintores de Incendio",
        "Sistema de Hidrantes e Mangotinhos",
        "Sistema de Chuveiros Automaticos",
        "Sistema de Supressao de Incendio",
        "Sistema de Espuma",
      ],
    },
    {
      title: "III. Meios de aviso",
      items: ["Sistema de Deteccao de Incendio", "Sistema de Alarme de Incendio"],
    },
    {
      title: "IV. Facilidades no abandono",
      items: [
        "Saidas de Emergencia",
        "Iluminacao de Emergencia",
        "Sinalizacao de Emergencia",
      ],
    },
    {
      title: "V. Acesso e facilidades para as operacoes de socorro",
      items: ["Acesso de Viatura na Edificacao"],
    },
    {
      title: "VI. Protecao estrutural em situacoes de incendio",
      items: ["Seguranca Estrutural Contra Incendio"],
    },
    {
      title: "VII. Gerenciamento de risco de incendio",
      items: [
        "Brigada de Incendio",
        "Brigada Profissional",
        "Programa de Seguranca Contra Incendio e Emergencias (PSIE)",
        "Plano de Emergencia Contra Incendio",
      ],
    },
    {
      title: "VIII. Controle de fumaca e gases",
      items: ["Sistema de Controle de Fumaca"],
    },
  ];

  const pages: ReactNode[] = [];

  pages.push(
    <div className="space-y-8">
      <section className="space-y-3">
        <SectionHeading index="1" title="Dados Gerais" />
        <div className="border border-zinc-300">
          <div className="grid grid-cols-[2fr_1fr_1fr]">
            <DataCell label="Nome do Estabelecimento" value={company.razao_social} />
            <DataCell label="CNPJ" value={company.cnpj || "-"} />
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

      <section className="space-y-3">
        <SectionHeading index="2" title="Objeto" />
        <p className="text-[13px] leading-7 text-zinc-800">{form.objetivo}</p>
        <p className="text-[13px] leading-7 text-zinc-800">{form.escopo}</p>
      </section>

      <section className="space-y-3">
        <SectionHeading index="3" title="Criterio para Estabelecimento de Plano de Correcao" />
        <p className="text-[13px] leading-7 text-zinc-800">
          As inconformidades identificadas sao classificadas de acordo com uma matriz de risco, determinando a gravidade e a probabilidade de ocorrencia de falhas ou ausencias das medidas de seguranca contra incendios e emergencias consideradas, definindo o nivel de probabilidade de ocorrencia (baixa, media ou alta) e o grau de inconformidade (leve, moderado ou grave), servindo de base para definicao do plano de correcao eficaz.
        </p>
      </section>
    </div>,
  );

  pages.push(
    <div className="space-y-6 text-[12.5px] leading-6 text-zinc-800">
      <section className="space-y-3">
        <h3 className="text-[14px] font-bold uppercase text-zinc-900">3.1 Matriz de Risco</h3>
        <p>
          A presente metodologia estabelece o criterio de avaliacao, classificacao e priorizacao das acoes corretivas decorrentes do Relatorio de Inspecao Tecnica Preventiva (RITP). A classificacao e baseada na analise de risco das inconformidades identificadas nos elementos do sistema global de seguranca contra incendios e emergencias, conforme diretrizes aplicadas ao processo de seguranca da edificacao.
        </p>
        <p>
          A matriz de risco utilizada considera dois criterios principais: I. grau de inconformidade, classificado como leve, moderado ou grave; e II. nivel de probabilidade de ocorrencia, classificado como baixa, media ou alta.
        </p>
        <p>
          A classificacao das inconformidades segue o seguinte criterio: a) correcao imediata, quando a inconformidade apresenta alto risco a seguranca dos ocupantes; b) correcao prioritaria, quando a inconformidade pode comprometer a seguranca em medio prazo; e c) correcao programada, quando a inconformidade e leve e nao impacta diretamente na seguranca.
        </p>
      </section>

      <section className="space-y-4">
        <h3 className="text-[14px] font-bold uppercase text-zinc-900">
          3.2 Classificacao das Medidas de Seguranca Contra Incendios e Emergencias
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          {categoryBulletGroups.map((group) => (
            <div key={group.title} className="space-y-2">
              <p className="font-semibold">{group.title}</p>
              <ul className="list-disc pl-5">
                {group.items.map((item) => (
                  <li key={`${group.title}-${item}`}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>,
  );

  pages.push(
    <div className="space-y-8">
      <RiskMatrix />

      <section className="space-y-4">
        <SectionHeading index="4" title="Resultado da Avaliacao" />
        <div className="grid grid-cols-4 gap-3">
          <div className="rounded-sm border border-zinc-300 bg-zinc-50 px-3 py-4">
            <div className="text-[9px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
              Itens avaliados
            </div>
            <div className="mt-2 text-[24px] font-bold text-zinc-900">{snapshot.overall.total}</div>
          </div>
          <div className="rounded-sm border border-zinc-300 bg-emerald-50 px-3 py-4">
            <div className="text-[9px] font-semibold uppercase tracking-[0.08em] text-emerald-700">
              Conformes
            </div>
            <div className="mt-2 text-[24px] font-bold text-emerald-800">{snapshot.overall.conforme}</div>
          </div>
          <div className="rounded-sm border border-zinc-300 bg-red-50 px-3 py-4">
            <div className="text-[9px] font-semibold uppercase tracking-[0.08em] text-red-700">
              Nao conformes
            </div>
            <div className="mt-2 text-[24px] font-bold text-red-800">{snapshot.overall.nao_conforme}</div>
          </div>
          <div className="rounded-sm border border-zinc-300 bg-amber-50 px-3 py-4">
            <div className="text-[9px] font-semibold uppercase tracking-[0.08em] text-amber-700">
              Exigencias aplicaveis
            </div>
            <div className="mt-2 text-[24px] font-bold text-amber-800">{reportRequirements.length}</div>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-[13px] font-semibold text-zinc-900">Observacoes das Medidas:</p>
          <div className="border border-zinc-300">
            <table className="w-full border-collapse text-[11px]">
              <thead>
                <tr className="bg-zinc-100">
                  <th className="border border-zinc-300 px-3 py-2 text-left font-semibold">Checklist</th>
                  <th className="border border-zinc-300 px-2 py-2 text-center font-semibold">Total</th>
                  <th className="border border-zinc-300 px-2 py-2 text-center font-semibold">C</th>
                  <th className="border border-zinc-300 px-2 py-2 text-center font-semibold">NC</th>
                  <th className="border border-zinc-300 px-2 py-2 text-center font-semibold">NA</th>
                  <th className="border border-zinc-300 px-2 py-2 text-center font-semibold">P</th>
                </tr>
              </thead>
              <tbody>
                {inspectionSummaryLines.map((line) => (
                  <tr key={line.code}>
                    <td className="border border-zinc-300 px-3 py-2">{`${line.code} - ${line.name}`}</td>
                    <td className="border border-zinc-300 px-2 py-2 text-center">{line.total}</td>
                    <td className="border border-zinc-300 px-2 py-2 text-center">{line.conforme}</td>
                    <td className="border border-zinc-300 px-2 py-2 text-center">{line.naoConforme}</td>
                    <td className="border border-zinc-300 px-2 py-2 text-center">{line.naoAplicavel}</td>
                    <td className="border border-zinc-300 px-2 py-2 text-center">{line.pendentes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="space-y-2 border border-zinc-300 p-4 text-[12px] leading-6 text-zinc-800">
            {groupedObservationLines.map((line) => (
              <p key={line}>- {line}</p>
            ))}
            <p>
              Exigencias atendidas: {requirementsAttendedCount} de {reportRequirements.length}. Itens com analise complementar permanecem sinalizados no conjunto de exigencias aplicaveis da empresa.
            </p>
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
              <p className="text-[10px] font-bold uppercase text-zinc-900">
                {entry.contextLabel} | Item {entry.itemDisplay}
              </p>
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
      <section className="space-y-3">
        <SectionHeading index="7" title="Conclusao" />
        <div className="space-y-4 text-[13px] leading-7 text-zinc-800">
          {conclusionParagraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeading index="8" title="Dados da Atribuicao" />
        <div className="border border-zinc-300">
          <div className="grid grid-cols-[2fr_1fr]">
            <DataCell label="Nome dos Encarregados" value={form.inspetorNome || "-"} />
            <DataCell label="CPF" value="-" />
          </div>
          <div className="grid grid-cols-[2fr_1fr]">
            <DataCell label="" value={form.representanteNome || "-"} />
            <DataCell label="" value="-" />
          </div>
          <div className="grid grid-cols-[1fr_1fr_1fr]">
            <DataCell label="Data de Execucao" value={formatDate(form.dataInspecao)} className="border-b-0" />
            <DataCell
              label="Hora de Execucao"
              value={formatTimeRange(form.horaInicio, form.horaFim)}
              className="border-b-0"
            />
            <DataCell
              label="Relatorio Lancado"
              value={form.numeroRelatorio || formatDate(form.dataEmissao)}
              className="border-b-0"
            />
          </div>
        </div>

        <div className="pt-8">
          <div className="w-[190px] border-t border-zinc-400 pt-2 text-center text-[11px] text-zinc-700">
            <p className="font-semibold uppercase text-zinc-900">
              {form.inspetorNome || "Responsavel tecnico"}
            </p>
            <p>{form.inspetorCargo || "Equipe de inspecao"}</p>
          </div>
        </div>
      </section>
    </div>,
  );

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

          .report-page {
            break-after: page;
            margin: 0 auto !important;
          }

          .report-page:last-child {
            break-after: auto;
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
        />

        <div className="report-editor grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
          <Card>
            <CardHeader>
              <CardTitle>Dados do relatorio</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="titulo">Titulo</Label>
                <Input id="titulo" value={form.titulo} onChange={(event) => handleInputChange("titulo", event.target.value)} />
              </div>
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
          <Card><CardContent className="pt-6"><div className="text-xs uppercase text-muted-foreground">Itens avaliados</div><div className="mt-2 text-3xl font-bold">{snapshot.overall.total}</div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="text-xs uppercase text-muted-foreground">Nao conformes ativos</div><div className="mt-2 text-3xl font-bold text-red-600">{snapshot.overall.nao_conforme}</div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="text-xs uppercase text-muted-foreground">Registros detalhados</div><div className="mt-2 text-3xl font-bold text-primary">{reportEntries.length}</div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="text-xs uppercase text-muted-foreground">Checklist base</div><div className="mt-2 text-sm font-semibold">{formatDateTime(snapshot.generated_at)}</div></CardContent></Card>
        </div>

        <div className="space-y-8">
          {pages.map((page, index) => (
            <PageFrame key={`report-page-${index + 1}`} pageNumber={index + 1} totalPages={pages.length}>
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
