import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  getNextEquipmentNumber,
  LUMINAIRE_STATUS_OPTIONS,
  LUMINAIRE_TYPE_OPTIONS,
  saveLuminaire,
  type EquipmentChecklistSnapshot,
  type LuminaireRecord,
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

const luminaireFormSchema = z.object({
  numero: z.string().trim().min(1, "Informe o numero da luminaria."),
  localizacao: z.string().trim().min(1, "Informe a localizacao."),
  tipo_luminaria: z.string().min(1, "Selecione o tipo de luminaria."),
  status: z.string().min(1, "Selecione o status."),
});

type LuminaireFormValues = z.infer<typeof luminaireFormSchema>;

interface LuminaireDialogProps {
  companyId: string;
  checklistSnapshot: EquipmentChecklistSnapshot;
  open: boolean;
  record: LuminaireRecord | null;
  onOpenChange: (open: boolean) => void;
  onSaved: (record: LuminaireRecord) => void;
}

export const LuminaireDialog = ({
  companyId,
  checklistSnapshot,
  open,
  record,
  onOpenChange,
  onSaved,
}: LuminaireDialogProps) => {
  const { toast } = useToast();
  const [loadingNumber, setLoadingNumber] = useState(false);
  const form = useForm<LuminaireFormValues>({
    resolver: zodResolver(luminaireFormSchema),
    defaultValues: {
      numero: "",
      localizacao: "",
      tipo_luminaria: "",
      status: "",
    },
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    if (record) {
      setLoadingNumber(false);
      form.reset({
        numero: record.numero,
        localizacao: record.localizacao,
        tipo_luminaria: record.tipo_luminaria,
        status: record.status,
      });
      return;
    }

    setLoadingNumber(true);
    form.reset({
      numero: "",
      localizacao: "",
      tipo_luminaria: "",
      status: "",
    });

    const loadNextNumber = async () => {
      try {
        const nextNumber = await getNextEquipmentNumber(
          supabase,
          companyId,
          "luminaria",
        );
        form.setValue("numero", nextNumber, {
          shouldDirty: false,
          shouldTouch: false,
          shouldValidate: true,
        });
      } catch (error) {
        toast({
          title: "Erro ao gerar numero da luminaria",
          description:
            "Nao foi possivel consultar a proxima numeracao automatica.",
          variant: "destructive",
        });
      } finally {
        setLoadingNumber(false);
      }
    };

    void loadNextNumber();
  }, [companyId, form, open, record, toast]);

  const handleSubmit = async (values: LuminaireFormValues) => {
    try {
      const saved = await saveLuminaire(
        supabase,
        {
          empresa_id: companyId,
          numero: values.numero.trim(),
          localizacao: values.localizacao.trim(),
          tipo_luminaria: values.tipo_luminaria,
          status: values.status,
        },
        {
          recordId: record?.id,
          existingToken: record?.public_token,
          existingSnapshot: record?.checklist_snapshot,
          checklistSnapshot,
        },
      );

      toast({
        title: record ? "Luminaria atualizada" : "Luminaria cadastrada",
        description:
          saved.qr_code_url && saved.qr_code_svg
            ? "Os dados da luminaria e o QR Code foram salvos com sucesso."
            : "Os dados da luminaria foram salvos, mas o QR Code depende da migration complementar no banco.",
      });

      onSaved(saved);
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Erro ao salvar luminaria",
        description:
          "Nao foi possivel salvar o cadastro da luminaria. Verifique se o numero ja existe para esta empresa.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {record ? "Editar luminaria" : "Cadastrar luminaria"}
          </DialogTitle>
          <DialogDescription>
            Informe os dados da luminaria conforme a planilha de controle de equipamentos.
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
                    <FormLabel>No. da Luminaria</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder={loadingNumber ? "Gerando..." : "Ex.: 1"}
                        disabled
                        className="cursor-not-allowed bg-muted"
                      />
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
                      <Input {...field} placeholder="Ex.: Corredor principal" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="tipo_luminaria"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Luminaria</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value ?? ""}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o tipo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {LUMINAIRE_TYPE_OPTIONS.map((item) => (
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
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value ?? ""}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {LUMINAIRE_STATUS_OPTIONS.map((item) => (
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
            </div>

            <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
              Os tipos disponiveis foram cadastrados a partir da aba DAD. LUM da planilha de controle.
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={form.formState.isSubmitting || loadingNumber}
              >
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
