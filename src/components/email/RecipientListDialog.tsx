import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ChevronLeft, ChevronRight, ListPlus, Loader2, Search } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface CompanyMetadata {
  legal_name?: string;
  trade_name?: string;
  cnpj_raw?: string;
  city?: string;
  phone_raw?: string;
  address?: string;
  economic_activity?: string;
  source_pages?: number[];
}

interface RecipientRow {
  id: string;
  email: string;
  name: string | null;
  status: string;
  consent_source: string;
  consent_at: string | null;
  metadata: Record<string, unknown> & { companies?: CompanyMetadata[]; source_pages?: number[] };
}

interface RecipientListDialogProps {
  list: { id: string; name: string } | null;
  onClose: () => void;
  onCreated: () => void | Promise<void>;
}

const PAGE_SIZE = 50;
const emailDb = supabase as unknown as SupabaseClient;

export const RecipientListDialog = ({ list, onClose, onCreated }: RecipientListDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [rows, setRows] = useState<RecipientRow[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Map<string, RecipientRow>>(new Map());
  const [newListName, setNewListName] = useState("");

  useEffect(() => {
    setSelected(new Map());
    setSearch("");
    setQuery("");
    setPage(0);
    setRows([]);
    setNewListName(list ? `${list.name.slice(0, 110)} - Teste` : "");
  }, [list]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setQuery(search.trim().replace(/[,()%]/g, " "));
      setPage(0);
    }, 250);
    return () => clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    if (!list?.id) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      let request = emailDb.from("email_recipients")
        .select("id,email,name,status,consent_source,consent_at,metadata", { count: "exact" })
        .eq("list_id", list.id).order("email").range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (query) request = request.or(`email.ilike.%${query}%,name.ilike.%${query}%`);
      const result = await request;
      if (cancelled) return;
      if (result.error) {
        setRows([]);
        setCount(0);
        toast({ title: "Erro ao carregar contatos", description: result.error.message, variant: "destructive" });
      } else {
        setRows((result.data || []) as unknown as RecipientRow[]);
        setCount(result.count || 0);
      }
      setLoading(false);
    };
    void load();
    return () => { cancelled = true; };
  }, [list?.id, page, query, toast]);

  const toggleRecipient = (row: RecipientRow, checked: boolean) => {
    setSelected((previous) => {
      const next = new Map(previous);
      if (checked) next.set(row.id, row);
      else next.delete(row.id);
      return next;
    });
  };

  const createSelectedList = async () => {
    if (!list || !selected.size || newListName.trim().length < 2) return;
    let createdId: string | null = null;
    try {
      setSaving(true);
      const created = await emailDb.from("email_recipient_lists").insert({
        name: newListName.trim(),
        description: `${selected.size} contato(s) selecionado(s) de ${list.name}.`,
        created_by: user?.id || null,
      }).select("id").single();
      if (created.error) throw created.error;
      createdId = String(created.data.id);
      const recipients = [...selected.values()].map((row) => ({
        list_id: createdId,
        email: row.email,
        name: row.name,
        consent_source: row.consent_source,
        consent_at: row.consent_at,
        metadata: { ...row.metadata, copied_from_list_id: list.id },
      }));
      for (let offset = 0; offset < recipients.length; offset += 150) {
        const result = await emailDb.from("email_recipients").insert(recipients.slice(offset, offset + 150));
        if (result.error) throw result.error;
      }
      toast({ title: "Lista de teste criada", description: `${recipients.length} contato(s) disponíveis para selecionar em uma campanha.` });
      await onCreated();
      onClose();
    } catch (error) {
      if (createdId) await emailDb.from("email_recipient_lists").delete().eq("id", createdId);
      const message = error instanceof Error ? error.message : (error as { message?: string })?.message;
      toast({ title: "Erro ao criar lista", description: message || "Não foi possível criar a lista selecionada.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={Boolean(list)} onOpenChange={(open) => { if (!open && !saving) onClose(); }}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle>{list?.name}</DialogTitle>
          <DialogDescription>Consulte os dados das empresas e selecione alguns contatos para criar uma lista de teste.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative sm:max-w-md sm:flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" aria-label="Buscar por nome ou e-mail" placeholder="Buscar por nome ou e-mail" value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{count.toLocaleString("pt-BR")} contato(s)</Badge>
            <Badge variant="secondary">{selected.size} selecionado(s)</Badge>
            <Button size="sm" variant="outline" disabled={loading} onClick={() => setSelected((previous) => {
              const next = new Map(previous);
              rows.filter((row) => row.status === "active").forEach((row) => next.set(row.id, row));
              return next;
            })}>Selecionar página</Button>
            <Button size="sm" variant="ghost" disabled={!selected.size} onClick={() => setSelected(new Map())}>Limpar seleção</Button>
          </div>
        </div>
        <div className="max-h-[48vh] overflow-auto rounded-xl border">
          <Table>
            <TableHeader><TableRow><TableHead className="w-10" /><TableHead>E-mail</TableHead><TableHead>Empresa e dados</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {loading ? <TableRow><TableCell colSpan={4} className="h-32 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></TableCell></TableRow> : rows.length === 0 ? <TableRow><TableCell colSpan={4} className="h-24 text-center text-muted-foreground">Nenhum contato encontrado.</TableCell></TableRow> : rows.map((row) => {
                const companies = row.metadata?.companies || [];
                return (
                  <TableRow key={row.id} data-state={selected.has(row.id) ? "selected" : undefined}>
                    <TableCell><Checkbox aria-label={`Selecionar ${row.email}`} checked={selected.has(row.id)} disabled={row.status !== "active" || saving} onCheckedChange={(checked) => toggleRecipient(row, checked === true)} /></TableCell>
                    <TableCell className="align-top"><div className="font-medium">{row.email}</div><div className="mt-1 text-xs text-muted-foreground">{row.name || "Contato compartilhado ou institucional"}</div><div className="mt-1 text-xs text-muted-foreground">Páginas: {row.metadata?.source_pages?.join(", ") || "—"}</div></TableCell>
                    <TableCell className="min-w-[280px] align-top">
                      {companies.length ? <details><summary className="cursor-pointer text-sm font-medium">{companies[0].legal_name}{companies.length > 1 ? ` (+${companies.length - 1})` : ""}</summary><div className="mt-2 space-y-3">{companies.map((company, index) => <div key={index} className="space-y-1 rounded-lg bg-muted/50 p-3 text-xs"><div className="font-semibold">{company.trade_name || company.legal_name}</div><div>{company.legal_name}</div><div>CNPJ: {company.cnpj_raw || "—"}</div><div>Município: {company.city || "—"}</div><div>Telefone: {company.phone_raw || "—"}</div><div>{company.address}</div><div>{company.economic_activity}</div></div>)}</div></details> : <span className="text-xs text-muted-foreground">Contato extraído do documento, sem ficha empresarial vinculada.</span>}
                    </TableCell>
                    <TableCell className="align-top"><Badge variant={row.status === "active" ? "secondary" : "outline"}>{row.status === "active" ? "Ativo" : row.status === "unsubscribed" ? "Descadastrado" : "Inválido"}</Badge></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Página {page + 1} de {Math.max(1, Math.ceil(count / PAGE_SIZE))}</span>
          <div className="flex gap-2"><Button size="sm" variant="outline" disabled={page === 0 || loading} onClick={() => setPage((value) => value - 1)}><ChevronLeft className="mr-1 h-4 w-4" />Anterior</Button><Button size="sm" variant="outline" disabled={(page + 1) * PAGE_SIZE >= count || loading} onClick={() => setPage((value) => value + 1)}>Próxima<ChevronRight className="ml-1 h-4 w-4" /></Button></div>
        </div>
        <div className="space-y-3 rounded-xl border bg-muted/30 p-4">
          <Label htmlFor="selected-list-name">Nome da lista com os contatos selecionados</Label>
          <div className="flex flex-col gap-3 sm:flex-row"><Input id="selected-list-name" maxLength={120} value={newListName} onChange={(event) => setNewListName(event.target.value)} /><Button disabled={saving || !selected.size || newListName.trim().length < 2} onClick={() => void createSelectedList()}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ListPlus className="mr-2 h-4 w-4" />}Criar lista com {selected.size} contato(s)</Button></div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
