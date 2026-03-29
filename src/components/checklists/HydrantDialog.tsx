import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  getNextEquipmentNumber,
  HOSE_TYPE_OPTIONS,
  HYDRANT_TYPE_OPTIONS,
  type EquipmentChecklistSnapshot,
  YES_NO_OPTIONS,
  monthInputToDateValue,
  saveHydrant,
  toMonthInputValue,
  type HydrantRecord,
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

const hydrantFormSchema = z
  .object({
    numero: z.string().trim().min(1, "Informe o numero do hidrante."),
    localizacao: z.string().trim().min(1, "Informe a localizacao."),
    tipo_hidrante: z.string().min(1, "Selecione o tipo do hidrante."),
    mangueira1_tipo: z.string().min(1, "Selecione o tipo da mangueira 1."),
    mangueira1_vencimento_teste_hidrostatico: z
      .string()
      .regex(/^\d{4}-\d{2}$/, "Informe o vencimento da mangueira 1."),
    mangueira2_tipo: z.string().optional(),
    mangueira2_vencimento_teste_hidrostatico: z.string().optional(),
    esguicho: z.enum(["true", "false"]),
    chave_mangueira: z.enum(["true", "false"]),
  })
  .superRefine((values, ctx) => {
    const hasType = Boolean(values.mangueira2_tipo);
    const hasDate = Boolean(values.mangueira2_vencimento_teste_hidrostatico);

    if (hasType !== hasDate) {
      if (!hasType) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Selecione o tipo da mangueira 2.",
          path: ["mangueira2_tipo"],
        });
      }

      if (!hasDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Informe o vencimento da mangueira 2.",
          path: ["mangueira2_vencimento_teste_hidrostatico"],
        });
      }
    }
  });

type HydrantFormValues = z.infer<typeof hydrantFormSchema>;

interface HydrantDialogProps {
  companyId: string;
  checklistSnapshot: EquipmentChecklistSnapshot;
  open: boolean;
  record: HydrantRecord | null;
  onOpenChange: (open: boolean) => void;
  onSaved: (record: HydrantRecord) => void;
}

export const HydrantDialog = ({
  companyId,
  checklistSnapshot,
  open,
  record,
  onOpenChange,
  onSaved,
}: HydrantDialogProps) => {
  const { toast } = useToast();
  const [loadingNumber, setLoadingNumber] = useState(false);
  const form = useForm<HydrantFormValues>({
    resolver: zodResolver(hydrantFormSchema),
    defaultValues: {
      numero: "",
      localizacao: "",
      tipo_hidrante: "",
      mangueira1_tipo: "",
      mangueira1_vencimento_teste_hidrostatico: "",
      mangueira2_tipo: "",
      mangueira2_vencimento_teste_hidrostatico: "",
      esguicho: "true",
      chave_mangueira: "true",
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
        tipo_hidrante: record.tipo_hidrante,
        mangueira1_tipo: record.mangueira1_tipo,
        mangueira1_vencimento_teste_hidrostatico: toMonthInputValue(
          record.mangueira1_vencimento_teste_hidrostatico,
        ),
        mangueira2_tipo: record.mangueira2_tipo || "",
        mangueira2_vencimento_teste_hidrostatico: toMonthInputValue(
          record.mangueira2_vencimento_teste_hidrostatico,
        ),
        esguicho: String(record.esguicho) as "true" | "false",
        chave_mangueira: String(record.chave_mangueira) as "true" | "false",
      });
      return;
    }

    setLoadingNumber(true);
    form.reset({
      numero: "",
      localizacao: "",
      tipo_hidrante: "",
      mangueira1_tipo: "",
      mangueira1_vencimento_teste_hidrostatico: "",
      mangueira2_tipo: "",
      mangueira2_vencimento_teste_hidrostatico: "",
      esguicho: "true",
      chave_mangueira: "true",
    });

    const loadNextNumber = async () => {
      try {
        const nextNumber = await getNextEquipmentNumber(
          supabase,
          companyId,
          "hidrante",
        );
        form.setValue("numero", nextNumber, {
          shouldDirty: false,
          shouldTouch: false,
          shouldValidate: true,
        });
      } catch (error) {
        toast({
          title: "Erro ao gerar numero do hidrante",
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

  const handleSubmit = async (values: HydrantFormValues) => {
    try {
      const saved = await saveHydrant(
        supabase,
        {
          empresa_id: companyId,
          numero: values.numero.trim(),
          localizacao: values.localizacao.trim(),
          tipo_hidrante: values.tipo_hidrante,
          mangueira1_tipo: values.mangueira1_tipo,
          mangueira1_vencimento_teste_hidrostatico:
            monthInputToDateValue(
              values.mangueira1_vencimento_teste_hidrostatico,
            ) || "",
          mangueira2_tipo: values.mangueira2_tipo?.trim() || null,
          mangueira2_vencimento_teste_hidrostatico:
            monthInputToDateValue(
              values.mangueira2_vencimento_teste_hidrostatico || "",
            ),
          esguicho: values.esguicho === "true",
          chave_mangueira: values.chave_mangueira === "true",
          status: record?.status || null,
        },
        {
          recordId: record?.id,
          existingToken: record?.public_token,
          existingSnapshot: record?.checklist_snapshot,
          checklistSnapshot,
        },
      );

      toast({
        title: record ? "Hidrante atualizado" : "Hidrante cadastrado",
        description:
          saved.qr_code_url && saved.qr_code_svg
            ? "Os dados do hidrante e o QR Code foram salvos com sucesso."
            : "Os dados do hidrante foram salvos, mas o QR Code depende da migration complementar no banco.",
      });

      onSaved(saved);
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Erro ao salvar hidrante",
        description:
          "Nao foi possivel salvar o cadastro do hidrante. Verifique se o numero ja existe para esta empresa.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {record ? "Editar hidrante" : "Cadastrar hidrante"}
          </DialogTitle>
          <DialogDescription>
            Informe os dados do hidrante e das mangueiras conforme a planilha de controle.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-4"
          >
            <div className="grid gap-4 md:grid-cols-3">
              <FormField
                control={form.control}
                name="numero"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>No.</FormLabel>
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
                  <FormItem className="md:col-span-2">
                    <FormLabel>Localizacao</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Ex.: Recepcao" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="tipo_hidrante"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Hidrante</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value ?? ""}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o tipo de hidrante" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {HYDRANT_TYPE_OPTIONS.map((item) => (
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

            <div className="rounded-lg border p-4 space-y-4">
              <h3 className="text-sm font-semibold">Mangueira 1</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="mangueira1_tipo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value ?? ""}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione a mangueira 1" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {HOSE_TYPE_OPTIONS.map((item) => (
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
                  name="mangueira1_vencimento_teste_hidrostatico"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Venc. Teste Hidrost.</FormLabel>
                      <FormControl>
                        <Input type="month" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="rounded-lg border p-4 space-y-4">
              <h3 className="text-sm font-semibold">Mangueira 2</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="mangueira2_tipo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value ?? ""}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione a mangueira 2" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {HOSE_TYPE_OPTIONS.map((item) => (
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
                  name="mangueira2_vencimento_teste_hidrostatico"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Venc. Teste Hidrost.</FormLabel>
                      <FormControl>
                        <Input type="month" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="esguicho"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Esguicho</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value ?? ""}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {YES_NO_OPTIONS.map((item) => (
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
                name="chave_mangueira"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Chave de Mangueira</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value ?? ""}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {YES_NO_OPTIONS.map((item) => (
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
