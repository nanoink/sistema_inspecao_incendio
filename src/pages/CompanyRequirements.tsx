import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft, ClipboardList, Check, X, Loader2 } from "lucide-react";

interface Company {
  id: string;
  razao_social: string;
  divisao: string | null;
  area_m2: number;
  altura_tipo: string | null;
  altura_denominacao: string | null;
  altura_descricao: string | null;
}

interface Exigencia {
  id: string;
  codigo: string;
  nome: string;
  categoria: string;
  ordem: number;
  observacao?: string;
}

interface CompanyRequirement {
  exigenciaId: string;
  atende: boolean;
  observacoes: string | null;
}

const CompanyRequirements = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [company, setCompany] = useState<Company | null>(null);
  const [exigencias, setExigencias] = useState<Exigencia[]>([]);
  const [requirements, setRequirements] = useState<CompanyRequirement[]>([]);
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
        .select("id, razao_social, divisao, area_m2, altura_tipo, altura_denominacao, altura_descricao")
        .eq("id", id)
        .maybeSingle();

      if (companyError) throw companyError;
      
      if (!companyData) {
        toast.error("Empresa não encontrada");
        setLoading(false);
        return;
      }

      // Fetch altura_ref if altura_descricao is empty
      if (!companyData.altura_descricao && companyData.altura_tipo) {
        const { data: alturaRef } = await supabase
          .from("altura_ref")
          .select("h_min_m, h_max_m")
          .eq("tipo", companyData.altura_tipo)
          .single();

        if (alturaRef) {
          let descricao = "";
          if (alturaRef.h_min_m === null && alturaRef.h_max_m === null) {
            descricao = "Um pavimento";
          } else if (alturaRef.h_min_m === null && alturaRef.h_max_m !== null) {
            descricao = `H < ${alturaRef.h_max_m} m`;
          } else if (alturaRef.h_min_m !== null && alturaRef.h_max_m === null) {
            descricao = `Acima de ${alturaRef.h_min_m} m`;
          } else if (alturaRef.h_min_m !== null && alturaRef.h_max_m !== null) {
            descricao = `${alturaRef.h_min_m} < H < ${alturaRef.h_max_m} m`;
          }
          companyData.altura_descricao = descricao;
        }
      }

      setCompany(companyData);

      // Fetch requirements from empresa_exigencias with details from exigencias_seguranca
      const { data: companyRequirements, error: reqError } = await supabase
        .from("empresa_exigencias")
        .select(`
          exigencia_id,
          atende,
          observacoes,
          exigencias_seguranca!inner (
            id,
            codigo,
            nome,
            categoria,
            ordem
          )
        `)
        .eq("empresa_id", id);

      if (reqError) throw reqError;

      // Extract exigencias and requirements
      const exigenciasData: Exigencia[] = [];
      const requirementsData: CompanyRequirement[] = [];

      companyRequirements?.forEach((item: any) => {
        const exig = item.exigencias_seguranca;
        exigenciasData.push({
          id: exig.id,
          codigo: exig.codigo,
          nome: exig.nome,
          categoria: exig.categoria,
          ordem: exig.ordem,
        });
        requirementsData.push({
          exigenciaId: exig.id,
          atende: item.atende,
          observacoes: item.observacoes,
        });
      });

      setExigencias(exigenciasData.sort((a, b) => a.ordem - b.ordem));
      setRequirements(requirementsData);

    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Não foi possível carregar os dados da empresa.");
    } finally {
      setLoading(false);
    }
  };

  const handleCheckChange = (exigenciaId: string, checked: boolean) => {
    setRequirements(prev => {
      const existing = prev.find(r => r.exigenciaId === exigenciaId);
      if (existing) {
        return prev.map(r => 
          r.exigenciaId === exigenciaId 
            ? { ...r, atende: checked }
            : r
        );
      } else {
        return [...prev, { exigenciaId, atende: checked, observacoes: null }];
      }
    });
  };

  const handleObservationChange = (exigenciaId: string, value: string) => {
    setRequirements(prev => {
      const existing = prev.find(r => r.exigenciaId === exigenciaId);
      if (existing) {
        return prev.map(r => 
          r.exigenciaId === exigenciaId 
            ? { ...r, observacoes: value || null }
            : r
        );
      } else {
        return [...prev, { exigenciaId, atende: false, observacoes: value || null }];
      }
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
      const requirementsToInsert = requirements.map(req => ({
        empresa_id: id,
        exigencia_id: req.exigenciaId,
        atende: req.atende,
        observacoes: req.observacoes,
      }));

      if (requirementsToInsert.length > 0) {
        const { error } = await supabase
          .from("empresa_exigencias")
          .insert(requirementsToInsert);

        if (error) throw error;
      }

      toast.success("Exigências salvas com sucesso!");
      navigate("/");
    } catch (error) {
      console.error("Error saving requirements:", error);
      toast.error("Não foi possível salvar as exigências.");
    } finally {
      setSaving(false);
    }
  };

  // Group requirements by category
  const groupedRequirements = exigencias.reduce((acc, exigencia) => {
    if (!acc[exigencia.categoria]) {
      acc[exigencia.categoria] = [];
    }
    acc[exigencia.categoria].push(exigencia);
    return acc;
  }, {} as Record<string, Exigencia[]>);

  const getCategoryColor = (categoria: string) => {
    switch (categoria) {
      case "Restrição ao Surgimento e à Propagação de Incêndio":
        return "bg-yellow-100 border-yellow-400";
      case "Controle de Crescimento e Supressão de Incêndio":
        return "bg-red-100 border-red-400";
      case "Meios de Aviso":
        return "bg-blue-100 border-blue-400";
      case "Facilidades no Abandono":
        return "bg-green-100 border-green-400";
      case "Acesso e Facilidades para Operações de Socorro":
        return "bg-orange-100 border-orange-400";
      case "Proteção Estrutural em Situações de Incêndio":
        return "bg-gray-100 border-gray-400";
      case "Gerenciamento de Risco de Incêndio":
        return "bg-amber-100 border-amber-400";
      case "Controle de Fumaça e Gases":
        return "bg-cyan-100 border-cyan-400";
      default:
        return "bg-slate-100 border-slate-400";
    }
  };

  const getCategoryTextColor = (categoria: string) => {
    switch (categoria) {
      case "Restrição ao Surgimento e à Propagação de Incêndio":
        return "text-yellow-900";
      case "Controle de Crescimento e Supressão de Incêndio":
        return "text-red-900";
      case "Meios de Aviso":
        return "text-blue-900";
      case "Facilidades no Abandono":
        return "text-green-900";
      case "Acesso e Facilidades para Operações de Socorro":
        return "text-orange-900";
      case "Proteção Estrutural em Situações de Incêndio":
        return "text-gray-900";
      case "Gerenciamento de Risco de Incêndio":
        return "text-amber-900";
      case "Controle de Fumaça e Gases":
        return "text-cyan-900";
      default:
        return "text-slate-900";
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4 flex justify-center items-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!company) {
    return (
      <div className="container mx-auto py-8 px-4">
        <p className="text-center">Empresa não encontrada.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-6 flex items-center gap-4">
        <Button
          variant="outline"
          onClick={() => navigate("/")}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
        <h1 className="text-3xl font-bold">Exigências de Segurança</h1>
      </div>

      {company && (
        <div className="mb-6 p-4 bg-card rounded-lg border">
          <h2 className="text-xl font-semibold mb-2">{company.razao_social}</h2>
          <div className="text-sm text-muted-foreground">
            <p>Divisão: {company.divisao}</p>
            <p>Área: {company.area_m2}m²</p>
            <p>Altura: {company.altura_descricao || company.altura_tipo}</p>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {Object.entries(groupedRequirements).map(([categoria, exigs]) => (
          <div key={categoria} className={`border-l-4 p-4 rounded-lg ${getCategoryColor(categoria)}`}>
            <h3 className={`text-lg font-semibold mb-4 ${getCategoryTextColor(categoria)}`}>
              {categoria}
            </h3>
            <div className="space-y-4">
              {exigs.map((exigencia) => {
                const requirement = requirements.find(r => r.exigenciaId === exigencia.id);
                const atende = requirement?.atende || false;
                const observacoes = requirement?.observacoes || "";

                return (
                  <div key={exigencia.id} className="bg-white p-4 rounded-md shadow-sm border">
                    <div className="flex items-start gap-4 mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-sm font-semibold text-muted-foreground">
                            {exigencia.codigo}
                          </span>
                          <span className="text-sm font-medium">
                            {exigencia.nome}
                          </span>
                        </div>
                        {exigencia.observacao && (
                          <p className="text-xs text-muted-foreground italic">
                            {exigencia.observacao}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleCheckChange(exigencia.id, true)}
                          className={`p-2 rounded-md transition-colors ${
                            atende 
                              ? "bg-green-500 text-white" 
                              : "bg-gray-200 text-gray-400 hover:bg-green-100"
                          }`}
                          title="Atende"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleCheckChange(exigencia.id, false)}
                          className={`p-2 rounded-md transition-colors ${
                            !atende 
                              ? "bg-red-500 text-white" 
                              : "bg-gray-200 text-gray-400 hover:bg-red-100"
                          }`}
                          title="Não atende"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <Textarea
                      placeholder="Observações..."
                      value={observacoes}
                      onChange={(e) => handleObservationChange(exigencia.id, e.target.value)}
                      className="mt-2"
                      rows={2}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {exigencias.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            Nenhuma exigência encontrada para esta empresa.
          </p>
        </div>
      )}

      <div className="mt-8 flex justify-end gap-4">
        <Button
          variant="outline"
          onClick={() => navigate(`/checklists/${id}`)}
          className="flex items-center gap-2"
        >
          <ClipboardList className="h-4 w-4" />
          Ver Checklists
        </Button>
        <Button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Salvando...
            </>
          ) : (
            "Salvar"
          )}
        </Button>
      </div>
    </div>
  );
};

export default CompanyRequirements;
