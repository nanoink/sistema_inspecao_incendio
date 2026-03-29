import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Crown,
  Loader2,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createCompanyUser,
  formatCpf,
  loadCompanyMembers,
  normalizeCpf,
  removeCompanyMember,
  setCompanyMemberRole,
  type CompanyMemberRole,
  type CompanyMemberSummary,
} from "@/lib/company-members";

interface CompanyMembersManagerProps {
  companyId: string;
  responsavelName: string;
}

export const CompanyMembersManager = ({
  companyId,
  responsavelName,
}: CompanyMembersManagerProps) => {
  const { toast } = useToast();
  const { user, isSystemAdmin } = useAuth();
  const [members, setMembers] = useState<CompanyMemberSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [cpf, setCpf] = useState("");
  const [cargo, setCargo] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<CompanyMemberRole>("membro");

  const fetchMembers = useCallback(async () => {
    try {
      setLoading(true);
      const data = await loadCompanyMembers(supabase, companyId);
      setMembers(data);
    } catch (error) {
      console.error("Error loading company members:", error);
      toast({
        title: "Erro ao carregar usuarios",
        description: "Nao foi possivel carregar os usuarios vinculados a esta empresa.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [companyId, toast]);

  useEffect(() => {
    void fetchMembers();
  }, [fetchMembers]);

  const currentMember = useMemo(
    () => members.find((member) => member.user_id === user?.id) || null,
    [members, user?.id],
  );

  const hasGestor = members.some((member) => member.papel === "gestor");
  const canManageMembers = isSystemAdmin || currentMember?.papel === "gestor";
  const creationRole = isSystemAdmin ? role : "membro";

  useEffect(() => {
    if (isSystemAdmin) {
      setRole(hasGestor ? "membro" : "gestor");
    } else {
      setRole("membro");
    }
  }, [hasGestor, isSystemAdmin]);

  const resetCreationForm = () => {
    setName("");
    setEmail("");
    setCpf("");
    setCargo("");
    setPassword("");
    setRole(hasGestor ? "membro" : "gestor");
  };

  const handleCreateUser = async () => {
    const normalizedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedName) {
      toast({
        title: "Informe o nome",
        description: "Digite o nome do usuario que sera criado.",
        variant: "destructive",
      });
      return;
    }

    if (!normalizedEmail) {
      toast({
        title: "Informe um e-mail",
        description: "Digite o e-mail do usuario que sera criado.",
        variant: "destructive",
      });
      return;
    }

    if (normalizeCpf(cpf).length !== 11) {
      toast({
        title: "Informe um CPF valido",
        description: "Digite o CPF do usuario que sera criado.",
        variant: "destructive",
      });
      return;
    }

    if (!cargo.trim()) {
      toast({
        title: "Informe o cargo",
        description: "Digite o cargo do usuario que sera criado.",
        variant: "destructive",
      });
      return;
    }

    if (password.trim().length < 6) {
      toast({
        title: "Senha provisoria invalida",
        description: "A senha provisoria precisa ter no minimo 6 caracteres.",
        variant: "destructive",
      });
      return;
    }

    try {
      setSaving(true);
      await createCompanyUser(supabase, {
        companyId,
        nome: normalizedName,
        email: normalizedEmail,
        cpf,
        cargo,
        password: password.trim(),
        role: creationRole,
      });
      resetCreationForm();
      await fetchMembers();
      toast({
        title: "Usuario criado",
        description:
          creationRole === "gestor"
            ? "O primeiro usuario da empresa foi criado como gestor."
            : "O usuario foi criado com senha provisoria e vinculado a empresa.",
      });
    } catch (error) {
      console.error("Error creating company user:", error);
      toast({
        title: "Erro ao criar usuario",
        description:
          error instanceof Error
            ? error.message
            : "Nao foi possivel criar o usuario da empresa.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handlePromoteToGestor = async (member: CompanyMemberSummary) => {
    try {
      setSaving(true);
      await setCompanyMemberRole(supabase, {
        companyId,
        userId: member.user_id,
        role: "gestor",
      });
      await fetchMembers();
      toast({
        title: "Gestor atualizado",
        description: `${member.nome} agora e o gestor desta empresa.`,
      });
    } catch (error) {
      console.error("Error promoting company member:", error);
      toast({
        title: "Erro ao atualizar gestor",
        description:
          error instanceof Error
            ? error.message
            : "Nao foi possivel atualizar o gestor da empresa.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveMember = async (member: CompanyMemberSummary) => {
    if (!window.confirm(`Remover ${member.nome} desta empresa?`)) {
      return;
    }

    try {
      setSaving(true);
      await removeCompanyMember(supabase, {
        companyId,
        userId: member.user_id,
      });
      await fetchMembers();
      toast({
        title: "Usuario removido",
        description: `${member.nome} nao esta mais vinculado a esta empresa.`,
      });
    } catch (error) {
      console.error("Error removing company member:", error);
      toast({
        title: "Erro ao remover usuario",
        description:
          error instanceof Error
            ? error.message
            : "Nao foi possivel remover o usuario da empresa.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-4 w-4" />
          Usuarios da Empresa
        </CardTitle>
        <CardDescription>
          O gestor e quem assina como responsavel da empresa no relatorio final.
          Responsavel atual no cadastro: <strong>{responsavelName || "-"}</strong>.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!canManageMembers ? (
          <Alert>
            <Users className="h-4 w-4" />
            <AlertTitle>Acesso de consulta</AlertTitle>
            <AlertDescription>
              Apenas o administrador geral ou o gestor da empresa pode criar,
              promover ou remover usuarios desta empresa.
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="space-y-3 rounded-lg border border-border/70 bg-muted/20 p-4">
          <div>
            <h3 className="text-sm font-semibold">
              {hasGestor ? "Criar novo usuario da empresa" : "Criar primeiro usuario da empresa"}
            </h3>
            <p className="text-sm text-muted-foreground">
              {hasGestor
                ? "A conta sera criada com e-mail e senha provisoria. O usuario podera trocar a senha depois."
                : "Esse primeiro usuario sera o gestor da empresa e podera criar os demais usuarios."}
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Input
              placeholder="Nome completo"
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={saving || !canManageMembers}
            />
            <Input
              placeholder="email@empresa.com"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={saving || !canManageMembers}
            />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Input
              placeholder="CPF"
              value={formatCpf(cpf)}
              onChange={(event) => setCpf(normalizeCpf(event.target.value))}
              disabled={saving || !canManageMembers}
              inputMode="numeric"
            />
            <Input
              placeholder="Cargo"
              value={cargo}
              onChange={(event) => setCargo(event.target.value)}
              disabled={saving || !canManageMembers}
            />
          </div>

          <div className="grid gap-3 md:grid-cols-[1.2fr_0.8fr_auto]">
            <Input
              placeholder="Senha provisoria"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={saving || !canManageMembers}
            />

            {isSystemAdmin ? (
              <Select
                value={role}
                onValueChange={(value) => setRole(value as CompanyMemberRole)}
                disabled={saving || !canManageMembers || (!hasGestor && role === "gestor")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Papel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="membro">Membro</SelectItem>
                  <SelectItem value="gestor">Gestor</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <Input value="Membro" disabled className="bg-muted" />
            )}

            <Button
              type="button"
              onClick={() => void handleCreateUser()}
              disabled={saving || !canManageMembers}
            >
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="mr-2 h-4 w-4" />
              )}
              Criar
            </Button>
          </div>
        </div>

        <div className="rounded-md border">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Carregando usuarios...
            </div>
          ) : members.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Nenhum usuario vinculado a esta empresa ainda.
            </div>
          ) : (
            <div className="divide-y">
              {members.map((member) => {
                const isGestor = member.papel === "gestor";
                const canEditThisMember = canManageMembers && !isGestor;

                return (
                  <div
                    key={member.user_id}
                    className="flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-foreground">{member.nome}</span>
                        <Badge variant={isGestor ? "default" : "outline"}>
                          {isGestor ? "Gestor" : "Membro"}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{member.email}</p>
                      <p className="text-xs text-muted-foreground">
                        CPF: {formatCpf(member.cpf)} | Cargo: {member.cargo || "-"}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {canEditThisMember ? (
                        <>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => void handlePromoteToGestor(member)}
                            disabled={saving}
                          >
                            <Crown className="mr-2 h-4 w-4" />
                            Definir como gestor
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => void handleRemoveMember(member)}
                            disabled={saving}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Remover
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          O administrador geral cria as empresas e pode definir o primeiro gestor.
          Depois disso, o gestor da empresa cria os demais usuarios com senha
          provisoria.
        </p>
      </CardContent>
    </Card>
  );
};
