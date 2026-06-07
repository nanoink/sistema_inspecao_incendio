import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Building2, Loader2, Save, Search, ShieldCheck, Users } from "lucide-react";

import { FirePageHeader, FirePageShell } from "@/components/branding/FirePageShell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

type CompanyRow = Pick<
  Database["public"]["Tables"]["empresa"]["Row"],
  "id" | "razao_social" | "nome_fantasia" | "cnpj" | "cidade" | "estado"
>;

type ManagerAssignmentRow =
  Database["public"]["Functions"]["list_gestor_empresa_vinculos"]["Returns"][number];

interface AssignedCompany {
  empresa_id: string;
  razao_social: string;
  nome_fantasia: string | null;
  cnpj: string;
  cidade: string | null;
  estado: string | null;
}

interface ManagerAssignment
  extends Omit<ManagerAssignmentRow, "empresas"> {
  empresas: AssignedCompany[];
}

const isRecord = (value: Json): value is Record<string, Json> =>
  !!value && typeof value === "object" && !Array.isArray(value);

const parseAssignedCompanies = (value: Json): AssignedCompany[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (!isRecord(entry)) {
        return null;
      }

      const empresaId = typeof entry.empresa_id === "string" ? entry.empresa_id : "";
      const razaoSocial =
        typeof entry.razao_social === "string" ? entry.razao_social : "";
      const cnpj = typeof entry.cnpj === "string" ? entry.cnpj : "";

      if (!empresaId || !razaoSocial) {
        return null;
      }

      return {
        empresa_id: empresaId,
        razao_social: razaoSocial,
        nome_fantasia:
          typeof entry.nome_fantasia === "string" ? entry.nome_fantasia : null,
        cnpj,
        cidade: typeof entry.cidade === "string" ? entry.cidade : null,
        estado: typeof entry.estado === "string" ? entry.estado : null,
      };
    })
    .filter((entry): entry is AssignedCompany => Boolean(entry));
};

const normalizeSearch = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const ManagerAssignmentsPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isSystemAdmin, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [managers, setManagers] = useState<ManagerAssignment[]>([]);
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [search, setSearch] = useState("");
  const [companySearch, setCompanySearch] = useState("");
  const [selectedManager, setSelectedManager] = useState<ManagerAssignment | null>(null);
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<Set<string>>(new Set());

  const loadData = useCallback(async () => {
    if (authLoading) {
      return;
    }

    if (!isSystemAdmin) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const [managersResult, companiesResult] = await Promise.all([
        supabase.rpc("list_gestor_empresa_vinculos", {}),
        supabase
          .from("empresa")
          .select("id, razao_social, nome_fantasia, cnpj, cidade, estado")
          .order("razao_social", { ascending: true }),
      ]);

      if (managersResult.error) {
        throw managersResult.error;
      }

      if (companiesResult.error) {
        throw companiesResult.error;
      }

      setManagers(
        (managersResult.data || []).map((manager) => ({
          ...manager,
          empresas: parseAssignedCompanies(manager.empresas),
        })),
      );
      setCompanies((companiesResult.data || []) as CompanyRow[]);
    } catch (error) {
      console.error("Error loading manager assignments:", error);
      toast({
        title: "Erro ao carregar gestores",
        description:
          error instanceof Error
            ? error.message
            : "Nao foi possivel carregar os vinculos de gestores.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [authLoading, isSystemAdmin, toast]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const companyManagerById = useMemo(() => {
    const lookup = new Map<string, ManagerAssignment>();

    managers.forEach((manager) => {
      manager.empresas.forEach((company) => {
        lookup.set(company.empresa_id, manager);
      });
    });

    return lookup;
  }, [managers]);

  const filteredManagers = useMemo(() => {
    const normalizedSearch = normalizeSearch(search);

    if (!normalizedSearch) {
      return managers;
    }

    return managers.filter((manager) => {
      const searchableText = normalizeSearch(
        [
          manager.nome,
          manager.email,
          manager.cargo || "",
          manager.empresas.map((company) => company.razao_social).join(" "),
        ].join(" "),
      );

      return searchableText.includes(normalizedSearch);
    });
  }, [managers, search]);

  const filteredCompanies = useMemo(() => {
    const normalizedSearch = normalizeSearch(companySearch);

    if (!normalizedSearch) {
      return companies;
    }

    return companies.filter((company) =>
      normalizeSearch(
        [
          company.razao_social,
          company.nome_fantasia || "",
          company.cnpj,
          company.cidade || "",
          company.estado || "",
        ].join(" "),
      ).includes(normalizedSearch),
    );
  }, [companies, companySearch]);

  const unmanagedCompaniesCount = useMemo(
    () => companies.filter((company) => !companyManagerById.has(company.id)).length,
    [companies, companyManagerById],
  );

  const openAssignmentDialog = (manager: ManagerAssignment) => {
    setSelectedManager(manager);
    setSelectedCompanyIds(new Set(manager.empresas.map((company) => company.empresa_id)));
    setCompanySearch("");
  };

  const toggleCompany = (companyId: string, checked: boolean) => {
    setSelectedCompanyIds((current) => {
      const next = new Set(current);

      if (checked) {
        next.add(companyId);
      } else {
        next.delete(companyId);
      }

      return next;
    });
  };

  const handleSaveAssignments = async () => {
    if (!selectedManager) {
      return;
    }

    try {
      setSaving(true);
      const { error } = await supabase.rpc("set_gestor_empresas", {
        p_user_id: selectedManager.user_id,
        p_empresa_ids: Array.from(selectedCompanyIds),
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Vinculos atualizados",
        description: `${selectedManager.nome} agora possui ${selectedCompanyIds.size} empresa(s) vinculada(s).`,
      });
      setSelectedManager(null);
      await loadData();
    } catch (error) {
      console.error("Error saving manager assignments:", error);
      toast({
        title: "Erro ao salvar vinculos",
        description:
          error instanceof Error
            ? error.message
            : "Nao foi possivel atualizar as empresas do gestor.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) {
    return (
      <FirePageShell containerClassName="flex min-h-screen items-center justify-center">
        <div className="fire-app-surface flex items-center gap-3 px-6 py-4 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          Carregando gestores e unidades...
        </div>
      </FirePageShell>
    );
  }

  if (!isSystemAdmin) {
    return (
      <FirePageShell>
        <FirePageHeader
          icon={ShieldCheck}
          eyebrow="acesso administrativo"
          title="Gestores e Unidades"
          description="Esta area e exclusiva do administrador geral do sistema."
          actions={
            <Button variant="outline" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
          }
        />
        <Alert className="fire-app-note border-amber-500/30 bg-amber-50/85 text-amber-950">
          <ShieldCheck className="h-4 w-4" />
          <AlertTitle>Acesso restrito</AlertTitle>
          <AlertDescription>
            Apenas o administrador geral pode vincular gestores a multiplas empresas.
          </AlertDescription>
        </Alert>
      </FirePageShell>
    );
  }

  return (
    <FirePageShell>
      <FirePageHeader
        icon={Users}
        eyebrow="multiempresa"
        title="Gestores e Unidades"
        description="Defina quais empresas cada gestor administra. O gestor enxergara essas empresas na lista principal e continuara operando normalmente dentro de cada unidade."
        actions={
          <Button variant="outline" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar ao dashboard
          </Button>
        }
        stats={[
          { value: String(managers.length), label: "gestores ativos" },
          { value: String(companies.length), label: "empresas cadastradas" },
          { value: String(unmanagedCompaniesCount), label: "sem gestor" },
        ]}
      />

      <div className="mb-6 grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar gestor por nome, e-mail, cargo ou empresa..."
            className="pl-9"
          />
        </div>
        <Button onClick={() => void loadData()} variant="outline">
          Atualizar lista
        </Button>
      </div>

      {managers.length === 0 ? (
        <Card className="fire-app-surface">
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhum gestor encontrado. Crie o primeiro usuario gestor dentro de uma
            empresa para ele aparecer nesta lista.
          </CardContent>
        </Card>
      ) : filteredManagers.length === 0 ? (
        <Card className="fire-app-surface">
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhum gestor encontrado para a busca informada.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {filteredManagers.map((manager) => (
            <Card key={manager.user_id} className="fire-app-surface">
              <CardHeader className="gap-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <CardTitle className="text-xl">{manager.nome}</CardTitle>
                    <CardDescription>{manager.email}</CardDescription>
                  </div>
                  <Badge className="w-fit">
                    {manager.total_empresas} empresa(s)
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  {manager.cargo ? <span>Cargo: {manager.cargo}</span> : null}
                  {manager.cpf ? <span>CPF: {manager.cpf}</span> : null}
                  {manager.crea ? <span>CREA: {manager.crea}</span> : null}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="min-h-16 rounded-2xl border border-border/70 bg-muted/20 p-3">
                  {manager.empresas.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {manager.empresas.map((company) => (
                        <Badge
                          key={company.empresa_id}
                          variant="outline"
                          className="border-primary/20 bg-primary/5 text-foreground"
                        >
                          {company.razao_social}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Gestor sem empresas vinculadas.
                    </p>
                  )}
                </div>

                <Button
                  type="button"
                  className="w-full"
                  onClick={() => openAssignmentDialog(manager)}
                >
                  <Building2 className="mr-2 h-4 w-4" />
                  Gerenciar empresas deste gestor
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog
        open={!!selectedManager}
        onOpenChange={(open) => {
          if (!open && !saving) {
            setSelectedManager(null);
          }
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Empresas do gestor</DialogTitle>
            <DialogDescription>
              {selectedManager
                ? `Marque as unidades que ${selectedManager.nome} deve administrar.`
                : "Marque as unidades do gestor selecionado."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold text-foreground">
                    {selectedManager?.nome}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {selectedManager?.email}
                  </p>
                </div>
                <Badge variant="outline">
                  {selectedCompanyIds.size} selecionada(s)
                </Badge>
              </div>
            </div>

            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={companySearch}
                onChange={(event) => setCompanySearch(event.target.value)}
                placeholder="Buscar empresa por razao social, CNPJ ou cidade..."
                className="pl-9"
              />
            </div>

            <ScrollArea className="h-[23rem] rounded-2xl border border-border/70">
              <div className="divide-y">
                {filteredCompanies.map((company) => {
                  const checked = selectedCompanyIds.has(company.id);
                  const currentManager = companyManagerById.get(company.id);
                  const isAssignedToOtherManager =
                    !!currentManager && currentManager.user_id !== selectedManager?.user_id;

                  return (
                    <label
                      key={company.id}
                      className="flex cursor-pointer gap-3 px-4 py-3 transition hover:bg-muted/40"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(value) => toggleCompany(company.id, value === true)}
                        disabled={saving}
                        className="mt-1"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-foreground">
                            {company.razao_social}
                          </p>
                          {isAssignedToOtherManager ? (
                            <Badge
                              variant="outline"
                              className="border-amber-200 bg-amber-50 text-amber-700"
                            >
                              Hoje: {currentManager.nome}
                            </Badge>
                          ) : checked ? (
                            <Badge
                              variant="outline"
                              className="border-emerald-200 bg-emerald-50 text-emerald-700"
                            >
                              Vinculada
                            </Badge>
                          ) : (
                            <Badge variant="outline">Sem este gestor</Badge>
                          )}
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {company.nome_fantasia || company.cnpj}
                          {company.cidade || company.estado
                            ? ` | ${[company.cidade, company.estado].filter(Boolean).join(" - ")}`
                            : ""}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </ScrollArea>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setSelectedManager(null)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => void handleSaveAssignments()}
              disabled={saving || !selectedManager}
            >
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Salvar vinculos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </FirePageShell>
  );
};

export default ManagerAssignmentsPage;
