import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Loader2, Shield, Save, ClipboardCheck } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Company {
  id: string;
  razao_social: string;
  altura_tipo: string | null;
  altura_denominacao: string | null;
  grupo: string | null;
}

interface Exigencia {
  id: string;
  codigo: string;
  nome: string;
  categoria: string;
  ordem: number;
}

interface CompanyRequirement {
  exigencia_id: string;
  atende: boolean;
  observacoes: string | null;
}

const CompanyRequirements = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [company, setCompany] = useState<Company | null>(null);
  const [exigencias, setExigencias] = useState<Exigencia[]>([]);
  const [requirements, setRequirements] = useState<Map<string, CompanyRequirement>>(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
        .select("id, razao_social, altura_tipo, altura_denominacao, grupo")
        .eq("id", id)
        .single();

      if (companyError) throw companyError;
      setCompany(companyData);

      // Fetch requirements by group from external API
      let filteredExigencias: Exigencia[] = [];
      if (companyData.grupo) {
        try {
          const response = await fetch(
            `https://script.google.com/macros/s/AKfycbwVCNyGnn84VSz0gKaV6PIyCdrcLJzYfkVCLe-EN94WkgQyPhU_a3SXyc16YF8QyC61/exec?divisao=${encodeURIComponent(companyData.grupo)}`
          );
          const apiData = await response.json();
          
          // Get all requirements from database
          const { data: allExigencias, error: exigenciasError } = await supabase
            .from("exigencias_seguranca")
            .select("*")
            .order("ordem");

          if (exigenciasError) throw exigenciasError;

          // Filter requirements based on API response
          const apiCodigos = new Set(apiData.map((item: any) => item.CÓDIGO));
          filteredExigencias = (allExigencias || []).filter(exig => 
            apiCodigos.has(exig.codigo)
          );
        } catch (error) {
          console.error("Error fetching requirements from API:", error);
          toast({
            title: "Aviso",
            description: "Não foi possível carregar exigências da API. Mostrando todas.",
            variant: "default",
          });
          // Fallback to all requirements
          const { data: allExigencias } = await supabase
            .from("exigencias_seguranca")
            .select("*")
            .order("ordem");
          filteredExigencias = allExigencias || [];
        }
      } else {
        // No group, show all requirements
        const { data: allExigencias } = await supabase
          .from("exigencias_seguranca")
          .select("*")
          .order("ordem");
        filteredExigencias = allExigencias || [];
      }
      
      setExigencias(filteredExigencias);

      // Fetch existing company requirements
      const { data: companyReqData, error: companyReqError } = await supabase
        .from("empresa_exigencias")
        .select("exigencia_id, atende, observacoes")
        .eq("empresa_id", id);

      if (companyReqError) throw companyReqError;

      const reqMap = new Map<string, CompanyRequirement>();
      companyReqData?.forEach((req) => {
        reqMap.set(req.exigencia_id, {
          exigencia_id: req.exigencia_id,
          atende: req.atende,
          observacoes: req.observacoes,
        });
      });
      setRequirements(reqMap);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({
        title: "Erro ao carregar dados",
        description: "Não foi possível carregar os dados da empresa.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCheckChange = (exigenciaId: string, checked: boolean) => {
    setRequirements((prev) => {
      const newMap = new Map(prev);
      const existing = newMap.get(exigenciaId);
      newMap.set(exigenciaId, {
        exigencia_id: exigenciaId,
        atende: checked,
        observacoes: existing?.observacoes || null,
      });
      return newMap;
    });
  };

  const handleObservationChange = (exigenciaId: string, value: string) => {
    setRequirements((prev) => {
      const newMap = new Map(prev);
      const existing = newMap.get(exigenciaId);
      newMap.set(exigenciaId, {
        exigencia_id: exigenciaId,
        atende: existing?.atende || false,
        observacoes: value || null,
      });
      return newMap;
    });
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      // Delete all existing requirements for this company
      await supabase
        .from("empresa_exigencias")
        .delete()
        .eq("empresa_id", id);

      // Insert new requirements
      const requirementsToInsert = Array.from(requirements.entries()).map(
        ([exigenciaId, req]) => ({
          empresa_id: id,
          exigencia_id: exigenciaId,
          atende: req.atende,
          observacoes: req.observacoes,
        })
      );

      if (requirementsToInsert.length > 0) {
        const { error } = await supabase
          .from("empresa_exigencias")
          .insert(requirementsToInsert);

        if (error) throw error;
      }

      toast({
        title: "Exigências salvas",
        description: "As exigências foram salvas com sucesso.",
      });

      navigate("/");
    } catch (error) {
      console.error("Error saving requirements:", error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar as exigências.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // Group requirements by category
  const groupedExigencias = exigencias.reduce((acc, exigencia) => {
    if (!acc[exigencia.categoria]) {
      acc[exigencia.categoria] = [];
    }
    acc[exigencia.categoria].push(exigencia);
    return acc;
  }, {} as Record<string, Exigencia[]>);

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
            onClick={() => navigate("/")}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar ao Dashboard
          </Button>
          
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-start md:items-center">
              <Shield className="h-8 w-8 md:h-12 md:w-12 text-primary mr-2 md:mr-3 flex-shrink-0 mt-1 md:mt-0" />
              <div>
                <h1 className="text-2xl md:text-4xl font-bold text-foreground">
                  Exigências de Segurança
                </h1>
                <p className="text-sm md:text-lg text-muted-foreground mt-1">
                  {company.razao_social}
                </p>
                {company.altura_denominacao && (
                  <p className="text-xs md:text-sm text-muted-foreground">
                    Classificação: {company.altura_denominacao} (Tipo {company.altura_tipo})
                  </p>
                )}
              </div>
            </div>
            <Button onClick={handleSave} disabled={saving} size="lg" className="w-full md:w-auto">
              {saving ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <Save className="mr-2 h-5 w-5" />
              )}
              Salvar Exigências
            </Button>
          </div>
        </div>

        <div className="space-y-4 md:space-y-6">
          {Object.entries(groupedExigencias).map(([categoria, items]) => (
            <Card key={categoria}>
              <CardHeader>
                <CardTitle className="text-base md:text-lg">{categoria}</CardTitle>
              </CardHeader>
              <CardContent className="p-0 md:p-6">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16 md:w-24 whitespace-nowrap">Código</TableHead>
                        <TableHead className="whitespace-nowrap">Medida de Segurança</TableHead>
                        <TableHead className="w-20 md:w-32 text-center whitespace-nowrap">Atende</TableHead>
                        <TableHead className="w-32 md:w-[300px] whitespace-nowrap">Observações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((exigencia) => {
                        const req = requirements.get(exigencia.id);
                        return (
                          <TableRow key={exigencia.id}>
                            <TableCell className="font-medium whitespace-nowrap text-xs md:text-sm">
                              {exigencia.codigo}
                            </TableCell>
                            <TableCell className="text-xs md:text-sm">{exigencia.nome}</TableCell>
                            <TableCell className="text-center">
                              <div className="flex justify-center">
                                <Checkbox
                                  checked={req?.atende || false}
                                  onCheckedChange={(checked) =>
                                    handleCheckChange(exigencia.id, checked as boolean)
                                  }
                                />
                              </div>
                            </TableCell>
                            <TableCell>
                              <Textarea
                                placeholder="Observações..."
                                value={req?.observacoes || ""}
                                onChange={(e) =>
                                  handleObservationChange(exigencia.id, e.target.value)
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
          ))}
        </div>

        <div className="mt-8 flex justify-center">
          <Button
            onClick={() => navigate(`/checklists/${id}`)}
            size="lg"
            className="w-full md:w-auto"
          >
            <ClipboardCheck className="mr-2 h-5 w-5" />
            Ir para Check Lists de Renovação
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CompanyRequirements;
