import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ClipboardList,
  Loader2,
  Save,
  ShieldCheck,
} from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  canCompanyMemberExecuteChecklists,
  formatCpf,
  loadCompanyMember,
  normalizeCpf,
  type CompanyMemberSummary,
  updateCompanyUser,
} from "@/lib/company-members";

type CompanySummary = Pick<Database["public"]["Tables"]["empresa"]["Row"], "id" | "razao_social">;

const EditCompanyUserPage = () => {
  const { companyId, userId } = useParams<{ companyId: string; userId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [company, setCompany] = useState<CompanySummary | null>(null);
  const [member, setMember] = useState<CompanyMemberSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [cargo, setCargo] = useState("");
  const [crea, setCrea] = useState("");
  const [isTechnicalResponsible, setIsTechnicalResponsible] = useState(false);
  const [canExecuteChecklists, setCanExecuteChecklists] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!companyId || !userId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        const [{ data: companyData, error: companyError }, memberData] = await Promise.all([
          supabase.from("empresa").select("id, razao_social").eq("id", companyId).maybeSingle(),
          loadCompanyMember(supabase, { companyId, userId }),
        ]);

        if (companyError) {
          throw companyError;
        }

        setCompany((companyData as CompanySummary | null) ?? null);
        setMember(memberData);

        if (memberData) {
          setNome(memberData.nome || "");
          setCpf(memberData.cpf || "");
          setCargo(memberData.cargo || "");
          setCrea(memberData.crea || "");
          setIsTechnicalResponsible(memberData.is_responsavel_tecnico);
          setCanExecuteChecklists(canCompanyMemberExecuteChecklists(memberData));
        }
      } catch (error) {
        console.error("Error loading company user:", error);
        toast({
          title: "Erro ao carregar usuario",
          description: "Nao foi possivel carregar os dados do usuario da empresa.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    void fetchData();
  }, [companyId, userId, toast]);

  const handleSave = async () => {
    if (!companyId || !userId || !member) {
      return;
    }

    if (!nome.trim()) {
      toast({
        title: "Informe o nome",
        description: "Digite o nome completo do usuario.",
        variant: "destructive",
      });
      return;
    }

    if (normalizeCpf(cpf).length !== 11) {
      toast({
        title: "Informe um CPF valido",
        description: "Digite um CPF valido para este usuario.",
        variant: "destructive",
      });
      return;
    }

    if (!cargo.trim()) {
      toast({
        title: "Informe o cargo",
        description: "Digite o cargo ou funcao do usuario.",
        variant: "destructive",
      });
      return;
    }

    if (isTechnicalResponsible && !crea.trim()) {
      toast({
        title: "Informe o CREA",
        description: "O CREA e obrigatorio quando o usuario for responsavel tecnico.",
        variant: "destructive",
      });
      return;
    }

    try {
      setSaving(true);
      const updatedMember = await updateCompanyUser(supabase, {
        companyId,
        userId,
        nome,
        cpf,
        cargo,
        crea,
        isTechnicalResponsible,
        canExecuteChecklists,
      });

      setMember(updatedMember);
      setNome(updatedMember.nome || "");
      setCpf(updatedMember.cpf || "");
      setCargo(updatedMember.cargo || "");
      setCrea(updatedMember.crea || "");
      setIsTechnicalResponsible(updatedMember.is_responsavel_tecnico);
      setCanExecuteChecklists(canCompanyMemberExecuteChecklists(updatedMember));

      toast({
        title: "Usuario atualizado",
        description: "As alteracoes do usuario foram salvas com sucesso.",
      });
    } catch (error) {
      console.error("Error updating company user:", error);
      toast({
        title: "Erro ao salvar usuario",
        description:
          error instanceof Error
            ? error.message
            : "Nao foi possivel salvar as alteracoes deste usuario.",
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

  if (!company || !member) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <Card className="w-full max-w-xl">
          <CardContent className="py-12 text-center">
            <p className="text-lg font-semibold">Usuario nao encontrado</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Nao foi possivel localizar o usuario solicitado nesta empresa.
            </p>
            <Button
              type="button"
              variant="outline"
              className="mt-6"
              onClick={() => navigate(`/empresas/${companyId}/editar`)}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar para empresa
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isGestor = member.papel === "gestor";

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto max-w-4xl px-4 py-6 md:py-8">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-muted-foreground">
              Edicao de usuario
            </p>
            <h1 className="text-2xl font-bold md:text-3xl">{member.nome}</h1>
            <p className="text-sm text-muted-foreground">
              Empresa: {company.razao_social}
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(`/empresas/${companyId}/usuarios/${userId}/atividades`)}
            >
              <ClipboardList className="mr-2 h-4 w-4" />
              Ver atividades
            </Button>
            <Button type="button" variant="outline" onClick={() => navigate(`/empresas/${companyId}/editar`)}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2">
              <span>Dados do Usuario</span>
              <Badge variant={isGestor ? "default" : "outline"}>
                {isGestor ? "Gestor" : "Membro"}
              </Badge>
              {member.is_responsavel_tecnico ? (
                <Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-700">
                  Responsavel tecnico
                </Badge>
              ) : null}
            </CardTitle>
            <CardDescription>
              Atualize os dados cadastrais e as permissoes deste usuario dentro da empresa.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="member-name">Nome completo *</Label>
                <Input
                  id="member-name"
                  value={nome}
                  onChange={(event) => setNome(event.target.value)}
                  placeholder="Nome completo do usuario"
                  disabled={saving}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="member-email">Email de acesso</Label>
                <Input
                  id="member-email"
                  type="email"
                  value={member.email}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  O e-mail de login permanece como referencia da conta e nao e editado nesta tela.
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="member-cpf">CPF *</Label>
                <Input
                  id="member-cpf"
                  value={cpf ? formatCpf(cpf) : ""}
                  onChange={(event) => setCpf(normalizeCpf(event.target.value))}
                  placeholder="CPF do usuario"
                  inputMode="numeric"
                  disabled={saving}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="member-cargo">Cargo ou funcao *</Label>
                <Input
                  id="member-cargo"
                  value={cargo}
                  onChange={(event) => setCargo(event.target.value)}
                  placeholder="Cargo ou funcao"
                  disabled={saving}
                />
              </div>
            </div>

            <div className="flex flex-col gap-4 rounded-lg border border-border/70 bg-muted/20 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">
                    Permissao para executar checklists
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {isGestor
                      ? "O gestor permanece sempre liberado para executar checklists."
                      : "Defina se este usuario pode abrir, preencher e salvar checklists da empresa."}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Switch
                    checked={isGestor ? true : canExecuteChecklists}
                    onCheckedChange={setCanExecuteChecklists}
                    disabled={saving || isGestor}
                    aria-label="Permitir execucao de checklists"
                  />
                  <span className="text-xs font-medium text-muted-foreground">
                    {isGestor || canExecuteChecklists ? "Liberado" : "Bloqueado"}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">
                    Definir como responsavel tecnico
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Quando ativado, este usuario passa a ser o responsavel tecnico atual da empresa.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Switch
                    checked={isTechnicalResponsible}
                    onCheckedChange={setIsTechnicalResponsible}
                    disabled={saving}
                    aria-label="Definir como responsavel tecnico"
                  />
                  <span className="text-xs font-medium text-muted-foreground">
                    {isTechnicalResponsible ? "Ativado" : "Desativado"}
                  </span>
                </div>
              </div>
            </div>

            {isTechnicalResponsible ? (
              <div className="space-y-2 rounded-lg border border-sky-100 bg-sky-50/60 p-4">
                <Label htmlFor="member-crea">Numero do CREA *</Label>
                <Input
                  id="member-crea"
                  value={crea}
                  onChange={(event) => setCrea(event.target.value)}
                  placeholder="Informe o CREA do responsavel tecnico"
                  disabled={saving}
                />
              </div>
            ) : null}

            <div className="flex flex-col justify-end gap-3 border-t pt-4 sm:flex-row">
              <Button type="button" variant="outline" onClick={() => navigate(`/empresas/${companyId}/editar`)}>
                Cancelar
              </Button>
              <Button type="button" onClick={() => void handleSave()} disabled={saving}>
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Salvar usuario
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default EditCompanyUserPage;
