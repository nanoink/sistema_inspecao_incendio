import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CompanyTable } from "@/components/company/CompanyTable";
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
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-4 md:py-8 px-4">
        <div className="mb-6 md:mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center">
              <Shield className="h-8 w-8 md:h-12 md:w-12 text-primary mr-2 md:mr-3 flex-shrink-0" />
              <div>
                <h1 className="text-2xl md:text-4xl font-bold text-foreground">Dashboard de Empresas</h1>
                <p className="text-sm md:text-lg text-muted-foreground mt-1">
                  Gerencie todas as empresas cadastradas
                </p>
              </div>
            </div>
            <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
              {isSystemAdmin ? (
                <Button onClick={() => navigate("/cadastro")} size="lg" className="w-full md:w-auto">
                  <Plus className="mr-2 h-5 w-5" />
                  Nova Empresa
                </Button>
              ) : null}
              <Button
                onClick={() => setPasswordDialogOpen(true)}
                variant="outline"
                size="lg"
                className="w-full md:w-auto"
              >
                <KeyRound className="mr-2 h-5 w-5" />
                Alterar Senha
              </Button>
              <Button onClick={handleLogout} variant="outline" size="lg" className="w-full md:w-auto">
                <LogOut className="mr-2 h-5 w-5" />
                Sair
              </Button>
            </div>
          </div>
        </div>

        {requiresPasswordChange ? (
          <Alert className="mb-6 border-amber-500/40 bg-amber-50 text-amber-950">
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
      </div>
    </div>
  );
};

export default Dashboard;
