import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CompanyTable } from "@/components/company/CompanyTable";
import { Button } from "@/components/ui/button";
import { Shield, Plus } from "lucide-react";

const Dashboard = () => {
  const navigate = useNavigate();

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
            <Button onClick={() => navigate("/cadastro")} size="lg" className="w-full md:w-auto">
              <Plus className="mr-2 h-5 w-5" />
              Nova Empresa
            </Button>
          </div>
        </div>
        
        <CompanyTable />
      </div>
    </div>
  );
};

export default Dashboard;
