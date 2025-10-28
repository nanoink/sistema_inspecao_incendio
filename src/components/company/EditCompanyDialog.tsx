import { useEffect } from "react";
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
import { Loader2 } from "lucide-react";

const formSchema = z.object({
  razao_social: z.string().min(1, "Razão social é obrigatória"),
  nome_fantasia: z.string().optional(),
  cnpj: z.string().min(14, "CNPJ inválido"),
  responsavel: z.string().min(1, "Responsável é obrigatório"),
  telefone: z.string().min(10, "Telefone inválido"),
  email: z.string().email("Email inválido"),
  area_m2: z.number().min(1, "Área deve ser maior que 0"),
  numero_ocupantes: z.number().min(1, "Número de ocupantes deve ser maior que 0"),
});

type FormData = z.infer<typeof formSchema>;

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
    },
  });

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
      });
    }
  }, [company, form]);

  const onSubmit = async (data: FormData) => {
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
                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* CNAE Information - Read Only */}
            <div className="border-t pt-4 mt-4">
              <h3 className="text-sm font-semibold mb-3 text-muted-foreground">
                Informações de CNAE (Somente Leitura)
              </h3>
              
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <FormLabel>CNAE</FormLabel>
                  <Input value={company?.cnae || ""} disabled className="bg-muted" />
                </div>
                
                <div className="space-y-2">
                  <FormLabel>Grupo</FormLabel>
                  <Input value={company?.grupo || ""} disabled className="bg-muted" />
                </div>
                
                <div className="space-y-2">
                  <FormLabel>Ocupação/Uso</FormLabel>
                  <Input value={company?.ocupacao_uso || ""} disabled className="bg-muted" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 mt-4">
                <div className="space-y-2">
                  <FormLabel>Divisão</FormLabel>
                  <Input value={company?.divisao || ""} disabled className="bg-muted" />
                </div>
                
                <div className="space-y-2">
                  <FormLabel>Descrição</FormLabel>
                  <Input value={company?.descricao || ""} disabled className="bg-muted" />
                </div>
                
                <div className="space-y-2">
                  <FormLabel>Carga de Incêndio (MJ/m²)</FormLabel>
                  <Input value={company?.carga_incendio_mj_m2 || ""} disabled className="bg-muted" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 mt-4">
                <div className="space-y-2">
                  <FormLabel>Altura da Edificação (Tipo)</FormLabel>
                  <Input value={company?.altura_tipo || ""} disabled className="bg-muted" />
                </div>
                
                <div className="space-y-2">
                  <FormLabel>Denominação da Altura</FormLabel>
                  <Input value={company?.altura_denominacao || ""} disabled className="bg-muted" />
                </div>
                
                <div className="space-y-2">
                  <FormLabel>Grau de Risco</FormLabel>
                  <Input 
                    value={company?.grau_risco ? company.grau_risco.charAt(0).toUpperCase() + company.grau_risco.slice(1) : ""} 
                    disabled 
                    className="bg-muted" 
                  />
                </div>
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
