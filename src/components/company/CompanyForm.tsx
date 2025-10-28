import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Check, ChevronsUpDown } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const formSchema = z.object({
  razao_social: z.string().min(1, "Razão social é obrigatória"),
  nome_fantasia: z.string().optional(),
  cnpj: z.string().min(14, "CNPJ inválido"),
  responsavel: z.string().min(1, "Responsável é obrigatório"),
  email: z.string().email("E-mail inválido"),
  telefone: z.string().min(10, "Telefone inválido"),
  cep: z.string().min(8, "CEP inválido"),
  rua: z.string().min(1, "Rua é obrigatória"),
  numero: z.string().min(1, "Número é obrigatório"),
  bairro: z.string().min(1, "Bairro é obrigatório"),
  cidade: z.string().min(1, "Cidade é obrigatória"),
  estado: z.string().min(2, "Estado é obrigatório"),
  cnae: z.string().optional(),
  altura_tipo: z.string().min(1, "Altura da edificação é obrigatória"),
  area_m2: z.coerce.number().min(0, "Área deve ser maior que 0"),
  numero_ocupantes: z.coerce.number().int().min(0, "Número de ocupantes inválido"),
});

type FormData = z.infer<typeof formSchema>;

interface CNAEData {
  cnae: string;
  grupo: string;
  ocupacao_uso: string;
  divisao: string;
  descricao: string;
  carga_incendio_mj_m2: number;
}

interface AlturaRef {
  tipo: string;
  denominacao: string;
  h_min_m: number | null;
  h_max_m: number | null;
}

export function CompanyForm() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [loadingCEP, setLoadingCEP] = useState(false);
  const [cnaeData, setCnaeData] = useState<CNAEData | null>(null);
  const [grauRisco, setGrauRisco] = useState<string>("");
  const [alturaOptions, setAlturaOptions] = useState<AlturaRef[]>([]);
  const [alturaDenominacao, setAlturaDenominacao] = useState<string>("");
  const [alturaDescricao, setAlturaDescricao] = useState<string>("");
  const [cnaeOptions, setCnaeOptions] = useState<CNAEData[]>([]);
  const [cnaeOpen, setCnaeOpen] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      razao_social: "",
      nome_fantasia: "",
      cnpj: "",
      responsavel: "",
      email: "",
      telefone: "",
      cep: "",
      rua: "",
      numero: "",
      bairro: "",
      cidade: "",
      estado: "",
      cnae: "",
      altura_tipo: "",
      area_m2: 0,
      numero_ocupantes: 0,
    },
  });

  // Load altura options and CNAE catalog
  useEffect(() => {
    loadAlturaOptions();
    loadCnaeOptions();
  }, []);

  const loadAlturaOptions = async () => {
    const { data, error } = await supabase
      .from("altura_ref")
      .select("*")
      .order("tipo");
    
    if (error) {
      console.error("Error loading altura options:", error);
      return;
    }
    
    setAlturaOptions(data || []);
  };

  const loadCnaeOptions = async () => {
    try {
      const response = await fetch('https://script.google.com/macros/s/AKfycbwFuTToILsB-y5kbSkSI7u04jIoOlCOogPzUp6VSJbElZ-8u3pra5TtFRKR4J5aGvbX/exec');
      const data = await response.json();
      
      // Map API response to expected format
      const mappedData = data.map((item: any) => ({
        cnae: item.CNAE || item.cnae,
        grupo: item.GRUPO || item.grupo || '',
        ocupacao_uso: item['OCUPAÇÃO/USO'] || item.ocupacao_uso || '',
        divisao: item['DIVISÃO'] || item.divisao || '',
        descricao: item['DESCRIÇÃO'] || item.descricao || '',
        carga_incendio_mj_m2: Number(item['CARGA DE INCÊNDIO (MJ/m2)'] || item.carga_incendio_mj_m2 || 0),
      }));
      
      // Remove duplicates based on CNAE code
      const uniqueCnaes = mappedData.filter((item: CNAEData, index: number, self: CNAEData[]) => 
        index === self.findIndex((t) => t.cnae === item.cnae)
      );
      
      setCnaeOptions(uniqueCnaes);
    } catch (error) {
      console.error("Error loading CNAE options from API:", error);
      toast({
        title: "Erro ao carregar CNAEs",
        description: "Não foi possível carregar a lista de CNAEs.",
        variant: "destructive",
      });
    }
  };

  // Fetch CEP data from ViaCEP
  const handleCEPBlur = async () => {
    const cep = form.getValues("cep").replace(/\D/g, "");
    if (cep.length !== 8) return;

    setLoadingCEP(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await response.json();

      if (data.erro) {
        toast({
          title: "CEP não encontrado",
          description: "Verifique o CEP informado.",
          variant: "destructive",
        });
        return;
      }

      form.setValue("rua", data.logradouro || "", { shouldValidate: true });
      form.setValue("bairro", data.bairro || "", { shouldValidate: true });
      form.setValue("cidade", data.localidade || "", { shouldValidate: true });
      form.setValue("estado", data.uf || "", { shouldValidate: true });
      
      // Clear errors for filled fields
      if (data.logradouro) form.clearErrors("rua");
      if (data.bairro) form.clearErrors("bairro");
      if (data.localidade) form.clearErrors("cidade");
      if (data.uf) form.clearErrors("estado");
    } catch (error) {
      toast({
        title: "Erro ao buscar CEP",
        description: "Não foi possível buscar os dados do CEP.",
        variant: "destructive",
      });
    } finally {
      setLoadingCEP(false);
    }
  };

  // Handle CNAE selection
  const handleCNAESelect = (selectedCnae: string) => {
    form.setValue("cnae", selectedCnae);
    const selected = cnaeOptions.find(c => c.cnae === selectedCnae);
    
    if (selected) {
      // Extract first letter from divisão for grupo
      const grupoLetra = selected.divisao?.charAt(0).toUpperCase() || '';
      
      setCnaeData({
        cnae: selected.cnae,
        grupo: grupoLetra,
        ocupacao_uso: selected.ocupacao_uso,
        divisao: selected.divisao,
        descricao: selected.descricao,
        carga_incendio_mj_m2: selected.carga_incendio_mj_m2,
      });

      // Calculate risk grade
      calculateRiskGrade(selected.carga_incendio_mj_m2, form.getValues("numero_ocupantes"));
    }
    
    setCnaeOpen(false);
  };

  // Calculate risk grade based on Table 3 (IT-01)
  const calculateRiskGrade = (carga: number, ocupantes: number) => {
    let risco = "baixo";

    // Simplified logic based on IT-01 Table 3
    // Matrix: occupants x fire load
    if (ocupantes <= 100) {
      if (carga > 1200) risco = "alto";
      else if (carga > 300) risco = "medio";
    } else if (ocupantes <= 500) {
      if (carga > 1200) risco = "alto";
      else if (carga > 300) risco = "medio";
    } else if (ocupantes <= 1000) {
      if (carga > 800) risco = "alto";
      else if (carga > 200) risco = "medio";
    } else if (ocupantes <= 5000) {
      if (carga > 600) risco = "alto";
      else if (carga > 150) risco = "medio";
    } else {
      if (carga > 400) risco = "alto";
      else if (carga > 100) risco = "medio";
    }

    setGrauRisco(risco);
  };

  // Format CNPJ
  const formatCNPJ = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 14) {
      return numbers
        .replace(/^(\d{2})(\d)/, '$1.$2')
        .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
        .replace(/\.(\d{3})(\d)/, '.$1/$2')
        .replace(/(\d{4})(\d)/, '$1-$2');
    }
    return value;
  };

  // Format telefone
  const formatTelefone = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 11) {
      return numbers
        .replace(/^(\d{2})(\d)/, '($1) $2')
        .replace(/(\d{5})(\d)/, '$1-$2');
    }
    return value;
  };

  // Handle CNPJ change
  const handleCNPJChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCNPJ(e.target.value);
    form.setValue("cnpj", formatted);
  };

  // Handle telefone change
  const handleTelefoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatTelefone(e.target.value);
    form.setValue("telefone", formatted);
  };

  // Handle occupants change
  const handleOcupantesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value) || 0;
    form.setValue("numero_ocupantes", value);
    
    if (cnaeData) {
      calculateRiskGrade(cnaeData.carga_incendio_mj_m2, value);
    }
  };

  // Handle altura selection
  const handleAlturaChange = (tipo: string) => {
    form.setValue("altura_tipo", tipo);
    const selected = alturaOptions.find(a => a.tipo === tipo);
    setAlturaDenominacao(selected?.denominacao || "");
    
    // Calculate altura description based on h_min_m and h_max_m
    if (selected) {
      let descricao = "";
      if (selected.h_min_m === null && selected.h_max_m === null) {
        descricao = "Um pavimento";
      } else if (selected.h_min_m === null && selected.h_max_m !== null) {
        descricao = `H < ${selected.h_max_m} m`;
      } else if (selected.h_min_m !== null && selected.h_max_m === null) {
        descricao = `Acima de ${selected.h_min_m} m`;
      } else if (selected.h_min_m !== null && selected.h_max_m !== null) {
        descricao = `${selected.h_min_m} < H < ${selected.h_max_m} m`;
      }
      setAlturaDescricao(descricao);
    }
  };

  // Submit form
  const onSubmit = async (data: FormData) => {
    if (!cnaeData) {
      toast({
        title: "Dados incompletos",
        description: "Por favor, preencha um CNAE válido.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const empresaData = {
        razao_social: data.razao_social,
        nome_fantasia: data.nome_fantasia,
        cnpj: data.cnpj,
        responsavel: data.responsavel,
        email: data.email,
        telefone: data.telefone,
        cep: data.cep,
        rua: data.rua,
        numero: data.numero,
        bairro: data.bairro,
        cidade: data.cidade,
        estado: data.estado,
        cnae: data.cnae,
        grupo: cnaeData.grupo,
        ocupacao_uso: cnaeData.ocupacao_uso,
        divisao: cnaeData.divisao,
        descricao: cnaeData.descricao,
        carga_incendio_mj_m2: cnaeData.carga_incendio_mj_m2,
        altura_tipo: data.altura_tipo,
        altura_denominacao: alturaDenominacao,
        altura_descricao: alturaDescricao,
        area_m2: data.area_m2,
        numero_ocupantes: data.numero_ocupantes,
        grau_risco: grauRisco,
      };

      const { data: insertedData, error } = await supabase
        .from("empresa")
        .insert(empresaData)
        .select()
        .single();

      if (error) throw error;

      // Create company requirements based on division
      if (insertedData?.id && cnaeData.divisao) {
        try {
          const response = await fetch(
            `https://script.google.com/macros/s/AKfycbwVCNyGnn84VSz0gKaV6PIyCdrcLJzYfkVCLe-EN94WkgQyPhU_a3SXyc16YF8QyC61/exec?divisao=${encodeURIComponent(cnaeData.divisao)}`
          );
          const apiData = await response.json();
          
          // Get all requirements from database
          const { data: allExigencias } = await supabase
            .from("exigencias_seguranca")
            .select("*");

          if (allExigencias) {
            // Filter requirements based on API response
            const apiCodigos = new Set(apiData.map((item: any) => item.CÓDIGO));
            const filteredExigencias = allExigencias.filter(exig => 
              apiCodigos.has(exig.codigo)
            );

            // Insert new requirements with default values
            const newRequirements = filteredExigencias.map(exig => ({
              empresa_id: insertedData.id,
              exigencia_id: exig.id,
              atende: false,
              observacoes: null
            }));

            if (newRequirements.length > 0) {
              await supabase
                .from("empresa_exigencias")
                .insert(newRequirements);
            }
          }
        } catch (error) {
          console.error("Error creating requirements:", error);
        }
      }

      toast({
        title: "Empresa cadastrada com sucesso!",
        description: "Redirecionando para exigências...",
      });

      // Navigate to requirements page
      if (insertedData?.id) {
        navigate(`/exigencias/${insertedData.id}`);
      }

      form.reset();
      setCnaeData(null);
      setGrauRisco("");
      setAlturaDenominacao("");
    } catch (error) {
      console.error("Error saving company:", error);
      toast({
        title: "Erro ao salvar empresa",
        description: "Não foi possível salvar os dados.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      {/* Company Section */}
      <Card>
        <CardHeader>
          <CardTitle>Empresa</CardTitle>
          <CardDescription>Informações básicas da empresa</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="razao_social">Razão Social *</Label>
              <Input id="razao_social" {...form.register("razao_social")} />
              {form.formState.errors.razao_social && (
                <p className="text-sm text-destructive">{form.formState.errors.razao_social.message}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="nome_fantasia">Nome Fantasia</Label>
              <Input id="nome_fantasia" {...form.register("nome_fantasia")} />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="cnpj">CNPJ *</Label>
              <Input 
                id="cnpj" 
                value={form.watch("cnpj")}
                onChange={handleCNPJChange}
                placeholder="00.000.000/0000-00" 
                maxLength={18}
              />
              {form.formState.errors.cnpj && (
                <p className="text-sm text-destructive">{form.formState.errors.cnpj.message}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="responsavel">Responsável *</Label>
              <Input id="responsavel" {...form.register("responsavel")} />
              {form.formState.errors.responsavel && (
                <p className="text-sm text-destructive">{form.formState.errors.responsavel.message}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email">E-mail *</Label>
              <Input id="email" type="email" {...form.register("email")} />
              {form.formState.errors.email && (
                <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="telefone">Telefone *</Label>
              <Input 
                id="telefone" 
                value={form.watch("telefone")}
                onChange={handleTelefoneChange}
                placeholder="(00) 00000-0000" 
                maxLength={15}
              />
              {form.formState.errors.telefone && (
                <p className="text-sm text-destructive">{form.formState.errors.telefone.message}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Address Section */}
      <Card>
        <CardHeader>
          <CardTitle>Endereço</CardTitle>
          <CardDescription>Localização da empresa</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cep">CEP *</Label>
              <div className="flex gap-2">
                <Input 
                  id="cep" 
                  {...form.register("cep")} 
                  onBlur={handleCEPBlur}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleCEPBlur();
                    }
                  }}
                  placeholder="00000-000"
                />
                {loadingCEP && <Loader2 className="h-5 w-5 animate-spin" />}
              </div>
              {form.formState.errors.cep && (
                <p className="text-sm text-destructive">{form.formState.errors.cep.message}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="rua">Rua/Logradouro *</Label>
              <Input id="rua" {...form.register("rua")} />
              {form.formState.errors.rua && (
                <p className="text-sm text-destructive">{form.formState.errors.rua.message}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="numero">Número *</Label>
              <Input id="numero" {...form.register("numero")} />
              {form.formState.errors.numero && (
                <p className="text-sm text-destructive">{form.formState.errors.numero.message}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="bairro">Bairro *</Label>
              <Input id="bairro" {...form.register("bairro")} />
              {form.formState.errors.bairro && (
                <p className="text-sm text-destructive">{form.formState.errors.bairro.message}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="cidade">Cidade *</Label>
              <Input id="cidade" {...form.register("cidade")} />
              {form.formState.errors.cidade && (
                <p className="text-sm text-destructive">{form.formState.errors.cidade.message}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="estado">Estado (UF) *</Label>
              <Input id="estado" {...form.register("estado")} maxLength={2} />
              {form.formState.errors.estado && (
                <p className="text-sm text-destructive">{form.formState.errors.estado.message}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Other Data Section */}
      <Card>
        <CardHeader>
          <CardTitle>Outros Dados</CardTitle>
          <CardDescription>Classificação e informações técnicas</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* First Row: CNAE, Grupo, Ocupação */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>CNAE</Label>
              <Popover open={cnaeOpen} onOpenChange={setCnaeOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={cnaeOpen}
                    className="w-full justify-between"
                  >
                    {form.watch("cnae") || "Selecione o CNAE..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0">
                  <Command>
                    <CommandInput placeholder="Buscar CNAE..." />
                    <CommandList>
                      <CommandEmpty>Nenhum CNAE encontrado.</CommandEmpty>
                      <CommandGroup>
                        {cnaeOptions.map((cnae) => (
                          <CommandItem
                            key={cnae.cnae}
                            value={cnae.cnae}
                            onSelect={() => handleCNAESelect(cnae.cnae)}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                form.watch("cnae") === cnae.cnae ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {cnae.cnae} - {cnae.descricao}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            
            <div className="space-y-2">
              <Label>Grupo</Label>
              <Input value={cnaeData?.grupo || ""} disabled className="bg-muted" />
            </div>
            
            <div className="space-y-2">
              <Label>Ocupação</Label>
              <Input value={cnaeData?.ocupacao_uso || ""} disabled className="bg-muted" />
            </div>
          </div>

          {/* Second Row: Divisão, Descrição, Carga de Incêndio */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Divisão</Label>
              <Input value={cnaeData?.divisao || ""} disabled className="bg-muted" />
            </div>
            
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input value={cnaeData?.descricao || ""} disabled className="bg-muted" />
            </div>
            
            <div className="space-y-2">
              <Label>Carga de Icêndio (MJ/m2)</Label>
              <Input value={cnaeData?.carga_incendio_mj_m2 || ""} disabled className="bg-muted" />
            </div>
          </div>

          {/* Third Row: Grau de Risco, Altura, Área */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Grau de risco por carga de incendio</Label>
              <Input 
                value={grauRisco ? grauRisco.charAt(0).toUpperCase() + grauRisco.slice(1) : ""} 
                disabled 
                className="bg-muted" 
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="altura_tipo">Altura da edificação *</Label>
              <Select onValueChange={handleAlturaChange} value={form.watch("altura_tipo")}>
                <SelectTrigger>
                  <SelectValue placeholder="Altura em (m)" />
                </SelectTrigger>
                <SelectContent>
                  {alturaOptions.map((altura) => (
                    <SelectItem key={altura.tipo} value={altura.tipo}>
                      {altura.tipo} — {altura.denominacao}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.altura_tipo && (
                <p className="text-sm text-destructive">{form.formState.errors.altura_tipo.message}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="area_m2">Área da edificação *</Label>
              <Input 
                id="area_m2" 
                type="number" 
                step="0.01" 
                placeholder="Área em (m²)"
                {...form.register("area_m2")} 
              />
              {form.formState.errors.area_m2 && (
                <p className="text-sm text-destructive">{form.formState.errors.area_m2.message}</p>
              )}
            </div>
          </div>

          {/* Fourth Row: Número de Ocupantes */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="numero_ocupantes">Número de Ocupantes *</Label>
              <Input 
                id="numero_ocupantes" 
                type="number" 
                {...form.register("numero_ocupantes")}
                onChange={handleOcupantesChange}
              />
              {form.formState.errors.numero_ocupantes && (
                <p className="text-sm text-destructive">{form.formState.errors.numero_ocupantes.message}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={loading} size="lg">
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Salvar Empresa
        </Button>
      </div>
    </form>
  );
}
