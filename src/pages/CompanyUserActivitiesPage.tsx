import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Pencil, Loader2, History, ShieldCheck } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  canCompanyMemberExecuteChecklists,
  loadCompanyMember,
  loadCompanyMemberActivityHistory,
  type CompanyMemberActivityRecord,
  type CompanyMemberSummary,
} from "@/lib/company-members";

type CompanySummary = Pick<Database["public"]["Tables"]["empresa"]["Row"], "id" | "razao_social">;

const formatDateTime = (value: string | null) => {
  if (!value) {
    return "-";
  }

  try {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
};

const formatContextLabel = (activity: CompanyMemberActivityRecord) => {
  if (activity.context_type === "principal") {
    return "Checklist principal";
  }

  const equipmentTypeMap: Record<string, string> = {
    extintor: "Extintor",
    hidrante: "Hidrante",
    luminaria: "Luminaria",
  };

  const equipmentLabel = activity.equipment_type
    ? equipmentTypeMap[activity.equipment_type] || activity.equipment_type
    : "Equipamento";

  return `${equipmentLabel} ${activity.source_label ? `• ${activity.source_label}` : ""}`.trim();
};

const CompanyUserActivitiesPage = () => {
  const { companyId, userId } = useParams<{ companyId: string; userId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [company, setCompany] = useState<CompanySummary | null>(null);
  const [member, setMember] = useState<CompanyMemberSummary | null>(null);
  const [activities, setActivities] = useState<CompanyMemberActivityRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!companyId || !userId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        const [{ data: companyData, error: companyError }, memberData, activityData] =
          await Promise.all([
            supabase.from("empresa").select("id, razao_social").eq("id", companyId).maybeSingle(),
            loadCompanyMember(supabase, { companyId, userId }),
            loadCompanyMemberActivityHistory(supabase, { companyId, userId }),
          ]);

        if (companyError) {
          throw companyError;
        }

        setCompany((companyData as CompanySummary | null) ?? null);
        setMember(memberData);
        setActivities(activityData);
      } catch (error) {
        console.error("Error loading company user activities:", error);
        toast({
          title: "Erro ao carregar atividades",
          description: "Nao foi possivel carregar os registros de atividades deste usuario.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    void fetchData();
  }, [companyId, userId, toast]);

  const totals = useMemo(
    () => ({
      records: activities.length,
      saves: activities.reduce((sum, item) => sum + (item.total_saves || 0), 0),
    }),
    [activities],
  );

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
              Nao foi possivel localizar o usuario ou o historico solicitado.
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

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto max-w-5xl px-4 py-6 md:py-8">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-muted-foreground">
              Registros de atividades
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
              onClick={() => navigate(`/empresas/${companyId}/usuarios/${userId}/editar`)}
            >
              <Pencil className="mr-2 h-4 w-4" />
              Editar usuario
            </Button>
            <Button type="button" variant="outline" onClick={() => navigate(`/empresas/${companyId}/editar`)}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
          <Card>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2">
                <span>Resumo do usuario</span>
                <Badge variant={member.papel === "gestor" ? "default" : "outline"}>
                  {member.papel === "gestor" ? "Gestor" : "Membro"}
                </Badge>
                {member.is_responsavel_tecnico ? (
                  <Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-700">
                    Responsavel tecnico
                  </Badge>
                ) : null}
                {canCompanyMemberExecuteChecklists(member) ? (
                  <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                    Checklist liberado
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
                    Checklist bloqueado
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                Historico individual dos checklists salvos por este usuario.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                  E-mail
                </p>
                <p className="mt-2 text-sm font-medium">{member.email}</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                  Cargo
                </p>
                <p className="mt-2 text-sm font-medium">{member.cargo || "-"}</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                  CPF
                </p>
                <p className="mt-2 text-sm font-medium">{member.cpf || "-"}</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                  CREA
                </p>
                <p className="mt-2 text-sm font-medium">{member.crea || "-"}</p>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Registros</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold text-foreground">{totals.records}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Total de salvamentos</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold text-foreground">{totals.saves}</p>
              </CardContent>
            </Card>
          </div>
        </div>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-4 w-4" />
              Linha do tempo dos checklists
            </CardTitle>
            <CardDescription>
              Cada registro abaixo representa um checklist salvo por este usuario.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {activities.length === 0 ? (
              <div className="rounded-lg border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">
                Este usuario ainda nao possui registros de atividades em checklists.
              </div>
            ) : (
              <div className="space-y-4">
                {activities.map((activity) => (
                  <div
                    key={activity.id}
                    className="rounded-xl border border-border/80 bg-card p-4 shadow-sm"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-foreground">
                            {activity.inspection_name}
                          </span>
                          <Badge variant="outline">{activity.inspection_code}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {formatContextLabel(activity)}
                        </p>
                      </div>

                      <Badge variant="outline" className="w-fit border-zinc-200 bg-zinc-50 text-zinc-700">
                        {activity.total_saves} salvamento(s)
                      </Badge>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      <div className="rounded-md border bg-background px-3 py-2">
                        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                          Primeira atividade
                        </p>
                        <p className="mt-1 text-sm font-medium">
                          {formatDateTime(activity.first_activity_at)}
                        </p>
                      </div>
                      <div className="rounded-md border bg-background px-3 py-2">
                        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                          Ultima atividade
                        </p>
                        <p className="mt-1 text-sm font-medium">
                          {formatDateTime(activity.last_activity_at)}
                        </p>
                      </div>
                      <div className="rounded-md border bg-background px-3 py-2">
                        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                          Chave de contexto
                        </p>
                        <p className="mt-1 text-sm font-medium break-all">
                          {activity.context_key}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CompanyUserActivitiesPage;
