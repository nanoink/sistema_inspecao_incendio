import { CompanyForm } from "@/components/company/CompanyForm";
import { Shield } from "lucide-react";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 px-4">
        <div className="mb-8 text-center">
          <div className="flex items-center justify-center mb-4">
            <Shield className="h-12 w-12 text-primary mr-3" />
            <h1 className="text-4xl font-bold text-foreground">Sistema de Cadastro de Empresas</h1>
          </div>
          <p className="text-lg text-muted-foreground">
            Cadastro conforme IT-01 e IT-02 do Corpo de Bombeiros
          </p>
        </div>
        
        <div className="max-w-5xl mx-auto">
          <CompanyForm />
        </div>
      </div>
    </div>
  );
};

export default Index;
