import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Loader2,
  Save,
  ClipboardCheck,
  FileText,
  Shield,
  Building,
  Zap,
  Flame,
  Bell,
  CloudRain,
  Package,
  Check,
  X,
  Minus,
  type LucideIcon,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  buildChecklistSnapshot,
  buildChecklistTableRows,
  type ChecklistGroupWithItems,
  type ChecklistModelShape,
  type ChecklistResponseShape,
} from "@/lib/checklist";
import {
  loadChecklistData,
  saveChecklistResponses,
} from "@/lib/checklist-source";
import { isMissingRelationError } from "@/lib/supabase-errors";

interface Company {
  id: string;
  razao_social: string;
}

type ChecklistStatus = "C" | "NC" | "NA";
type ChecklistResponseTable = "empresa_checklist_respostas" | "empresa_checklist";

const STATUS_ORDER: ChecklistStatus[] = ["C", "NC", "NA"];

const STATUS_META: Record<
  ChecklistStatus,
  {
    value: ChecklistStatus;
    label: string;
    shortLabel: string;
    icon: LucideIcon;
    activeClass: string;
    inactiveClass: string;
    ariaLabel: string;
  }
> = {
  C: {
    value: "C",
    label: "Conforme",
    shortLabel: "C",
    icon: Check,
    activeClass: "border-emerald-600 bg-emerald-600 text-white shadow-sm",
    inactiveClass: "border-emerald-200 bg-background text-emerald-700 hover:bg-emerald-50",
    ariaLabel: "Marcar como conforme",
  },
  NC: {
    value: "NC",
    label: "Nao Conforme",
    shortLabel: "NC",
    icon: X,
    activeClass: "border-red-600 bg-red-600 text-white shadow-sm",
    inactiveClass: "border-red-200 bg-background text-red-700 hover:bg-red-50",
    ariaLabel: "Marcar como nao conforme",
  },
  NA: {
    value: "NA",
    label: "Nao Aplicavel",
    shortLabel: "NA",
    icon: Minus,
    activeClass: "border-slate-500 bg-slate-500 text-white shadow-sm",
    inactiveClass: "border-slate-300 bg-background text-slate-600 hover:bg-slate-100",
    ariaLabel: "Marcar como nao aplicavel",
  },
};

const getInspectionIcon = (name: string) => {
  if (name.includes("Informacoes")) return FileText;
  if (name.includes("Acesso")) return Building;
  if (name.includes("Compartimentacao")) return Package;
  if (name.includes("Escada") || name.includes("Saida")) return Building;
  if (name.includes("Iluminacao")) return Zap;
  if (name.includes("Sinalizacao")) return ClipboardCheck;
  if (name.includes("Extintor")) return Flame;
  if (name.includes("Hidrante") || name.includes("Mangotinh")) return Flame;
  if (name.includes("Chuveiro")) return CloudRain;
  if (name.includes("Alarme") || name.includes("Deteccao")) return Bell;
  if (name.includes("GLP") || name.includes("GN")) return Flame;
  if (name.includes("SPDA") || name.includes("Atmosferica")) return CloudRain;
  if (name.includes("Acabamento") || name.includes("CMAR")) return Package;
  return Shield;
};

const CompanyChecklists = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [company, setCompany] = useState<Company | null>(null);
  const [models, setModels] = useState<ChecklistModelShape[]>([]);
  const [groupsByModel, setGroupsByModel] = useState<
    Map<string, ChecklistGroupWithItems[]>
  >(new Map());
  const [responses, setResponses] = useState<
    Map<string, ChecklistResponseShape>
  >(new Map());
  const [responseTable, setResponseTable] =
    useState<ChecklistResponseTable>("empresa_checklist");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [openInspection, setOpenInspection] = useState<string | null>(null);
  const { rowsByInspection, evaluableIds: evaluableItemIds } = useMemo(
    () => buildChecklistTableRows(groupsByModel),
    [groupsByModel],
  );

  const fetchData = useCallback(async () => {
    if (!id) {
      return;
    }

    try {
      setLoading(true);

      const { data: companyData, error: companyError } = await supabase
        .from("empresa")
        .select("id, razao_social")
        .eq("id", id)
        .maybeSingle();

      if (companyError) {
        throw companyError;
      }

      if (!companyData) {
        throw new Error("Empresa nao encontrada");
      }

      const checklistData = await loadChecklistData(supabase, id);

      setCompany(companyData);
      setModels(checklistData.models);
      setGroupsByModel(checklistData.groupsByModel);
      setResponses(checklistData.responses);
      setResponseTable(checklistData.responseTable);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({
        title: "Erro ao carregar dados",
        description: "Nao foi possivel carregar os dados dos checklists.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleStatusChange = (itemId: string, status: ChecklistStatus) => {
    setResponses((previous) => {
      const next = new Map(previous);
      const existing = next.get(itemId);
      next.set(itemId, {
        checklist_item_id: itemId,
        status,
        observacoes: existing?.observacoes || null,
      });
      return next;
    });
  };

  const saveChecklistAndEnsureReport = async () => {
    if (!id) {
      return false;
    }

    try {
      await saveChecklistResponses({
        supabase,
        companyId: id,
        responseTable,
        responses,
        evaluableIds: evaluableItemIds,
      });

      const checklistSnapshot = buildChecklistSnapshot(
        models,
        groupsByModel,
        responses,
      );

      const { error: reportError } = await supabase
        .from("empresa_relatorios")
        .upsert(
          {
            empresa_id: id,
            titulo: "Relatorio de Inspecao",
            status: "rascunho",
            checklist_snapshot: checklistSnapshot,
          },
          { onConflict: "empresa_id" },
        );

      if (reportError) {
        if (isMissingRelationError(reportError, "empresa_relatorios")) {
          toast({
            title: "Relatorio indisponivel",
            description:
              "A tabela de relatorios ainda nao foi criada no Supabase. O checklist foi salvo mesmo assim.",
            variant: "destructive",
          });
          return true;
        }

        throw reportError;
      }

      return true;
    } catch (error) {
      console.error("Error finalizing checklist:", error);
      toast({
        title: "Erro ao finalizar",
        description: "Nao foi possivel finalizar o checklist.",
        variant: "destructive",
      });
      return false;
    }
  };

  const handleFinalizeChecklist = async () => {
    if (!id) {
      return;
    }

    try {
      setSaving(true);

      const saved = await saveChecklistAndEnsureReport();
      if (!saved) {
        return;
      }

      toast({
        title: "Checklist finalizado",
        description: "Continue preenchendo o relatorio da inspecao.",
      });

      navigate(`/relatorios/${id}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!company) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card>
          <CardContent className="py-12">
            <p className="text-center text-muted-foreground">
              Empresa nao encontrada.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const openInspectionData = models.find(
    (inspection) => inspection.id === openInspection,
  );
  const checklistRows = openInspection
    ? rowsByInspection.get(openInspection) || []
    : [];
  const checklistTitle =
    openInspectionData?.titulo || `CHECKLIST DE ${openInspectionData?.nome || ""}`;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-4 md:py-8 px-4">
        <div className="mb-6 md:mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate(`/exigencias/${id}`)}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar as Exigencias
          </Button>

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-start md:items-center">
              <ClipboardCheck className="h-8 w-8 md:h-12 md:w-12 text-primary mr-2 md:mr-3 flex-shrink-0 mt-1 md:mt-0" />
              <div>
                <h1 className="text-2xl md:text-4xl font-bold text-foreground">
                  Check Lists de Renovacao
                </h1>
                <p className="text-sm md:text-lg text-muted-foreground mt-1">
                  {company.razao_social}
                </p>
              </div>
            </div>
            <Button
              onClick={handleFinalizeChecklist}
              disabled={saving}
              size="lg"
              className="w-full md:w-auto"
            >
              {saving ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <Save className="mr-2 h-5 w-5" />
              )}
              Finalizar Checklist
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-8">
          {models.map((inspection) => {
            const Icon = getInspectionIcon(inspection.nome);
            const isOpen = openInspection === inspection.id;

            return (
              <Card
                key={inspection.id}
                className={`cursor-pointer transition-all hover:shadow-lg ${
                  isOpen ? "ring-2 ring-primary" : ""
                }`}
                onClick={() => setOpenInspection(isOpen ? null : inspection.id)}
              >
                <CardContent className="p-3 flex flex-col items-center text-center">
                  <Icon
                    className={`h-6 w-6 mb-2 ${
                      isOpen ? "text-primary" : "text-muted-foreground"
                    }`}
                  />
                  <p className="text-[10px] md:text-xs text-muted-foreground line-clamp-2">
                    {inspection.nome}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {openInspection && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg md:text-xl">
                {openInspectionData?.nome}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 md:p-6">
              <div className="px-4 pt-4 md:px-0 md:pt-0">
                <div className="flex flex-wrap items-center gap-2 text-xs md:text-sm">
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-emerald-700">
                    <Check className="h-3 w-3" />
                    C = Conforme
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-1 text-red-700">
                    <X className="h-3 w-3" />
                    NC = Nao Conforme
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-slate-100 px-2 py-1 text-slate-700">
                    <Minus className="h-3 w-3" />
                    NA = Nao Aplicavel
                  </span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead colSpan={5} className="text-center whitespace-nowrap">
                        {checklistTitle.toUpperCase()}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {checklistRows.map((row) => {
                      if (row.type === "section") {
                        return (
                          <TableRow key={row.key} className="bg-muted/25">
                            <TableCell className="font-medium whitespace-nowrap text-xs md:text-sm">
                              Item
                            </TableCell>
                            <TableCell className="font-medium text-xs md:text-sm">
                              {row.title}
                            </TableCell>
                            <TableCell className="font-medium text-center whitespace-nowrap text-xs md:text-sm">
                              C
                            </TableCell>
                            <TableCell className="font-medium text-center whitespace-nowrap text-xs md:text-sm">
                              NC
                            </TableCell>
                            <TableCell className="font-medium text-center whitespace-nowrap text-xs md:text-sm">
                              NA
                            </TableCell>
                          </TableRow>
                        );
                      }

                      if (row.type === "info") {
                        return (
                          <TableRow key={row.key}>
                            <TableCell className="whitespace-nowrap text-xs md:text-sm" />
                            <TableCell
                              colSpan={4}
                              className="text-xs md:text-sm text-muted-foreground"
                            >
                              <div>{row.description}</div>
                              {row.complement && (
                                <p className="mt-2">{row.complement}</p>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      }

                      const response = responses.get(row.itemId);

                      return (
                        <TableRow key={row.key}>
                          <TableCell className="font-medium whitespace-nowrap text-xs md:text-sm">
                            {row.number}
                          </TableCell>
                          <TableCell className="text-xs md:text-sm">
                            <div>{row.description}</div>
                            {row.complement && (
                              <p className="mt-2 text-muted-foreground">
                                {row.complement}
                              </p>
                            )}
                          </TableCell>
                          {STATUS_ORDER.map((statusValue) => {
                            const meta = STATUS_META[statusValue];
                            const Icon = meta.icon;
                            const isActive = response?.status === statusValue;

                            return (
                              <TableCell
                                key={`${row.itemId}-${statusValue}`}
                                className="text-center"
                              >
                                <button
                                  type="button"
                                  aria-pressed={isActive}
                                  aria-label={`${meta.ariaLabel} para item ${row.number}`}
                                  onClick={() =>
                                    handleStatusChange(row.itemId, statusValue)
                                  }
                                  className={cn(
                                    "inline-flex min-h-9 min-w-9 items-center justify-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                                    isActive
                                      ? meta.activeClass
                                      : meta.inactiveClass,
                                  )}
                                >
                                  <Icon className="h-3.5 w-3.5" />
                                  <span className="sr-only sm:not-sr-only sm:ml-1">
                                    {meta.shortLabel}
                                  </span>
                                </button>
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default CompanyChecklists;
