import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Save, ClipboardCheck, FileText, Shield, Building, Zap, Flame, Bell, CloudRain, Package, Check, X, Minus, type LucideIcon } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface Company {
  id: string;
  razao_social: string;
}

interface Inspecao {
  id: string;
  codigo: string;
  nome: string;
  tipo: string;
  ordem: number;
}

interface ChecklistItem {
  id: string;
  inspecao_id: string;
  item_numero: string;
  descricao: string;
  ordem: number;
}

type ChecklistStatus = "C" | "NC" | "NA";

interface ChecklistResponse {
  checklist_item_id: string;
  status: ChecklistStatus;
  observacoes: string | null;
}

const STATUS_ORDER: ChecklistStatus[] = ["C", "NC", "NA"];

const isChecklistStatus = (value: string): value is ChecklistStatus =>
  value === "C" || value === "NC" || value === "NA";

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

const getInspectionIcon = (codigo: string) => {
  if (codigo.includes('Informações')) return FileText;
  if (codigo.includes('Acesso')) return Building;
  if (codigo.includes('Compartimentação')) return Package;
  if (codigo.includes('Escada') || codigo.includes('Saída')) return Building;
  if (codigo.includes('Iluminação')) return Zap;
  if (codigo.includes('Sinalização')) return ClipboardCheck;
  if (codigo.includes('Extintor')) return Flame;
  if (codigo.includes('Hidrante') || codigo.includes('Mangotinh')) return Flame;
  if (codigo.includes('Chuveiro')) return CloudRain;
  if (codigo.includes('Alarme') || codigo.includes('Detecção')) return Bell;
  if (codigo.includes('GLP') || codigo.includes('GN')) return Flame;
  if (codigo.includes('SPDA') || codigo.includes('Atmosférica')) return CloudRain;
  if (codigo.includes('Acabamento')) return Package;
  return Shield;
};

const CompanyChecklists = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [company, setCompany] = useState<Company | null>(null);
  const [inspecoes, setInspecoes] = useState<Inspecao[]>([]);
  const [checklistItems, setChecklistItems] = useState<Map<string, ChecklistItem[]>>(new Map());
  const [responses, setResponses] = useState<Map<string, ChecklistResponse>>(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [openInspection, setOpenInspection] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      fetchData();
    }
  }, [id]);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch company data
      const { data: companyData, error: companyError } = await supabase
        .from("empresa")
        .select("id, razao_social")
        .eq("id", id)
        .single();

      if (companyError) throw companyError;
      setCompany(companyData);

      // Fetch all inspections
      const { data: inspecoesData, error: inspecoesError } = await supabase
        .from("inspecoes")
        .select("*")
        .order("ordem");

      if (inspecoesError) throw inspecoesError;
      setInspecoes(inspecoesData || []);

      // Fetch all checklist items
      const { data: itemsData, error: itemsError } = await supabase
        .from("checklist_itens")
        .select("*")
        .order("ordem");

      if (itemsError) throw itemsError;

      // Group items by inspection
      const itemsMap = new Map<string, ChecklistItem[]>();
      itemsData?.forEach((item) => {
        const existing = itemsMap.get(item.inspecao_id) || [];
        itemsMap.set(item.inspecao_id, [...existing, item]);
      });
      setChecklistItems(itemsMap);

      // Fetch existing responses
      const { data: responsesData, error: responsesError } = await supabase
        .from("empresa_checklist")
        .select("checklist_item_id, status, observacoes")
        .eq("empresa_id", id);

      if (responsesError) throw responsesError;

      const responsesMap = new Map<string, ChecklistResponse>();
      responsesData?.forEach((resp) => {
        responsesMap.set(resp.checklist_item_id, {
          checklist_item_id: resp.checklist_item_id,
          status: isChecklistStatus(resp.status) ? resp.status : "NA",
          observacoes: resp.observacoes,
        });
      });
      setResponses(responsesMap);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({
        title: "Erro ao carregar dados",
        description: "Não foi possível carregar os dados dos check lists.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = (itemId: string, status: ChecklistStatus) => {
    setResponses((prev) => {
      const newMap = new Map(prev);
      const existing = newMap.get(itemId);
      newMap.set(itemId, {
        checklist_item_id: itemId,
        status,
        observacoes: existing?.observacoes || null,
      });
      return newMap;
    });
  };

  const handleObservationChange = (itemId: string, observacoes: string) => {
    setResponses((prev) => {
      const newMap = new Map(prev);
      const existing = newMap.get(itemId);
      newMap.set(itemId, {
        checklist_item_id: itemId,
        status: existing?.status || 'NA',
        observacoes: observacoes || null,
      });
      return newMap;
    });
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      // Delete existing responses
      await supabase
        .from("empresa_checklist")
        .delete()
        .eq("empresa_id", id);

      // Insert new responses
      const responsesToInsert = Array.from(responses.entries()).map(
        ([itemId, resp]) => ({
          empresa_id: id,
          checklist_item_id: itemId,
          status: resp.status,
          observacoes: resp.observacoes,
        })
      );

      if (responsesToInsert.length > 0) {
        const { error } = await supabase
          .from("empresa_checklist")
          .insert(responsesToInsert);

        if (error) throw error;
      }

      toast({
        title: "Check lists salvos",
        description: "Os check lists foram salvos com sucesso.",
      });

      navigate("/");
    } catch (error) {
      console.error("Error saving checklists:", error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar os check lists.",
        variant: "destructive",
      });
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
              Empresa não encontrada.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

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
            Voltar às Exigências
          </Button>

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-start md:items-center">
              <ClipboardCheck className="h-8 w-8 md:h-12 md:w-12 text-primary mr-2 md:mr-3 flex-shrink-0 mt-1 md:mt-0" />
              <div>
                <h1 className="text-2xl md:text-4xl font-bold text-foreground">
                  Check Lists de Renovação
                </h1>
                <p className="text-sm md:text-lg text-muted-foreground mt-1">
                  {company.razao_social}
                </p>
              </div>
            </div>
            <Button onClick={handleSave} disabled={saving} size="lg" className="w-full md:w-auto">
              {saving ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <Save className="mr-2 h-5 w-5" />
              )}
              Salvar Check Lists
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-8">
          {inspecoes.map((inspecao) => {
            const Icon = getInspectionIcon(inspecao.nome);
            const isOpen = openInspection === inspecao.id;
            
            return (
              <Card
                key={inspecao.id}
                className={`cursor-pointer transition-all hover:shadow-lg ${
                  isOpen ? 'ring-2 ring-primary' : ''
                }`}
                onClick={() => setOpenInspection(isOpen ? null : inspecao.id)}
              >
                <CardContent className="p-3 flex flex-col items-center text-center">
                  <Icon className={`h-6 w-6 mb-2 ${isOpen ? 'text-primary' : 'text-muted-foreground'}`} />
                  <p className="text-[10px] md:text-xs text-muted-foreground line-clamp-2">
                    {inspecao.nome}
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
                {inspecoes.find(i => i.id === openInspection)?.nome}
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
                      <TableHead className="w-16 md:w-24 whitespace-nowrap">Item</TableHead>
                      <TableHead className="whitespace-nowrap">Descrição</TableHead>
                      <TableHead className="w-[220px] text-center whitespace-nowrap">Status</TableHead>
                      <TableHead className="w-32 md:w-[300px] whitespace-nowrap">Observações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {checklistItems.get(openInspection)?.map((item) => {
                      const resp = responses.get(item.id);
                      return (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium whitespace-nowrap text-xs md:text-sm">
                            {item.item_numero}
                          </TableCell>
                          <TableCell className="text-xs md:text-sm">{item.descricao}</TableCell>
                          <TableCell className="text-center">
                            <div
                              role="radiogroup"
                              aria-label={`Status do item ${item.item_numero}`}
                              className="inline-flex items-center gap-1 rounded-xl border bg-muted/30 p-1"
                            >
                              {STATUS_ORDER.map((statusValue) => {
                                const meta = STATUS_META[statusValue];
                                const Icon = meta.icon;
                                const isActive = resp?.status === statusValue;

                                return (
                                  <button
                                    key={meta.value}
                                    type="button"
                                    role="radio"
                                    aria-checked={isActive}
                                    aria-label={`${meta.ariaLabel} para item ${item.item_numero}`}
                                    onClick={() => handleStatusChange(item.id, statusValue)}
                                    className={cn(
                                      "inline-flex min-h-9 min-w-9 items-center justify-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                                      isActive ? meta.activeClass : meta.inactiveClass,
                                    )}
                                  >
                                    <Icon className="h-3.5 w-3.5" />
                                    <span className="sr-only sm:not-sr-only sm:ml-1">
                                      {meta.shortLabel}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Textarea
                              placeholder="Observações..."
                              value={resp?.observacoes || ""}
                              onChange={(e) =>
                                handleObservationChange(item.id, e.target.value)
                              }
                              rows={2}
                              className="text-xs md:text-sm min-w-[200px]"
                            />
                          </TableCell>
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
