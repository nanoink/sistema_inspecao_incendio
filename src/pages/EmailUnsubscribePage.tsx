import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CheckCircle2, Loader2, MailX, ShieldCheck } from "lucide-react";

import { FirePageHeader, FirePageShell } from "@/components/branding/FirePageShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

type UnsubscribeState = "confirm" | "loading" | "success" | "invalid" | "error";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const EmailUnsubscribePage = () => {
  const { token = "" } = useParams<{ token: string }>();
  const [state, setState] = useState<UnsubscribeState>(
    uuidPattern.test(token) ? "confirm" : "invalid",
  );

  const handleUnsubscribe = async () => {
    if (!uuidPattern.test(token)) {
      setState("invalid");
      return;
    }

    setState("loading");
    const emailDb = supabase as unknown as SupabaseClient;
    const { data, error } = await emailDb.rpc("unsubscribe_email_recipient", {
      p_token: token,
    });

    if (error) {
      console.error("Error unsubscribing email recipient:", error);
      setState("error");
      return;
    }

    setState(data === true ? "success" : "invalid");
  };

  const content = {
    confirm: {
      icon: MailX,
      title: "Confirmar descadastro",
      description:
        "Ao confirmar, este endereço deixará de receber as próximas campanhas da Fire Tetraedro.",
      iconClassName: "text-primary",
    },
    loading: {
      icon: Loader2,
      title: "Processando solicitação",
      description: "Estamos atualizando suas preferências de comunicação.",
      iconClassName: "animate-spin text-primary",
    },
    success: {
      icon: CheckCircle2,
      title: "Descadastro confirmado",
      description:
        "Este endereço foi removido das campanhas futuras da Fire Tetraedro.",
      iconClassName: "text-emerald-600",
    },
    invalid: {
      icon: MailX,
      title: "Link inválido ou expirado",
      description:
        "Não encontramos um destinatário associado a este link de descadastro.",
      iconClassName: "text-amber-600",
    },
    error: {
      icon: MailX,
      title: "Não foi possível concluir",
      description:
        "Tente novamente em alguns instantes. Se o problema continuar, entre em contato com a Fire Tetraedro.",
      iconClassName: "text-destructive",
    },
  }[state];
  const Icon = content.icon;

  return (
    <FirePageShell containerClassName="flex min-h-screen flex-col justify-center py-8">
      <FirePageHeader
        icon={ShieldCheck}
        eyebrow="preferências de comunicação"
        title="Comunicações Fire Tetraedro"
        description="Gerencie com segurança o recebimento de campanhas informativas."
        stats={[
          { value: "Privacidade", label: "preferência respeitada" },
          { value: "Fire 360", label: "comunicação responsável" },
        ]}
      />

      <Card className="fire-app-surface mx-auto w-full max-w-xl">
        <CardContent className="flex flex-col items-center px-6 py-12 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-muted/70">
            <Icon className={`h-8 w-8 ${content.iconClassName}`} />
          </div>
          <h2 className="fire-display mt-6 text-2xl font-bold text-slate-950">
            {content.title}
          </h2>
          <p className="mt-3 max-w-md leading-7 text-muted-foreground">
            {content.description}
          </p>
          {state === "confirm" ? (
            <Button className="mt-7" onClick={() => void handleUnsubscribe()}>
              Confirmar descadastro
            </Button>
          ) : null}
          {state !== "loading" && state !== "confirm" ? (
            <Button className="mt-7" variant="outline" asChild>
              <Link to="/">Voltar ao site</Link>
            </Button>
          ) : null}
        </CardContent>
      </Card>
    </FirePageShell>
  );
};

export default EmailUnsubscribePage;
