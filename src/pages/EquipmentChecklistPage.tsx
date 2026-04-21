import {
  Fragment,
  startTransition,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useParams } from "react-router-dom";
import {
  Loader2,
  Flame,
  Droplets,
  Lightbulb,
  Save,
  ShieldCheck,
  Check,
  Minus,
  X,
  type LucideIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  canCompanyMemberExecuteChecklists,
  loadCompanyMembers,
} from "@/lib/company-members";
import {
  formatChecklistItemAuditSummary,
  type ChecklistSnapshotItem,
} from "@/lib/checklist";
import {
  isMissingEquipmentChecklistSaveRpcError,
} from "@/lib/supabase-errors";
import {
  formatMonthYear,
  getEquipmentChecklistSnapshotForType,
  loadEquipmentQrPage,
  saveEquipmentQrChecklist,
  updateEquipmentChecklistSnapshotItem,
  type EquipmentChecklistSnapshot,
  type EquipmentPublicPageRecord,
  type EquipmentType,
} from "@/lib/checklist-equipment";
import { broadcastEquipmentChecklistUpdate } from "@/lib/equipment-checklist-sync";
import {
  loadChecklistNonConformities,
  saveChecklistNonConformity,
  type ChecklistNonConformityRecord,
} from "@/lib/checklist-non-conformities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EquipmentQrLoginDialog } from "@/components/auth/EquipmentQrLoginDialog";
import { ChecklistNonConformityDialog } from "@/components/checklists/ChecklistNonConformityDialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

type EquipmentChecklistStatus = "C" | "NC" | "NA";
type SaveIndicatorState = "idle" | "saving" | "saved" | "error";

const STATUS_ORDER: EquipmentChecklistStatus[] = ["C", "NC", "NA"];
const MOBILE_INITIAL_VISIBLE_ITEMS = 8;
const MOBILE_VISIBLE_ITEMS_BATCH = 6;

const STATUS_META: Record<
  EquipmentChecklistStatus,
  {
    value: EquipmentChecklistStatus;
    label: string;
    shortLabel: string;
    icon: LucideIcon;
    activeClass: string;
    inactiveClass: string;
    badgeClassName: string;
  }
> = {
  C: {
    value: "C",
    label: "Conforme",
    shortLabel: "C",
    icon: Check,
    activeClass: "border-emerald-600 bg-emerald-600 text-white shadow-sm",
    inactiveClass:
      "border-emerald-200 bg-background text-emerald-700 hover:bg-emerald-50",
    badgeClassName: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  NC: {
    value: "NC",
    label: "Nao Conforme",
    shortLabel: "NC",
    icon: X,
    activeClass: "border-red-600 bg-red-600 text-white shadow-sm",
    inactiveClass: "border-red-200 bg-background text-red-700 hover:bg-red-50",
    badgeClassName: "bg-red-50 text-red-700 border-red-200",
  },
  NA: {
    value: "NA",
    label: "Nao Aplicavel",
    shortLabel: "NA",
    icon: Minus,
    activeClass: "border-slate-500 bg-slate-500 text-white shadow-sm",
    inactiveClass:
      "border-slate-300 bg-background text-slate-600 hover:bg-slate-100",
    badgeClassName: "bg-slate-100 text-slate-700 border-slate-300",
  },
};

const formatGeneratedAt = (value?: string | null) => {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleString("pt-BR");
};

const renderEquipmentDetails = (
  equipmentType: EquipmentType,
  equipmentData: Record<string, unknown>,
) => {
  if (equipmentType === "extintor") {
    return [
      { label: "Numero", value: String(equipmentData.numero || "-") },
      { label: "Localizacao", value: String(equipmentData.localizacao || "-") },
      { label: "Tipo", value: String(equipmentData.tipo || "-") },
      {
        label: "Carga nominal",
        value: String(equipmentData.carga_nominal || "-"),
      },
      {
        label: "Vencimento da carga",
        value:
          typeof equipmentData.vencimento_carga === "string"
            ? formatMonthYear(equipmentData.vencimento_carga)
            : "-",
      },
      {
        label: "Teste hidrostatico",
        value: String(equipmentData.vencimento_teste_hidrostatico_ano || "-"),
      },
    ];
  }

  if (equipmentType === "luminaria") {
    return [
      { label: "Numero", value: String(equipmentData.numero || "-") },
      { label: "Localizacao", value: String(equipmentData.localizacao || "-") },
      {
        label: "Tipo de luminaria",
        value: String(equipmentData.tipo_luminaria || "-"),
      },
      {
        label: "Status",
        value: String(equipmentData.status || "-"),
      },
    ];
  }

  return [
    { label: "Numero", value: String(equipmentData.numero || "-") },
    { label: "Localizacao", value: String(equipmentData.localizacao || "-") },
    {
      label: "Tipo de hidrante",
      value: String(equipmentData.tipo_hidrante || "-"),
    },
    {
      label: "Mangueira 1",
      value: `${String(equipmentData.mangueira1_tipo || "-")} | ${
        typeof equipmentData.mangueira1_vencimento_teste_hidrostatico === "string"
          ? formatMonthYear(
              equipmentData.mangueira1_vencimento_teste_hidrostatico,
            )
          : "-"
      }`,
    },
    {
      label: "Mangueira 2",
      value: equipmentData.mangueira2_tipo
        ? `${String(equipmentData.mangueira2_tipo)} | ${
            typeof equipmentData.mangueira2_vencimento_teste_hidrostatico ===
            "string"
              ? formatMonthYear(
                  equipmentData.mangueira2_vencimento_teste_hidrostatico,
                )
              : "-"
          }`
        : "-",
    },
    {
      label: "Esguicho",
      value: equipmentData.esguicho ? "Sim" : "Nao",
    },
    {
      label: "Chave de mangueira",
      value: equipmentData.chave_mangueira ? "Sim" : "Nao",
    },
    {
      label: "Status",
      value: String(equipmentData.status || "-"),
    },
  ];
};

const EquipmentChecklistPage = () => {
  const { kind, token } = useParams<{ kind: string; token: string }>();
  const { toast } = useToast();
  const { user, loading: authLoading, signIn, isSystemAdmin } = useAuth();
  const isMobile = useIsMobile();
  const equipmentType =
    kind === "extintor" || kind === "hidrante" || kind === "luminaria"
      ? (kind as EquipmentType)
      : null;
  const [record, setRecord] = useState<EquipmentPublicPageRecord | null>(null);
  const [checklistSnapshot, setChecklistSnapshot] =
    useState<EquipmentChecklistSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [canExecuteChecklist, setCanExecuteChecklist] = useState(true);
  const [saveIndicator, setSaveIndicator] =
    useState<SaveIndicatorState>("idle");
  const [notFound, setNotFound] = useState(false);
  const [nonConformities, setNonConformities] = useState<
    Map<string, ChecklistNonConformityRecord>
  >(new Map());
  const [selectedNonConformityItem, setSelectedNonConformityItem] = useState<
    EquipmentChecklistSnapshot["items"][number] | null
  >(null);
  const [nonConformityDialogOpen, setNonConformityDialogOpen] = useState(false);
  const [savingNonConformity, setSavingNonConformity] = useState(false);
  const [loadingSelectedNonConformity, setLoadingSelectedNonConformity] =
    useState(false);
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [visibleItemCount, setVisibleItemCount] = useState(
    Number.POSITIVE_INFINITY,
  );
  const confirmedSnapshotRef = useRef<EquipmentChecklistSnapshot | null>(null);
  const activeSnapshotRef = useRef<EquipmentChecklistSnapshot | null>(null);
  const pendingSnapshotRef = useRef<EquipmentChecklistSnapshot | null>(null);
  const saveInFlightRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const totalItems = checklistSnapshot?.items.length ?? 0;

    if (!totalItems) {
      setVisibleItemCount(Number.POSITIVE_INFINITY);
      return;
    }

    if (!isMobile) {
      setVisibleItemCount(Number.POSITIVE_INFINITY);
      return;
    }

    setVisibleItemCount(Math.min(MOBILE_INITIAL_VISIBLE_ITEMS, totalItems));

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const scheduleNextBatch = () => {
      timer = setTimeout(() => {
        if (cancelled) {
          return;
        }

        startTransition(() => {
          setVisibleItemCount((current) => {
            if (!Number.isFinite(current)) {
              return current;
            }

            const next = Math.min(current + MOBILE_VISIBLE_ITEMS_BATCH, totalItems);

            if (next < totalItems && !cancelled) {
              scheduleNextBatch();
            }

            return next;
          });
        });
      }, 90);
    };

    if (MOBILE_INITIAL_VISIBLE_ITEMS < totalItems) {
      scheduleNextBatch();
    }

    return () => {
      cancelled = true;
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [checklistSnapshot?.items.length, isMobile]);

  const flushPendingSave = useCallback(async () => {
    if (!token || !equipmentType || !user || saveInFlightRef.current) {
      return false;
    }

    saveInFlightRef.current = true;
    let hasError = false;

    try {
      while (pendingSnapshotRef.current) {
        const snapshotToSave = pendingSnapshotRef.current;
        pendingSnapshotRef.current = null;

        if (mountedRef.current) {
          setSaveIndicator("saving");
        }

        const result = await saveEquipmentQrChecklist(supabase, {
          token,
          checklistSnapshot: snapshotToSave,
        });
        const persistedSnapshot = getEquipmentChecklistSnapshotForType(
          equipmentType,
          result?.checklist_snapshot ?? snapshotToSave,
        );
        const nextConfirmedSnapshot = {
          ...persistedSnapshot,
          generated_at:
            persistedSnapshot.generated_at || new Date().toISOString(),
        };
        const companyId = result?.empresa_id;
        confirmedSnapshotRef.current = nextConfirmedSnapshot;

        if (!mountedRef.current) {
          if (companyId) {
            broadcastEquipmentChecklistUpdate(companyId);
          }
          continue;
        }

        setRecord((previous) =>
          previous
            ? {
                ...previous,
                checklist_snapshot:
                  result?.checklist_snapshot ?? previous.checklist_snapshot,
              }
            : previous,
        );

        if (!pendingSnapshotRef.current) {
          activeSnapshotRef.current = nextConfirmedSnapshot;
          setChecklistSnapshot(nextConfirmedSnapshot);
          setSaveIndicator("saved");
        }

        if (companyId) {
          broadcastEquipmentChecklistUpdate(companyId);
        }
      }
    } catch (error) {
      hasError = true;
      pendingSnapshotRef.current = null;
      console.error("Error saving equipment checklist:", error);

      if (mountedRef.current) {
        activeSnapshotRef.current = confirmedSnapshotRef.current;
        setChecklistSnapshot(confirmedSnapshotRef.current);
        setSaveIndicator("error");
        toast({
          title: "Erro ao salvar checklist",
          description:
            isMissingEquipmentChecklistSaveRpcError(error)
              ? "A funcao save_equipment_qr_checklist nao existe no Supabase conectado. Aplique a migration 20260318123000_add_save_equipment_qr_checklist_rpc.sql."
              : "Nao foi possivel salvar o checklist deste equipamento.",
          variant: "destructive",
        });
      }
    } finally {
      saveInFlightRef.current = false;

      if (pendingSnapshotRef.current) {
        void flushPendingSave();
      }
    }

    return !hasError;
  }, [equipmentType, record, toast, token, user]);

  useEffect(() => {
    if (authLoading || user) {
      return;
    }

    setLoading(false);
    setNotFound(false);
    setRecord(null);
    setChecklistSnapshot(null);
    setNonConformities(new Map());
    setSelectedNonConformityItem(null);
    setNonConformityDialogOpen(false);
    setSaveIndicator("idle");
    setCanExecuteChecklist(true);
    activeSnapshotRef.current = null;
    confirmedSnapshotRef.current = null;
    pendingSnapshotRef.current = null;
  }, [authLoading, user]);

  useEffect(() => {
    const fetchRecord = async () => {
      if (authLoading || !user) {
        return;
      }

      if (!equipmentType || !token) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const data = await loadEquipmentQrPage(supabase, token, equipmentType);

        if (!data || data.equipment_type !== equipmentType) {
          setNotFound(true);
          setRecord(null);
          setChecklistSnapshot(null);
          setNonConformities(new Map());
          return;
        }

        let executionAllowed = true;

        try {
          const members = await loadCompanyMembers(supabase, data.empresa_id);
          const currentMember =
            members.find((member) => member.user_id === user?.id) || null;
          executionAllowed = canCompanyMemberExecuteChecklists(
            currentMember,
            isSystemAdmin,
          );
        } catch (permissionError) {
          console.error(
            "Error loading company checklist permission for equipment page:",
            permissionError,
          );
        }

        const baseSnapshot = getEquipmentChecklistSnapshotForType(
          equipmentType,
          data.checklist_snapshot,
        );
        setRecord(data);
        setCanExecuteChecklist(executionAllowed);
        setNonConformities(new Map());
        setChecklistSnapshot(baseSnapshot);
        activeSnapshotRef.current = baseSnapshot;
        confirmedSnapshotRef.current = baseSnapshot;
        pendingSnapshotRef.current = null;
        setSaveIndicator("idle");
        setNotFound(false);
      } catch (error) {
        console.error("Error loading equipment QR page:", error);
        setNotFound(true);
        setRecord(null);
        setChecklistSnapshot(null);
        setNonConformities(new Map());
        setCanExecuteChecklist(true);
        activeSnapshotRef.current = null;
        confirmedSnapshotRef.current = null;
        pendingSnapshotRef.current = null;
      } finally {
        setLoading(false);
      }
    };

    void fetchRecord();
  }, [authLoading, equipmentType, isSystemAdmin, toast, token, user, user?.id]);

  const queueSnapshotSave = useCallback(
    (nextSnapshot: EquipmentChecklistSnapshot) => {
      activeSnapshotRef.current = nextSnapshot;
      setChecklistSnapshot(nextSnapshot);
      pendingSnapshotRef.current = nextSnapshot;
      setSaveIndicator("saving");
      void flushPendingSave();
    },
    [flushPendingSave],
  );

  const handleSaveCurrentChecklist = useCallback(async () => {
    const currentSnapshot = activeSnapshotRef.current;

    if (!currentSnapshot || !canExecuteChecklist) {
      return;
    }

    pendingSnapshotRef.current = currentSnapshot;
    setSaveIndicator("saving");

    const success = await flushPendingSave();

    if (success && mountedRef.current) {
      toast({
        title: "Checklist salvo",
        description: "O checklist deste equipamento foi salvo com sucesso.",
      });
    }
  }, [canExecuteChecklist, flushPendingSave, toast]);

  const handleStatusChange = (
    itemId: string,
    status: EquipmentChecklistStatus,
  ) => {
    const currentSnapshot = activeSnapshotRef.current;

    if (!currentSnapshot) {
      return;
    }

    const existingNonConformity = nonConformities.get(itemId);
    const nextSnapshot = updateEquipmentChecklistSnapshotItem(
      currentSnapshot,
      itemId,
      {
        status,
        observacoes:
          status === "NC" ? existingNonConformity?.descricao || null : null,
        preenchido_por_nome: currentActorName,
        preenchido_por_user_id: user?.id || null,
        preenchido_em: new Date().toISOString(),
      },
    );

    queueSnapshotSave(nextSnapshot);
  };

  const openNonConformityDialog = async (
    item: EquipmentChecklistSnapshot["items"][number],
  ) => {
    if (item.status !== "NC") {
      return;
    }

    setSelectedNonConformityItem(item);
    setNonConformityDialogOpen(true);

    if (!record || !equipmentType) {
      return;
    }

    const existing = nonConformities.get(item.checklist_item_id);
    if (existing?.imagem_data_url) {
      return;
    }

    try {
      setLoadingSelectedNonConformity(true);
      const [fullRecord] = await loadChecklistNonConformities(
        supabase,
        {
          companyId: record.empresa_id,
          checklistItemId: item.checklist_item_id,
          equipmentType,
          equipmentRecordId: record.equipment_id,
        },
        {
          includeImageData: true,
        },
      );

      if (!fullRecord) {
        return;
      }

      setNonConformities((previous) => {
        const next = new Map(previous);
        next.set(fullRecord.checklist_item_id, fullRecord);
        return next;
      });
    } catch (error) {
      console.error(
        "Error loading selected equipment non conformity:",
        error,
      );
      toast({
        title: "Nao foi possivel carregar a nao conformidade completa",
        description:
          "A descricao foi exibida, mas a imagem detalhada nao pode ser carregada agora.",
        variant: "destructive",
      });
    } finally {
      setLoadingSelectedNonConformity(false);
    }
  };

  const handleSaveNonConformity = async ({
    description,
    imageDataUrl,
  }: {
    description: string;
    imageDataUrl: string;
  }) => {
    if (!record || !selectedNonConformityItem || !equipmentType) {
      return;
    }

    try {
      setSavingNonConformity(true);
      const savedRecord = await saveChecklistNonConformity(supabase, {
        companyId: record.empresa_id,
        checklistItemId: selectedNonConformityItem.checklist_item_id,
        description,
        imageDataUrl,
        equipmentType,
        equipmentRecordId: record.equipment_id,
      });

      if (savedRecord) {
        setNonConformities((previous) => {
          const next = new Map(previous);
          next.set(savedRecord.checklist_item_id, savedRecord);
          return next;
        });
      }

      const currentSnapshot = activeSnapshotRef.current;
      if (currentSnapshot) {
        const nextSnapshot = updateEquipmentChecklistSnapshotItem(
          currentSnapshot,
          selectedNonConformityItem.checklist_item_id,
          {
            observacoes: description,
            preenchido_por_nome: currentActorName,
            preenchido_por_user_id: user?.id || null,
            preenchido_em: new Date().toISOString(),
          },
        );
        queueSnapshotSave(nextSnapshot);
      }

      setNonConformityDialogOpen(false);
    } catch (error) {
      console.error("Error saving equipment non conformity:", error);
      toast({
        title: "Erro ao salvar nao conformidade",
        description:
          "Nao foi possivel registrar a descricao e a imagem desta nao conformidade.",
        variant: "destructive",
      });
    } finally {
      setSavingNonConformity(false);
    }
  };

  const handleQrLogin = useCallback(
    async ({
      email,
      password,
    }: {
      email: string;
      password: string;
    }) => {
      setAuthSubmitting(true);

      try {
        const { error } = await signIn(email, password);

        if (error) {
          if (error.message.includes("Invalid login credentials")) {
            throw new Error("Email ou senha incorretos.");
          }

          throw new Error(error.message);
        }

        toast({
          title: "Login realizado com sucesso",
          description: "Checklist do equipamento liberado para consulta e preenchimento.",
        });
      } finally {
        setAuthSubmitting(false);
      }
    },
    [signIn, toast],
  );

  const equipmentData = isObjectRecord(record?.equipment_data)
    ? record.equipment_data
    : {};
  const saveIndicatorClassName =
    saveIndicator === "error"
      ? "text-red-700"
      : saveIndicator === "saved"
        ? "text-emerald-700"
        : "text-muted-foreground";
  const isPersistingChecklist = saveIndicator === "saving";
  const saveIndicatorLabel =
    saveIndicator === "saving"
      ? "Salvando..."
      : saveIndicator === "saved"
        ? "Salvo agora"
        : saveIndicator === "error"
          ? "Erro ao salvar"
          : "Autosave ativo";

  const loginRequired = !authLoading && !user;

  if (authLoading || (user && loading)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (loginRequired) {
    return (
      <>
        <div className="min-h-screen bg-muted/20">
          <div className="container mx-auto flex min-h-screen max-w-3xl items-center justify-center px-4 py-8">
            <Card className="w-full border-none shadow-sm">
              <CardContent className="flex flex-col items-center gap-4 px-6 py-12 text-center">
                <div className="rounded-3xl bg-primary/10 p-4 text-primary">
                  <ShieldCheck className="h-8 w-8" />
                </div>
                <div className="space-y-2">
                  <p className="text-sm uppercase tracking-[0.24em] text-muted-foreground">
                    Checklist via QR Code
                  </p>
                  <h1 className="text-2xl font-bold">
                    Acesso restrito a usuarios autenticados
                  </h1>
                  <p className="mx-auto max-w-xl text-sm text-muted-foreground">
                    Faça login para visualizar o checklist do equipamento, registrar
                    nao conformidades e sincronizar as informacoes com o checklist
                    principal da empresa.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <EquipmentQrLoginDialog
          open={loginRequired}
          submitting={authSubmitting}
          onSubmit={handleQrLogin}
        />
      </>
    );
  }

  if (notFound || !record || !equipmentType || !checklistSnapshot) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <Card className="w-full max-w-xl">
          <CardContent className="py-12 text-center">
            <p className="text-lg font-semibold">Equipamento nao encontrado</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Verifique se o QR Code lido pertence a um equipamento ativo deste sistema.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const Icon =
    equipmentType === "extintor"
      ? Flame
      : equipmentType === "hidrante"
        ? Droplets
        : Lightbulb;
  const detailRows = renderEquipmentDetails(equipmentType, equipmentData);
  const totalChecklistItems = checklistSnapshot.items.length;
  const visibleChecklistItems = Number.isFinite(visibleItemCount)
    ? checklistSnapshot.items.slice(0, visibleItemCount)
    : checklistSnapshot.items;
  const isProgressivelyRenderingMobileItems =
    isMobile && visibleChecklistItems.length < totalChecklistItems;
  const currentActorName =
    (typeof user?.user_metadata?.nome === "string" &&
    user.user_metadata.nome.trim()
      ? user.user_metadata.nome.trim()
      : "") ||
    user?.email?.trim() ||
    "Usuario nao identificado";

  return (
    <div className="min-h-screen bg-muted/20">
      <div className="container mx-auto px-4 py-6 md:py-10">
        <div className="grid gap-6 lg:grid-cols-[1.05fr,0.95fr]">
          <div className="space-y-6">
            <Card className="overflow-hidden border-none shadow-sm">
              <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700 p-6 text-white">
                <div className="flex items-start gap-4">
                  <div className="rounded-2xl bg-white/10 p-3">
                    <Icon className="h-7 w-7" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm uppercase tracking-[0.24em] text-white/70">
                      Ficha do equipamento
                    </p>
                    <h1 className="text-2xl font-bold md:text-3xl">
                      {record.titulo}
                    </h1>
                    <p className="text-sm text-white/80">{record.subtitulo}</p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Badge className="border-white/20 bg-white/10 text-white hover:bg-white/10">
                        {record.empresa_razao_social}
                      </Badge>
                      <Badge className="border-white/20 bg-white/10 text-white hover:bg-white/10">
                        {record.localizacao}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
              <CardContent className="p-6">
                <div className="grid gap-4 md:grid-cols-2">
                  {detailRows.map((item) => (
                    <div
                      key={item.label}
                      className="rounded-xl border bg-background p-4"
                    >
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        {item.label}
                      </p>
                      <p className="mt-2 text-sm font-medium text-foreground">
                        {item.value}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-primary/10 p-2 text-primary">
                      <ShieldCheck className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle>Checklist do equipamento</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        Ultima sincronizacao:{" "}
                        {formatGeneratedAt(checklistSnapshot.generated_at)}
                      </p>
                      <p className={cn("mt-1 text-xs font-medium", saveIndicatorClassName)}>
                        {saveIndicator === "saving" && (
                          <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" />
                        )}
                        {saveIndicatorLabel}
                      </p>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-xl border bg-background p-4">
                    <p className="text-xs uppercase text-muted-foreground">
                      Total
                    </p>
                    <p className="mt-2 text-2xl font-bold">
                      {checklistSnapshot.total}
                    </p>
                  </div>
                  <div className="rounded-xl border bg-emerald-50 p-4">
                    <p className="text-xs uppercase text-emerald-700">
                      Conformes
                    </p>
                    <p className="mt-2 text-2xl font-bold text-emerald-700">
                      {checklistSnapshot.conforme}
                    </p>
                  </div>
                  <div className="rounded-xl border bg-red-50 p-4">
                    <p className="text-xs uppercase text-red-700">
                      Nao conformes
                    </p>
                    <p className="mt-2 text-2xl font-bold text-red-700">
                      {checklistSnapshot.nao_conforme}
                    </p>
                  </div>
                  <div className="rounded-xl border bg-slate-100 p-4">
                    <p className="text-xs uppercase text-slate-700">
                      NA/Pendentes
                    </p>
                    <p className="mt-2 text-2xl font-bold text-slate-700">
                      {checklistSnapshot.nao_aplicavel + checklistSnapshot.pendentes}
                    </p>
                  </div>
                </div>

                {!canExecuteChecklist ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                    Seu usuario esta em modo consulta para esta empresa. O gestor
                    precisa liberar a execucao de checklists para que voce possa
                    marcar os itens e registrar nao conformidades neste equipamento.
                  </div>
                ) : (
                  <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
                    Cada clique em `C`, `NC` ou `NA` salva automaticamente este
                    checklist. O checklist principal da empresa assume o pior
                    status por item em tempo real.
                  </div>
                )}

                {canExecuteChecklist && checklistSnapshot.items.length === 0 ? (
                  <div className="rounded-xl border border-dashed bg-background p-6 text-center text-sm text-muted-foreground">
                    O checklist principal deste equipamento ainda nao foi sincronizado.
                  </div>
                ) : canExecuteChecklist ? (
                  <div className="overflow-x-auto rounded-xl border bg-background">
                    {isProgressivelyRenderingMobileItems ? (
                      <div className="border-b bg-amber-50 px-4 py-2 text-xs text-amber-900 md:hidden">
                        Exibindo {visibleChecklistItems.length} de {totalChecklistItems} itens.
                        O restante do checklist esta carregando em segundo plano.
                      </div>
                    ) : null}
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead colSpan={6} className="text-center">
                            {checklistSnapshot.inspection_name.toUpperCase()}
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {visibleChecklistItems.map((item, index) => {
                          const showSectionHeader =
                            index === 0 ||
                            visibleChecklistItems[index - 1]?.secao !== item.secao;
                          const nonConformityRecord = nonConformities.get(
                            item.checklist_item_id,
                          );
                          const canOpenNonConformityDialog =
                            item.status === "NC";

                          return (
                            <Fragment key={item.checklist_item_id}>
                              {showSectionHeader && (
                                <TableRow className="bg-muted/25">
                                  <TableCell className="font-medium whitespace-nowrap text-xs md:text-sm">
                                    Item
                                  </TableCell>
                                  <TableCell className="font-medium text-xs md:text-sm">
                                    {item.secao}
                                  </TableCell>
                                  <TableCell className="font-medium text-xs md:text-sm">
                                    Registro
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
                              )}

                              <TableRow
                                onClick={
                                  canOpenNonConformityDialog
                                    ? () => openNonConformityDialog(item)
                                    : undefined
                                }
                                className={cn(
                                  canOpenNonConformityDialog &&
                                    "cursor-pointer transition-colors hover:bg-red-50/40",
                                )}
                              >
                                <TableCell className="font-medium whitespace-nowrap text-xs md:text-sm">
                                  {item.item_exibicao}
                                </TableCell>
                                <TableCell className="text-xs md:text-sm">
                                  <div className="whitespace-pre-line">
                                    {item.descricao}
                                  </div>
                                  {item.observacoes && (
                                    <p className="mt-2 text-xs text-muted-foreground">
                                      Obs.: {item.observacoes}
                                    </p>
                                  )}
                                  {canOpenNonConformityDialog && (
                                    <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                                      <span className="font-semibold">
                                        {nonConformityRecord
                                          ? "Nao conformidade registrada:"
                                          : "Registro pendente:"}
                                      </span>{" "}
                                      {nonConformityRecord
                                        ? "clique na linha para editar a descricao e a imagem."
                                        : "clique na linha para descrever e anexar a imagem desta nao conformidade."}
                                    </div>
                                  )}
                                </TableCell>
                                <TableCell className="whitespace-pre-line text-[11px] leading-5 text-muted-foreground">
                                  {formatChecklistItemAuditSummary(item)}
                                </TableCell>
                                {STATUS_ORDER.map((statusValue) => {
                                  const meta = STATUS_META[statusValue];
                                  const StatusIcon = meta.icon;
                                  const isActive = item.status === statusValue;

                                  return (
                                    <TableCell
                                      key={`${item.checklist_item_id}-${statusValue}`}
                                      className="text-center"
                                    >
                                      <button
                                        type="button"
                                        aria-pressed={isActive}
                                        aria-label={`${meta.label} para item ${item.item_exibicao}`}
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          handleStatusChange(
                                            item.checklist_item_id,
                                            statusValue,
                                          );
                                        }}
                                        className={cn(
                                          "inline-flex min-h-9 min-w-9 items-center justify-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                                          isActive
                                            ? meta.activeClass
                                            : meta.inactiveClass,
                                        )}
                                      >
                                        <StatusIcon className="h-3.5 w-3.5" />
                                        <span className="sr-only sm:not-sr-only sm:ml-1">
                                          {meta.shortLabel}
                                        </span>
                                      </button>
                                    </TableCell>
                                  );
                                })}
                              </TableRow>
                            </Fragment>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                ) : null}

                {canExecuteChecklist && checklistSnapshot.items.length > 0 ? (
                  <div className="border-t px-4 py-4 md:px-0 md:pt-5">
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => void handleSaveCurrentChecklist()}
                        disabled={isPersistingChecklist}
                        className="w-full sm:w-auto"
                      >
                        {isPersistingChecklist ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="mr-2 h-4 w-4" />
                        )}
                        Salvar este checklist
                      </Button>
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {nonConformityDialogOpen ? (
        <ChecklistNonConformityDialog
          open={nonConformityDialogOpen}
          onOpenChange={(open) => {
            setNonConformityDialogOpen(open);
            if (!open) {
              setSelectedNonConformityItem(null);
            }
          }}
          itemLabel={
            selectedNonConformityItem
              ? `Item ${selectedNonConformityItem.item_exibicao} - ${selectedNonConformityItem.secao}`
              : undefined
          }
          initialDescription={
            selectedNonConformityItem
              ? nonConformities.get(selectedNonConformityItem.checklist_item_id)
                  ?.descricao ||
                selectedNonConformityItem.observacoes ||
                ""
              : ""
          }
          initialImageDataUrl={
            selectedNonConformityItem
              ? nonConformities.get(selectedNonConformityItem.checklist_item_id)
                  ?.imagem_data_url || ""
              : ""
          }
          saving={savingNonConformity}
          loading={loadingSelectedNonConformity}
          onSave={handleSaveNonConformity}
        />
      ) : null}
    </div>
  );
};

export default EquipmentChecklistPage;
