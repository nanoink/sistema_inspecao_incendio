import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Pencil, Trash2, Loader2, ClipboardCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { EditCompanyDialog } from "./EditCompanyDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Company {
  id: string;
  razao_social: string;
  nome_fantasia: string | null;
  cnpj: string;
  responsavel: string;
  telefone: string;
  email: string;
  area_m2: number;
  numero_ocupantes: number;
  grau_risco: string | null;
}

export const CompanyTable = () => {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchCompanies = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("empresa")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setCompanies(data || []);
    } catch (error) {
      toast({
        title: "Erro ao carregar empresas",
        description: "Não foi possível carregar a lista de empresas.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from("empresa").delete().eq("id", id);

      if (error) throw error;

      toast({
        title: "Empresa excluída",
        description: "A empresa foi excluída com sucesso.",
      });

      fetchCompanies();
    } catch (error) {
      toast({
        title: "Erro ao excluir empresa",
        description: "Não foi possível excluir a empresa.",
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  };

  useEffect(() => {
    fetchCompanies();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (companies.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <p className="text-center text-muted-foreground">
            Nenhuma empresa cadastrada ainda.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg md:text-xl">Empresas Cadastradas ({companies.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0 md:p-6">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Razão Social</TableHead>
                  <TableHead className="whitespace-nowrap">Nome Fantasia</TableHead>
                  <TableHead className="whitespace-nowrap">CNPJ</TableHead>
                  <TableHead className="whitespace-nowrap hidden md:table-cell">Responsável</TableHead>
                  <TableHead className="whitespace-nowrap hidden lg:table-cell">Telefone</TableHead>
                  <TableHead className="whitespace-nowrap hidden lg:table-cell">Grau de Risco</TableHead>
                  <TableHead className="text-right whitespace-nowrap sticky right-0 bg-background">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {companies.map((company) => (
                  <TableRow key={company.id}>
                    <TableCell className="font-medium whitespace-nowrap">{company.razao_social}</TableCell>
                    <TableCell className="whitespace-nowrap">{company.nome_fantasia || "-"}</TableCell>
                    <TableCell className="whitespace-nowrap">{company.cnpj}</TableCell>
                    <TableCell className="whitespace-nowrap hidden md:table-cell">{company.responsavel}</TableCell>
                    <TableCell className="whitespace-nowrap hidden lg:table-cell">{company.telefone}</TableCell>
                    <TableCell className="whitespace-nowrap hidden lg:table-cell">{company.grau_risco || "-"}</TableCell>
                    <TableCell className="text-right sticky right-0 bg-background">
                      <div className="flex justify-end gap-1 md:gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/exigencias/${company.id}`)}
                          title="Exigências de Segurança"
                        >
                          <ClipboardCheck className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingCompany(company)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setDeletingId(company.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <EditCompanyDialog
        company={editingCompany}
        open={!!editingCompany}
        onOpenChange={(open) => !open && setEditingCompany(null)}
        onSuccess={() => {
          setEditingCompany(null);
          fetchCompanies();
        }}
      />

      <AlertDialog open={!!deletingId} onOpenChange={() => setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta empresa? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deletingId && handleDelete(deletingId)}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
