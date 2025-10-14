import { CompanyForm } from "@/components/company/CompanyForm";
import { Shield } from "lucide-react";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-4 md:py-8 px-4">
        <div className="mb-6 md:mb-8 text-center">
          <div className="flex flex-col items-center justify-center mb-4">
            <Shield className="h-8 w-8 md:h-12 md:w-12 text-primary mb-2 md:mb-0 md:mr-3" />
            <h1 className="text-2xl md:text-4xl font-bold text-foreground">Sistema de Cadastro de Empresas</h1>
          </div>
          <p className="text-sm md:text-lg text-muted-foreground">
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
