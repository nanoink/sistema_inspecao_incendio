import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowRight,
  Building2,
  ClipboardCheck,
  Loader2,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";

import fireTetraedroLogo from "@/assets/firetetraedro-logo.svg";
import { FirePageShell } from "@/components/branding/FirePageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

const loginSchema = z.object({
  email: z.string().email("Email invalido"),
  password: z.string().min(6, "Senha deve ter no minimo 6 caracteres"),
});

type LoginFormData = z.infer<typeof loginSchema>;

const authHighlights = [
  {
    icon: ClipboardCheck,
    title: "Operacao padronizada",
    description: "Checklists, evidencias e nao conformidades no mesmo fluxo.",
  },
  {
    icon: ShieldCheck,
    title: "Compliance rastreavel",
    description: "Visibilidade tecnica, historico e prova documental por ciclo.",
  },
  {
    icon: Building2,
    title: "Gestao por empresa",
    description: "Cada conta acessa apenas a estrutura e os ativos permitidos.",
  },
];

export default function Auth() {
  const [isLoading, setIsLoading] = useState(false);
  const { signIn, user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  useEffect(() => {
    if (user) {
      navigate("/dashboard", { replace: true });
    }
  }, [navigate, user]);

  const handleLogin = async (data: LoginFormData) => {
    setIsLoading(true);

    try {
      const { error } = await signIn(data.email, data.password);

      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          toast({
            title: "Erro ao fazer login",
            description: "Email ou senha incorretos.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Erro ao fazer login",
            description: error.message,
            variant: "destructive",
          });
        }
        return;
      }

      toast({
        title: "Login realizado com sucesso",
        description: "Bem-vindo de volta.",
      });
      navigate("/dashboard");
    } catch {
      toast({
        title: "Erro inesperado",
        description: "Ocorreu um erro ao fazer login.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <FirePageShell containerClassName="flex min-h-screen items-center py-8">
      <div className="grid w-full items-stretch gap-6 lg:grid-cols-[1.08fr_0.92fr]">
        <section className="fire-app-hero flex flex-col justify-between overflow-hidden">
          <div>
            <div className="mb-8 flex items-center justify-between gap-4">
              <div className="rounded-[1.5rem] bg-white px-4 py-3 shadow-[0_18px_44px_rgba(255,91,31,0.18)]">
                <img
                  src={fireTetraedroLogo}
                  alt="Fire Tetraedro"
                  className="h-11 w-auto"
                />
              </div>

              <Link
                to="/"
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/10"
              >
                Voltar ao site
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="fire-app-hero__eyebrow">
              acesso ao ecossistema fire 360
            </div>

            <h1 className="fire-display mt-5 text-4xl font-bold tracking-[-0.05em] text-white md:text-6xl">
              Entre na operacao continua da Fire Tetraedro.
            </h1>
            <p className="fire-app-hero__description max-w-2xl">
              O portal autenticado concentra cadastro, exigencias, checklists,
              relatorios e rastreabilidade operacional em uma interface unica.
            </p>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {authHighlights.map((item) => {
                const Icon = item.icon;

                return (
                  <div
                    key={item.title}
                    className="rounded-[1.45rem] border border-white/10 bg-white/6 p-4 shadow-[0_18px_38px_rgba(0,0,0,0.15)]"
                  >
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h2 className="fire-display mt-4 text-xl font-bold text-white">
                      {item.title}
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-white/72">
                      {item.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <div className="fire-app-stat">
              <div className="fire-app-stat__value">Campo</div>
              <div className="fire-app-stat__label">execucao assistida</div>
            </div>
            <div className="fire-app-stat">
              <div className="fire-app-stat__value">Compliance</div>
              <div className="fire-app-stat__label">trilha tecnica ativa</div>
            </div>
            <div className="fire-app-stat">
              <div className="fire-app-stat__value">Gestao</div>
              <div className="fire-app-stat__label">decisao baseada em ciclo</div>
            </div>
          </div>
        </section>

        <Card className="self-center overflow-hidden border-white/70 bg-white shadow-[0_30px_90px_rgba(7,22,47,0.18)]">
          <CardHeader className="space-y-3 border-b border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(244,248,255,0.97))]">
            <div className="fire-app-chip w-fit">login protegido</div>
            <CardTitle className="flex items-center gap-3 text-3xl text-slate-950">
              <span className="rounded-2xl border border-primary/10 bg-primary/12 p-3 text-primary shadow-[0_12px_30px_rgba(255,91,31,0.12)]">
                <LockKeyhole className="h-5 w-5" />
              </span>
              Acessar plataforma
            </CardTitle>
            <CardDescription className="max-w-xl text-base leading-7 text-slate-600">
              Entre com suas credenciais para continuar na operacao do FIRE 360.
            </CardDescription>
          </CardHeader>
          <CardContent className="bg-white">
            <form
              onSubmit={loginForm.handleSubmit(handleLogin)}
              className="space-y-5"
            >
              <div className="space-y-2">
                <Label htmlFor="login-email">Email</Label>
                <Input
                  id="login-email"
                  type="email"
                  placeholder="seu@email.com"
                  autoComplete="email"
                  {...loginForm.register("email")}
                  disabled={isLoading}
                />
                {loginForm.formState.errors.email ? (
                  <p className="text-sm text-destructive">
                    {loginForm.formState.errors.email.message}
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="login-password">Senha</Label>
                <Input
                  id="login-password"
                  type="password"
                  placeholder="••••••"
                  autoComplete="current-password"
                  {...loginForm.register("password")}
                  disabled={isLoading}
                />
                {loginForm.formState.errors.password ? (
                  <p className="text-sm text-destructive">
                    {loginForm.formState.errors.password.message}
                  </p>
                ) : null}
              </div>

              <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="mr-2 h-4 w-4" />
                )}
                Entrar no sistema
              </Button>

              <div className="fire-app-note">
                <p className="text-sm font-semibold text-foreground">
                  Provisionamento centralizado de contas
                </p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  As contas sao criadas pelo administrador geral do sistema ou
                  pelo gestor da empresa, mantendo o controle de acesso alinhado
                  a cada operacao.
                </p>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </FirePageShell>
  );
}
