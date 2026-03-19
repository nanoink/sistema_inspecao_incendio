import { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
  Plus,
  Pencil,
  QrCode,
  Trash2,
  ExternalLink,
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
  loadChecklistResponses,
  saveChecklistResponses,
} from "@/lib/checklist-source";
import {
  subscribeEquipmentChecklistUpdates,
} from "@/lib/equipment-checklist-sync";
import {
  isMissingEquipmentQrSchemaError,
  isMissingRelationError,
} from "@/lib/supabase-errors";
import { ExtinguisherDialog } from "@/components/checklists/ExtinguisherDialog";
import { HydrantDialog } from "@/components/checklists/HydrantDialog";
import { EquipmentQrDialog } from "@/components/checklists/EquipmentQrDialog";
import {
  buildEquipmentChecklistSnapshots,
  buildEquipmentPublicUrl,
  buildExtinguisherSummary,
  buildHydrantSummary,
  deleteExtinguisher,
  deleteHydrant,
  ensureEquipmentQrCodes,
  syncEquipmentChecklistSnapshots,
  formatMonthYear,
  getExtinguisherRuleEvaluation,
  isDateExpired,
  isHydroYearExpired,
  loadChecklistEquipmentData,
  normalizeEquipmentChecklistSnapshot,
  sortByEquipmentNumber,
  type EquipmentType,
  type ExtinguisherRecord,
  type HydrantRecord,
} from "@/lib/checklist-equipment";

interface Company {
  id: string;
  razao_social: string;
}

type ChecklistStatus = "C" | "NC" | "NA";

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
  const [extinguishers, setExtinguishers] = useState<ExtinguisherRecord[]>([]);
  const [hydrants, setHydrants] = useState<HydrantRecord[]>([]);
  const [equipmentSchemaPending, setEquipmentSchemaPending] =
    useState(false);
  const [equipmentQrSchemaPending, setEquipmentQrSchemaPending] =
    useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [openInspection, setOpenInspection] = useState<string | null>(null);
  const [extinguisherDialogOpen, setExtinguisherDialogOpen] =
    useState(false);
  const [hydrantDialogOpen, setHydrantDialogOpen] = useState(false);
  const [editingExtinguisher, setEditingExtinguisher] =
    useState<ExtinguisherRecord | null>(null);
  const [editingHydrant, setEditingHydrant] =
    useState<HydrantRecord | null>(null);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [qrDialogType, setQrDialogType] = useState<EquipmentType>("extintor");
  const [qrDialogRecord, setQrDialogRecord] = useState<
    ExtinguisherRecord | HydrantRecord | null
  >(null);
  const initialEquipmentSyncDone = useRef(false);
  const responsesRefreshTimeoutRef = useRef<number | null>(null);
  const extinguisherRefreshTimeoutRef = useRef<number | null>(null);
  const { rowsByInspection, evaluableIds: evaluableItemIds } = useMemo(
    () => buildChecklistTableRows(groupsByModel),
    [groupsByModel],
  );
  const equipmentInspectionItemIds = useMemo(() => {
    const next = new Set<string>();

    models.forEach((model) => {
      if (model.codigo !== "A.23" && model.codigo !== "A.25") {
        return;
      }

      (rowsByInspection.get(model.id) || []).forEach((row) => {
        if (row.type === "item") {
          next.add(row.itemId);
        }
      });
    });

    return next;
  }, [models, rowsByInspection]);
  const equipmentChecklistTemplates = useMemo(
    () =>
      buildEquipmentChecklistSnapshots({
        models,
        groupsByModel,
        responses: new Map<string, ChecklistResponseShape>(),
      }),
    [groupsByModel, models],
  );
  const extinguisherInspectionItemIds = useMemo(
    () =>
      new Set(
        equipmentChecklistTemplates.extintor.items.map(
          (item) => item.checklist_item_id,
        ),
      ),
    [equipmentChecklistTemplates.extintor.items],
  );
  const mirroredExtinguisherResponses = useMemo(() => {
    const templateItems = equipmentChecklistTemplates.extintor.items;

    if (templateItems.length === 0) {
      return new Map<string, ChecklistResponseShape>();
    }

    const extinguisherItemMaps = extinguishers.map((record) => {
      const snapshot = normalizeEquipmentChecklistSnapshot(record.checklist_snapshot);
      return new Map(
        snapshot.items.map((item) => [item.checklist_item_id, item.status]),
      );
    });
    const next = new Map<string, ChecklistResponseShape>();

    templateItems.forEach((templateItem) => {
      const statuses = extinguisherItemMaps
        .map((itemsMap) => itemsMap.get(templateItem.checklist_item_id))
        .filter(
          (status): status is ChecklistStatus =>
            status === "C" || status === "NC" || status === "NA",
        );

      if (statuses.some((status) => status === "NC")) {
        next.set(templateItem.checklist_item_id, {
          checklist_item_id: templateItem.checklist_item_id,
          status: "NC",
          observacoes: "Nao conformidade identificada em ao menos um extintor.",
        });
        return;
      }

      if (statuses.length > 0 && statuses.every((status) => status === "NA")) {
        next.set(templateItem.checklist_item_id, {
          checklist_item_id: templateItem.checklist_item_id,
          status: "NA",
          observacoes: null,
        });
        return;
      }

      if (statuses.some((status) => status === "C")) {
        next.set(templateItem.checklist_item_id, {
          checklist_item_id: templateItem.checklist_item_id,
          status: "C",
          observacoes: null,
        });
      }
    });

    return next;
  }, [equipmentChecklistTemplates.extintor.items, extinguishers]);
  const automaticResponses = useMemo(() => {
    const next = new Map<string, ChecklistResponseShape>();

    models.forEach((model) => {
      if (model.codigo === "A.23" || model.codigo === "A.25") {
        return;
      }

      const rows = rowsByInspection.get(model.id) || [];
      let currentSection = "";

      rows.forEach((row) => {
        if (row.type === "section") {
          currentSection = row.title;
          return;
        }

        if (row.type !== "item") {
          return;
        }

        const evaluation = getExtinguisherRuleEvaluation({
          sectionTitle: currentSection,
          itemNumber: row.sourceItemNumber,
          extinguishers,
        });

        if (!evaluation?.status) {
          return;
        }

        next.set(row.itemId, {
          checklist_item_id: row.itemId,
          status: evaluation.status,
          observacoes: evaluation.message,
        });
      });
    });

    return next;
  }, [extinguishers, models, rowsByInspection]);
  const mergedResponses = useMemo(() => {
    const next = new Map(automaticResponses);

    responses.forEach((value, key) => {
      if (!extinguisherInspectionItemIds.has(key)) {
        next.set(key, value);
      }
    });

    mirroredExtinguisherResponses.forEach((value, key) => {
      next.set(key, value);
    });

    return next;
  }, [automaticResponses, extinguisherInspectionItemIds, mirroredExtinguisherResponses, responses]);
  const equipmentChecklistSnapshots = useMemo(
    () =>
      buildEquipmentChecklistSnapshots({
        models,
        groupsByModel,
        responses: mergedResponses,
      }),
    [groupsByModel, mergedResponses, models],
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

      const [checklistData, equipmentData] = await Promise.all([
        loadChecklistData(supabase, id),
        loadChecklistEquipmentData(supabase, id),
      ]);

      setCompany(companyData);
      setModels(checklistData.models);
      setGroupsByModel(checklistData.groupsByModel);
      setResponses(checklistData.responses);
      setExtinguishers(equipmentData.extinguishers);
      setHydrants(equipmentData.hydrants);
      setEquipmentSchemaPending(equipmentData.missingTables);
      setEquipmentQrSchemaPending(false);
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

  useEffect(() => {
    initialEquipmentSyncDone.current = false;
  }, [id]);

  useEffect(
    () => () => {
      if (responsesRefreshTimeoutRef.current !== null) {
        window.clearTimeout(responsesRefreshTimeoutRef.current);
      }
      if (extinguisherRefreshTimeoutRef.current !== null) {
        window.clearTimeout(extinguisherRefreshTimeoutRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (
      !id ||
      loading ||
      equipmentSchemaPending ||
      initialEquipmentSyncDone.current
    ) {
      return;
    }

    initialEquipmentSyncDone.current = true;

    const synchronizeEquipmentAssets = async () => {
      try {
        const synced = await syncEquipmentChecklistSnapshots(supabase, {
          companyId: id,
          extinguisherSnapshot: equipmentChecklistSnapshots.extintor,
          hydrantSnapshot: equipmentChecklistSnapshots.hidrante,
          mode: "preserve",
        });

        if (!synced) {
          setEquipmentQrSchemaPending(true);
          return;
        }

        const updatedRecords = await ensureEquipmentQrCodes(supabase, {
          extinguishers,
          hydrants,
          extinguisherSnapshot: equipmentChecklistSnapshots.extintor,
          hydrantSnapshot: equipmentChecklistSnapshots.hidrante,
        });

        setExtinguishers(updatedRecords.extinguishers);
        setHydrants(updatedRecords.hydrants);
      } catch (error) {
        if (isMissingEquipmentQrSchemaError(error)) {
          setEquipmentQrSchemaPending(true);
          return;
        }
        console.error("Error synchronizing equipment QR data:", error);
      }
    };

    void synchronizeEquipmentAssets();
  }, [
    equipmentChecklistSnapshots.extintor,
    equipmentChecklistSnapshots.hidrante,
    equipmentSchemaPending,
    extinguishers,
    hydrants,
    id,
    loading,
  ]);

  const refreshEquipmentInspectionResponses = useCallback(async () => {
    if (!id || equipmentInspectionItemIds.size === 0) {
      return;
    }

    try {
      const latestResponses = await loadChecklistResponses(supabase, id);

      setResponses((previous) => {
        const next = new Map(previous);

        equipmentInspectionItemIds.forEach((itemId) => {
          next.delete(itemId);
        });

        latestResponses.forEach((response, itemId) => {
          if (equipmentInspectionItemIds.has(itemId)) {
            next.set(itemId, response);
          }
        });

        return next;
      });
    } catch (error) {
      console.error("Error refreshing equipment checklist responses:", error);
    }
  }, [equipmentInspectionItemIds, id]);

  const scheduleEquipmentInspectionRefresh = useCallback(() => {
    if (responsesRefreshTimeoutRef.current !== null) {
      window.clearTimeout(responsesRefreshTimeoutRef.current);
    }

    responsesRefreshTimeoutRef.current = window.setTimeout(() => {
      responsesRefreshTimeoutRef.current = null;
      void refreshEquipmentInspectionResponses();
    }, 250);
  }, [refreshEquipmentInspectionResponses]);

  const refreshExtinguishers = useCallback(async () => {
    if (!id || equipmentSchemaPending) {
      return;
    }

    try {
      const { data, error } = await supabase
        .from("empresa_extintores")
        .select("*")
        .eq("empresa_id", id)
        .order("numero", { ascending: true });

      if (error) {
        throw error;
      }

      setExtinguishers(sortByEquipmentNumber(data || []));
    } catch (error) {
      console.error("Error refreshing extinguishers:", error);
    }
  }, [equipmentSchemaPending, id]);

  const scheduleExtinguisherRefresh = useCallback(() => {
    if (extinguisherRefreshTimeoutRef.current !== null) {
      window.clearTimeout(extinguisherRefreshTimeoutRef.current);
    }

    extinguisherRefreshTimeoutRef.current = window.setTimeout(() => {
      extinguisherRefreshTimeoutRef.current = null;
      void refreshExtinguishers();
    }, 200);
  }, [refreshExtinguishers]);

  useEffect(() => {
    if (!id) {
      return;
    }

    const channel = supabase
      .channel(`company-checklist-responses-${id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "empresa_checklist_respostas",
          filter: `empresa_id=eq.${id}`,
        },
        () => {
          scheduleEquipmentInspectionRefresh();
        },
      )
      .subscribe();

    return () => {
      if (responsesRefreshTimeoutRef.current !== null) {
        window.clearTimeout(responsesRefreshTimeoutRef.current);
        responsesRefreshTimeoutRef.current = null;
      }

      void supabase.removeChannel(channel);
    };
  }, [id, scheduleEquipmentInspectionRefresh]);

  useEffect(() => {
    if (!id || equipmentSchemaPending) {
      return;
    }

    const channel = supabase
      .channel(`company-extinguishers-${id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "empresa_extintores",
          filter: `empresa_id=eq.${id}`,
        },
        () => {
          scheduleExtinguisherRefresh();
        },
      )
      .subscribe();

    return () => {
      if (extinguisherRefreshTimeoutRef.current !== null) {
        window.clearTimeout(extinguisherRefreshTimeoutRef.current);
        extinguisherRefreshTimeoutRef.current = null;
      }

      void supabase.removeChannel(channel);
    };
  }, [equipmentSchemaPending, id, scheduleExtinguisherRefresh]);

  useEffect(() => {
    if (!id) {
      return;
    }

    const unsubscribe = subscribeEquipmentChecklistUpdates((event) => {
      if (event.companyId === id) {
        scheduleEquipmentInspectionRefresh();
        scheduleExtinguisherRefresh();
      }
    });

    const handleVisibilityOrFocus = () => {
      scheduleEquipmentInspectionRefresh();
      scheduleExtinguisherRefresh();
    };

    window.addEventListener("focus", handleVisibilityOrFocus);
    document.addEventListener("visibilitychange", handleVisibilityOrFocus);

    return () => {
      unsubscribe();
      window.removeEventListener("focus", handleVisibilityOrFocus);
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
    };
  }, [id, scheduleEquipmentInspectionRefresh, scheduleExtinguisherRefresh]);

  const handleStatusChange = (itemId: string, status: ChecklistStatus) => {
    setResponses((previous) => {
      const next = new Map(previous);
      const existing = previous.get(itemId);
      next.set(itemId, {
        checklist_item_id: itemId,
        status,
        observacoes: existing?.observacoes || null,
      });
      return next;
    });
  };

  const openEquipmentQrDialog = (
    equipmentType: EquipmentType,
    record: ExtinguisherRecord | HydrantRecord,
  ) => {
    setQrDialogType(equipmentType);
    setQrDialogRecord(record);
    setQrDialogOpen(true);
  };

  const openEquipmentPublicPage = (
    equipmentType: EquipmentType,
    record: ExtinguisherRecord | HydrantRecord,
  ) => {
    const url =
      record.qr_code_url || buildEquipmentPublicUrl(equipmentType, record.public_token);
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleExtinguisherSaved = (record: ExtinguisherRecord) => {
    if (!record.qr_code_url || !record.qr_code_svg) {
      setEquipmentQrSchemaPending(true);
    }
    setExtinguishers((previous) =>
      sortByEquipmentNumber([
        ...previous.filter((item) => item.id !== record.id),
        record,
      ]),
    );
    setEditingExtinguisher(null);
  };

  const handleHydrantSaved = (record: HydrantRecord) => {
    if (!record.qr_code_url || !record.qr_code_svg) {
      setEquipmentQrSchemaPending(true);
    }
    setHydrants((previous) =>
      sortByEquipmentNumber([
        ...previous.filter((item) => item.id !== record.id),
        record,
      ]),
    );
    setEditingHydrant(null);
  };

  const handleDeleteExtinguisher = async (record: ExtinguisherRecord) => {
    if (!window.confirm(`Excluir o extintor ${record.numero}?`)) {
      return;
    }

    try {
      await deleteExtinguisher(supabase, record.id);
      setExtinguishers((previous) =>
        previous.filter((item) => item.id !== record.id),
      );
      toast({
        title: "Extintor removido",
        description: "O cadastro do extintor foi excluido.",
      });
    } catch (error) {
      toast({
        title: "Erro ao remover extintor",
        description: "Nao foi possivel excluir o extintor.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteHydrant = async (record: HydrantRecord) => {
    if (!window.confirm(`Excluir o hidrante ${record.numero}?`)) {
      return;
    }

    try {
      await deleteHydrant(supabase, record.id);
      setHydrants((previous) =>
        previous.filter((item) => item.id !== record.id),
      );
      toast({
        title: "Hidrante removido",
        description: "O cadastro do hidrante foi excluido.",
      });
    } catch (error) {
      toast({
        title: "Erro ao remover hidrante",
        description: "Nao foi possivel excluir o hidrante.",
        variant: "destructive",
      });
    }
  };

  const saveChecklistAndEnsureReport = async () => {
    if (!id) {
      return false;
    }

    try {
      await saveChecklistResponses({
        supabase,
        companyId: id,
        responses: mergedResponses,
        evaluableIds: evaluableItemIds,
      });

      const checklistSnapshot = buildChecklistSnapshot(
        models,
        groupsByModel,
        mergedResponses,
      );
      const equipmentSnapshots = buildEquipmentChecklistSnapshots({
        models,
        groupsByModel,
        responses: mergedResponses,
      });

      if (!equipmentSchemaPending) {
        const synced = await syncEquipmentChecklistSnapshots(supabase, {
          companyId: id,
          extinguisherSnapshot: equipmentSnapshots.extintor,
          hydrantSnapshot: equipmentSnapshots.hidrante,
          mode: "overwrite",
        });

        if (!synced) {
          setEquipmentQrSchemaPending(true);
        }
      }

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
  const isExtinguisherInspection = openInspectionData?.codigo === "A.23";
  const isHydrantInspection = openInspectionData?.codigo === "A.25";
  const isReadOnlyEquipmentInspection =
    isExtinguisherInspection || isHydrantInspection;
  const extinguisherSummary = buildExtinguisherSummary(extinguishers);
  const hydrantSummary = buildHydrantSummary(hydrants);
  const getEquipmentRuleHint = (
    sectionTitle: string,
    sourceItemNumber?: string | null,
  ) => {
    if (isExtinguisherInspection) {
      return (
        getExtinguisherRuleEvaluation({
          sectionTitle,
          itemNumber: sourceItemNumber,
          extinguishers,
        }) || null
      );
    }

    if (isHydrantInspection && sourceItemNumber === "3") {
      return {
        message: `${hydrantSummary.total} hidrante(s), ${hydrantSummary.expiredHoses} mangueira(s) vencida(s) e ${hydrantSummary.missingComponents} cadastro(s) com componentes pendentes.`,
      };
    }

    return null;
  };

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
              {(isExtinguisherInspection || isHydrantInspection) && (
                <div className="border-b px-4 py-4 md:px-0 md:pt-0 md:pb-6">
                  <div className="rounded-xl border bg-muted/10 p-4 space-y-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-1">
                        <h3 className="text-base font-semibold">
                          {isExtinguisherInspection
                            ? "Cadastro de extintores"
                            : "Cadastro de hidrantes"}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {isExtinguisherInspection
                            ? "Cadastre os extintores vistoriados para apoiar a avaliacao de quantidade, tipo, localizacao e vencimentos."
                            : "Cadastre os hidrantes e seus componentes para apoiar a avaliacao das mangueiras e acessorios."}
                        </p>
                      </div>

                      <Button
                        type="button"
                        onClick={() => {
                          if (isExtinguisherInspection) {
                            setEditingExtinguisher(null);
                            setExtinguisherDialogOpen(true);
                            return;
                          }

                          setEditingHydrant(null);
                          setHydrantDialogOpen(true);
                        }}
                        disabled={equipmentSchemaPending}
                        className="w-full md:w-auto"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        {isExtinguisherInspection
                          ? "Cadastrar Extintor"
                          : "Cadastrar Hidrante"}
                      </Button>
                    </div>

                    {equipmentSchemaPending ? (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                        As tabelas de equipamentos ainda nao existem no banco conectado. A migracao foi criada no projeto e precisa ser aplicada para liberar este cadastro.
                      </div>
                    ) : (
                      <>
                        {equipmentQrSchemaPending && (
                          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                            O cadastro continua funcionando, mas o QR Code e a ficha publica dos equipamentos ficam indisponiveis ate aplicar a migration de QR no banco conectado.
                          </div>
                        )}

                        {isExtinguisherInspection && (
                          <>
                            <div className="grid gap-3 md:grid-cols-3">
                              <div className="rounded-lg border bg-background p-4">
                                <p className="text-xs uppercase text-muted-foreground">
                                  Total
                                </p>
                                <p className="mt-2 text-2xl font-bold">
                                  {extinguisherSummary.total}
                                </p>
                              </div>
                              <div className="rounded-lg border bg-background p-4">
                                <p className="text-xs uppercase text-muted-foreground">
                                  Cargas vencidas
                                </p>
                                <p className="mt-2 text-2xl font-bold text-red-600">
                                  {extinguisherSummary.expiredRecharge}
                                </p>
                              </div>
                              <div className="rounded-lg border bg-background p-4">
                                <p className="text-xs uppercase text-muted-foreground">
                                  Testes vencidos
                                </p>
                                <p className="mt-2 text-2xl font-bold text-red-600">
                                  {extinguisherSummary.expiredHydroTest}
                                </p>
                              </div>
                            </div>

                            <div className="overflow-x-auto rounded-lg border bg-background">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>No.</TableHead>
                                    <TableHead>Localizacao</TableHead>
                                    <TableHead>Tipo</TableHead>
                                    <TableHead>Carga</TableHead>
                                    <TableHead>Venc. Carga</TableHead>
                                    <TableHead>Venc. Teste Hidrost.</TableHead>
                                    <TableHead className="text-right">
                                      Acoes
                                    </TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {extinguishers.length === 0 ? (
                                    <TableRow>
                                      <TableCell
                                        colSpan={7}
                                        className="text-center text-muted-foreground"
                                      >
                                        Nenhum extintor cadastrado.
                                      </TableCell>
                                    </TableRow>
                                  ) : (
                                    extinguishers.map((record) => (
                                      <TableRow key={record.id}>
                                        <TableCell className="font-medium">
                                          {record.numero}
                                        </TableCell>
                                        <TableCell>{record.localizacao}</TableCell>
                                        <TableCell>{record.tipo}</TableCell>
                                        <TableCell>{record.carga_nominal}</TableCell>
                                        <TableCell
                                          className={cn(
                                            isDateExpired(record.vencimento_carga) &&
                                              "font-medium text-red-600",
                                          )}
                                        >
                                          {formatMonthYear(record.vencimento_carga)}
                                        </TableCell>
                                        <TableCell
                                          className={cn(
                                            isHydroYearExpired(
                                              record.vencimento_teste_hidrostatico_ano,
                                            ) && "font-medium text-red-600",
                                          )}
                                        >
                                          {record.vencimento_teste_hidrostatico_ano}
                                        </TableCell>
                                        <TableCell className="text-right">
                                          <div className="flex justify-end gap-2">
                                            <Button
                                              type="button"
                                              variant="outline"
                                              size="sm"
                                              disabled={
                                                equipmentQrSchemaPending ||
                                                !record.qr_code_svg
                                              }
                                              onClick={() =>
                                                openEquipmentQrDialog(
                                                  "extintor",
                                                  record,
                                                )
                                              }
                                              aria-label={`Abrir QR do extintor ${record.numero}`}
                                            >
                                              <QrCode className="h-4 w-4" />
                                            </Button>
                                            <Button
                                              type="button"
                                              variant="outline"
                                              size="sm"
                                              disabled={
                                                equipmentQrSchemaPending ||
                                                !record.qr_code_url
                                              }
                                              onClick={() =>
                                                openEquipmentPublicPage(
                                                  "extintor",
                                                  record,
                                                )
                                              }
                                              aria-label={`Abrir ficha do extintor ${record.numero}`}
                                            >
                                              <ExternalLink className="h-4 w-4" />
                                            </Button>
                                            <Button
                                              type="button"
                                              variant="outline"
                                              size="sm"
                                              onClick={() => {
                                                setEditingExtinguisher(record);
                                                setExtinguisherDialogOpen(true);
                                              }}
                                            >
                                              <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button
                                              type="button"
                                              variant="outline"
                                              size="sm"
                                              onClick={() =>
                                                handleDeleteExtinguisher(record)
                                              }
                                            >
                                              <Trash2 className="h-4 w-4" />
                                            </Button>
                                          </div>
                                        </TableCell>
                                      </TableRow>
                                    ))
                                  )}
                                </TableBody>
                              </Table>
                            </div>
                          </>
                        )}

                        {isHydrantInspection && (
                          <>
                            <div className="grid gap-3 md:grid-cols-3">
                              <div className="rounded-lg border bg-background p-4">
                                <p className="text-xs uppercase text-muted-foreground">
                                  Total
                                </p>
                                <p className="mt-2 text-2xl font-bold">
                                  {hydrantSummary.total}
                                </p>
                              </div>
                              <div className="rounded-lg border bg-background p-4">
                                <p className="text-xs uppercase text-muted-foreground">
                                  Mangueiras vencidas
                                </p>
                                <p className="mt-2 text-2xl font-bold text-red-600">
                                  {hydrantSummary.expiredHoses}
                                </p>
                              </div>
                              <div className="rounded-lg border bg-background p-4">
                                <p className="text-xs uppercase text-muted-foreground">
                                  Componentes faltantes
                                </p>
                                <p className="mt-2 text-2xl font-bold text-amber-600">
                                  {hydrantSummary.missingComponents}
                                </p>
                              </div>
                            </div>

                            <div className="overflow-x-auto rounded-lg border bg-background">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>No.</TableHead>
                                    <TableHead>Localizacao</TableHead>
                                    <TableHead>Tipo de Hidrante</TableHead>
                                    <TableHead>Mangueira 1</TableHead>
                                    <TableHead>Mangueira 2</TableHead>
                                    <TableHead>Esguicho</TableHead>
                                    <TableHead>Chave</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">
                                      Acoes
                                    </TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {hydrants.length === 0 ? (
                                    <TableRow>
                                      <TableCell
                                        colSpan={9}
                                        className="text-center text-muted-foreground"
                                      >
                                        Nenhum hidrante cadastrado.
                                      </TableCell>
                                    </TableRow>
                                  ) : (
                                    hydrants.map((record) => (
                                      <TableRow key={record.id}>
                                        <TableCell className="font-medium">
                                          {record.numero}
                                        </TableCell>
                                        <TableCell>{record.localizacao}</TableCell>
                                        <TableCell>{record.tipo_hidrante}</TableCell>
                                        <TableCell>
                                          <div>{record.mangueira1_tipo}</div>
                                          <p
                                            className={cn(
                                              "text-xs text-muted-foreground",
                                              isDateExpired(
                                                record.mangueira1_vencimento_teste_hidrostatico,
                                              ) && "font-medium text-red-600",
                                            )}
                                          >
                                            {formatMonthYear(
                                              record.mangueira1_vencimento_teste_hidrostatico,
                                            )}
                                          </p>
                                        </TableCell>
                                        <TableCell>
                                          {record.mangueira2_tipo ? (
                                            <>
                                              <div>{record.mangueira2_tipo}</div>
                                              <p
                                                className={cn(
                                                  "text-xs text-muted-foreground",
                                                  isDateExpired(
                                                    record.mangueira2_vencimento_teste_hidrostatico,
                                                  ) &&
                                                    "font-medium text-red-600",
                                                )}
                                              >
                                                {formatMonthYear(
                                                  record.mangueira2_vencimento_teste_hidrostatico,
                                                )}
                                              </p>
                                            </>
                                          ) : (
                                            <span className="text-muted-foreground">
                                              -
                                            </span>
                                          )}
                                        </TableCell>
                                        <TableCell>
                                          {record.esguicho ? "Sim" : "Nao"}
                                        </TableCell>
                                        <TableCell>
                                          {record.chave_mangueira ? "Sim" : "Nao"}
                                        </TableCell>
                                        <TableCell>{record.status || "-"}</TableCell>
                                        <TableCell className="text-right">
                                          <div className="flex justify-end gap-2">
                                            <Button
                                              type="button"
                                              variant="outline"
                                              size="sm"
                                              disabled={
                                                equipmentQrSchemaPending ||
                                                !record.qr_code_svg
                                              }
                                              onClick={() =>
                                                openEquipmentQrDialog(
                                                  "hidrante",
                                                  record,
                                                )
                                              }
                                              aria-label={`Abrir QR do hidrante ${record.numero}`}
                                            >
                                              <QrCode className="h-4 w-4" />
                                            </Button>
                                            <Button
                                              type="button"
                                              variant="outline"
                                              size="sm"
                                              disabled={
                                                equipmentQrSchemaPending ||
                                                !record.qr_code_url
                                              }
                                              onClick={() =>
                                                openEquipmentPublicPage(
                                                  "hidrante",
                                                  record,
                                                )
                                              }
                                              aria-label={`Abrir ficha do hidrante ${record.numero}`}
                                            >
                                              <ExternalLink className="h-4 w-4" />
                                            </Button>
                                            <Button
                                              type="button"
                                              variant="outline"
                                              size="sm"
                                              onClick={() => {
                                                setEditingHydrant(record);
                                                setHydrantDialogOpen(true);
                                              }}
                                            >
                                              <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button
                                              type="button"
                                              variant="outline"
                                              size="sm"
                                              onClick={() =>
                                                handleDeleteHydrant(record)
                                              }
                                            >
                                              <Trash2 className="h-4 w-4" />
                                            </Button>
                                          </div>
                                        </TableCell>
                                      </TableRow>
                                    ))
                                  )}
                                </TableBody>
                              </Table>
                            </div>
                          </>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}

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
                {isReadOnlyEquipmentInspection && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Neste checklist principal, os status apenas refletem os checklists individuais dos equipamentos.
                  </p>
                )}
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
                    {(() => {
                      let currentSection = "";

                      return checklistRows.map((row) => {
                      if (row.type === "section") {
                        currentSection = row.title;
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

                      const manualResponse = responses.get(row.itemId);
                      const automaticResponse = automaticResponses.get(row.itemId);
                      const response = mergedResponses.get(row.itemId);
                      const equipmentRuleHint = getEquipmentRuleHint(
                        currentSection,
                        row.sourceItemNumber,
                      );

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
                            {equipmentRuleHint && (
                              <div className="mt-3 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900">
                                <span className="font-semibold">
                                  {equipmentRuleHint.status
                                    ? "Regra automatica"
                                    : "Base de avaliacao"}
                                  :
                                </span>{" "}
                                {equipmentRuleHint.message}
                                {automaticResponse && !manualResponse && (
                                  <span className="ml-2 inline-flex rounded-full border border-blue-300 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                                    Status automatico
                                  </span>
                                )}
                              </div>
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
                                  disabled={isReadOnlyEquipmentInspection}
                                  onClick={() =>
                                    handleStatusChange(row.itemId, statusValue)
                                  }
                                  className={cn(
                                    "inline-flex min-h-9 min-w-9 items-center justify-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-100",
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
                                {automaticResponse?.status === statusValue &&
                                  !manualResponse && (
                                    <div className="mt-1 text-[10px] font-medium uppercase text-blue-700">
                                      Auto
                                    </div>
                                  )}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      );
                    });
                    })()}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {id && (
          <>
            <ExtinguisherDialog
              companyId={id}
              checklistSnapshot={equipmentChecklistSnapshots.extintor}
              open={extinguisherDialogOpen}
              record={editingExtinguisher}
              onOpenChange={(open) => {
                setExtinguisherDialogOpen(open);
                if (!open) {
                  setEditingExtinguisher(null);
                }
              }}
              onSaved={handleExtinguisherSaved}
            />

            <HydrantDialog
              companyId={id}
              checklistSnapshot={equipmentChecklistSnapshots.hidrante}
              open={hydrantDialogOpen}
              record={editingHydrant}
              onOpenChange={(open) => {
                setHydrantDialogOpen(open);
                if (!open) {
                  setEditingHydrant(null);
                }
              }}
              onSaved={handleHydrantSaved}
            />

            <EquipmentQrDialog
              open={qrDialogOpen}
              onOpenChange={(open) => {
                setQrDialogOpen(open);
                if (!open) {
                  setQrDialogRecord(null);
                }
              }}
              equipmentType={qrDialogType}
              record={qrDialogRecord}
            />
          </>
        )}
      </div>
    </div>
  );
};

export default CompanyChecklists;
