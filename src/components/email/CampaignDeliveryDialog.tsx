import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const PAGE_SIZE = 25;
const labels: Record<string, string> = {
  queued: "Na fila", processing: "Em processamento", sent: "Aceito pelo servidor",
  failed: "Falha", skipped: "Ignorado", uncertain: "Sem confirmação",
};
type Delivery = {
  id: string; recipient_email: string; status: string; last_error: string | null;
  sent_at: string | null; updated_at: string; provider_message_id: string | null;
  uol_archive_status?: string; uol_archive_folder?: string | null;
  uol_archived_at?: string | null; uol_archive_error?: string | null;
};

export function CampaignDeliveryDialog({ campaign, onClose }: {
  campaign: { id: string; name: string } | null; onClose: () => void;
}) {
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<Delivery[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const campaignId = campaign?.id;

  useEffect(() => { setFilter("all"); setPage(0); }, [campaignId]);
  useEffect(() => {
    if (!campaignId) return;
    let cancelled = false;
    setLoading(true);
    setRows([]);
    setError(null);
    const load = async () => {
      let query = (supabase as unknown as SupabaseClient).from("email_campaign_deliveries")
        .select("id, recipient_email, status, last_error, sent_at, updated_at, provider_message_id, uol_archive_status, uol_archive_folder, uol_archived_at, uol_archive_error", { count: "exact" })
        .eq("campaign_id", campaignId).order("created_at").order("id");
      if (filter !== "all") query = query.eq("status", filter);
      const { data, count, error: queryError } = await query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (cancelled) return;
      if (queryError) throw queryError;
      setRows(data || []);
      setTotal(count || 0);
    };
    void load().catch(() => { if (!cancelled) setError("Não foi possível consultar os resultados. Tente abrir novamente."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [campaignId, filter, page]);

  return <Dialog open={Boolean(campaign)} onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent className="max-h-[85vh] max-w-4xl overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Resultados de envio — {campaign?.name}</DialogTitle>
        <DialogDescription>
          Aceito pelo servidor não confirma entrega na caixa de entrada. Envios sem confirmação não são reenviados automaticamente.
        </DialogDescription>
      </DialogHeader>
      <Select value={filter} onValueChange={(value) => { setPage(0); setFilter(value); }}>
        <SelectTrigger aria-label="Filtrar resultados de envio"><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value="all">Todos os resultados</SelectItem>{Object.entries(labels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
      </Select>
      {loading ? <div role="status" className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /><span className="sr-only">Carregando resultados</span></div>
        : error ? <p role="alert" className="text-sm text-red-700">{error}</p>
        : <div className="space-y-3">{rows.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum resultado neste filtro.</p> : rows.map((row) => <article key={row.id} className="rounded-lg border p-3 text-sm">
          <div className="flex flex-wrap justify-between gap-2"><span className="break-all font-semibold">{row.recipient_email}</span><span>{labels[row.status] || row.status}</span></div>
          <p className="mt-1 text-xs text-muted-foreground">{new Date(row.sent_at || row.updated_at).toLocaleString("pt-BR")}</p>
          {row.last_error ? <p className="mt-2 break-words text-red-700">{row.last_error}</p> : null}
          {row.status === "sent" ? <p className="mt-1 text-xs text-muted-foreground">
            {row.uol_archive_status === "saved" ? `Cópia salva no UOL: ${row.uol_archive_folder || "Enviados"}`
              : row.uol_archive_status === "error" ? `Cópia UOL pendente de nova tentativa: ${row.uol_archive_error || "falha de arquivamento"}`
              : row.uol_archive_status === "pending" ? "Cópia UOL aguardando arquivamento. O e-mail não será reenviado."
              : "Sem cópia UOL registrada: envio antigo ou arquivamento desativado."}
          </p> : null}
          <p className="mt-1 break-all text-xs text-muted-foreground">Registro: {row.id}{row.provider_message_id ? ` | Message-ID: ${row.provider_message_id}` : ""}</p>
        </article>)}</div>}
      <div className="flex items-center justify-between gap-2 text-sm">
        <Button variant="outline" disabled={loading || page === 0} onClick={() => setPage((current) => current - 1)}>Anterior</Button>
        <span>{total} resultado(s) · Página {page + 1} de {Math.max(1, Math.ceil(total / PAGE_SIZE))}</span>
        <Button variant="outline" disabled={loading || (page + 1) * PAGE_SIZE >= total} onClick={() => setPage((current) => current + 1)}>Próxima</Button>
      </div>
    </DialogContent>
  </Dialog>;
}
