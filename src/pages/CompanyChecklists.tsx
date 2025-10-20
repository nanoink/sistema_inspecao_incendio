import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Save, ClipboardCheck, FileText, Shield, Building, Zap, Flame, Bell, CloudRain, Package } from "lucide-react";
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

interface ChecklistResponse {
  checklist_item_id: string;
  status: string;
  observacoes: string | null;
}

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
        responsesMap.set(resp.checklist_item_id, resp);
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

  const handleStatusChange = (itemId: string, status: string) => {
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
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16 md:w-24 whitespace-nowrap">Item</TableHead>
                      <TableHead className="whitespace-nowrap">Descrição</TableHead>
                      <TableHead className="w-20 md:w-24 text-center whitespace-nowrap">C</TableHead>
                      <TableHead className="w-20 md:w-24 text-center whitespace-nowrap">NC</TableHead>
                      <TableHead className="w-20 md:w-24 text-center whitespace-nowrap">NA</TableHead>
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
                            <input
                              type="radio"
                              name={`status-${item.id}`}
                              checked={resp?.status === 'C'}
                              onChange={() => handleStatusChange(item.id, 'C')}
                              className="cursor-pointer"
                            />
                          </TableCell>
                          <TableCell className="text-center">
                            <input
                              type="radio"
                              name={`status-${item.id}`}
                              checked={resp?.status === 'NC'}
                              onChange={() => handleStatusChange(item.id, 'NC')}
                              className="cursor-pointer"
                            />
                          </TableCell>
                          <TableCell className="text-center">
                            <input
                              type="radio"
                              name={`status-${item.id}`}
                              checked={resp?.status === 'NA'}
                              onChange={() => handleStatusChange(item.id, 'NA')}
                              className="cursor-pointer"
                            />
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
