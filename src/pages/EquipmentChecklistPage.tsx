import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Loader2,
  Flame,
  Droplets,
  ShieldCheck,
  Check,
  Minus,
  X,
  type LucideIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  formatMonthYear,
  getEquipmentChecklistSnapshotForType,
  loadEquipmentQrPage,
  saveEquipmentQrChecklist,
  updateEquipmentChecklistSnapshotItemStatus,
  type EquipmentChecklistSnapshot,
  type EquipmentPublicPageRecord,
  type EquipmentType,
} from "@/lib/checklist-equipment";
import { broadcastEquipmentChecklistUpdate } from "@/lib/equipment-checklist-sync";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

type EquipmentChecklistStatus = "C" | "NC" | "NA";
type SaveIndicatorState = "idle" | "saving" | "saved" | "error";

const STATUS_ORDER: EquipmentChecklistStatus[] = ["C", "NC", "NA"];

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
  const equipmentType =
    kind === "extintor" || kind === "hidrante"
      ? (kind as EquipmentType)
      : null;
  const [record, setRecord] = useState<EquipmentPublicPageRecord | null>(null);
  const [checklistSnapshot, setChecklistSnapshot] =
    useState<EquipmentChecklistSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveIndicator, setSaveIndicator] =
    useState<SaveIndicatorState>("idle");
  const [notFound, setNotFound] = useState(false);
  const confirmedSnapshotRef = useRef<EquipmentChecklistSnapshot | null>(null);
  const pendingSnapshotRef = useRef<EquipmentChecklistSnapshot | null>(null);
  const saveInFlightRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  const flushPendingSave = useCallback(async () => {
    if (!token || !equipmentType || saveInFlightRef.current) {
      return;
    }

    saveInFlightRef.current = true;

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
          setChecklistSnapshot(nextConfirmedSnapshot);
          setSaveIndicator("saved");
        }

        if (companyId) {
          broadcastEquipmentChecklistUpdate(companyId);
        }
      }
    } catch (error) {
      pendingSnapshotRef.current = null;
      console.error("Error saving equipment checklist:", error);

      if (mountedRef.current) {
        setChecklistSnapshot(confirmedSnapshotRef.current);
        setSaveIndicator("error");
        toast({
          title: "Erro ao salvar checklist",
          description:
            "Nao foi possivel salvar o checklist deste equipamento.",
          variant: "destructive",
        });
      }
    } finally {
      saveInFlightRef.current = false;

      if (pendingSnapshotRef.current) {
        void flushPendingSave();
      }
    }
  }, [equipmentType, toast, token]);

  useEffect(() => {
    const fetchRecord = async () => {
      if (!equipmentType || !token) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const data = await loadEquipmentQrPage(supabase, token);

        if (!data || data.equipment_type !== equipmentType) {
          setNotFound(true);
          setRecord(null);
          setChecklistSnapshot(null);
          return;
        }

        const nextSnapshot = getEquipmentChecklistSnapshotForType(
          equipmentType,
          data.checklist_snapshot,
        );
        setRecord(data);
        setChecklistSnapshot(nextSnapshot);
        confirmedSnapshotRef.current = nextSnapshot;
        pendingSnapshotRef.current = null;
        setSaveIndicator("idle");
        setNotFound(false);
      } catch (error) {
        console.error("Error loading equipment QR page:", error);
        setNotFound(true);
        setRecord(null);
        setChecklistSnapshot(null);
        confirmedSnapshotRef.current = null;
        pendingSnapshotRef.current = null;
      } finally {
        setLoading(false);
      }
    };

    void fetchRecord();
  }, [equipmentType, token]);

  const handleStatusChange = (
    itemId: string,
    status: EquipmentChecklistStatus,
  ) => {
    let nextSnapshot: EquipmentChecklistSnapshot | null = null;

    setChecklistSnapshot((previous) => {
      if (!previous) {
        return previous;
      }

      nextSnapshot = updateEquipmentChecklistSnapshotItemStatus(
        previous,
        itemId,
        status,
      );
      return nextSnapshot;
    });

    if (!nextSnapshot) {
      return;
    }

    pendingSnapshotRef.current = nextSnapshot;
    setSaveIndicator("saving");
    void flushPendingSave();
  };

  const equipmentData = isObjectRecord(record?.equipment_data)
    ? record.equipment_data
    : {};
  const saveIndicatorClassName =
    saveIndicator === "error"
      ? "text-red-700"
      : saveIndicator === "saved"
        ? "text-emerald-700"
        : "text-muted-foreground";
  const saveIndicatorLabel =
    saveIndicator === "saving"
      ? "Salvando..."
      : saveIndicator === "saved"
        ? "Salvo agora"
        : saveIndicator === "error"
          ? "Erro ao salvar"
          : "Autosave ativo";

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
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

  const Icon = equipmentType === "extintor" ? Flame : Droplets;
  const detailRows = renderEquipmentDetails(equipmentType, equipmentData);

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
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
                  Cada clique em `C`, `NC` ou `NA` salva automaticamente este
                  checklist. O checklist principal da empresa assume o pior
                  status por item em tempo real.
                </div>

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

                {checklistSnapshot.items.length === 0 ? (
                  <div className="rounded-xl border border-dashed bg-background p-6 text-center text-sm text-muted-foreground">
                    O checklist principal deste equipamento ainda nao foi sincronizado.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border bg-background">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead colSpan={5} className="text-center">
                            {checklistSnapshot.inspection_name.toUpperCase()}
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {checklistSnapshot.items.map((item, index) => {
                          const showSectionHeader =
                            index === 0 ||
                            checklistSnapshot.items[index - 1]?.secao !== item.secao;

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

                              <TableRow>
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
                                        onClick={() =>
                                          handleStatusChange(
                                            item.checklist_item_id,
                                            statusValue,
                                          )
                                        }
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
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EquipmentChecklistPage;
