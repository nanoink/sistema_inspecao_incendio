import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  EXTINGUISHER_TYPE_OPTIONS,
  monthInputToDateValue,
  saveExtinguisher,
  toMonthInputValue,
  type ExtinguisherRecord,
} from "@/lib/checklist-equipment";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const extinguisherFormSchema = z.object({
  numero: z.string().trim().min(1, "Informe o numero do extintor."),
  localizacao: z.string().trim().min(1, "Informe a localizacao."),
  tipo: z.string().min(1, "Selecione o tipo."),
  carga_nominal: z.string().min(1, "Selecione a carga nominal."),
  vencimento_carga: z
    .string()
    .regex(/^\d{4}-\d{2}$/, "Informe o vencimento da carga."),
  vencimento_teste_hidrostatico_ano: z.coerce
    .number()
    .int("Informe um ano valido.")
    .min(2000, "Informe um ano valido.")
    .max(9999, "Informe um ano valido."),
});

type ExtinguisherFormValues = z.infer<typeof extinguisherFormSchema>;

interface ExtinguisherDialogProps {
  companyId: string;
  open: boolean;
  record: ExtinguisherRecord | null;
  onOpenChange: (open: boolean) => void;
  onSaved: (record: ExtinguisherRecord) => void;
}

export const ExtinguisherDialog = ({
  companyId,
  open,
  record,
  onOpenChange,
  onSaved,
}: ExtinguisherDialogProps) => {
  const { toast } = useToast();
  const form = useForm<ExtinguisherFormValues>({
    resolver: zodResolver(extinguisherFormSchema),
    defaultValues: {
      numero: "",
      localizacao: "",
      tipo: "",
      carga_nominal: "",
      vencimento_carga: "",
      vencimento_teste_hidrostatico_ano: new Date().getFullYear(),
    },
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    if (record) {
      form.reset({
        numero: record.numero,
        localizacao: record.localizacao,
        tipo: record.tipo,
        carga_nominal: record.carga_nominal,
        vencimento_carga: toMonthInputValue(record.vencimento_carga),
        vencimento_teste_hidrostatico_ano:
          record.vencimento_teste_hidrostatico_ano,
      });
      return;
    }

    form.reset({
      numero: "",
      localizacao: "",
      tipo: "",
      carga_nominal: "",
      vencimento_carga: "",
      vencimento_teste_hidrostatico_ano: new Date().getFullYear(),
    });
  }, [form, open, record]);

  const selectedType = form.watch("tipo");
  const selectedTypeConfig = EXTINGUISHER_TYPE_OPTIONS.find(
    (item) => item.value === selectedType,
  );

  useEffect(() => {
    const currentLoad = form.getValues("carga_nominal");
    if (
      currentLoad &&
      selectedTypeConfig &&
      !selectedTypeConfig.loadOptions.includes(currentLoad)
    ) {
      form.setValue("carga_nominal", "");
    }
  }, [form, selectedTypeConfig]);

  const handleSubmit = async (values: ExtinguisherFormValues) => {
    try {
      const saved = await saveExtinguisher(
        supabase,
        {
          empresa_id: companyId,
          numero: values.numero.trim(),
          localizacao: values.localizacao.trim(),
          tipo: values.tipo,
          carga_nominal: values.carga_nominal,
          vencimento_carga:
            monthInputToDateValue(values.vencimento_carga) || "",
          vencimento_teste_hidrostatico_ano:
            values.vencimento_teste_hidrostatico_ano,
        },
        record?.id,
      );

      toast({
        title: record ? "Extintor atualizado" : "Extintor cadastrado",
        description: "Os dados do extintor foram salvos com sucesso.",
      });

      onSaved(saved);
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Erro ao salvar extintor",
        description:
          "Nao foi possivel salvar o cadastro do extintor. Verifique se o numero ja existe para esta empresa.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {record ? "Editar extintor" : "Cadastrar extintor"}
          </DialogTitle>
          <DialogDescription>
            Informe os dados do extintor conforme a planilha de controle de equipamentos.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-4"
          >
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="numero"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>No. do Extintor</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Ex.: 1" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="localizacao"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Localizacao</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Ex.: Recepcao" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="tipo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value || undefined}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o tipo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {EXTINGUISHER_TYPE_OPTIONS.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="carga_nominal"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Carga Nominal</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value || undefined}
                      disabled={!selectedTypeConfig}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a carga" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(selectedTypeConfig?.loadOptions || []).map((load) => (
                          <SelectItem key={load} value={load}>
                            {load}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="vencimento_carga"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Venc. Carga</FormLabel>
                    <FormControl>
                      <Input type="month" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="vencimento_teste_hidrostatico_ano"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Venc. Teste Hidrostatico</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={2000}
                        max={9999}
                        {...field}
                        onChange={(event) =>
                          field.onChange(Number(event.target.value))
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
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
