import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  BarChart3,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  Flame,
  Gauge,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  Siren,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";

import { FirePageHeader, FirePageShell } from "@/components/branding/FirePageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Tables } from "@/integrations/supabase/types";
import { useToast } from "@/hooks/use-toast";
import {
  buildChecklistSnapshot,
  type ChecklistSnapshot,
  type ChecklistSnapshotItem,
  type ChecklistSnapshotStatus,
} from "@/lib/checklist";
import { loadChecklistData } from "@/lib/checklist-source";
import {
  buildExtinguisherSummary,
  buildHydrantSummary,
  buildLuminaireSummary,
  formatMonthYear,
  isDateExpired,
  isHydroYearExpired,
  normalizeEquipmentChecklistSnapshot,
  sanitizeEquipmentRecordsChecklistSnapshots,
  type EquipmentType,
  type ExtinguisherRecord,
  type HydrantRecord,
  type LuminaireRecord,
} from "@/lib/checklist-equipment";
import {
  loadAllChecklistNonConformitiesForActiveCycle,
  type ChecklistNonConformityRecord,
} from "@/lib/checklist-non-conformities";
import { loadCompanyMembers, type CompanyMemberSummary } from "@/lib/company-members";
import { loadActiveCompanyReport } from "@/lib/report-cycles";
import { isMissingFunctionError, isMissingRelationError } from "@/lib/supabase-errors";
import { cn } from "@/lib/utils";

type CompanyRow = Pick<
  Tables<"empresa">,
  | "id"
  | "razao_social"
  | "nome_fantasia"
  | "cnpj"
  | "responsavel"
  | "cidade"
  | "estado"
  | "grau_risco"
>;
type ReportRow = Pick<
  Tables<"empresa_relatorios">,
  "data_inspecao" | "data_emissao" | "hora_inicio" | "status" | "updated_at"
>;
type ChecklistExecutionRow = Tables<"empresa_checklist_execucoes">;
type RiskLevel = "ALTA" | "MEDIA" | "BAIXA";
type ActionStatus = "pendente" | "em_execucao" | "concluida";
type SystemKey =
  | "extintores"
  | "hidrantes"
  | "chuveiros"
  | "saidas"
  | "gestao";
type SourceType = "principal" | EquipmentType | "registro";

interface DashboardData {
  company: CompanyRow;
  report: ReportRow | null;
  snapshot: ChecklistSnapshot;
  nonConformities: ChecklistNonConformityRecord[];
  extinguishers: ExtinguisherRecord[];
  hydrants: HydrantRecord[];
  luminaires: LuminaireRecord[];
  executions: ChecklistExecutionRow[];
  members: CompanyMemberSummary[];
}

interface DashboardItemRow {
  id: string;
  checklistItemId: string;
  sourceType: SourceType;
  systemKey: SystemKey;
  systemLabel: string;
  sourceLabel: string;
  inspectionCode: string;
  inspectionName: string;
  section: string;
  itemDisplay: string;
  description: string;
  status: ChecklistSnapshotStatus;
  activityAt: string | null;
  href: string;
}

interface DashboardIssue {
  id: string;
  riskLevel: RiskLevel;
  priority: string;
  status: ActionStatus;
  systemKey: SystemKey;
  systemLabel: string;
  sourceType: SourceType;
  sourceLabel: string;
  title: string;
  detail: string;
  date: string | null;
  dueDate: string;
  href: string;
  item?: DashboardItemRow;
}

interface DrilldownState {
  title: string;
  description: string;
  rows: Array<DashboardItemRow | DashboardIssue>;
}

const STATUS_COLORS: Record<string, string> = {
  C: "#16a34a",
  NC: "#dc2626",
  P: "#f59e0b",
  NA: "#64748b",
};

const RISK_META: Record<
  RiskLevel,
  {
    label: string;
    color: string;
    bg: string;
    priority: string;
    daysLabel: string;
  }
> = {
  ALTA: {
    label: "Risco Alto",
    color: "#dc2626",
    bg: "bg-red-500",
    priority: "Correção imediata",
    daysLabel: "26 horas",
  },
  MEDIA: {
    label: "Risco Médio",
    color: "#f59e0b",
    bg: "bg-amber-400",
    priority: "Correção prioritária",
    daysLabel: "15 dias",
  },
  BAIXA: {
    label: "Risco Baixo",
    color: "#16a34a",
    bg: "bg-emerald-500",
    priority: "Correção programada",
    daysLabel: "50 dias",
  },
};

const SYSTEM_META: Record<
  SystemKey,
  {
    label: string;
    icon: LucideIcon;
    color: string;
  }
> = {
  extintores: { label: "Extintores", icon: Flame, color: "#ea580c" },
  hidrantes: { label: "Hidrantes", icon: Siren, color: "#2563eb" },
  chuveiros: { label: "Chuveiros automáticos", icon: Zap, color: "#0891b2" },
  saidas: { label: "Saídas de emergência", icon: ShieldCheck, color: "#7c3aed" },
  gestao: { label: "Gestão", icon: Building2, color: "#0f172a" },
};

const SYSTEM_ORDER: SystemKey[] = [
  "extintores",
  "hidrantes",
  "chuveiros",
  "saidas",
  "gestao",
];

const EMPTY_SNAPSHOT: ChecklistSnapshot = {
  generated_at: new Date().toISOString(),
  overall: {
    total: 0,
    conforme: 0,
    nao_conforme: 0,
    nao_aplicavel: 0,
    pendentes: 0,
  },
  inspections: [],
  non_conformities: [],
};

const normalizeText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const toDateKey = (value?: string | null) => {
  if (!value) {
    return null;
  }

  const directDate = value.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  if (directDate) {
    return directDate;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
};

const formatDate = (value?: string | null) => {
  const key = toDateKey(value);
  if (!key) {
    return "-";
  }

  return new Date(`${key}T00:00:00`).toLocaleDateString("pt-BR");
};

const formatPercent = (value: number) => `${Math.round(value)}%`;

const getPercent = (value: number, total: number) =>
  total > 0 ? Math.round((value / total) * 100) : 0;

const matchesDateFilter = (value: string | null | undefined, selectedDate: string) =>
  !selectedDate || toDateKey(value) === selectedDate;

const classifyInspectionSystem = (
  inspectionCode: string,
  inspectionName: string,
): SystemKey => {
  const normalized = normalizeText(`${inspectionCode} ${inspectionName}`);

  if (inspectionCode === "A.23" || normalized.includes("extintor")) {
    return "extintores";
  }

  if (inspectionCode === "A.25" || normalized.includes("hidrante")) {
    return "hidrantes";
  }

  if (
    inspectionCode === "A.27" ||
    normalized.includes("chuveiro") ||
    normalized.includes("sprinkler")
  ) {
    return "chuveiros";
  }

  if (
    normalized.includes("saida") ||
    normalized.includes("rota") ||
    normalized.includes("emergencia") ||
    normalized.includes("sinalizacao")
  ) {
    return "saidas";
  }

  return "gestao";
};

const getRiskAssessment = ({
  itemDescription,
  detailDescription,
  sourceType,
}: {
  itemDescription: string;
  detailDescription: string;
  sourceType: SourceType;
}) => {
  const normalized = normalizeText(`${itemDescription} ${detailDescription}`);

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
    return { level: "ALTA" as const, ...RISK_META.ALTA };
  }

  if (
    normalized.includes("fixa") ||
    normalized.includes("fixacao") ||
    normalized.includes("fixada") ||
    normalized.includes("sinaliza") ||
    normalized.includes("vazamento") ||
    normalized.includes("pressao") ||
    normalized.includes("pressão")
  ) {
    return { level: "MEDIA" as const, ...RISK_META.MEDIA };
  }

  return { level: "BAIXA" as const, ...RISK_META.BAIXA };
};

const getSuggestedDueDate = ({
  startDate,
  startTime,
  riskLevel,
}: {
  startDate?: string | null;
  startTime?: string | null;
  riskLevel: RiskLevel;
}) => {
  const baseDate = startDate ? new Date(`${startDate}T${startTime || "08:00"}`) : new Date();
  const date = Number.isNaN(baseDate.getTime()) ? new Date() : baseDate;

  if (riskLevel === "ALTA") {
    date.setHours(date.getHours() + 26);
  } else if (riskLevel === "MEDIA") {
    date.setDate(date.getDate() + 15);
  } else {
    date.setDate(date.getDate() + 50);
  }

  return date.toISOString();
};

const getActionStatus = (riskLevel: RiskLevel, dueDate: string): ActionStatus => {
  if (riskLevel === "ALTA" || new Date(dueDate).getTime() < Date.now()) {
    return "pendente";
  }

  return "em_execucao";
};

const getRiskMatrixCoordinates = (issue: DashboardIssue) => {
  if (issue.riskLevel === "ALTA") {
    return { impact: 3, probability: 3 };
  }

  if (issue.riskLevel === "MEDIA") {
    return { impact: 2, probability: 2 };
  }

  return { impact: 1, probability: 1 };
};

const countStatuses = (items: DashboardItemRow[]) => {
  const conforme = items.filter((item) => item.status === "C").length;
  const naoConforme = items.filter((item) => item.status === "NC").length;
  const naoAplicavel = items.filter((item) => item.status === "NA").length;
  const pendentes = items.filter((item) => item.status === "P").length;
  const total = items.length;

  return {
    total,
    conforme,
    naoConforme,
    naoAplicavel,
    pendentes,
    progresso: getPercent(conforme + naoConforme + naoAplicavel, total),
  };
};

const getItemActivityDate = (item: ChecklistSnapshotItem) =>
  item.preenchido_em || null;

const buildPrincipalRows = (
  snapshot: ChecklistSnapshot,
  companyId: string,
): DashboardItemRow[] =>
  snapshot.inspections.flatMap((inspection) => {
    const systemKey = classifyInspectionSystem(inspection.codigo, inspection.nome);
    const systemLabel = SYSTEM_META[systemKey].label;

    return inspection.itens.map((item) => ({
      id: `principal:${inspection.codigo}:${item.checklist_item_id}`,
      checklistItemId: item.checklist_item_id,
      sourceType: "principal" as const,
      systemKey,
      systemLabel,
      sourceLabel: "Checklist principal",
      inspectionCode: inspection.codigo,
      inspectionName: inspection.nome,
      section: item.secao || "Sem seção",
      itemDisplay: item.item_exibicao || item.item_numero || "-",
      description: item.descricao,
      status: item.status,
      activityAt: getItemActivityDate(item),
      href: `/checklists/${companyId}`,
    }));
  });

const buildEquipmentRows = (
  companyId: string,
  type: EquipmentType,
  records: Array<
    (ExtinguisherRecord | HydrantRecord | LuminaireRecord) & {
      numero: string;
      localizacao: string;
      public_token: string;
      checklist_snapshot: Database["public"]["Tables"]["empresa_extintores"]["Row"]["checklist_snapshot"];
    }
  >,
): DashboardItemRow[] => {
  const systemKey: SystemKey =
    type === "extintor" ? "extintores" : type === "hidrante" ? "hidrantes" : "saidas";
  const systemLabel = SYSTEM_META[systemKey].label;

  return records.flatMap((record) => {
    const snapshot = normalizeEquipmentChecklistSnapshot(record.checklist_snapshot);
    const equipmentLabel =
      type === "extintor"
        ? `Extintor ${record.numero}`
        : type === "hidrante"
          ? `Hidrante ${record.numero}`
          : `Luminária ${record.numero}`;

    return snapshot.items.map((item) => ({
      id: `${type}:${record.id}:${item.checklist_item_id}`,
      checklistItemId: item.checklist_item_id,
      sourceType: type,
      systemKey,
      systemLabel,
      sourceLabel: equipmentLabel,
      inspectionCode: snapshot.inspection_code || "-",
      inspectionName: snapshot.inspection_name || systemLabel,
      section: item.secao || "Sem seção",
      itemDisplay: item.item_exibicao || item.item_numero || "-",
      description: item.descricao,
      status: item.status,
      activityAt: getItemActivityDate(item),
      href: record.public_token
        ? `/equipamentos/${type}/${record.public_token}`
        : `/checklists/${companyId}`,
    }));
  });
};

const getEquipmentDetail = (
  type: EquipmentType,
  record: ExtinguisherRecord | HydrantRecord | LuminaireRecord,
) => {
  if (type === "extintor") {
    const extinguisher = record as ExtinguisherRecord;
    return `${extinguisher.tipo} ${extinguisher.carga_nominal} | ${extinguisher.localizacao}`;
  }

  if (type === "hidrante") {
    const hydrant = record as HydrantRecord;
    return `${hydrant.tipo_hidrante} | ${hydrant.localizacao}`;
  }

  const luminaire = record as LuminaireRecord;
  return `${luminaire.tipo_luminaria} | ${luminaire.localizacao}`;
};

const buildNonConformityRecordKey = (record: ChecklistNonConformityRecord) => {
  if (record.equipment_type && record.equipment_record_id) {
    return `${record.equipment_type}:${record.equipment_record_id}:${record.checklist_item_id}`;
  }

  return `principal:${record.checklist_item_id}`;
};

const buildIssues = ({
  allItems,
  nonConformities,
  report,
  extinguishers,
  hydrants,
  luminaires,
}: {
  allItems: DashboardItemRow[];
  nonConformities: ChecklistNonConformityRecord[];
  report: ReportRow | null;
  extinguishers: ExtinguisherRecord[];
  hydrants: HydrantRecord[];
  luminaires: LuminaireRecord[];
}): DashboardIssue[] => {
  const reportStartDate = report?.data_inspecao || report?.data_emissao || null;
  const recordsByKey = new Map(
    nonConformities.map((record) => [buildNonConformityRecordKey(record), record] as const),
  );
  const issues: DashboardIssue[] = [];

  allItems
    .filter((item) => item.status === "NC")
    .forEach((item) => {
      const key =
        item.sourceType === "principal"
          ? `principal:${item.checklistItemId}`
          : `${item.sourceType}:${item.id.split(":")[1]}:${item.checklistItemId}`;
      const record = recordsByKey.get(key);
      const detail = record?.descricao || item.description;
      const risk = getRiskAssessment({
        itemDescription: item.description,
        detailDescription: detail,
        sourceType: item.sourceType,
      });
      const dueDate = getSuggestedDueDate({
        startDate: reportStartDate || toDateKey(item.activityAt),
        startTime: report?.hora_inicio,
        riskLevel: risk.level,
      });

      issues.push({
        id: item.id,
        riskLevel: risk.level,
        priority: risk.priority,
        status: getActionStatus(risk.level, dueDate),
        systemKey: item.systemKey,
        systemLabel: item.systemLabel,
        sourceType: item.sourceType,
        sourceLabel: item.sourceLabel,
        title: item.description,
        detail,
        date: record?.updated_at || item.activityAt || reportStartDate,
        dueDate,
        href: item.href,
        item,
      });
    });

  extinguishers.forEach((record) => {
    if (isDateExpired(record.vencimento_carga)) {
      const dueDate = getSuggestedDueDate({
        startDate: reportStartDate,
        startTime: report?.hora_inicio,
        riskLevel: "ALTA",
      });
      issues.push({
        id: `registro-extintor-recarga-${record.id}`,
        riskLevel: "ALTA",
        priority: RISK_META.ALTA.priority,
        status: getActionStatus("ALTA", dueDate),
        systemKey: "extintores",
        systemLabel: SYSTEM_META.extintores.label,
        sourceType: "registro",
        sourceLabel: `Extintor ${record.numero}`,
        title: "Carga vencida",
        detail: `Carga vencida em ${formatMonthYear(record.vencimento_carga)}. ${getEquipmentDetail("extintor", record)}`,
        date: reportStartDate,
        dueDate,
        href: `/checklists/${record.empresa_id}`,
      });
    }

    if (isHydroYearExpired(record.vencimento_teste_hidrostatico_ano)) {
      const dueDate = getSuggestedDueDate({
        startDate: reportStartDate,
        startTime: report?.hora_inicio,
        riskLevel: "MEDIA",
      });
      issues.push({
        id: `registro-extintor-hidro-${record.id}`,
        riskLevel: "MEDIA",
        priority: RISK_META.MEDIA.priority,
        status: getActionStatus("MEDIA", dueDate),
        systemKey: "extintores",
        systemLabel: SYSTEM_META.extintores.label,
        sourceType: "registro",
        sourceLabel: `Extintor ${record.numero}`,
        title: "Teste hidrostático vencido",
        detail: `Teste hidrostático vencido em ${record.vencimento_teste_hidrostatico_ano}. ${getEquipmentDetail("extintor", record)}`,
        date: reportStartDate,
        dueDate,
        href: `/checklists/${record.empresa_id}`,
      });
    }
  });

  hydrants.forEach((record) => {
    const hasExpiredHose =
      isDateExpired(record.mangueira1_vencimento_teste_hidrostatico) ||
      isDateExpired(record.mangueira2_vencimento_teste_hidrostatico);
    const hasMissingComponents = !record.esguicho || !record.chave_mangueira;
    const isIrregularStatus = normalizeText(record.status || "").includes("nao");

    if (hasExpiredHose || hasMissingComponents || isIrregularStatus) {
      const dueDate = getSuggestedDueDate({
        startDate: reportStartDate,
        startTime: report?.hora_inicio,
        riskLevel: hasExpiredHose ? "ALTA" : "MEDIA",
      });
      const riskLevel = hasExpiredHose ? "ALTA" : "MEDIA";
      issues.push({
        id: `registro-hidrante-${record.id}`,
        riskLevel,
        priority: RISK_META[riskLevel].priority,
        status: getActionStatus(riskLevel, dueDate),
        systemKey: "hidrantes",
        systemLabel: SYSTEM_META.hidrantes.label,
        sourceType: "registro",
        sourceLabel: `Hidrante ${record.numero}`,
        title: hasExpiredHose ? "Mangueira vencida" : "Irregularidade cadastral",
        detail: `${getEquipmentDetail("hidrante", record)}. ${
          hasMissingComponents ? "Componentes ausentes ou incompletos." : ""
        }`,
        date: reportStartDate,
        dueDate,
        href: `/checklists/${record.empresa_id}`,
      });
    }
  });

  luminaires
    .filter((record) => normalizeText(record.status).includes("nao"))
    .forEach((record) => {
      const dueDate = getSuggestedDueDate({
        startDate: reportStartDate,
        startTime: report?.hora_inicio,
        riskLevel: "ALTA",
      });
      issues.push({
        id: `registro-luminaria-${record.id}`,
        riskLevel: "ALTA",
        priority: RISK_META.ALTA.priority,
        status: getActionStatus("ALTA", dueDate),
        systemKey: "saidas",
        systemLabel: SYSTEM_META.saidas.label,
        sourceType: "registro",
        sourceLabel: `Luminária ${record.numero}`,
        title: "Luminária não conforme",
        detail: getEquipmentDetail("luminaria", record),
        date: reportStartDate,
        dueDate,
        href: `/checklists/${record.empresa_id}`,
      });
    });

  return issues;
};

const getStatusLabel = (status: ChecklistSnapshotStatus) => {
  if (status === "C") return "Conforme";
  if (status === "NC") return "Não conforme";
  if (status === "NA") return "Não aplicável";
  return "Pendente";
};

const groupCount = <T,>(
  values: T[],
  getKey: (value: T) => string,
  getRows?: (key: string) => Array<DashboardItemRow | DashboardIssue>,
) => {
  const countMap = new Map<string, number>();
  values.forEach((value) => {
    const key = getKey(value);
    countMap.set(key, (countMap.get(key) || 0) + 1);
  });

  return Array.from(countMap.entries())
    .map(([name, value]) => ({
      name,
      value,
      rows: getRows ? getRows(name) : [],
    }))
    .sort((left, right) => right.value - left.value);
};

const DashboardPanel = ({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) => (
  <Card className="fire-app-surface overflow-hidden">
    <CardHeader className="border-b border-slate-200/70 pb-4">
      <div className="flex items-start gap-3">
        <span className="mt-1 h-4 w-4 rounded border border-slate-400 bg-slate-100" />
        <div>
          <CardTitle className="fire-display text-xl tracking-[-0.02em] text-slate-950">
            {title}
          </CardTitle>
          {description ? (
            <CardDescription className="mt-1">{description}</CardDescription>
          ) : null}
        </div>
      </div>
    </CardHeader>
    <CardContent className="p-4 md:p-6">{children}</CardContent>
  </Card>
);

const KpiCard = ({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone: "success" | "warning" | "danger" | "neutral";
}) => {
  const toneClass =
    tone === "success"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : tone === "warning"
        ? "bg-amber-50 text-amber-700 border-amber-200"
        : tone === "danger"
          ? "bg-red-50 text-red-700 border-red-200"
          : "bg-slate-50 text-slate-700 border-slate-200";

  return (
    <div className={cn("rounded-2xl border p-4 shadow-sm", toneClass)}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-[0.16em] opacity-75">
          {label}
        </p>
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-3 text-3xl font-black tracking-[-0.04em]">{value}</p>
    </div>
  );
};

const TrafficLightBadge = ({ riskLevel }: { riskLevel: RiskLevel }) => (
  <Badge
    variant="outline"
    className={cn(
      "gap-2 bg-white font-semibold",
      riskLevel === "ALTA"
        ? "border-red-200 text-red-700"
        : riskLevel === "MEDIA"
          ? "border-amber-200 text-amber-700"
          : "border-emerald-200 text-emerald-700",
    )}
  >
    <span className={cn("h-2.5 w-2.5 rounded-full", RISK_META[riskLevel].bg)} />
    {RISK_META[riskLevel].label}
  </Badge>
);

const ChartBox = ({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) => (
  <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
    <p className="mb-4 text-sm font-bold text-slate-700">{title}</p>
    {children}
  </div>
);

const DrilldownDialog = ({
  drilldown,
  onOpenChange,
}: {
  drilldown: DrilldownState | null;
  onOpenChange: (open: boolean) => void;
}) => (
  <Dialog open={Boolean(drilldown)} onOpenChange={onOpenChange}>
    <DialogContent className="max-h-[86vh] max-w-4xl overflow-hidden">
      <DialogHeader>
        <DialogTitle>{drilldown?.title}</DialogTitle>
        <DialogDescription>{drilldown?.description}</DialogDescription>
      </DialogHeader>
      <div className="max-h-[60vh] overflow-auto rounded-2xl border">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="sticky top-0 bg-slate-50 text-left text-xs uppercase tracking-[0.16em] text-slate-500">
            <tr>
              <th className="px-4 py-3">Origem</th>
              <th className="px-4 py-3">Item / Ação</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Acesso</th>
            </tr>
          </thead>
          <tbody>
            {(drilldown?.rows || []).map((row) => {
              const isIssue = "riskLevel" in row;
              const href = isIssue ? row.href : row.href;
              const title = isIssue ? row.title : row.description;
              const subtitle = isIssue
                ? `${row.systemLabel} | ${row.detail}`
                : `${row.inspectionCode} - ${row.inspectionName} | ${row.section}`;

              return (
                <tr key={row.id} className="border-t align-top">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-900">
                      {isIssue ? row.sourceLabel : row.sourceLabel}
                    </p>
                    <p className="text-xs text-slate-500">{subtitle}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="line-clamp-2 font-medium text-slate-800">{title}</p>
                    {isIssue ? (
                      <p className="mt-1 text-xs text-slate-500">
                        Prazo: {formatDate(row.dueDate)}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    {isIssue ? (
                      <TrafficLightBadge riskLevel={row.riskLevel} />
                    ) : (
                      <Badge
                        variant="outline"
                        className="bg-white"
                        style={{ borderColor: STATUS_COLORS[row.status], color: STATUS_COLORS[row.status] }}
                      >
                        {getStatusLabel(row.status)}
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="outline" size="sm" asChild>
                      <a href={href}>Abrir</a>
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </DialogContent>
  </Dialog>
);

const loadExecutions = async (companyId: string) => {
  const { data, error } = await supabase
    .from("empresa_checklist_execucoes")
    .select("*")
    .eq("empresa_id", companyId)
    .order("last_activity_at", { ascending: false });

  if (error) {
    if (isMissingRelationError(error, "empresa_checklist_execucoes")) {
      return [] as ChecklistExecutionRow[];
    }

    throw error;
  }

  return (data || []) as ChecklistExecutionRow[];
};

const loadMembers = async (companyId: string) => {
  try {
    return await loadCompanyMembers(supabase, companyId);
  } catch (error) {
    if (isMissingFunctionError(error, "list_empresa_usuarios")) {
      return [] as CompanyMemberSummary[];
    }

    throw error;
  }
};

const CompanyAnalyticsDashboard = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedRisk, setSelectedRisk] = useState<"all" | RiskLevel>("all");
  const [drilldown, setDrilldown] = useState<DrilldownState | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!id) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        const [
          companyResult,
          reportResult,
          checklistData,
          nonConformities,
          extinguishersResult,
          hydrantsResult,
          luminairesResult,
          executions,
          members,
        ] = await Promise.all([
          supabase
            .from("empresa")
            .select("id, razao_social, nome_fantasia, cnpj, responsavel, cidade, estado, grau_risco")
            .eq("id", id)
            .maybeSingle(),
          loadActiveCompanyReport(
            supabase,
            id,
            "data_inspecao, data_emissao, hora_inicio, status, updated_at",
          ),
          loadChecklistData(supabase, id),
          loadAllChecklistNonConformitiesForActiveCycle(supabase, id, {
            includeImageData: false,
          }),
          supabase.from("empresa_extintores").select("*").eq("empresa_id", id),
          supabase.from("empresa_hidrantes").select("*").eq("empresa_id", id),
          supabase.from("empresa_luminarias").select("*").eq("empresa_id", id),
          loadExecutions(id),
          loadMembers(id),
        ]);

        if (companyResult.error) {
          throw companyResult.error;
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

        const [safeExtinguishers, safeHydrants, safeLuminaires] = await Promise.all([
          sanitizeEquipmentRecordsChecklistSnapshots(
            supabase,
            id,
            "extintor",
            (extinguishersResult.data || []) as ExtinguisherRecord[],
          ),
          sanitizeEquipmentRecordsChecklistSnapshots(
            supabase,
            id,
            "hidrante",
            (hydrantsResult.data || []) as HydrantRecord[],
          ),
          sanitizeEquipmentRecordsChecklistSnapshots(
            supabase,
            id,
            "luminaria",
            (luminairesResult.data || []) as LuminaireRecord[],
          ),
        ]);

        const snapshot =
          checklistData.models.length > 0
            ? buildChecklistSnapshot(
                checklistData.models,
                checklistData.groupsByModel,
                checklistData.responses,
              )
            : EMPTY_SNAPSHOT;

        setData({
          company: companyResult.data as CompanyRow,
          report: reportResult.report as ReportRow | null,
          snapshot,
          nonConformities,
          extinguishers: safeExtinguishers,
          hydrants: safeHydrants,
          luminaires: safeLuminaires,
          executions,
          members,
        });
      } catch (error) {
        console.error("Error loading analytics dashboard:", error);
        toast({
          title: "Erro ao carregar dashboard",
          description: "Não foi possível carregar os indicadores desta empresa.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    void fetchData();
  }, [id, toast]);

  const analytics = useMemo(() => {
    if (!data || !id) {
      return null;
    }

    const principalRows = buildPrincipalRows(data.snapshot, id);
    const equipmentRows = [
      ...buildEquipmentRows(id, "extintor", data.extinguishers),
      ...buildEquipmentRows(id, "hidrante", data.hydrants),
      ...buildEquipmentRows(id, "luminaria", data.luminaires),
    ];
    const allItems = [...principalRows, ...equipmentRows];
    const itemsByDate = allItems.filter((item) =>
      matchesDateFilter(item.activityAt, selectedDate),
    );
    const baseItems = selectedDate ? itemsByDate : allItems;
    const metrics = countStatuses(baseItems);
    const issues = buildIssues({
      allItems,
      nonConformities: data.nonConformities,
      report: data.report,
      extinguishers: data.extinguishers,
      hydrants: data.hydrants,
      luminaires: data.luminaires,
    });
    const filteredIssues = issues.filter((issue) => {
      const riskMatches = selectedRisk === "all" || issue.riskLevel === selectedRisk;
      const dateMatches = matchesDateFilter(issue.date, selectedDate);
      return riskMatches && dateMatches;
    });
    const extinguisherSummary = buildExtinguisherSummary(data.extinguishers);
    const hydrantSummary = buildHydrantSummary(data.hydrants);
    const luminaireSummary = buildLuminaireSummary(data.luminaires);
    const membersByUserId = new Map(data.members.map((member) => [member.user_id, member]));
    const filteredExecutions = data.executions.filter((execution) =>
      matchesDateFilter(execution.last_activity_at, selectedDate),
    );

    return {
      allItems,
      baseItems,
      metrics,
      issues,
      filteredIssues,
      extinguisherSummary,
      hydrantSummary,
      luminaireSummary,
      filteredExecutions,
      membersByUserId,
    };
  }, [data, id, selectedDate, selectedRisk]);

  if (loading) {
    return (
      <FirePageShell>
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </FirePageShell>
    );
  }

  if (!data || !analytics) {
    return (
      <FirePageShell>
        <Card className="fire-app-surface">
          <CardContent className="py-12 text-center">
            <p className="text-lg font-semibold">Dashboard não encontrado</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Não foi possível localizar os dados analíticos desta empresa.
            </p>
            <Button className="mt-6" variant="outline" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
          </CardContent>
        </Card>
      </FirePageShell>
    );
  }

  const { company, report } = data;
  const {
    baseItems,
    metrics,
    filteredIssues,
    extinguisherSummary,
    hydrantSummary,
    luminaireSummary,
    filteredExecutions,
    membersByUserId,
  } = analytics;
  const pendingDistribution = metrics.pendentes + metrics.naoAplicavel;
  const donutData = [
    {
      name: "Conformes",
      value: metrics.conforme,
      fill: STATUS_COLORS.C,
      rows: baseItems.filter((item) => item.status === "C"),
    },
    {
      name: "Não conformes",
      value: metrics.naoConforme,
      fill: STATUS_COLORS.NC,
      rows: baseItems.filter((item) => item.status === "NC"),
    },
    {
      name: "Pendentes",
      value: pendingDistribution,
      fill: STATUS_COLORS.P,
      rows: baseItems.filter((item) => item.status === "P" || item.status === "NA"),
    },
  ];
  const riskData = (["ALTA", "MEDIA", "BAIXA"] as RiskLevel[]).map((riskLevel) => ({
    riskLevel,
    name: RISK_META[riskLevel].label,
    value: filteredIssues.filter((issue) => issue.riskLevel === riskLevel).length,
    fill: RISK_META[riskLevel].color,
    rows: filteredIssues.filter((issue) => issue.riskLevel === riskLevel),
  }));
  const systemData = SYSTEM_ORDER.map((systemKey) => {
    const rows = baseItems.filter((item) => item.systemKey === systemKey);
    const counts = countStatuses(rows);
    const total = counts.total || 1;

    return {
      systemKey,
      name: SYSTEM_META[systemKey].label.replace(" automáticos", ""),
      conformes: Math.round((counts.conforme / total) * 100),
      naoConformes: Math.round((counts.naoConforme / total) * 100),
      pendentes: Math.max(
        0,
        100 - Math.round((counts.conforme / total) * 100) - Math.round((counts.naoConforme / total) * 100),
      ),
      percent: counts.total ? counts.progresso : 0,
      rows,
    };
  });
  const groupedNonConformities = groupCount(
    filteredIssues,
    (issue) => issue.title.slice(0, 72),
    (name) => filteredIssues.filter((issue) => issue.title.slice(0, 72) === name),
  ).slice(0, 6);
  const paretoTotal = groupedNonConformities.reduce((sum, item) => sum + item.value, 0) || 1;
  let paretoAccumulated = 0;
  const paretoData = groupedNonConformities.map((item) => {
    paretoAccumulated += item.value;
    return {
      ...item,
      cumulative: Math.round((paretoAccumulated / paretoTotal) * 100),
    };
  });
  const actionData = (["ALTA", "MEDIA", "BAIXA"] as RiskLevel[]).map((riskLevel) => {
    const rows = filteredIssues.filter((issue) => issue.riskLevel === riskLevel);
    return {
      name: riskLevel === "ALTA" ? "Alta" : riskLevel === "MEDIA" ? "Média" : "Baixa",
      pendente: rows.filter((issue) => issue.status === "pendente").length,
      emExecucao: rows.filter((issue) => issue.status === "em_execucao").length,
      concluida: rows.filter((issue) => issue.status === "concluida").length,
      rows,
    };
  });
  const memberRanking = groupCount(
    filteredExecutions,
    (execution) =>
      membersByUserId.get(execution.user_id)?.nome ||
      membersByUserId.get(execution.user_id)?.email ||
      "Usuário não identificado",
  ).slice(0, 6);
  const activityDistribution = groupCount(filteredExecutions, (execution) => {
    if (execution.context_type === "principal") return "Checklist principal";
    if (execution.equipment_type === "extintor") return "Extintores";
    if (execution.equipment_type === "hidrante") return "Hidrantes";
    if (execution.equipment_type === "luminaria") return "Luminárias";
    return "Outras atividades";
  });
  const equipmentIssues = [
    { name: "Recarga vencida", value: extinguisherSummary.expiredRecharge },
    { name: "Teste hidro", value: extinguisherSummary.expiredHydroTest },
    { name: "Mangueira vencida", value: hydrantSummary.expiredHoses },
    { name: "Componentes", value: hydrantSummary.missingComponents },
    { name: "Luminárias NC", value: luminaireSummary.naoConformes },
  ];
  const reportDate = report?.data_inspecao || report?.data_emissao;

  const openRows = (
    title: string,
    description: string,
    rows: Array<DashboardItemRow | DashboardIssue>,
  ) => {
    setDrilldown({ title, description, rows });
  };

  return (
    <FirePageShell>
      <FirePageHeader
        icon={BarChart3}
        eyebrow="business intelligence fire 360"
        title="Dashboard Analítico"
        description={`Indicadores por empresa para gestão de risco, decisão e acompanhamento operacional: ${company.razao_social}.`}
        actions={
          <>
            <Button variant="outline" size="lg" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="mr-2 h-5 w-5" />
              Empresas
            </Button>
            <Button size="lg" onClick={() => navigate(`/relatorios/${company.id}`)}>
              Abrir relatório
            </Button>
          </>
        }
        stats={[
          { value: company.grau_risco || "-", label: "grau de risco" },
          { value: formatDate(reportDate), label: "data de inspeção" },
          { value: formatPercent(metrics.progresso), label: "progresso geral" },
        ]}
      />

      <Card className="fire-app-surface mb-6">
        <CardContent className="grid gap-4 p-4 md:grid-cols-3 md:p-6">
          <div className="space-y-2">
            <Label>Unidade / cliente</Label>
            <Select value={company.id}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={company.id}>
                  {company.nome_fantasia || company.razao_social}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="inspection-date">Data de inspeção</Label>
            <Input
              id="inspection-date"
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Nível de risco</Label>
            <Select
              value={selectedRisk}
              onValueChange={(value) => setSelectedRisk(value as "all" | RiskLevel)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os riscos</SelectItem>
                <SelectItem value="ALTA">Risco alto</SelectItem>
                <SelectItem value="MEDIA">Risco médio</SelectItem>
                <SelectItem value="BAIXA">Risco baixo</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="visao" className="space-y-6">
        <TabsList className="fire-app-surface grid h-auto grid-cols-2 gap-2 p-2 md:grid-cols-4 xl:grid-cols-7">
          <TabsTrigger value="visao">Visão Geral</TabsTrigger>
          <TabsTrigger value="risco">Risco</TabsTrigger>
          <TabsTrigger value="sistemas">Sistemas</TabsTrigger>
          <TabsTrigger value="nao-conformidades">Não Conformidades</TabsTrigger>
          <TabsTrigger value="plano">Plano de Ação</TabsTrigger>
          <TabsTrigger value="operacional">Operacional</TabsTrigger>
          <TabsTrigger value="equipamentos">Equipamentos</TabsTrigger>
        </TabsList>

        <TabsContent value="visao">
          <DashboardPanel
            title="Visão Geral"
            description="Resumo executivo com distribuição de conformidade e progresso geral."
          >
            <div className="grid gap-4 md:grid-cols-5">
              <KpiCard icon={ClipboardCheck} label="Itens avaliados" value={metrics.total} tone="neutral" />
              <KpiCard icon={CheckCircle2} label="Conformes" value={metrics.conforme} tone="success" />
              <KpiCard icon={ShieldAlert} label="Não conformes" value={metrics.naoConforme} tone="danger" />
              <KpiCard icon={Gauge} label="Pendentes" value={metrics.pendentes} tone="warning" />
              <KpiCard icon={BarChart3} label="Progresso" value={formatPercent(metrics.progresso)} tone="neutral" />
            </div>
            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <ChartBox title="Distribuição Conforme / Não Conforme / Pendente">
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={donutData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={70}
                        outerRadius={115}
                        paddingAngle={3}
                        onClick={(entry) => {
                          const payload = entry as (typeof donutData)[number];
                          openRows(payload.name, "Itens vinculados ao segmento selecionado.", payload.rows);
                        }}
                      >
                        {donutData.map((entry) => (
                          <Cell key={entry.name} fill={entry.fill} />
                        ))}
                      </Pie>
                      <RechartsTooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </ChartBox>
              <ChartBox title="Gauge de progresso geral">
                <div className="relative h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadialBarChart
                      data={[{ name: "Progresso", value: metrics.progresso, fill: "#2563eb" }]}
                      innerRadius="72%"
                      outerRadius="100%"
                      startAngle={180}
                      endAngle={0}
                    >
                      <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                      <RadialBar dataKey="value" cornerRadius={12} background />
                    </RadialBarChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-x-0 bottom-12 text-center">
                    <p className="fire-display text-5xl font-black text-slate-950">
                      {formatPercent(metrics.progresso)}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">itens preenchidos</p>
                  </div>
                </div>
              </ChartBox>
            </div>
          </DashboardPanel>
        </TabsContent>

        <TabsContent value="risco">
          <DashboardPanel
            title="Análise de Risco"
            description="Semáforo executivo, barras horizontais e matriz Impacto x Probabilidade."
          >
            <div className="mb-6 grid gap-4 md:grid-cols-3">
              {riskData.map((risk) => (
                <button
                  key={risk.riskLevel}
                  type="button"
                  className="rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                  onClick={() =>
                    openRows(risk.name, "Não conformidades neste nível de risco.", risk.rows)
                  }
                >
                  <TrafficLightBadge riskLevel={risk.riskLevel} />
                  <p className="mt-3 text-3xl font-black">{risk.value}</p>
                  <p className="text-sm text-slate-500">Prazo sugerido: {RISK_META[risk.riskLevel].daysLabel}</p>
                </button>
              ))}
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <ChartBox title="Barras horizontais por nível de risco">
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={riskData} layout="vertical" margin={{ left: 24 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" allowDecimals={false} />
                      <YAxis dataKey="name" type="category" width={110} />
                      <RechartsTooltip />
                      <Bar
                        dataKey="value"
                        radius={[0, 10, 10, 0]}
                        onClick={(entry) => {
                          const payload = entry as (typeof riskData)[number];
                          openRows(payload.name, "Não conformidades deste nível.", payload.rows);
                        }}
                      >
                        {riskData.map((entry) => (
                          <Cell key={entry.riskLevel} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </ChartBox>
              <ChartBox title="Matriz de risco Impacto x Probabilidade">
                <div className="grid min-h-80 grid-cols-[auto_1fr] gap-4">
                  <div className="flex items-center text-xs font-bold uppercase tracking-[0.14em] text-slate-500 [writing-mode:vertical-rl]">
                    Probabilidade
                  </div>
                  <div>
                    <div className="grid grid-cols-3 overflow-hidden rounded-2xl border">
                      {[3, 2, 1].flatMap((probability) =>
                        [1, 2, 3].map((impact) => {
                          const level: RiskLevel =
                            impact * probability >= 7
                              ? "ALTA"
                              : impact * probability >= 4
                                ? "MEDIA"
                                : "BAIXA";
                          const rows = filteredIssues.filter((issue) => {
                            const coordinates = getRiskMatrixCoordinates(issue);
                            return (
                              coordinates.impact === impact &&
                              coordinates.probability === probability
                            );
                          });

                          return (
                            <button
                              key={`${probability}-${impact}`}
                              type="button"
                              className={cn(
                                "flex aspect-square flex-col items-center justify-center border text-sm font-bold transition hover:scale-[1.02]",
                                level === "ALTA"
                                  ? "bg-red-100 text-red-800"
                                  : level === "MEDIA"
                                    ? "bg-amber-100 text-amber-800"
                                    : "bg-emerald-100 text-emerald-800",
                              )}
                              onClick={() =>
                                openRows(
                                  `Matriz ${RISK_META[level].label}`,
                                  `Impacto ${impact} x Probabilidade ${probability}`,
                                  rows,
                                )
                              }
                            >
                              <span>{rows.length}</span>
                              <span className="text-[10px] uppercase opacity-70">
                                I{impact} P{probability}
                              </span>
                            </button>
                          );
                        }),
                      )}
                    </div>
                    <div className="mt-3 flex justify-between text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                      <span>Baixo impacto</span>
                      <span>Impacto</span>
                    </div>
                  </div>
                </div>
              </ChartBox>
            </div>
          </DashboardPanel>
        </TabsContent>

        <TabsContent value="sistemas">
          <DashboardPanel
            title="Status dos Sistemas"
            description="Percentual de conformidade por sistema de segurança."
          >
            <div className="grid gap-4 md:grid-cols-5">
              {systemData.map((system) => {
                const Icon = SYSTEM_META[system.systemKey].icon;

                return (
                  <button
                    key={system.systemKey}
                    type="button"
                    className="rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5"
                    onClick={() =>
                      openRows(system.name, "Itens do sistema selecionado.", system.rows)
                    }
                  >
                    <Icon className="h-5 w-5" style={{ color: SYSTEM_META[system.systemKey].color }} />
                    <p className="mt-3 text-sm font-semibold text-slate-600">{system.name}</p>
                    <p className="text-3xl font-black">{formatPercent(system.percent)}</p>
                  </button>
                );
              })}
            </div>
            <div className="mt-6">
              <ChartBox title="Barras comparativas de conformidade">
                <div className="h-96">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={systemData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" interval={0} tick={{ fontSize: 12 }} />
                      <YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                      <RechartsTooltip formatter={(value) => `${value}%`} />
                      <Bar
                        dataKey="conformes"
                        stackId="a"
                        fill={STATUS_COLORS.C}
                        name="Conformes"
                        onClick={(entry) => {
                          const payload = entry as (typeof systemData)[number];
                          openRows(payload.name, "Itens do sistema selecionado.", payload.rows);
                        }}
                      />
                      <Bar
                        dataKey="pendentes"
                        stackId="a"
                        fill={STATUS_COLORS.P}
                        name="Pendentes"
                        onClick={(entry) => {
                          const payload = entry as (typeof systemData)[number];
                          openRows(payload.name, "Itens do sistema selecionado.", payload.rows);
                        }}
                      />
                      <Bar
                        dataKey="naoConformes"
                        stackId="a"
                        fill={STATUS_COLORS.NC}
                        name="Não conformes"
                        onClick={(entry) => {
                          const payload = entry as (typeof systemData)[number];
                          openRows(payload.name, "Itens do sistema selecionado.", payload.rows);
                        }}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </ChartBox>
            </div>
          </DashboardPanel>
        </TabsContent>

        <TabsContent value="nao-conformidades">
          <DashboardPanel
            title="Não Conformidades"
            description="Principais desvios, agrupamento por sistema e curva de Pareto."
          >
            <div className="mb-6 grid gap-4 md:grid-cols-3">
              {SYSTEM_ORDER.map((systemKey) => {
                const rows = filteredIssues.filter((issue) => issue.systemKey === systemKey);
                return (
                  <button
                    key={systemKey}
                    type="button"
                    className="rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5"
                    onClick={() =>
                      openRows(SYSTEM_META[systemKey].label, "Não conformidades agrupadas por sistema.", rows)
                    }
                  >
                    <p className="text-sm font-semibold text-slate-600">{SYSTEM_META[systemKey].label}</p>
                    <p className="text-3xl font-black text-red-600">{rows.length}</p>
                  </button>
                );
              })}
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <ChartBox title="Top não conformidades">
                <div className="h-96">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={groupedNonConformities} margin={{ left: 12 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" hide />
                      <YAxis allowDecimals={false} />
                      <RechartsTooltip />
                      <Bar
                        dataKey="value"
                        fill="#dc2626"
                        radius={[8, 8, 0, 0]}
                        onClick={(entry) => {
                          const payload = entry as (typeof groupedNonConformities)[number];
                          openRows(payload.name, "Itens que compõem este grupo.", payload.rows);
                        }}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </ChartBox>
              <ChartBox title="Análise Pareto 80/20">
                <div className="h-96">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={paretoData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" hide />
                      <YAxis yAxisId="left" allowDecimals={false} />
                      <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                      <RechartsTooltip />
                      <Bar yAxisId="left" dataKey="value" fill="#f97316" radius={[8, 8, 0, 0]} />
                      <Line yAxisId="right" type="monotone" dataKey="cumulative" stroke="#0f172a" strokeWidth={3} dot />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </ChartBox>
            </div>
          </DashboardPanel>
        </TabsContent>

        <TabsContent value="plano">
          <DashboardPanel
            title="Plano de Ação"
            description="Priorização por criticidade e linha do tempo das correções."
          >
            <div className="grid gap-6 lg:grid-cols-2">
              <ChartBox title="Tarefas por prioridade">
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={actionData} layout="vertical" margin={{ left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" allowDecimals={false} />
                      <YAxis dataKey="name" type="category" />
                      <RechartsTooltip />
                      <Bar
                        dataKey="pendente"
                        stackId="a"
                        name="Pendente"
                        fill="#dc2626"
                        onClick={(entry) => {
                          const payload = entry as (typeof actionData)[number];
                          openRows(payload.name, "Ações desta prioridade.", payload.rows);
                        }}
                      />
                      <Bar
                        dataKey="emExecucao"
                        stackId="a"
                        name="Em execução"
                        fill="#f59e0b"
                        onClick={(entry) => {
                          const payload = entry as (typeof actionData)[number];
                          openRows(payload.name, "Ações desta prioridade.", payload.rows);
                        }}
                      />
                      <Bar
                        dataKey="concluida"
                        stackId="a"
                        name="Concluída"
                        fill="#16a34a"
                        onClick={(entry) => {
                          const payload = entry as (typeof actionData)[number];
                          openRows(payload.name, "Ações desta prioridade.", payload.rows);
                        }}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </ChartBox>
              <ChartBox title="Timeline de correções">
                <div className="space-y-4">
                  {filteredIssues.slice(0, 6).map((issue) => (
                    <button
                      key={issue.id}
                      type="button"
                      className="grid w-full grid-cols-[7rem_1fr_auto] items-center gap-3 rounded-2xl border bg-white p-3 text-left transition hover:bg-slate-50"
                      onClick={() => openRows(issue.title, "Ação selecionada.", [issue])}
                    >
                      <TrafficLightBadge riskLevel={issue.riskLevel} />
                      <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={cn("h-full rounded-full", RISK_META[issue.riskLevel].bg)}
                          style={{ width: issue.riskLevel === "ALTA" ? "96%" : issue.riskLevel === "MEDIA" ? "68%" : "42%" }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-slate-500">
                        {formatDate(issue.dueDate)}
                      </span>
                    </button>
                  ))}
                  {filteredIssues.length === 0 ? (
                    <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-slate-500">
                      Nenhuma ação aberta para os filtros selecionados.
                    </div>
                  ) : null}
                </div>
              </ChartBox>
            </div>
          </DashboardPanel>
        </TabsContent>

        <TabsContent value="operacional">
          <DashboardPanel
            title="Desempenho Operacional"
            description="Checklists executados e performance por vistoriador."
          >
            <div className="mb-6 grid gap-4 md:grid-cols-3">
              <KpiCard icon={ClipboardCheck} label="Checklists executados" value={filteredExecutions.length} tone="neutral" />
              <KpiCard icon={Wrench} label="Salvamentos" value={filteredExecutions.reduce((sum, item) => sum + (item.total_saves || 0), 0)} tone="success" />
              <KpiCard icon={Building2} label="Vistoriadores" value={memberRanking.length} tone="neutral" />
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <ChartBox title="Atividades por vistoriador">
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={memberRanking}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" hide />
                      <YAxis allowDecimals={false} />
                      <RechartsTooltip />
                      <Bar dataKey="value" fill="#2563eb" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </ChartBox>
              <ChartBox title="Checklists executados">
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={activityDistribution} dataKey="value" nameKey="name" outerRadius={112}>
                        {activityDistribution.map((entry, index) => (
                          <Cell
                            key={entry.name}
                            fill={["#2563eb", "#ea580c", "#0891b2", "#7c3aed", "#64748b"][index % 5]}
                          />
                        ))}
                      </Pie>
                      <RechartsTooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </ChartBox>
            </div>
          </DashboardPanel>
        </TabsContent>

        <TabsContent value="equipamentos">
          <DashboardPanel
            title="Controle de Equipamentos"
            description="Indicadores operacionais de extintores, hidrantes e luminárias."
          >
            <div className="grid gap-4 md:grid-cols-3">
              <KpiCard
                icon={Flame}
                label="Extintores cadastrados"
                value={`${extinguisherSummary.total}`}
                tone={extinguisherSummary.expiredRecharge > 0 ? "danger" : "success"}
              />
              <KpiCard
                icon={Siren}
                label="Hidrantes irregulares"
                value={hydrantSummary.expiredHoses + hydrantSummary.missingComponents}
                tone={hydrantSummary.expiredHoses + hydrantSummary.missingComponents > 0 ? "danger" : "success"}
              />
              <KpiCard
                icon={Zap}
                label="Luminárias verificadas"
                value={luminaireSummary.total}
                tone={luminaireSummary.naoConformes > 0 ? "warning" : "success"}
              />
            </div>
            <div className="mt-6">
              <ChartBox title="Barras por tipo de pendência">
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={equipmentIssues}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" interval={0} tick={{ fontSize: 12 }} />
                      <YAxis allowDecimals={false} />
                      <RechartsTooltip />
                      <Bar dataKey="value" fill="#f97316" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </ChartBox>
            </div>
          </DashboardPanel>
        </TabsContent>
      </Tabs>

      <DrilldownDialog
        drilldown={drilldown}
        onOpenChange={(open) => {
          if (!open) {
            setDrilldown(null);
          }
        }}
      />
    </FirePageShell>
  );
};

export default CompanyAnalyticsDashboard;
