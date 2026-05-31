import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CompanyTable } from "@/components/company/CompanyTable";
import { FirePageHeader, FirePageShell } from "@/components/branding/FirePageShell";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Shield, Plus, LogOut, KeyRound } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { ChangePasswordDialog } from "@/components/auth/ChangePasswordDialog";

const Dashboard = () => {
  const navigate = useNavigate();
  const { signOut, isSystemAdmin, requiresPasswordChange } = useAuth();
  const { toast } = useToast();
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);

  const handleLogout = async () => {
    const { error } = await signOut();
    if (error) {
      toast({
        title: "Erro ao sair",
        description: error.message,
        variant: "destructive"
      });
    } else {
      toast({
        title: "Logout realizado",
        description: "Até logo!"
      });
      navigate('/auth');
    }
  };

  return (
    <FirePageShell>
      <FirePageHeader
        icon={Shield}
        eyebrow="portal fire 360"
        title="Dashboard de Empresas"
        description="Gerencie as empresas vinculadas, acompanhe o acesso dos usuarios e avance para exigencias, checklists e relatorios com a mesma linguagem operacional."
        actions={
          <>
            {isSystemAdmin ? (
              <Button onClick={() => navigate("/cadastro")} size="lg">
                <Plus className="mr-2 h-5 w-5" />
                Nova Empresa
              </Button>
            ) : null}
            <Button
              onClick={() => setPasswordDialogOpen(true)}
              variant="outline"
              size="lg"
            >
              <KeyRound className="mr-2 h-5 w-5" />
              Alterar Senha
            </Button>
            <Button onClick={handleLogout} variant="outline" size="lg">
              <LogOut className="mr-2 h-5 w-5" />
              Sair
            </Button>
          </>
        }
        stats={[
          { value: isSystemAdmin ? "Global" : "Empresa", label: "escopo de acesso" },
          { value: "Fire 360", label: "camada operacional" },
        ]}
      />

      {requiresPasswordChange ? (
        <Alert className="fire-app-note mb-6 border-amber-500/30 bg-amber-50/85 text-amber-950 shadow-[0_18px_44px_rgba(7,22,47,0.06)]">
            <KeyRound className="h-4 w-4" />
            <AlertTitle>Senha provisoria em uso</AlertTitle>
            <AlertDescription>
              Sua conta foi criada com uma senha provisoria. Quando quiser, use o
              botao "Alterar Senha" para definir uma senha pessoal.
            </AlertDescription>
        </Alert>
      ) : null}
      
      <CompanyTable />

      <ChangePasswordDialog
        open={passwordDialogOpen}
        onOpenChange={setPasswordDialogOpen}
      />
    </FirePageShell>
  );
};

export default Dashboard;
