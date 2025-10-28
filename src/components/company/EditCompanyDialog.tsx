import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Loader2, Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

const formSchema = z.object({
  razao_social: z.string().min(1, "Razão social é obrigatória"),
  nome_fantasia: z.string().optional(),
  cnpj: z.string().min(14, "CNPJ inválido"),
  responsavel: z.string().min(1, "Responsável é obrigatório"),
  telefone: z.string().min(10, "Telefone inválido"),
  email: z.string().email("Email inválido"),
  area_m2: z.number().min(1, "Área deve ser maior que 0"),
  numero_ocupantes: z.number().min(1, "Número de ocupantes deve ser maior que 0"),
  cnae: z.string().optional(),
  altura_tipo: z.string().min(1, "Altura é obrigatória"),
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
}

interface EditCompanyDialogProps {
  company: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export const EditCompanyDialog = ({
  company,
  open,
  onOpenChange,
  onSuccess,
}: EditCompanyDialogProps) => {
  const { toast } = useToast();
  const [cnaeOpen, setCnaeOpen] = useState(false);
  const [cnaeData, setCnaeData] = useState<CNAEData | null>(null);
  const [grauRisco, setGrauRisco] = useState<string>("");
  const [alturaOptions, setAlturaOptions] = useState<AlturaRef[]>([]);
  const [alturaDenominacao, setAlturaDenominacao] = useState<string>("");
  const [cnaeOptions, setCnaeOptions] = useState<CNAEData[]>([]);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      razao_social: "",
      nome_fantasia: "",
      cnpj: "",
      responsavel: "",
      telefone: "",
      email: "",
      area_m2: 0,
      numero_ocupantes: 0,
      cnae: "",
      altura_tipo: "",
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
      
      const mappedData = data.map((item: any) => ({
        cnae: item.CNAE || item.cnae,
        grupo: item.GRUPO || item.grupo || '',
        ocupacao_uso: item['OCUPAÇÃO/USO'] || item.ocupacao_uso || '',
        divisao: item['DIVISÃO'] || item.divisao || '',
        descricao: item['DESCRIÇÃO'] || item.descricao || '',
        carga_incendio_mj_m2: Number(item['CARGA DE INCÊNDIO (MJ/m2)'] || item.carga_incendio_mj_m2 || 0),
      }));
      
      const uniqueCnaes = mappedData.filter((item: CNAEData, index: number, self: CNAEData[]) => 
        index === self.findIndex((t) => t.cnae === item.cnae)
      );
      
      setCnaeOptions(uniqueCnaes);
    } catch (error) {
      console.error("Error loading CNAE options:", error);
    }
  };

  // Calculate risk grade
  const calculateRiskGrade = (carga: number, ocupantes: number) => {
    let risco = "baixo";

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

  // Handle CNAE selection
  const handleCNAESelect = (selectedCnae: string) => {
    form.setValue("cnae", selectedCnae);
    const selected = cnaeOptions.find(c => c.cnae === selectedCnae);
    
    if (selected) {
      const grupoLetra = selected.divisao?.charAt(0).toUpperCase() || '';
      
      setCnaeData({
        cnae: selected.cnae,
        grupo: grupoLetra,
        ocupacao_uso: selected.ocupacao_uso,
        divisao: selected.divisao,
        descricao: selected.descricao,
        carga_incendio_mj_m2: selected.carga_incendio_mj_m2,
      });

      calculateRiskGrade(selected.carga_incendio_mj_m2, form.getValues("numero_ocupantes"));
    }
    
    setCnaeOpen(false);
  };

  // Handle altura selection
  const handleAlturaChange = (tipo: string) => {
    form.setValue("altura_tipo", tipo);
    const selected = alturaOptions.find(a => a.tipo === tipo);
    setAlturaDenominacao(selected?.denominacao || "");
  };

  // Handle occupants change
  const handleOcupantesChange = (value: number) => {
    form.setValue("numero_ocupantes", value);
    
    if (cnaeData) {
      calculateRiskGrade(cnaeData.carga_incendio_mj_m2, value);
    }
  };

  useEffect(() => {
    if (company) {
      form.reset({
        razao_social: company.razao_social,
        nome_fantasia: company.nome_fantasia || "",
        cnpj: company.cnpj,
        responsavel: company.responsavel,
        telefone: company.telefone,
        email: company.email,
        area_m2: company.area_m2,
        numero_ocupantes: company.numero_ocupantes,
        cnae: company.cnae || "",
        altura_tipo: company.altura_tipo || "",
      });

      // Set existing CNAE data
      if (company.cnae) {
        setCnaeData({
          cnae: company.cnae,
          grupo: company.grupo,
          ocupacao_uso: company.ocupacao_uso,
          divisao: company.divisao,
          descricao: company.descricao,
          carga_incendio_mj_m2: company.carga_incendio_mj_m2,
        });
      }

      // Set existing altura data
      if (company.altura_denominacao) {
        setAlturaDenominacao(company.altura_denominacao);
      }

      // Set existing grau risco
      if (company.grau_risco) {
        setGrauRisco(company.grau_risco);
      }
    }
  }, [company, form]);

  const onSubmit = async (data: FormData) => {
    if (!cnaeData) {
      toast({
        title: "Dados incompletos",
        description: "Por favor, selecione um CNAE válido.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from("empresa")
        .update({
          razao_social: data.razao_social,
          nome_fantasia: data.nome_fantasia || null,
          cnpj: data.cnpj,
          responsavel: data.responsavel,
          telefone: data.telefone,
          email: data.email,
          area_m2: data.area_m2,
          numero_ocupantes: data.numero_ocupantes,
          cnae: data.cnae,
          grupo: cnaeData.grupo,
          ocupacao_uso: cnaeData.ocupacao_uso,
          divisao: cnaeData.divisao,
          descricao: cnaeData.descricao,
          carga_incendio_mj_m2: cnaeData.carga_incendio_mj_m2,
          altura_tipo: data.altura_tipo,
          altura_denominacao: alturaDenominacao,
          grau_risco: grauRisco,
        })
        .eq("id", company.id);

      if (error) throw error;

      toast({
        title: "Empresa atualizada",
        description: "Os dados da empresa foram atualizados com sucesso.",
      });

      onSuccess();
    } catch (error) {
      toast({
        title: "Erro ao atualizar empresa",
        description: "Não foi possível atualizar os dados da empresa.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Empresa</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="razao_social"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Razão Social *</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="nome_fantasia"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome Fantasia</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="cnpj"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>CNPJ *</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="responsavel"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Responsável *</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="telefone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefone *</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email *</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* CNAE Section */}
            <div className="border-t pt-4 mt-4">
              <h3 className="text-sm font-semibold mb-3">
                Classificação CNAE
              </h3>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <FormLabel>CNAE *</FormLabel>
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
                    <PopoverContent className="w-full p-0">
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

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <FormLabel>Grupo</FormLabel>
                    <Input value={cnaeData?.grupo || ""} disabled className="bg-muted" />
                  </div>
                  
                  <div className="space-y-2">
                    <FormLabel>Ocupação/Uso</FormLabel>
                    <Input value={cnaeData?.ocupacao_uso || ""} disabled className="bg-muted" />
                  </div>
                  
                  <div className="space-y-2">
                    <FormLabel>Divisão</FormLabel>
                    <Input value={cnaeData?.divisao || ""} disabled className="bg-muted" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <FormLabel>Descrição</FormLabel>
                    <Input value={cnaeData?.descricao || ""} disabled className="bg-muted" />
                  </div>
                  
                  <div className="space-y-2">
                    <FormLabel>Carga de Incêndio (MJ/m²)</FormLabel>
                    <Input value={cnaeData?.carga_incendio_mj_m2 || ""} disabled className="bg-muted" />
                  </div>
                </div>
              </div>
            </div>

            {/* Altura Section */}
            <div className="border-t pt-4 mt-4">
              <h3 className="text-sm font-semibold mb-3">
                Altura e Risco
              </h3>
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="altura_tipo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Altura da Edificação *</FormLabel>
                      <Select onValueChange={handleAlturaChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione a altura" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {alturaOptions.map((altura) => (
                            <SelectItem key={altura.tipo} value={altura.tipo}>
                              {altura.tipo} — {altura.denominacao}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-2">
                  <FormLabel>Grau de Risco</FormLabel>
                  <Input 
                    value={grauRisco ? grauRisco.charAt(0).toUpperCase() + grauRisco.slice(1) : ""} 
                    disabled 
                    className="bg-muted" 
                  />
                </div>
              </div>
            </div>

            {/* Área e Ocupantes Section */}
            <div className="border-t pt-4 mt-4">
              <h3 className="text-sm font-semibold mb-3">
                Área e Ocupação
              </h3>
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="area_m2"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Área (m²) *</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="numero_ocupantes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nº de Ocupantes *</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          onChange={(e) => {
                            const value = parseInt(e.target.value);
                            field.onChange(value);
                            handleOcupantesChange(value);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="flex justify-end gap-4 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Salvar
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
