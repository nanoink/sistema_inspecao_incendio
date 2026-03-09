import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, ClipboardCheck, FileCheck, FileText, Loader2, RefreshCcw, Save, TriangleAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useToast } from "@/hooks/use-toast";
import { buildChecklistSnapshot, type ChecklistSnapshot } from "@/lib/checklist";
import { loadChecklistData } from "@/lib/checklist-source";
import { isMissingRelationError } from "@/lib/supabase-errors";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Company = Pick<
  Database["public"]["Tables"]["empresa"]["Row"],
  | "id"
  | "razao_social"
  | "nome_fantasia"
  | "cnpj"
  | "responsavel"
  | "telefone"
  | "email"
  | "rua"
  | "numero"
  | "bairro"
  | "cidade"
  | "estado"
  | "cep"
  | "divisao"
  | "grupo"
  | "ocupacao_uso"
  | "area_m2"
  | "numero_ocupantes"
  | "altura_denominacao"
  | "altura_descricao"
  | "grau_risco"
>;

type ReportRow = Database["public"]["Tables"]["empresa_relatorios"]["Row"];
type ReportStatus = "rascunho" | "finalizado";

interface ReportFormState {
  titulo: string;
  numeroRelatorio: string;
  dataInspecao: string;
  dataEmissao: string;
  horaInicio: string;
  horaFim: string;
  inspetorNome: string;
  inspetorCargo: string;
  representanteNome: string;
  representanteCargo: string;
  objetivo: string;
  escopo: string;
  observacoesGerais: string;
  recomendacoes: string;
  conclusao: string;
}

const getToday = () => new Date().toISOString().slice(0, 10);

const emptyForm = (): ReportFormState => ({
  titulo: "Relatorio de Inspecao",
  numeroRelatorio: "",
  dataInspecao: getToday(),
  dataEmissao: getToday(),
  horaInicio: "",
  horaFim: "",
  inspetorNome: "",
  inspetorCargo: "",
  representanteNome: "",
  representanteCargo: "",
  objetivo: "Registrar o resultado da inspecao de seguranca contra incendio da edificacao.",
  escopo: "Consolidacao dos resultados dos checklists de renovacao e das observacoes levantadas durante a vistoria.",
  observacoesGerais: "",
  recomendacoes: "",
  conclusao: "",
});

const normalizeNullable = (value: string) => {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const isChecklistSnapshot = (value: unknown): value is ChecklistSnapshot => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const snapshot = value as Partial<ChecklistSnapshot>;
  return (
    typeof snapshot.generated_at === "string" &&
    typeof snapshot.overall === "object" &&
    Array.isArray(snapshot.inspections) &&
    Array.isArray(snapshot.non_conformities)
  );
};

const getReportStatusBadge = (status: ReportStatus) =>
  status === "finalizado"
    ? {
        label: "Finalizado",
        className: "border-emerald-200 bg-emerald-50 text-emerald-700",
      }
    : {
        label: "Rascunho",
        className: "border-amber-200 bg-amber-50 text-amber-700",
      };

const buildDefaultForm = (company: Company, report: ReportRow | null): ReportFormState => {
  const defaults = emptyForm();

  if (!report) {
    return {
      ...defaults,
      representanteNome: company.responsavel || "",
      representanteCargo: "Responsavel pela empresa",
    };
  }

  return {
    titulo: report.titulo || defaults.titulo,
    numeroRelatorio: report.numero_relatorio || "",
    dataInspecao: report.data_inspecao || defaults.dataInspecao,
    dataEmissao: report.data_emissao || defaults.dataEmissao,
    horaInicio: report.hora_inicio || "",
    horaFim: report.hora_fim || "",
    inspetorNome: report.inspetor_nome || "",
    inspetorCargo: report.inspetor_cargo || "",
    representanteNome: report.representante_nome || company.responsavel || "",
    representanteCargo: report.representante_cargo || "Responsavel pela empresa",
    objetivo: report.objetivo || defaults.objetivo,
    escopo: report.escopo || defaults.escopo,
    observacoesGerais: report.observacoes_gerais || "",
    recomendacoes: report.recomendacoes || "",
    conclusao: report.conclusao || "",
  };
};

const CompanyReport = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [company, setCompany] = useState<Company | null>(null);
  const [report, setReport] = useState<ReportRow | null>(null);
  const [form, setForm] = useState<ReportFormState>(emptyForm());
  const [liveSnapshot, setLiveSnapshot] = useState<ChecklistSnapshot | null>(null);
  const [snapshot, setSnapshot] = useState<ChecklistSnapshot | null>(null);
  const [reportStatus, setReportStatus] = useState<ReportStatus>("rascunho");
  const [reportStorageAvailable, setReportStorageAvailable] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!id) {
        return;
      }

      try {
        setLoading(true);

        const [companyResult, reportResult, checklistData] = await Promise.all([
          supabase
            .from("empresa")
            .select("id, razao_social, nome_fantasia, cnpj, responsavel, telefone, email, rua, numero, bairro, cidade, estado, cep, divisao, grupo, ocupacao_uso, area_m2, numero_ocupantes, altura_denominacao, altura_descricao, grau_risco")
            .eq("id", id)
            .maybeSingle(),
          supabase
            .from("empresa_relatorios")
            .select("*")
            .eq("empresa_id", id)
            .maybeSingle(),
          loadChecklistData(supabase, id),
        ]);

        if (companyResult.error) {
          throw companyResult.error;
        }
        if (reportResult.error && !isMissingRelationError(reportResult.error, "empresa_relatorios")) {
          throw reportResult.error;
        }

        if (!companyResult.data) {
          throw new Error("Empresa nao encontrada");
        }

        const reportData = reportResult.error ? null : reportResult.data;
        const reportStorageEnabled = !reportResult.error;

        const computedSnapshot = buildChecklistSnapshot(
          checklistData.models,
          checklistData.groupsByModel,
          checklistData.responses,
        );
        const persistedSnapshot = isChecklistSnapshot(reportData?.checklist_snapshot)
          ? reportData.checklist_snapshot
          : null;
        const initialSnapshot = persistedSnapshot || computedSnapshot;
        const initialStatus = reportData?.status === "finalizado"
          ? "finalizado"
          : "rascunho";

        setCompany(companyResult.data);
        setReport(reportData);
        setLiveSnapshot(computedSnapshot);
        setSnapshot(initialSnapshot);
        setReportStatus(initialStatus);
        setReportStorageAvailable(reportStorageEnabled);
        setForm(buildDefaultForm(companyResult.data, reportData));
      } catch (error) {
        console.error("Error loading report page:", error);
        toast({
          title: "Erro ao carregar relatorio",
          description: "Nao foi possivel carregar os dados do relatorio.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, toast]);

  const handleInputChange = (field: keyof ReportFormState, value: string) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleSyncChecklistSnapshot = () => {
    if (!liveSnapshot) {
      return;
    }

    setSnapshot(liveSnapshot);
    toast({
      title: "Resumo sincronizado",
      description: "O relatorio agora usa o resultado mais recente do checklist.",
    });
  };

  const handleSave = async (nextStatus: ReportStatus = "rascunho") => {
    if (!id || !company || !snapshot) {
      return;
    }

    if (!reportStorageAvailable) {
      toast({
        title: "Relatorio sem persistencia",
        description: "A tabela empresa_relatorios ainda nao existe no Supabase. Aplique a migration para salvar o relatorio.",
        variant: "destructive",
      });
      return;
    }

    try {
      setSaving(true);

      const payload: Database["public"]["Tables"]["empresa_relatorios"]["Insert"] = {
        empresa_id: id,
        titulo: normalizeNullable(form.titulo) || "Relatorio de Inspecao",
        numero_relatorio: normalizeNullable(form.numeroRelatorio),
        data_inspecao: form.dataInspecao || null,
        data_emissao: form.dataEmissao || null,
        hora_inicio: form.horaInicio || null,
        hora_fim: form.horaFim || null,
        inspetor_nome: normalizeNullable(form.inspetorNome),
        inspetor_cargo: normalizeNullable(form.inspetorCargo),
        representante_nome: normalizeNullable(form.representanteNome),
        representante_cargo: normalizeNullable(form.representanteCargo),
        objetivo: normalizeNullable(form.objetivo),
        escopo: normalizeNullable(form.escopo),
        observacoes_gerais: normalizeNullable(form.observacoesGerais),
        recomendacoes: normalizeNullable(form.recomendacoes),
        conclusao: normalizeNullable(form.conclusao),
        status: nextStatus,
        checklist_snapshot: snapshot,
        dados_adicionais: {
          empresa_responsavel: company.responsavel,
          empresa_telefone: company.telefone,
          empresa_email: company.email,
        },
      };

      const { data, error } = await supabase
        .from("empresa_relatorios")
        .upsert(payload, { onConflict: "empresa_id" })
        .select("*")
        .single();

      if (error) {
        throw error;
      }

      setReport(data);
      setReportStatus(nextStatus);
      toast({
        title: "Relatorio salvo",
        description:
          nextStatus === "finalizado"
            ? "O relatorio foi salvo e marcado como finalizado."
            : "Os dados do relatorio foram atualizados com sucesso.",
      });
    } catch (error) {
      console.error("Error saving report:", error);
      toast({
        title: "Erro ao salvar relatorio",
        description: "Nao foi possivel salvar o relatorio.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!company || !snapshot) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <Card className="w-full max-w-xl">
          <CardContent className="py-12">
            <p className="text-center text-muted-foreground">
              Nao foi possivel localizar os dados da empresa para gerar o relatorio.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusMeta = getReportStatusBadge(reportStatus);
  const snapshotIsCurrent = liveSnapshot?.generated_at === snapshot.generated_at;
  const executiveSummary =
    snapshot.overall.nao_conforme > 0
      ? `Foram identificadas ${snapshot.overall.nao_conforme} nao conformidades entre ${snapshot.overall.total} itens avaliados. O relatorio deve consolidar as correcoes e a conclusao tecnica da vistoria.`
      : `Nao ha nao conformidades registradas no checklist atual. O relatorio pode ser finalizado com a conclusao tecnica e os registros formais da inspecao.`;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-4 md:py-8 px-4 space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/checklists/${id}`)}
              className="mt-1"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <FileText className="h-8 w-8 text-primary" />
                <div>
                  <h1 className="text-2xl md:text-4xl font-bold text-foreground">
                    Relatorio de Inspecao
                  </h1>
                  <p className="text-sm md:text-lg text-muted-foreground">
                    {company.razao_social}
                  </p>
                </div>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                Consolide o resultado do checklist, registre observacoes adicionais e prepare a base do PDF.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Badge variant="outline" className={statusMeta.className}>
                  {statusMeta.label}
                </Badge>
                <Badge variant="outline">
                  {report ? "Relatorio existente" : "Novo relatorio"}
                </Badge>
                <Badge variant="outline">
                  {snapshotIsCurrent ? "Checklist sincronizado" : "Checklist desatualizado"}
                </Badge>
                {!reportStorageAvailable && (
                  <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">
                    Banco sem tabela de relatorio
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={handleSyncChecklistSnapshot} disabled={!liveSnapshot || saving}>
              <RefreshCcw className="h-4 w-4 mr-2" />
              Atualizar com checklist
            </Button>
            <Button variant="outline" disabled>
              Gerar PDF em breve
            </Button>
            <Button variant="outline" onClick={() => handleSave("rascunho")} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Salvar rascunho
                </>
              )}
            </Button>
            <Button onClick={() => handleSave("finalizado")} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando
                </>
              ) : (
                <>
                  <FileCheck className="h-4 w-4 mr-2" />
                  Finalizar relatorio
                </>
              )}
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Identificacao da empresa</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground">Razao social</p>
              <p className="font-medium">{company.razao_social}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Nome fantasia</p>
              <p className="font-medium">{company.nome_fantasia || "-"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">CNPJ</p>
              <p className="font-medium">{company.cnpj}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Responsavel</p>
              <p className="font-medium">{company.responsavel}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Contato</p>
              <p className="font-medium">{company.telefone}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Endereco</p>
              <p className="font-medium">{`${company.rua}, ${company.numero} - ${company.bairro}`}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Cidade / UF</p>
              <p className="font-medium">{`${company.cidade} / ${company.estado}`}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Classificacao</p>
              <p className="font-medium">{company.divisao || company.ocupacao_uso || "-"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Area</p>
              <p className="font-medium">{company.area_m2} m²</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Altura</p>
              <p className="font-medium">{company.altura_descricao || company.altura_denominacao || "-"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Ocupantes</p>
              <p className="font-medium">{company.numero_ocupantes}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Grau de risco</p>
              <p className="font-medium">{company.grau_risco || "-"}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Dados do relatorio</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="titulo">Titulo</Label>
              <Input
                id="titulo"
                value={form.titulo}
                onChange={(event) => handleInputChange("titulo", event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="numeroRelatorio">Numero do relatorio</Label>
              <Input
                id="numeroRelatorio"
                value={form.numeroRelatorio}
                onChange={(event) => handleInputChange("numeroRelatorio", event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dataInspecao">Data da inspecao</Label>
              <Input
                id="dataInspecao"
                type="date"
                value={form.dataInspecao}
                onChange={(event) => handleInputChange("dataInspecao", event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dataEmissao">Data da emissao</Label>
              <Input
                id="dataEmissao"
                type="date"
                value={form.dataEmissao}
                onChange={(event) => handleInputChange("dataEmissao", event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="horaInicio">Hora inicio</Label>
              <Input
                id="horaInicio"
                type="time"
                value={form.horaInicio}
                onChange={(event) => handleInputChange("horaInicio", event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="horaFim">Hora fim</Label>
              <Input
                id="horaFim"
                type="time"
                value={form.horaFim}
                onChange={(event) => handleInputChange("horaFim", event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inspetorNome">Inspetor</Label>
              <Input
                id="inspetorNome"
                value={form.inspetorNome}
                onChange={(event) => handleInputChange("inspetorNome", event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inspetorCargo">Cargo do inspetor</Label>
              <Input
                id="inspetorCargo"
                value={form.inspetorCargo}
                onChange={(event) => handleInputChange("inspetorCargo", event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="representanteNome">Representante presente</Label>
              <Input
                id="representanteNome"
                value={form.representanteNome}
                onChange={(event) => handleInputChange("representanteNome", event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="representanteCargo">Funcao do representante</Label>
              <Input
                id="representanteCargo"
                value={form.representanteCargo}
                onChange={(event) => handleInputChange("representanteCargo", event.target.value)}
              />
            </div>
            <div className="space-y-2 xl:col-span-2">
              <Label htmlFor="objetivo">Objetivo</Label>
              <Textarea
                id="objetivo"
                rows={3}
                value={form.objetivo}
                onChange={(event) => handleInputChange("objetivo", event.target.value)}
              />
            </div>
            <div className="space-y-2 xl:col-span-2">
              <Label htmlFor="escopo">Escopo</Label>
              <Textarea
                id="escopo"
                rows={3}
                value={form.escopo}
                onChange={(event) => handleInputChange("escopo", event.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resumo executivo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!reportStorageAvailable && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                A pagina de relatorio esta funcional, mas a persistencia ainda depende da migration da tabela
                `empresa_relatorios` no Supabase.
              </div>
            )}
            <p className="text-sm leading-6 text-muted-foreground">
              {executiveSummary}
            </p>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border p-4">
                <p className="text-xs uppercase text-muted-foreground">Empresa</p>
                <p className="mt-1 font-medium">{company.razao_social}</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-xs uppercase text-muted-foreground">Data base do checklist</p>
                <p className="mt-1 font-medium">{new Date(snapshot.generated_at).toLocaleString("pt-BR")}</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-xs uppercase text-muted-foreground">Situacao do relatorio</p>
                <p className="mt-1 font-medium">{statusMeta.label}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Itens avaliados</p>
                  <p className="text-3xl font-bold">{snapshot.overall.total}</p>
                </div>
                <ClipboardCheck className="h-7 w-7 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Conformes</p>
                  <p className="text-3xl font-bold">{snapshot.overall.conforme}</p>
                </div>
                <CheckCircle2 className="h-7 w-7 text-emerald-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Nao conformes</p>
                  <p className="text-3xl font-bold">{snapshot.overall.nao_conforme}</p>
                </div>
                <TriangleAlert className="h-7 w-7 text-red-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Pendentes</p>
                  <p className="text-3xl font-bold">{snapshot.overall.pendentes}</p>
                </div>
                <FileText className="h-7 w-7 text-amber-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Resumo por checklist</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Checklist</TableHead>
                  <TableHead className="text-center">Total</TableHead>
                  <TableHead className="text-center">C</TableHead>
                  <TableHead className="text-center">NC</TableHead>
                  <TableHead className="text-center">NA</TableHead>
                  <TableHead className="text-center">Pendentes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {snapshot.inspections.map((inspection) => (
                  <TableRow key={inspection.inspecao_id}>
                    <TableCell>{`${inspection.codigo} - ${inspection.nome}`}</TableCell>
                    <TableCell className="text-center">{inspection.total}</TableCell>
                    <TableCell className="text-center">{inspection.conforme}</TableCell>
                    <TableCell className="text-center">{inspection.nao_conforme}</TableCell>
                    <TableCell className="text-center">{inspection.nao_aplicavel}</TableCell>
                    <TableCell className="text-center">{inspection.pendentes}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Itens nao conformes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {snapshot.non_conformities.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma nao conformidade registrada no checklist atual.
              </p>
            ) : (
              snapshot.non_conformities.map((item) => (
                <div key={item.checklist_item_id} className="rounded-lg border p-4">
                  <p className="text-xs text-muted-foreground">{item.secao || "Sem secao"}</p>
                  <p className="font-medium mt-1">{item.descricao}</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Item {item.item_exibicao} | Referencia {item.item_numero}
                  </p>
                  {item.observacoes && (
                    <p className="text-sm mt-2">{item.observacoes}</p>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Analise e conclusao</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="observacoesGerais">Observacoes gerais</Label>
              <Textarea
                id="observacoesGerais"
                rows={5}
                value={form.observacoesGerais}
                onChange={(event) => handleInputChange("observacoesGerais", event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="recomendacoes">Recomendacoes</Label>
              <Textarea
                id="recomendacoes"
                rows={5}
                value={form.recomendacoes}
                onChange={(event) => handleInputChange("recomendacoes", event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="conclusao">Conclusao</Label>
              <Textarea
                id="conclusao"
                rows={6}
                value={form.conclusao}
                onChange={(event) => handleInputChange("conclusao", event.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {report
              ? `Relatorio salvo no banco com status ${reportStatus}.`
              : "Relatorio ainda nao salvo no banco."}
          </span>
          <span>
            {snapshotIsCurrent ? "Snapshot atual do checklist" : "Snapshot salvo diferente do checklist atual"} em{" "}
            {new Date(snapshot.generated_at).toLocaleString("pt-BR")}
          </span>
        </div>
      </div>
    </div>
  );
};

export default CompanyReport;
