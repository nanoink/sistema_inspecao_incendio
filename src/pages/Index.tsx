import { CompanyForm } from "@/components/company/CompanyForm";
import { FirePageHeader, FirePageShell } from "@/components/branding/FirePageShell";
import { Shield, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";

const Index = () => {
  const navigate = useNavigate();
  const { isSystemAdmin } = useAuth();

  return (
    <FirePageShell>
      <FirePageHeader
        icon={Shield}
        eyebrow="cadastro estrategico"
        title="Cadastro de Empresas"
        description="Abra novas operacoes na base Fire 360 com dados institucionais, classificacao tecnica e configuracao inicial de acesso."
        actions={
          <Button variant="outline" size="lg" onClick={() => navigate(-1)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
        }
        stats={[
          { value: "IT-01", label: "referencia normativa" },
          { value: "IT-02", label: "classificacao base" },
        ]}
      />
      
      <div className="mx-auto max-w-5xl">
        {isSystemAdmin ? (
          <CompanyForm />
        ) : (
          <Card className="fire-app-surface">
            <CardContent className="py-12 text-center text-muted-foreground">
              Apenas o administrador geral do sistema pode cadastrar novas empresas.
            </CardContent>
          </Card>
        )}
      </div>
    </FirePageShell>
  );
};

export default Index;
