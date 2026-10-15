import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  AlertCircle,
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  CirclePause,
  CirclePlay,
  Code2,
  Eye,
  FilePlus2,
  ListPlus,
  Loader2,
  Mail,
  Monitor,
  RefreshCw,
  Send,
  Smartphone,
  Square,
  Users,
} from "lucide-react";

import { FirePageHeader, FirePageShell } from "@/components/branding/FirePageShell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

type CampaignStatus =
  | "draft"
  | "scheduled"
  | "running"
  | "paused"
  | "completed"
  | "cancelled"
  | "blocked";

interface RecipientListRow {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  email_recipients?: Array<{ count: number }>;
}

interface CampaignRow {
  id: string;
  name: string;
  subject: string;
  preview_text: string | null;
  html_body: string;
  sender_name: string;
  reply_to: string | null;
  recipient_list_id: string;
  status: CampaignStatus;
  batch_size: number;
  interval_minutes: number;
  scheduled_at: string | null;
  next_batch_at: string | null;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  skipped_count: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
  email_recipient_lists?: { name: string } | null;
}

interface ProviderStatus {
  configured: boolean;
  provider: string;
  from_address?: string | null;
  from_address_configured: boolean;
  public_app_url_configured: boolean;
}

interface ParsedRecipient {
  email: string;
  name: string | null;
}

interface CampaignFormState {
  name: string;
  subject: string;
  previewText: string;
  senderName: string;
  replyTo: string;
  listId: string;
  batchSize: string;
  intervalMinutes: string;
  scheduledAt: string;
  htmlBody: string;
}

const defaultHtml = `<style>
  body { margin: 0; padding: 0; background: #f3f6fa; font-family: Arial, sans-serif; color: #172033; }
  .email-shell { width: 100%; padding: 32px 12px; box-sizing: border-box; }
  .email-card { max-width: 640px; margin: 0 auto; background: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 18px 50px rgba(7, 22, 47, 0.12); }
  .email-header { padding: 30px; background: linear-gradient(135deg, #07162f, #0d2c54); color: #ffffff; }
  .email-content { padding: 34px 30px; font-size: 16px; line-height: 1.7; }
  .email-button { display: inline-block; margin-top: 18px; padding: 13px 22px; border-radius: 12px; background: #ff5b1f; color: #ffffff !important; text-decoration: none; font-weight: 700; }
  .email-footer { padding: 22px 30px; background: #f8fafc; color: #667085; font-size: 12px; line-height: 1.6; text-align: center; }
</style>
<div class="email-shell">
  <div class="email-card">
    <div class="email-header">
      <div style="font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#73e7ff;font-weight:700;">Fire Tetraedro</div>
      <h1 style="margin:12px 0 0;font-size:30px;line-height:1.15;">Segurança contra incêndio com visão 360°</h1>
    </div>
    <div class="email-content">
      <p>Olá, {{nome}}.</p>
      <p>Escreva aqui a mensagem principal da campanha. Você pode usar HTML e CSS para personalizar o conteúdo.</p>
      <a class="email-button" href="https://firetetraedro.com.br">Conheça nossas soluções</a>
    </div>
    <div class="email-footer">
      Fire Tetraedro · Comunicação institucional<br>
      <a href="{{unsubscribe_url}}" style="color:#667085;">Não quero mais receber estes e-mails</a>
    </div>
  </div>
</div>`;

const getDefaultScheduledAt = () => {
  const date = new Date(Date.now() + 5 * 60 * 1000);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

const emptyCampaignForm = (): CampaignFormState => ({
  name: "",
  subject: "",
  previewText: "",
  senderName: "Fire Tetraedro",
  replyTo: "comercial@firetetraedro.com.br",
  listId: "",
  batchSize: "10",
  intervalMinutes: "10",
  scheduledAt: getDefaultScheduledAt(),
  htmlBody: defaultHtml,
});

const statusMeta: Record<CampaignStatus, { label: string; className: string }> = {
  draft: { label: "Rascunho", className: "border-slate-300 bg-slate-100 text-slate-700" },
  scheduled: { label: "Programada", className: "border-blue-200 bg-blue-50 text-blue-700" },
  running: { label: "Em envio", className: "border-cyan-200 bg-cyan-50 text-cyan-700" },
  paused: { label: "Pausada", className: "border-amber-200 bg-amber-50 text-amber-700" },
  completed: { label: "Concluída", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  cancelled: { label: "Cancelada", className: "border-slate-300 bg-slate-100 text-slate-600" },
  blocked: { label: "Bloqueada", className: "border-red-200 bg-red-50 text-red-700" },
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const parseRecipients = (value: string) => {
  const recipients = new Map<string, ParsedRecipient>();
  const invalidLines: string[] = [];

  value
    .split(/[\n;]+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const bracketMatch = line.match(/^\s*(.*?)\s*<([^<>\s]+@[^<>\s]+)>\s*$/);
      const parts = line.split(/[\t,]+/).map((part) => part.trim()).filter(Boolean);
      const emailPart = bracketMatch?.[2] || parts.find((part) => emailPattern.test(part));
      const email = (emailPart || "").trim().toLowerCase();

      if (!emailPattern.test(email)) {
        invalidLines.push(line);
        return;
      }

      const rawName = bracketMatch?.[1] || parts.find((part) => part !== emailPart) || "";
      const name = rawName.replace(/^['"]|['"]$/g, "").trim() || null;
      recipients.set(email, { email, name });
    });

  return { recipients: Array.from(recipients.values()), invalidLines };
};

const formatDateTime = (value?: string | null) => {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString("pt-BR");
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const renderPreview = (html: string, subject: string, previewText: string) => {
  const unsubscribeUrl = `${window.location.origin}/email/descadastrar/00000000-0000-4000-8000-000000000000`;
  const replacements: Record<string, string> = {
    "{{nome}}": "Maria",
    "{{email}}": "maria@exemplo.com.br",
    "{{assunto}}": escapeHtml(subject || "Assunto da campanha"),
    "{{unsubscribe_url}}": unsubscribeUrl,
  };
  let rendered = html;

  Object.entries(replacements).forEach(([token, replacement]) => {
    rendered = rendered.split(token).join(replacement);
  });

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(
    previewText,
  )}</div>${rendered}</body></html>`;
};

const BulkEmailAdminPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const emailDb = supabase as unknown as SupabaseClient;
  const [activeTab, setActiveTab] = useState("campaigns");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [processingNow, setProcessingNow] = useState(false);
  const [testingSmtp, setTestingSmtp] = useState(false);
  const [schemaUnavailable, setSchemaUnavailable] = useState(false);
  const [lists, setLists] = useState<RecipientListRow[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [providerStatus, setProviderStatus] = useState<ProviderStatus | null>(null);
  const [campaignForm, setCampaignForm] = useState<CampaignFormState>(emptyCampaignForm);
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null);
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const [listName, setListName] = useState("");
  const [listDescription, setListDescription] = useState("");
  const [recipientInput, setRecipientInput] = useState("");
  const parsedRecipients = useMemo(() => parseRecipients(recipientInput), [recipientInput]);
  const previewHtml = useMemo(
    () => renderPreview(campaignForm.htmlBody, campaignForm.subject, campaignForm.previewText),
    [campaignForm.htmlBody, campaignForm.previewText, campaignForm.subject],
  );

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [listsResult, campaignsResult] = await Promise.all([
        emailDb
          .from("email_recipient_lists")
          .select("id, name, description, created_at, email_recipients(count)")
          .order("created_at", { ascending: false }),
        emailDb
          .from("email_campaigns")
          .select("*, email_recipient_lists(name)")
          .order("created_at", { ascending: false }),
      ]);

      if (listsResult.error || campaignsResult.error) {
        const error = listsResult.error || campaignsResult.error;
        if (error?.code === "42P01" || error?.code === "PGRST205") {
          setSchemaUnavailable(true);
          setLists([]);
          setCampaigns([]);
          return;
        }
        throw error;
      }

      setSchemaUnavailable(false);
      setLists((listsResult.data || []) as unknown as RecipientListRow[]);
      setCampaigns((campaignsResult.data || []) as unknown as CampaignRow[]);
    } catch (error) {
      console.error("Error loading email administration:", error);
      toast({
        title: "Erro ao carregar campanhas",
        description: "Nao foi possivel carregar o modulo de envios em massa.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [emailDb, toast]);

  const loadProviderStatus = useCallback(async () => {
    const { data, error } = await supabase.functions.invoke("process-email-campaigns", {
      body: { action: "status" },
    });

    if (!error && data && typeof data === "object") {
      setProviderStatus(data as ProviderStatus);
    }
  }, []);

  useEffect(() => {
    void loadData();
    void loadProviderStatus();
  }, [loadData, loadProviderStatus]);

  const updateCampaignField = <Key extends keyof CampaignFormState>(
    field: Key,
    value: CampaignFormState[Key],
  ) => {
    setCampaignForm((current) => ({ ...current, [field]: value }));
  };

  const validateCampaign = () => {
    const batchSize = Number(campaignForm.batchSize);
    const intervalMinutes = Number(campaignForm.intervalMinutes);

    if (!campaignForm.name.trim() || !campaignForm.subject.trim()) {
      return "Informe o nome interno e o assunto da campanha.";
    }
    if (!campaignForm.listId) {
      return "Selecione uma lista de destinatarios.";
    }
    if (!campaignForm.htmlBody.trim()) {
      return "Informe o corpo HTML do e-mail.";
    }
    if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 50) {
      return "O lote deve ter entre 1 e 50 e-mails.";
    }
    if (!Number.isInteger(intervalMinutes) || intervalMinutes < 1 || intervalMinutes > 1440) {
      return "O intervalo deve ter entre 1 e 1440 minutos.";
    }
    return null;
  };

  const persistCampaign = async () => {
    const validationError = validateCampaign();
    if (validationError) {
      throw new Error(validationError);
    }

    const payload = {
      name: campaignForm.name.trim(),
      subject: campaignForm.subject.trim(),
      preview_text: campaignForm.previewText.trim() || null,
      html_body: campaignForm.htmlBody,
      sender_name: campaignForm.senderName.trim() || "Fire Tetraedro",
      reply_to: campaignForm.replyTo.trim() || null,
      recipient_list_id: campaignForm.listId,
      batch_size: Number(campaignForm.batchSize),
      interval_minutes: Number(campaignForm.intervalMinutes),
      created_by: user?.id || null,
    };

    const result = editingCampaignId
      ? await emailDb
          .from("email_campaigns")
          .update(payload)
          .eq("id", editingCampaignId)
          .eq("status", "draft")
          .select("*")
          .single()
      : await emailDb.from("email_campaigns").insert(payload).select("*").single();

    if (result.error) {
      throw result.error;
    }

    return result.data as unknown as CampaignRow;
  };

  const handleSaveDraft = async () => {
    try {
      setSaving(true);
      await persistCampaign();
      toast({ title: "Rascunho salvo", description: "A campanha foi salva com sucesso." });
      setCampaignForm(emptyCampaignForm());
      setEditingCampaignId(null);
      setActiveTab("campaigns");
      await loadData();
    } catch (error) {
      toast({
        title: "Erro ao salvar campanha",
        description: error instanceof Error ? error.message : "Nao foi possivel salvar o rascunho.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleScheduleCampaign = async () => {
    try {
      setSaving(true);
      const campaign = await persistCampaign();
      const scheduledDate = new Date(campaignForm.scheduledAt);
      const scheduledAt = Number.isNaN(scheduledDate.getTime())
        ? new Date().toISOString()
        : scheduledDate.toISOString();
      const { error } = await emailDb.rpc("schedule_email_campaign", {
        p_campaign_id: campaign.id,
        p_scheduled_at: scheduledAt,
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Campanha programada",
        description: "O snapshot dos destinatarios foi criado e a cadencia esta ativa.",
      });
      setCampaignForm(emptyCampaignForm());
      setEditingCampaignId(null);
      setActiveTab("campaigns");
      await loadData();
    } catch (error) {
      toast({
        title: "Erro ao programar campanha",
        description: error instanceof Error ? error.message : "Nao foi possivel programar a campanha.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCampaignAction = async (
    functionName: "pause_email_campaign" | "resume_email_campaign" | "cancel_email_campaign",
    campaignId: string,
  ) => {
    const { error } = await emailDb.rpc(functionName, { p_campaign_id: campaignId });
    if (error) {
      toast({
        title: "Nao foi possivel atualizar a campanha",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    await loadData();
  };

  const handleEditDraft = (campaign: CampaignRow) => {
    setEditingCampaignId(campaign.id);
    setCampaignForm({
      name: campaign.name,
      subject: campaign.subject,
      previewText: campaign.preview_text || "",
      senderName: campaign.sender_name,
      replyTo: campaign.reply_to || "",
      listId: campaign.recipient_list_id,
      batchSize: String(campaign.batch_size),
      intervalMinutes: String(campaign.interval_minutes),
      scheduledAt: getDefaultScheduledAt(),
      htmlBody: campaign.html_body,
    });
    setActiveTab("compose");
  };

  const handleCreateList = async () => {
    if (!listName.trim()) {
      toast({ title: "Nome obrigatorio", description: "Informe o nome da lista.", variant: "destructive" });
      return;
    }
    if (parsedRecipients.recipients.length === 0) {
      toast({
        title: "Lista vazia",
        description: "Cole ao menos um endereco de e-mail valido.",
        variant: "destructive",
      });
      return;
    }

    let createdListId: string | null = null;
    try {
      setSaving(true);
      const { data: list, error: listError } = await emailDb
        .from("email_recipient_lists")
        .insert({
          name: listName.trim(),
          description: listDescription.trim() || null,
          created_by: user?.id || null,
        })
        .select("id")
        .single();

      if (listError || !list) {
        throw listError || new Error("Nao foi possivel identificar a lista criada.");
      }

      createdListId = String(list.id);
      const rows = parsedRecipients.recipients.map((recipient) => ({
        list_id: createdListId,
        email: recipient.email,
        name: recipient.name,
        consent_source: "importacao_administrativa",
        consent_at: new Date().toISOString(),
      }));

      for (let index = 0; index < rows.length; index += 250) {
        const { error } = await emailDb
          .from("email_recipients")
          .insert(rows.slice(index, index + 250));
        if (error) {
          throw error;
        }
      }

      toast({
        title: "Lista criada",
        description: `${rows.length} destinatario(s) foram importados.`,
      });
      setListName("");
      setListDescription("");
      setRecipientInput("");
      await loadData();
    } catch (error) {
      if (createdListId) {
        await emailDb.from("email_recipient_lists").delete().eq("id", createdListId);
      }
      toast({
        title: "Erro ao criar lista",
        description: error instanceof Error ? error.message : "Nao foi possivel importar os destinatarios.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleProcessNow = async () => {
    try {
      setProcessingNow(true);
      const { data, error } = await supabase.functions.invoke("process-email-campaigns", {
        body: { action: "process" },
      });
      if (error) {
        throw error;
      }
      const result = data as { processed?: number; sent?: number; failed?: number; message?: string };
      toast({
        title: result.processed ? "Lote processado" : "Nenhum lote pendente",
        description: result.processed
          ? `${result.sent || 0} enviado(s) e ${result.failed || 0} com falha.`
          : result.message || "Nao ha campanhas vencidas neste momento.",
      });
      await loadData();
      await loadProviderStatus();
    } catch (error) {
      toast({
        title: "Erro ao processar lote",
        description: error instanceof Error ? error.message : "A Edge Function nao respondeu.",
        variant: "destructive",
      });
    } finally {
      setProcessingNow(false);
    }
  };

  const handleTestSmtp = async () => {
    try {
      setTestingSmtp(true);
      const { data, error } = await supabase.functions.invoke("process-email-campaigns", {
        body: { action: "test_smtp" },
      });

      if (error) {
        throw error;
      }

      const result = data as { ok?: boolean; error?: string };
      if (!result.ok) {
        throw new Error(result.error || "O servidor SMTP recusou a autenticacao.");
      }

      toast({
        title: "SMTP da UOL conectado",
        description: "A conexao TLS e a autenticacao foram validadas sem enviar mensagem.",
      });
      await loadProviderStatus();
    } catch (error) {
      toast({
        title: "Falha no teste SMTP",
        description: error instanceof Error ? error.message : "Nao foi possivel autenticar na UOL.",
        variant: "destructive",
      });
    } finally {
      setTestingSmtp(false);
    }
  };

  return (
    <FirePageShell>
      <FirePageHeader
        icon={Mail}
        eyebrow="comunicacao administrativa"
        title="Envios de e-mail em massa"
        description="Crie campanhas HTML, organize listas de destinatarios e controle a cadencia de entrega em lotes com rastreabilidade individual."
        actions={
          <>
            <Button variant="outline" size="lg" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
            <Button variant="outline" size="lg" onClick={() => void loadData()} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
            <Button variant="outline" size="lg" onClick={() => void handleTestSmtp()} disabled={testingSmtp}>
              {testingSmtp ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
              Testar SMTP
            </Button>
          </>
        }
        stats={[
          { value: String(campaigns.length), label: "campanhas" },
          { value: String(lists.length), label: "listas de destinatarios" },
          {
            value: providerStatus?.configured ? "Ativo" : "Pendente",
            label: "transporte de email",
          },
        ]}
      />

      {schemaUnavailable ? (
        <Alert className="mb-6 border-amber-300 bg-amber-50 text-amber-950">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Estrutura do banco ainda nao aplicada</AlertTitle>
          <AlertDescription>
            A pagina esta pronta, mas a migration de campanhas precisa ser aplicada ao projeto Supabase antes do uso.
          </AlertDescription>
        </Alert>
      ) : null}

      {providerStatus && !providerStatus.configured ? (
        <Alert className="mb-6 border-blue-300 bg-blue-50 text-blue-950">
          <CalendarClock className="h-4 w-4" />
          <AlertTitle>Transporte de e-mail aguardando configuracao</AlertTitle>
          <AlertDescription>
            Voce ja pode criar listas e rascunhos. Antes do primeiro envio, configure o SMTP seguro da UOL ou outro provedor nas secrets da Edge Function.
          </AlertDescription>
        </Alert>
      ) : null}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid h-auto w-full grid-cols-3 rounded-2xl bg-white/80 p-1.5 shadow-sm">
          <TabsTrigger value="campaigns" className="gap-2 py-3">
            <Send className="h-4 w-4" /> Campanhas
          </TabsTrigger>
          <TabsTrigger value="compose" className="gap-2 py-3">
            <FilePlus2 className="h-4 w-4" /> Criar e-mail
          </TabsTrigger>
          <TabsTrigger value="lists" className="gap-2 py-3">
            <Users className="h-4 w-4" /> Listas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="campaigns" className="space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="fire-display text-2xl font-bold text-slate-950">Campanhas</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Acompanhe lotes, entregas, falhas e a proxima execucao prevista.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => void handleProcessNow()} disabled={processingNow}>
                {processingNow ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CirclePlay className="mr-2 h-4 w-4" />}
                Processar agora
              </Button>
              <Button onClick={() => { setEditingCampaignId(null); setCampaignForm(emptyCampaignForm()); setActiveTab("compose"); }}>
                <FilePlus2 className="mr-2 h-4 w-4" /> Nova campanha
              </Button>
            </div>
          </div>

          {loading ? (
            <Card className="fire-app-surface"><CardContent className="flex items-center justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-primary" /></CardContent></Card>
          ) : campaigns.length === 0 ? (
            <Card className="fire-app-surface"><CardContent className="py-16 text-center text-muted-foreground">Nenhuma campanha criada ainda.</CardContent></Card>
          ) : (
            <div className="grid gap-5 xl:grid-cols-2">
              {campaigns.map((campaign) => {
                const status = statusMeta[campaign.status];
                const progress = campaign.total_recipients > 0
                  ? Math.round(((campaign.sent_count + campaign.failed_count + campaign.skipped_count) / campaign.total_recipients) * 100)
                  : 0;
                return (
                  <Card key={campaign.id} className="fire-app-surface overflow-hidden">
                    <CardHeader>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <CardTitle className="text-xl">{campaign.name}</CardTitle>
                          <CardDescription className="mt-1 line-clamp-2">{campaign.subject}</CardDescription>
                        </div>
                        <Badge variant="outline" className={status.className}>{status.label}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-5">
                      <div>
                        <div className="mb-2 flex justify-between text-xs font-semibold text-muted-foreground">
                          <span>{progress}% processado</span>
                          <span>{campaign.sent_count} de {campaign.total_recipients} enviados</span>
                        </div>
                        <Progress value={progress} className="h-2" />
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                        <div className="rounded-xl bg-emerald-50 p-3"><div className="font-bold text-emerald-700">{campaign.sent_count}</div><div className="text-xs text-emerald-700/75">Enviados</div></div>
                        <div className="rounded-xl bg-red-50 p-3"><div className="font-bold text-red-700">{campaign.failed_count}</div><div className="text-xs text-red-700/75">Falhas</div></div>
                        <div className="rounded-xl bg-slate-100 p-3"><div className="font-bold text-slate-700">{campaign.skipped_count}</div><div className="text-xs text-slate-600">Ignorados</div></div>
                        <div className="rounded-xl bg-blue-50 p-3"><div className="font-bold text-blue-700">{campaign.batch_size}</div><div className="text-xs text-blue-700/75">Por lote</div></div>
                      </div>
                      <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                        <div>Lista: <strong className="text-foreground">{campaign.email_recipient_lists?.name || "-"}</strong></div>
                        <div>Cadencia: <strong className="text-foreground">a cada {campaign.interval_minutes} min</strong></div>
                        <div>Programada: <strong className="text-foreground">{formatDateTime(campaign.scheduled_at)}</strong></div>
                        <div>Proximo lote: <strong className="text-foreground">{formatDateTime(campaign.next_batch_at)}</strong></div>
                      </div>
                      {campaign.last_error ? (
                        <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{campaign.last_error}</AlertDescription></Alert>
                      ) : null}
                      <div className="flex flex-wrap justify-end gap-2">
                        {campaign.status === "draft" ? <Button variant="outline" onClick={() => handleEditDraft(campaign)}><Code2 className="mr-2 h-4 w-4" />Editar</Button> : null}
                        {campaign.status === "scheduled" || campaign.status === "running" ? <Button variant="outline" onClick={() => void handleCampaignAction("pause_email_campaign", campaign.id)}><CirclePause className="mr-2 h-4 w-4" />Pausar</Button> : null}
                        {campaign.status === "paused" || campaign.status === "blocked" ? <Button variant="outline" onClick={() => void handleCampaignAction("resume_email_campaign", campaign.id)}><CirclePlay className="mr-2 h-4 w-4" />Retomar</Button> : null}
                        {!(["completed", "cancelled", "draft"] as CampaignStatus[]).includes(campaign.status) ? <Button variant="destructive" onClick={() => void handleCampaignAction("cancel_email_campaign", campaign.id)}><Square className="mr-2 h-4 w-4" />Cancelar</Button> : null}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="compose" className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
            <Card className="fire-app-surface">
              <CardHeader>
                <CardTitle>{editingCampaignId ? "Editar rascunho" : "Nova campanha"}</CardTitle>
                <CardDescription>Defina o conteudo, os destinatarios e a velocidade de entrega.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2"><Label htmlFor="campaign-name">Nome interno</Label><Input id="campaign-name" value={campaignForm.name} onChange={(event) => updateCampaignField("name", event.target.value)} placeholder="Ex.: Apresentacao FIRE 360 - Setembro" /></div>
                <div className="space-y-2"><Label htmlFor="campaign-subject">Assunto do e-mail</Label><Input id="campaign-subject" value={campaignForm.subject} onChange={(event) => updateCampaignField("subject", event.target.value)} placeholder="Assunto que aparecera na caixa de entrada" /></div>
                <div className="space-y-2"><Label htmlFor="campaign-preview">Texto de pre-visualizacao</Label><Input id="campaign-preview" value={campaignForm.previewText} onChange={(event) => updateCampaignField("previewText", event.target.value)} placeholder="Resumo curto exibido ao lado do assunto" /></div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2"><Label htmlFor="campaign-sender">Nome do remetente</Label><Input id="campaign-sender" value={campaignForm.senderName} onChange={(event) => updateCampaignField("senderName", event.target.value)} /></div>
                  <div className="space-y-2"><Label htmlFor="campaign-reply">Responder para</Label><Input id="campaign-reply" type="email" value={campaignForm.replyTo} onChange={(event) => updateCampaignField("replyTo", event.target.value)} placeholder="contato@empresa.com.br" /></div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Endereço de envio: {providerStatus?.from_address || "comercial@firetetraedro.com.br"}
                </p>
                <div className="space-y-2">
                  <Label>Lista de destinatarios</Label>
                  <Select value={campaignForm.listId} onValueChange={(value) => updateCampaignField("listId", value)}>
                    <SelectTrigger><SelectValue placeholder="Selecione uma lista" /></SelectTrigger>
                    <SelectContent>{lists.map((list) => <SelectItem key={list.id} value={list.id}>{list.name} ({list.email_recipients?.[0]?.count || 0})</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2"><Label htmlFor="batch-size">E-mails por lote</Label><Input id="batch-size" type="number" min={1} max={50} value={campaignForm.batchSize} onChange={(event) => updateCampaignField("batchSize", event.target.value)} /></div>
                  <div className="space-y-2"><Label htmlFor="interval-minutes">Intervalo em minutos</Label><Input id="interval-minutes" type="number" min={1} max={1440} value={campaignForm.intervalMinutes} onChange={(event) => updateCampaignField("intervalMinutes", event.target.value)} /></div>
                </div>
                <div className="space-y-2"><Label htmlFor="scheduled-at">Iniciar em</Label><Input id="scheduled-at" type="datetime-local" value={campaignForm.scheduledAt} onChange={(event) => updateCampaignField("scheduledAt", event.target.value)} /></div>
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2"><Label htmlFor="html-body">HTML e CSS do e-mail</Label><span className="text-xs text-muted-foreground">Variaveis: {"{{nome}}"}, {"{{email}}"}, {"{{assunto}}"}, {"{{unsubscribe_url}}"}</span></div>
                  <Textarea id="html-body" value={campaignForm.htmlBody} onChange={(event) => updateCampaignField("htmlBody", event.target.value)} className="min-h-[520px] resize-y font-mono text-xs leading-5" spellCheck={false} />
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                  <Button variant="outline" onClick={() => void handleSaveDraft()} disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FilePlus2 className="mr-2 h-4 w-4" />}Salvar rascunho</Button>
                  <Button onClick={() => void handleScheduleCampaign()} disabled={saving || lists.length === 0}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CalendarClock className="mr-2 h-4 w-4" />}Salvar e programar</Button>
                </div>
              </CardContent>
            </Card>

            <Card className="fire-app-surface overflow-hidden xl:sticky xl:top-4 xl:self-start">
              <CardHeader className="border-b bg-white/70">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div><CardTitle className="flex items-center gap-2"><Eye className="h-5 w-5 text-primary" />Pre-visualizacao</CardTitle><CardDescription>Exemplo de como o destinatario recebera o conteudo.</CardDescription></div>
                  <div className="flex rounded-xl border bg-muted/40 p-1"><Button size="sm" variant={previewDevice === "desktop" ? "default" : "ghost"} onClick={() => setPreviewDevice("desktop")}><Monitor className="mr-2 h-4 w-4" />Desktop</Button><Button size="sm" variant={previewDevice === "mobile" ? "default" : "ghost"} onClick={() => setPreviewDevice("mobile")}><Smartphone className="mr-2 h-4 w-4" />Mobile</Button></div>
                </div>
              </CardHeader>
              <CardContent className="bg-slate-200/70 p-4 md:p-6">
                <div className={`mx-auto overflow-hidden rounded-2xl border bg-white shadow-xl transition-all ${previewDevice === "mobile" ? "max-w-[390px]" : "max-w-[760px]"}`}>
                  <div className="border-b bg-white px-4 py-3 text-sm"><div className="font-semibold text-slate-950">{campaignForm.senderName || "Fire Tetraedro"}</div><div className="mt-1 truncate font-medium text-slate-800">{campaignForm.subject || "Assunto da campanha"}</div><div className="mt-0.5 truncate text-xs text-slate-500">{campaignForm.previewText || "Texto de pre-visualizacao do e-mail"}</div></div>
                  <iframe title="Pre-visualizacao do e-mail" sandbox="" srcDoc={previewHtml} className="h-[680px] w-full bg-white" />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="lists" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
            <Card className="fire-app-surface">
              <CardHeader><CardTitle className="flex items-center gap-2"><ListPlus className="h-5 w-5 text-primary" />Criar lista</CardTitle><CardDescription>Cole um e-mail por linha. Tambem aceitamos “Nome &lt;email@dominio.com&gt;” ou “Nome, email@dominio.com”.</CardDescription></CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2"><Label htmlFor="list-name">Nome da lista</Label><Input id="list-name" value={listName} onChange={(event) => setListName(event.target.value)} placeholder="Ex.: Clientes e parceiros 2026" /></div>
                <div className="space-y-2"><Label htmlFor="list-description">Descricao</Label><Input id="list-description" value={listDescription} onChange={(event) => setListDescription(event.target.value)} placeholder="Origem e objetivo desta lista" /></div>
                <div className="space-y-2"><Label htmlFor="recipient-input">Destinatarios</Label><Textarea id="recipient-input" value={recipientInput} onChange={(event) => setRecipientInput(event.target.value)} className="min-h-[320px] font-mono text-sm" placeholder={"Maria <maria@empresa.com.br>\nJoao, joao@empresa.com.br\ncontato@empresa.com.br"} /></div>
                <div className="flex flex-wrap gap-2"><Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">{parsedRecipients.recipients.length} validos e unicos</Badge>{parsedRecipients.invalidLines.length > 0 ? <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">{parsedRecipients.invalidLines.length} linha(s) invalidas</Badge> : null}</div>
                <Alert><CheckCircle2 className="h-4 w-4" /><AlertTitle>Use apenas contatos autorizados</AlertTitle><AlertDescription>A importacao registra a origem administrativa e todos os envios incluem mecanismo de descadastro.</AlertDescription></Alert>
                <Button className="w-full" size="lg" onClick={() => void handleCreateList()} disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ListPlus className="mr-2 h-4 w-4" />}Criar lista com {parsedRecipients.recipients.length} contato(s)</Button>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <div><h2 className="fire-display text-2xl font-bold text-slate-950">Listas cadastradas</h2><p className="mt-1 text-sm text-muted-foreground">As campanhas criam um snapshot para preservar o historico dos destinatarios.</p></div>
              {lists.length === 0 ? <Card className="fire-app-surface"><CardContent className="py-16 text-center text-muted-foreground">Nenhuma lista cadastrada.</CardContent></Card> : lists.map((list) => (
                <Card key={list.id} className="fire-app-surface"><CardContent className="flex items-center justify-between gap-4 py-5"><div><div className="font-semibold text-slate-950">{list.name}</div><p className="mt-1 text-sm text-muted-foreground">{list.description || "Sem descricao"}</p><div className="mt-2 text-xs text-muted-foreground">Criada em {formatDateTime(list.created_at)}</div></div><div className="rounded-2xl bg-primary/10 px-4 py-3 text-center"><div className="text-xl font-bold text-primary">{list.email_recipients?.[0]?.count || 0}</div><div className="text-[10px] font-bold uppercase tracking-wider text-primary/70">contatos</div></div></CardContent></Card>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </FirePageShell>
  );
};

export default BulkEmailAdminPage;
