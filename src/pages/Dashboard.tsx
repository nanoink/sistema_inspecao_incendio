import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CompanyTable } from "@/components/company/CompanyTable";
import { Button } from "@/components/ui/button";
import { Shield, Plus } from "lucide-react";

const Dashboard = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 px-4">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Shield className="h-12 w-12 text-primary mr-3" />
              <div>
                <h1 className="text-4xl font-bold text-foreground">Dashboard de Empresas</h1>
                <p className="text-lg text-muted-foreground mt-1">
                  Gerencie todas as empresas cadastradas
                </p>
              </div>
            </div>
            <Button onClick={() => navigate("/cadastro")} size="lg">
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
