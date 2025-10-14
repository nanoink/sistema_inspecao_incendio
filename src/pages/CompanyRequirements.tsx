import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Loader2, Shield, Save } from "lucide-react";
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
        .select("id, razao_social, altura_tipo, altura_denominacao")
        .eq("id", id)
        .single();

      if (companyError) throw companyError;
      setCompany(companyData);

      // Fetch all requirements
      const { data: exigenciasData, error: exigenciasError } = await supabase
        .from("exigencias_seguranca")
        .select("*")
        .order("ordem");

      if (exigenciasError) throw exigenciasError;
      setExigencias(exigenciasData || []);

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
      <div className="container mx-auto py-8 px-4">
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate("/")}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar ao Dashboard
          </Button>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Shield className="h-12 w-12 text-primary mr-3" />
              <div>
                <h1 className="text-4xl font-bold text-foreground">
                  Exigências de Segurança
                </h1>
                <p className="text-lg text-muted-foreground mt-1">
                  {company.razao_social}
                </p>
                {company.altura_denominacao && (
                  <p className="text-sm text-muted-foreground">
                    Classificação: {company.altura_denominacao} (Tipo {company.altura_tipo})
                  </p>
                )}
              </div>
            </div>
            <Button onClick={handleSave} disabled={saving} size="lg">
              {saving ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <Save className="mr-2 h-5 w-5" />
              )}
              Salvar Exigências
            </Button>
          </div>
        </div>

        <div className="space-y-6">
          {Object.entries(groupedExigencias).map(([categoria, items]) => (
            <Card key={categoria}>
              <CardHeader>
                <CardTitle>{categoria}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-24">Código</TableHead>
                        <TableHead>Medida de Segurança</TableHead>
                        <TableHead className="w-32 text-center">Atende</TableHead>
                        <TableHead className="w-[300px]">Observações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((exigencia) => {
                        const req = requirements.get(exigencia.id);
                        return (
                          <TableRow key={exigencia.id}>
                            <TableCell className="font-medium">
                              {exigencia.codigo}
                            </TableCell>
                            <TableCell>{exigencia.nome}</TableCell>
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
      </div>
    </div>
  );
};

export default CompanyRequirements;
