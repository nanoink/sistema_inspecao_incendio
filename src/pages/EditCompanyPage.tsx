import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { ArrowLeft, Check, ChevronsUpDown, Loader2, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { CompanyMembersManager } from "@/components/company/CompanyMembersManager";
import { isMissingColumnError } from "@/lib/supabase-errors";

const formSchema = z.object({
  razao_social: z.string().min(1, "Razao social e obrigatoria"),
  nome_fantasia: z.string().optional(),
  cnpj: z.string().min(14, "CNPJ invalido"),
  responsavel: z.string().min(1, "Responsavel e obrigatorio"),
  possui_responsavel_tecnico: z.boolean(),
  telefone: z.string().min(10, "Telefone invalido"),
  email: z.string().email("Email invalido"),
  area_m2: z.number().min(1, "Area deve ser maior que 0"),
  numero_ocupantes: z.number().min(1, "Numero de ocupantes deve ser maior que 0"),
  cnae: z.string().optional(),
  altura_tipo: z.string().min(1, "Altura e obrigatoria"),
});

type FormData = z.infer<typeof formSchema>;
type Company = Database["public"]["Tables"]["empresa"]["Row"];

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

const EditCompanyPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [company, setCompany] = useState<Company | null>(null);
  const [loadingPage, setLoadingPage] = useState(true);
  const [cnaeOpen, setCnaeOpen] = useState(false);
  const [cnaeData, setCnaeData] = useState<CNAEData | null>(null);
  const [grauRisco, setGrauRisco] = useState<string>("");
  const [alturaOptions, setAlturaOptions] = useState<AlturaRef[]>([]);
  const [alturaDenominacao, setAlturaDenominacao] = useState<string>("");
  const [alturaDescricao, setAlturaDescricao] = useState<string>("");
  const [cnaeOptions, setCnaeOptions] = useState<CNAEData[]>([]);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      razao_social: "",
      nome_fantasia: "",
      cnpj: "",
      responsavel: "",
      possui_responsavel_tecnico: false,
      telefone: "",
      email: "",
      area_m2: 0,
      numero_ocupantes: 0,
      cnae: "",
      altura_tipo: "",
    },
  });

  useEffect(() => {
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
        const response = await fetch(
          "https://script.google.com/macros/s/AKfycbwFuTToILsB-y5kbSkSI7u04jIoOlCOogPzUp6VSJbElZ-8u3pra5TtFRKR4J5aGvbX/exec",
        );
        const data: unknown = await response.json();

        if (!Array.isArray(data)) {
          throw new Error("Resposta de CNAE invalida");
        }

        const mappedData = (data as Array<Record<string, unknown>>).map((item) => ({
          cnae: item.CNAE || item.cnae,
          grupo: item.GRUPO || item.grupo || "",
          ocupacao_uso: item["OCUPAÃ‡ÃƒO/USO"] || item.ocupacao_uso || "",
          divisao: item["DIVISÃƒO"] || item.divisao || "",
          descricao: item["DESCRIÃ‡ÃƒO"] || item.descricao || "",
          carga_incendio_mj_m2: Number(
            item["CARGA DE INCÃŠNDIO (MJ/m2)"] || item.carga_incendio_mj_m2 || 0,
          ),
        }));

        const uniqueCnaes = mappedData.filter(
          (item: CNAEData, index: number, self: CNAEData[]) =>
            index === self.findIndex((target) => target.cnae === item.cnae),
        );

        setCnaeOptions(uniqueCnaes);
      } catch (error) {
        console.error("Error loading CNAE options:", error);
      }
    };

    void loadAlturaOptions();
    void loadCnaeOptions();
  }, []);

  useEffect(() => {
    const fetchCompany = async () => {
      if (!id) {
        setLoadingPage(false);
        return;
      }

      try {
        setLoadingPage(true);
        const { data, error } = await supabase
          .from("empresa")
          .select("*")
          .eq("id", id)
          .maybeSingle();

        if (error) {
          throw error;
        }

        if (!data) {
          setCompany(null);
          return;
        }

        setCompany(data);
        form.reset({
          razao_social: data.razao_social,
          nome_fantasia: data.nome_fantasia || "",
          cnpj: data.cnpj,
          responsavel: data.responsavel,
          possui_responsavel_tecnico: data.possui_responsavel_tecnico ?? false,
          telefone: data.telefone,
          email: data.email,
          area_m2: data.area_m2,
          numero_ocupantes: data.numero_ocupantes,
          cnae: data.cnae || "",
          altura_tipo: data.altura_tipo || "",
        });

        if (data.cnae) {
          setCnaeData({
            cnae: data.cnae,
            grupo: data.grupo,
            ocupacao_uso: data.ocupacao_uso,
            divisao: data.divisao,
            descricao: data.descricao,
            carga_incendio_mj_m2: data.carga_incendio_mj_m2,
          });
        } else {
          setCnaeData(null);
        }

        setAlturaDenominacao(data.altura_denominacao || "");
        setAlturaDescricao(data.altura_descricao || "");
        setGrauRisco(data.grau_risco || "");
      } catch (error) {
        console.error("Error loading company:", error);
        toast({
          title: "Erro ao carregar empresa",
          description: "Nao foi possivel carregar os dados da empresa.",
          variant: "destructive",
        });
      } finally {
        setLoadingPage(false);
      }
    };

    void fetchCompany();
  }, [form, id, toast]);

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

  const handleCNAESelect = (selectedCnae: string) => {
    form.setValue("cnae", selectedCnae);
    const selected = cnaeOptions.find((item) => item.cnae === selectedCnae);

    if (selected) {
      const grupoLetra = selected.divisao?.charAt(0).toUpperCase() || "";

      setCnaeData({
        cnae: selected.cnae,
        grupo: grupoLetra,
        ocupacao_uso: selected.ocupacao_uso,
        divisao: selected.divisao,
        descricao: selected.descricao,
        carga_incendio_mj_m2: selected.carga_incendio_mj_m2,
      });

      calculateRiskGrade(
        selected.carga_incendio_mj_m2,
        form.getValues("numero_ocupantes"),
      );
    }

    setCnaeOpen(false);
  };

  const handleAlturaChange = (tipo: string) => {
    form.setValue("altura_tipo", tipo);
    const selected = alturaOptions.find((altura) => altura.tipo === tipo);
    setAlturaDenominacao(selected?.denominacao || "");

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

  const handleOcupantesChange = (value: number) => {
    form.setValue("numero_ocupantes", value);

    if (cnaeData) {
      calculateRiskGrade(cnaeData.carga_incendio_mj_m2, value);
    }
  };

  const onSubmit = async (data: FormData) => {
    if (!cnaeData) {
      toast({
        title: "Dados incompletos",
        description: "Por favor, selecione um CNAE valido.",
        variant: "destructive",
      });
      return;
    }

    if (!company) {
      return;
    }

    try {
      const updatePayload = {
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
        altura_descricao: alturaDescricao,
        grau_risco: grauRisco,
      };

      const updatePayloadWithTechnicalResponsible = {
        ...updatePayload,
        possui_responsavel_tecnico: data.possui_responsavel_tecnico,
      };

      const updateWithTechnicalResponsible = await supabase
        .from("empresa")
        .update(updatePayloadWithTechnicalResponsible)
        .eq("id", company.id);

      let error = updateWithTechnicalResponsible.error;

      if (
        error &&
        isMissingColumnError(error, ["possui_responsavel_tecnico"])
      ) {
        const updateFallback = await supabase
          .from("empresa")
          .update(updatePayload)
          .eq("id", company.id);

        error = updateFallback.error;
      }

      if (error) {
        throw error;
      }

      setCompany((previous) =>
        previous
          ? {
              ...previous,
              ...data,
              nome_fantasia: data.nome_fantasia || null,
              grupo: cnaeData.grupo,
              ocupacao_uso: cnaeData.ocupacao_uso,
              divisao: cnaeData.divisao,
              descricao: cnaeData.descricao,
              carga_incendio_mj_m2: cnaeData.carga_incendio_mj_m2,
              altura_denominacao: alturaDenominacao,
              altura_descricao: alturaDescricao,
              grau_risco: grauRisco,
            }
          : previous,
      );

      toast({
        title: "Empresa atualizada",
        description: "Os dados da empresa foram atualizados com sucesso.",
      });
    } catch (error) {
      console.error("Error updating company:", error);
      toast({
        title: "Erro ao atualizar empresa",
        description: "Nao foi possivel atualizar os dados da empresa.",
        variant: "destructive",
      });
    }
  };

  if (loadingPage) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!company) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <Card className="w-full max-w-xl">
          <CardContent className="py-12 text-center">
            <p className="text-lg font-semibold">Empresa nao encontrada</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Nao foi possivel localizar a empresa solicitada.
            </p>
            <Button
              type="button"
              variant="outline"
              className="mt-6"
              onClick={() => navigate("/")}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar ao dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto max-w-5xl px-4 py-6 md:py-8">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-muted-foreground">
              Edicao da empresa
            </p>
            <h1 className="text-2xl font-bold md:text-3xl">{company.razao_social}</h1>
            <p className="text-sm text-muted-foreground">
              Atualize os dados da empresa e gerencie os usuarios em uma unica view.
            </p>
          </div>

          <Button type="button" variant="outline" onClick={() => navigate("/")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Editar Empresa</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="razao_social"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Razao Social *</FormLabel>
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
                      <FormLabel>Responsavel *</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="possui_responsavel_tecnico"
                  render={({ field }) => (
                    <FormItem className="rounded-md border border-border/80 p-3">
                      <div className="flex items-start gap-3">
                        <FormControl>
                          <Checkbox
                            id="possui_responsavel_tecnico_edit"
                            checked={field.value}
                            onCheckedChange={(checked) => field.onChange(checked === true)}
                          />
                        </FormControl>
                        <div className="space-y-1">
                          <FormLabel
                            htmlFor="possui_responsavel_tecnico_edit"
                            className="cursor-pointer"
                          >
                            A empresa possui responsavel tecnico
                          </FormLabel>
                          <p className="text-xs text-muted-foreground">
                            Defina se esta empresa possui responsavel tecnico para emissao de
                            relatorio tecnico oficial.
                          </p>
                        </div>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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

                <div className="border-t pt-4">
                  <h3 className="mb-3 text-sm font-semibold">Classificacao CNAE</h3>

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
                                        form.watch("cnae") === cnae.cnae
                                          ? "opacity-100"
                                          : "opacity-0",
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

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                      <div className="space-y-2">
                        <FormLabel>Grupo</FormLabel>
                        <Input value={cnaeData?.grupo || ""} disabled className="bg-muted" />
                      </div>

                      <div className="space-y-2">
                        <FormLabel>Ocupacao/Uso</FormLabel>
                        <Input
                          value={cnaeData?.ocupacao_uso || ""}
                          disabled
                          className="bg-muted"
                        />
                      </div>

                      <div className="space-y-2">
                        <FormLabel>Divisao</FormLabel>
                        <Input value={cnaeData?.divisao || ""} disabled className="bg-muted" />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <FormLabel>Descricao</FormLabel>
                        <Input
                          value={cnaeData?.descricao || ""}
                          disabled
                          className="bg-muted"
                        />
                      </div>

                      <div className="space-y-2">
                        <FormLabel>Carga de Incendio (MJ/m²)</FormLabel>
                        <Input
                          value={cnaeData?.carga_incendio_mj_m2 || ""}
                          disabled
                          className="bg-muted"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h3 className="mb-3 text-sm font-semibold">Altura e Risco</h3>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="altura_tipo"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Altura da Edificacao *</FormLabel>
                          <Select onValueChange={handleAlturaChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione a altura" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {alturaOptions.map((altura) => (
                                <SelectItem key={altura.tipo} value={altura.tipo}>
                                  {altura.tipo} - {altura.denominacao}
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
                        value={
                          grauRisco
                            ? grauRisco.charAt(0).toUpperCase() + grauRisco.slice(1)
                            : ""
                        }
                        disabled
                        className="bg-muted"
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h3 className="mb-3 text-sm font-semibold">Area e Ocupacao</h3>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="area_m2"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Area (m²) *</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              {...field}
                              onChange={(event) =>
                                field.onChange(parseFloat(event.target.value))
                              }
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
                              onChange={(event) => {
                                const value = parseInt(event.target.value);
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

                <div className="border-t pt-4">
                  <CompanyMembersManager
                    companyId={company.id}
                    responsavelName={form.watch("responsavel") || company.responsavel}
                  />
                </div>

                <div className="flex flex-col justify-end gap-3 border-t pt-4 sm:flex-row">
                  <Button type="button" variant="outline" onClick={() => navigate("/")}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={form.formState.isSubmitting}>
                    {form.formState.isSubmitting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    Salvar
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default EditCompanyPage;
