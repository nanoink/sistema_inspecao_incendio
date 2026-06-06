import { useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  ArrowRight,
  BarChart3,
  Binary,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  Flame,
  Layers3,
  MapPinned,
  QrCode,
  RadioTower,
  ScanSearch,
  ShieldCheck,
  Siren,
  Smartphone,
  Users,
  Waypoints,
  type LucideIcon,
} from "lucide-react";
import fireTetraedroLogo from "@/assets/firetetraedro-logo.svg";
import fire360OfficialLogo from "@/assets/fire360-logo-oficial.png";

const pageFontStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Space+Grotesk:wght@500;700&display=swap');

  .fire360-landing {
    --fire-ink: #07162f;
    --fire-ink-soft: #0d2345;
    --fire-cyan: #73e7ff;
    --fire-blue: #2f7dff;
    --fire-blue-soft: #d7ecff;
    --fire-orange: #ff5b1f;
    --fire-orange-soft: #ffe2d3;
    --fire-red: #ff4d57;
    --fire-shell: #f7f9fc;
    --fire-line: rgba(115, 231, 255, 0.16);
    font-family: 'Manrope', sans-serif;
    background:
      radial-gradient(circle at top center, rgba(47, 125, 255, 0.18), transparent 30%),
      linear-gradient(180deg, #07162f 0%, #081d3a 18%, #f7f9fc 18%, #f7f9fc 100%);
  }

  .fire360-display {
    font-family: 'Space Grotesk', sans-serif;
  }

  .fire360-grid {
    background-image:
      linear-gradient(rgba(115, 231, 255, 0.12) 1px, transparent 1px),
      linear-gradient(90deg, rgba(115, 231, 255, 0.12) 1px, transparent 1px);
    background-size: 42px 42px;
    mask-image: linear-gradient(180deg, rgba(0, 0, 0, 0.9), transparent);
  }

  .fire360-orbit {
    animation: fire360Float 8s ease-in-out infinite;
  }

  .fire360-glow {
    animation: fire360Pulse 5.2s ease-in-out infinite;
  }

  .fire360-line {
    animation: fire360Sweep 7s linear infinite;
  }

  @keyframes fire360Float {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-10px); }
  }

  @keyframes fire360Pulse {
    0%, 100% {
      box-shadow: 0 0 0 0 rgba(115, 231, 255, 0.18), 0 0 60px rgba(47, 125, 255, 0.2);
    }
    50% {
      box-shadow: 0 0 0 18px rgba(115, 231, 255, 0.03), 0 0 78px rgba(47, 125, 255, 0.34);
    }
  }

  @keyframes fire360Sweep {
    0% { transform: translateX(-110%); }
    100% { transform: translateX(110%); }
  }
`;

const navigationItems = [
  { href: "#visao", label: "Visão 360" },
  { href: "#problema", label: "Problema" },
  { href: "#ciclo", label: "Ciclo" },
  { href: "#camadas", label: "Camadas" },
  { href: "#modulos", label: "Módulos" },
  { href: "#cta", label: "Contato" },
];

const heroPillars: Array<{
  title: string;
  description: string;
  icon: LucideIcon;
}> = [
  {
    title: "Campo",
    description: "Execução orientada por sistema e por ativo.",
    icon: Smartphone,
  },
  {
    title: "Compliance",
    description: "Trilha técnica, evidências e relatório final.",
    icon: ShieldCheck,
  },
  {
    title: "Gestão",
    description: "Leitura executiva do que exige ação imediata.",
    icon: BarChart3,
  },
];

const problemItems: Array<{
  title: string;
  description: string;
  accentClassName: string;
}> = [
  {
    title: "Planilhas e controles paralelos",
    description:
      "Dados espalhados entre arquivos locais e versões diferentes da mesma operação.",
    accentClassName: "bg-emerald-500",
  },
  {
    title: "Conversas e imagens soltas",
    description:
      "Evidências importantes ficam presas em mensagens e deixam de compor a memória técnica.",
    accentClassName: "bg-[var(--fire-orange)]",
  },
  {
    title: "Laudos e PDFs isolados",
    description:
      "A prova legal existe, mas sem encadeamento com o ativo físico e com a execução em campo.",
    accentClassName: "bg-[var(--fire-red)]",
  },
];

const advantageItems: Array<{
  title: string;
  description: string;
  icon: LucideIcon;
}> = [
  {
    title: "Espinha dorsal operacional",
    description: "Vertical SaaS 100% integrado à rotina de inspeção.",
    icon: Waypoints,
  },
  {
    title: "Identidade única por ativo",
    description: "QR individual preservando a memória exata do equipamento.",
    icon: QrCode,
  },
  {
    title: "Ciclo auditável",
    description: "Não conformidade, anexos, assinatura e ART no mesmo fluxo.",
    icon: FileCheck2,
  },
  {
    title: "Leitura executiva contínua",
    description: "Progresso, pendências e risco direto em uma única leitura.",
    icon: RadioTower,
  },
];

const cycleSteps: Array<{
  title: string;
  description: string;
  icon: LucideIcon;
  toneClassName: string;
}> = [
  {
    title: "Execução",
    description: "Checklist em campo, por sistema e por equipamento.",
    icon: ClipboardCheck,
    toneClassName: "text-[var(--fire-cyan)]",
  },
  {
    title: "Análise",
    description: "Leitura do que está conforme, pendente ou crítico.",
    icon: ScanSearch,
    toneClassName: "text-white",
  },
  {
    title: "Prova",
    description: "Registro técnico com fotos, observações e evidências.",
    icon: Camera,
    toneClassName: "text-[var(--fire-orange)]",
  },
  {
    title: "Acompanhamento",
    description: "Plano de correção com prioridade e rastreabilidade.",
    icon: Siren,
    toneClassName: "text-[var(--fire-red)]",
  },
  {
    title: "Revalidação",
    description: "Fechamento das pendências e novo ciclo ativo.",
    icon: CheckCircle2,
    toneClassName: "text-[var(--fire-cyan)]",
  },
];

const traceabilityItems: Array<{
  title: string;
  description: string;
  icon: LucideIcon;
}> = [
  {
    title: "Ativo físico",
    description: "Cada extintor, hidrante ou luminária nasce com identidade própria.",
    icon: Flame,
  },
  {
    title: "Inspeção orientada",
    description: "Checklist próprio com autoria, geolocalização e salvamento contínuo.",
    icon: MapPinned,
  },
  {
    title: "Desvio estruturado",
    description: "Não conformidade registrada com contexto, foto e prioridade.",
    icon: Siren,
  },
  {
    title: "Prova legal",
    description: "Relatório final com anexos, assinatura e vinculação da ART.",
    icon: FileCheck2,
  },
];

const layerItems: Array<{
  title: string;
  subtitle: string;
  description: string;
  surfaceClassName: string;
  borderClassName: string;
  items: string[];
}> = [
  {
    title: "Operação em Campo",
    subtitle: "Para vistoriadores e equipes técnicas",
    description:
      "Fluxo assistido, preservação de contexto e captura imediata de evidências durante a visita.",
    surfaceClassName:
      "bg-white text-[var(--fire-ink)] shadow-[0_24px_64px_rgba(7,22,47,0.12)]",
    borderClassName: "border-[var(--fire-blue-soft)]",
    items: [
      "Checklist por equipamento, etapa por etapa",
      "Salvamento contínuo com autoria",
      "Registro rápido de foto e não conformidade",
    ],
  },
  {
    title: "Compliance Técnico",
    subtitle: "Para engenharia e responsáveis técnicos",
    description:
      "Validação do risco, rastreabilidade por ciclo e documentação pronta para auditoria técnica.",
    surfaceClassName:
      "bg-[var(--fire-ink-soft)] text-white shadow-[0_24px_64px_rgba(7,22,47,0.26)]",
    borderClassName: "border-white/10",
    items: [
      "Checklist consolidado com lógica técnica",
      "Encadeamento entre ativo, desvio e relatório",
      "Controle documental com anexos e ART",
    ],
  },
  {
    title: "Gestão Executiva",
    subtitle: "Para decisão, visibilidade e crescimento previsível",
    description:
      "A gestão enxerga progresso, pendências e frentes críticas sem precisar descer à operação.",
    surfaceClassName:
      "bg-[linear-gradient(180deg,#102a56_0%,#0b1f40_100%)] text-white shadow-[0_24px_64px_rgba(7,22,47,0.28)]",
    borderClassName: "border-[var(--fire-red)]/20",
    items: [
      "Leitura executiva por impacto",
      "Priorização de correções e recorrência",
      "Base única para expansão do serviço",
    ],
  },
];

const moduleItems: Array<{
  title: string;
  description: string;
  icon: LucideIcon;
}> = [
  {
    title: "Extintores",
    description:
      "QR individual, checklist próprio, vencimentos e memória preservada do ativo.",
    icon: Flame,
  },
  {
    title: "Hidrantes",
    description:
      "Controle de mangueiras, componentes, testes e pendências operacionais.",
    icon: RadioTower,
  },
  {
    title: "Luminárias",
    description:
      "Status operacional, histórico de verificação e conformidade por ponto.",
    icon: Layers3,
  },
  {
    title: "Não conformidades",
    description:
      "Registro estruturado com imagem, criticidade e plano de correção rastreável.",
    icon: Siren,
  },
  {
    title: "Relatórios técnicos",
    description:
      "Ciclo consolidado com assinaturas, anexos e narrativa pronta para auditoria.",
    icon: FileCheck2,
  },
  {
    title: "Visão de maturidade",
    description:
      "Plataforma projetada para sair do checklist isolado e chegar ao SOC do risco físico.",
    icon: Binary,
  },
];

const faqItems = [
  {
    question: "O Fire 360 é apenas um checklist digital?",
    answer:
      "Não. Ele conecta execução em campo, compliance técnico, prova documental e leitura executiva no mesmo ecossistema operacional.",
  },
  {
    question: "O que diferencia o Fire 360 do padrão de mercado?",
    answer:
      "A espinha dorsal integrada. O sistema liga o ativo físico, a inspeção, a não conformidade, o relatório e a decisão de gestão sem herança indevida de dados.",
  },
  {
    question: "Ele serve só para extintores?",
    answer:
      "Não. O Fire 360 foi desenhado para checklists gerais e para o controle operacional de extintores, hidrantes, luminárias, relatórios técnicos, anexos e ciclos de conformidade.",
  },
  {
    question: "Como a Fire Tetraedro se posiciona com esse produto?",
    answer:
      "Como uma plataforma de gestão contínua de segurança contra incêndio, combinando Vertical SaaS, field service, compliance operacional e rastreabilidade legal.",
  },
];

const Fire360Landing = () => {
  useEffect(() => {
    const previousTitle = document.title;
    const descriptionMeta = document.querySelector('meta[name="description"]');
    const authorMeta = document.querySelector('meta[name="author"]');
    const ogTitleMeta = document.querySelector('meta[property="og:title"]');
    const ogDescriptionMeta = document.querySelector(
      'meta[property="og:description"]',
    );
    const previousDescription = descriptionMeta?.getAttribute("content");
    const previousAuthor = authorMeta?.getAttribute("content");
    const previousOgTitle = ogTitleMeta?.getAttribute("content");
    const previousOgDescription = ogDescriptionMeta?.getAttribute("content");

    document.title = "Fire Tetraedro | FIRE 360";
    descriptionMeta?.setAttribute(
      "content",
      "Fire Tetraedro apresenta o FIRE 360, plataforma de gestão contínua de segurança contra incêndio, compliance operacional e inteligência em campo.",
    );
    authorMeta?.setAttribute("content", "Fire Tetraedro");
    ogTitleMeta?.setAttribute("content", "Fire Tetraedro | FIRE 360");
    ogDescriptionMeta?.setAttribute(
      "content",
      "Transforme inspeção em inteligência operacional recorrente com o FIRE 360.",
    );

    return () => {
      document.title = previousTitle;
      descriptionMeta?.setAttribute("content", previousDescription ?? "");
      authorMeta?.setAttribute("content", previousAuthor ?? "");
      ogTitleMeta?.setAttribute("content", previousOgTitle ?? "");
      ogDescriptionMeta?.setAttribute("content", previousOgDescription ?? "");
    };
  }, []);

  return (
    <div className="fire360-landing min-h-screen text-[var(--fire-ink)]">
      <style>{pageFontStyles}</style>

      <div className="fixed inset-x-0 top-3 z-50 px-3 md:top-5">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 rounded-full border border-white/10 bg-[rgba(7,22,47,0.78)] px-4 py-3 text-white shadow-[0_18px_60px_rgba(4,12,28,0.35)] backdrop-blur md:px-6">
          <a href="#hero" className="flex items-center gap-3">
            <div className="rounded-2xl bg-white px-3 py-2 shadow-[0_14px_34px_rgba(255,91,31,0.18)]">
              <img
                src={fireTetraedroLogo}
                alt="Fire Tetraedro"
                className="h-9 w-auto md:h-10"
              />
            </div>
          </a>

          <div className="hidden items-center gap-6 lg:flex">
            {navigationItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="text-sm font-semibold text-white/72 transition-colors hover:text-[var(--fire-cyan)]"
              >
                {item.label}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/auth"
              className="hidden rounded-full border border-white/14 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/8 md:inline-flex"
            >
              Acessar plataforma
            </Link>
            <a
              href="#cta"
              className="inline-flex items-center gap-2 rounded-full bg-[var(--fire-orange)] px-4 py-2.5 text-sm font-bold text-white shadow-[0_18px_38px_rgba(255,91,31,0.28)] transition-transform hover:-translate-y-0.5"
            >
              Solicitar demonstração
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>

      <section
        id="hero"
        className="relative overflow-hidden px-4 pb-16 pt-32 text-white md:px-6 md:pb-24 md:pt-36"
      >
        <div className="fire360-grid absolute inset-x-0 top-0 h-[82%]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_18%,rgba(115,231,255,0.18),transparent_18%),radial-gradient(circle_at_78%_22%,rgba(255,91,31,0.18),transparent_24%),radial-gradient(circle_at_50%_78%,rgba(47,125,255,0.12),transparent_28%)]" />
        <div className="absolute inset-x-0 bottom-0 h-px overflow-hidden bg-white/10">
          <div className="fire360-line h-full w-1/3 bg-[linear-gradient(90deg,transparent,rgba(115,231,255,0.9),transparent)]" />
        </div>

        <div className="relative mx-auto grid max-w-7xl gap-12 lg:grid-cols-[1.04fr_0.96fr] lg:items-center">
          <div className="max-w-3xl">
            <div className="mb-6 inline-flex rounded-[1.35rem] border border-white/12 bg-[rgba(7,22,47,0.88)] px-4 py-3 shadow-[0_22px_58px_rgba(255,91,31,0.20)] ring-1 ring-white/10">
              <img
                src={fire360OfficialLogo}
                alt="Fire 360"
                className="h-10 w-auto md:h-14"
              />
            </div>

            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-white/62">
              Plataforma de gestão contínua de segurança contra incêndio
            </p>

            <h1 className="fire360-display mt-4 text-5xl font-bold leading-[0.94] tracking-[-0.06em] text-white md:text-7xl lg:text-[6.4rem]">
              FIRE 360
            </h1>

            <p className="fire360-display mt-4 max-w-3xl text-2xl font-medium leading-tight tracking-[-0.03em] text-white/90 md:text-4xl">
              Transforme inspeção em inteligência operacional recorrente.
            </p>

            <p className="mt-6 max-w-2xl text-base leading-8 text-white/76 md:text-lg">
              O Fire 360 conecta o ativo físico à diretoria no mesmo encadeamento:
              campo, compliance técnico, não conformidade, relatório, anexos e
              decisão executiva em uma única plataforma.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/auth"
                className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-bold text-[var(--fire-ink)] transition-transform hover:-translate-y-0.5"
              >
                Acessar a plataforma
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="#visao"
                className="inline-flex items-center gap-2 rounded-full border border-white/14 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-white/8"
              >
                Ver a visão 360
              </a>
            </div>

            <div className="mt-10 grid gap-3 md:grid-cols-3">
              {heroPillars.map((item) => (
                <HeroPillar key={item.title} {...item} />
              ))}
            </div>
          </div>

          <div className="relative lg:pl-6">
            <div className="fire360-orbit fire360-glow relative mx-auto aspect-square max-w-[36rem] rounded-full border border-white/10 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.06),rgba(255,255,255,0.01)_42%,transparent_66%)] p-6 shadow-[0_0_0_1px_rgba(115,231,255,0.06),0_40px_120px_rgba(8,29,58,0.62)]">
              <div className="absolute inset-5 rounded-full border border-[var(--fire-cyan)]/14" />
              <div className="absolute inset-14 rounded-full border border-[var(--fire-orange)]/16" />
              <div className="absolute inset-24 rounded-full border border-[var(--fire-blue)]/18" />

              <div className="absolute left-[8%] top-[12%]">
                <OrbitBadge
                  icon={ClipboardCheck}
                  label="Execução"
                  value="Campo assistido"
                />
              </div>
              <div className="absolute right-[2%] top-[18%]">
                <OrbitBadge
                  icon={ScanSearch}
                  label="Análise"
                  value="Conforme, pendente ou crítico"
                />
              </div>
              <div className="absolute right-[8%] bottom-[16%]">
                <OrbitBadge
                  icon={BarChart3}
                  label="Gestão"
                  value="Leitura executiva"
                />
              </div>
              <div className="absolute left-[4%] bottom-[18%]">
                <OrbitBadge
                  icon={FileCheck2}
                  label="Prova"
                  value="Relatório + anexos + ART"
                />
              </div>

              <div className="absolute inset-[20%] rounded-full border border-[var(--fire-cyan)]/16 bg-[radial-gradient(circle_at_center,rgba(47,125,255,0.26),rgba(8,29,58,0.24)_52%,rgba(7,22,47,0.72)_76%)]" />

              <div className="absolute inset-[24%] rounded-full bg-[linear-gradient(180deg,rgba(12,35,69,0.94),rgba(7,22,47,0.96))] p-8 shadow-[inset_0_0_0_1px_rgba(115,231,255,0.10),0_26px_60px_rgba(0,0,0,0.42)]">
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <span className="rounded-full border border-[var(--fire-orange)]/28 bg-[var(--fire-orange)]/12 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--fire-orange)]">
                    ciclo ativo 360
                  </span>
                  <div className="mt-6 rounded-2xl border border-white/12 bg-[rgba(7,22,47,0.88)] px-4 py-3 shadow-[0_18px_44px_rgba(255,91,31,0.18)]">
                    <img
                      src={fire360OfficialLogo}
                      alt="Fire 360"
                      className="h-10 w-auto md:h-12"
                    />
                  </div>
                  <p className="mt-4 max-w-xs text-sm leading-7 text-white/72 md:text-base">
                    A única plataforma que conecta o extintor físico à decisão
                    de diretoria em um único encadeamento.
                  </p>
                </div>
              </div>
            </div>

            <div className="mx-auto mt-7 grid max-w-3xl gap-3 sm:grid-cols-3">
              <MetricCard value="84%" label="checklists executados" />
              <MetricCard value="92%" label="pendências com plano ativo" />
              <MetricCard value="71%" label="equipamentos auditados" />
            </div>
          </div>
        </div>
      </section>

      <section id="visao" className="bg-[var(--fire-shell)] px-4 py-16 md:px-6 md:py-24">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.98fr_1.02fr] lg:items-center">
          <div className="rounded-[2rem] bg-white p-7 shadow-[0_24px_80px_rgba(7,22,47,0.08)]">
            <div className="inline-flex rounded-full bg-[var(--fire-blue-soft)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-[var(--fire-blue)]">
              Fire Tetraedro + Fire 360
            </div>
            <h2 className="fire360-display mt-5 text-3xl font-bold tracking-[-0.04em] text-[var(--fire-ink)] md:text-5xl">
              Saindo do checklist solto para o risco sob vigilância permanente.
            </h2>
            <p className="mt-5 text-base leading-8 text-[var(--fire-ink)]/72">
              O Fire 360 foi desenhado como a infraestrutura da operação:
              organiza a rotina técnica, rastreia o ativo individualmente, estrutura
              a não conformidade e devolve previsibilidade para compliance e gestão.
            </p>
          </div>

          <div className="rounded-[2rem] bg-[linear-gradient(180deg,#0b1f40_0%,#09162f_100%)] p-6 text-white shadow-[0_34px_90px_rgba(7,22,47,0.28)]">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[var(--fire-cyan)]">
              O motor da gestão contínua
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {cycleSteps.slice(0, 4).map((step, index) => (
                <div
                  key={step.title}
                  className="rounded-[1.5rem] border border-white/10 bg-white/6 p-4"
                >
                  <div className="flex items-center gap-3">
                    <div className={`rounded-2xl bg-white/10 p-3 ${step.toneClassName}`}>
                      <step.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/56">
                        etapa {index + 1}
                      </p>
                      <p className="fire360-display text-xl font-bold">{step.title}</p>
                    </div>
                  </div>
                  <p className="mt-4 text-sm leading-7 text-white/72">
                    {step.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="problema" className="bg-white px-4 py-16 md:px-6 md:py-24">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.92fr_1.08fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--fire-orange)]">
              O custo oculto da dispersão técnica
            </p>
            <h2 className="fire360-display mt-4 text-3xl font-bold tracking-[-0.04em] text-[var(--fire-ink)] md:text-5xl">
              O risco real não é a falta de inspeção. É a quebra da rastreabilidade.
            </h2>
            <p className="mt-5 text-base leading-8 text-[var(--fire-ink)]/72">
              Quanto maior a operação, maior o custo de perder contexto técnico.
              Operar com planilhas, conversas soltas e laudos isolados gera retrabalho,
              herança indevida de dados e baixa previsibilidade.
            </p>

            <div className="mt-8 space-y-4">
              {problemItems.map((item) => (
                <ProblemCard key={item.title} {...item} />
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] bg-[linear-gradient(180deg,#091a37_0%,#07162f_100%)] p-6 text-white shadow-[0_34px_90px_rgba(7,22,47,0.24)]">
            <div className="rounded-[1.75rem] border border-white/10 bg-white/4 p-5">
              <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
                <div className="rounded-[1.5rem] bg-white p-4 text-[var(--fire-ink)]">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--fire-blue)]">
                    O padrão de mercado
                  </p>
                  <div className="mt-4 space-y-3">
                    {[
                      "Descentralizado",
                      "Herança indevida entre equipamentos",
                      "Pastas e fotos dispersas",
                      "Operação reativa",
                    ].map((item) => (
                      <div
                        key={item}
                        className="rounded-[1.2rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold"
                      >
                        {item}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-[1.5rem] border border-[var(--fire-cyan)]/16 bg-[linear-gradient(180deg,rgba(47,125,255,0.16),rgba(8,29,58,0.12))] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--fire-cyan)]">
                    O padrão Fire 360
                  </p>
                  <div className="mt-4 grid gap-3">
                    {advantageItems.map((item) => (
                      <AdvantageCard key={item.title} {...item} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="ciclo" className="relative overflow-hidden bg-[var(--fire-ink)] px-4 py-16 text-white md:px-6 md:py-24">
        <div className="fire360-grid absolute inset-0 opacity-60" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_22%,rgba(255,91,31,0.14),transparent_18%),radial-gradient(circle_at_82%_18%,rgba(115,231,255,0.12),transparent_24%)]" />
        <div className="relative mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--fire-cyan)]">
              O ciclo inteligente de gestão de riscos de incêndio
            </p>
            <h2 className="fire360-display mt-4 text-3xl font-bold tracking-[-0.04em] md:text-5xl">
              Do cadastro e enquadramento legal ao relatório final com prova robusta.
            </h2>
            <p className="mt-5 text-base leading-8 text-white/74">
              O Fire 360 organiza a operação como um ciclo ativo: executa, analisa,
              prova, acompanha, revalida e reinicia com memória preservada.
            </p>
          </div>

          <div className="mt-10 grid gap-4 lg:grid-cols-5">
            {cycleSteps.map((step, index) => (
              <CycleStepCard
                key={step.title}
                index={index + 1}
                title={step.title}
                description={step.description}
                icon={step.icon}
                toneClassName={step.toneClassName}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[var(--fire-shell)] px-4 py-16 md:px-6 md:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="flex max-w-3xl flex-col gap-4">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--fire-blue)]">
              Anatomia da rastreabilidade
            </p>
            <h2 className="fire360-display text-3xl font-bold tracking-[-0.04em] md:text-5xl">
              O mesmo encadeamento de evidências da base ao topo.
            </h2>
          </div>

          <div className="relative mt-10 grid gap-4 lg:grid-cols-4">
            {traceabilityItems.map((item, index) => (
              <TraceabilityCard
                key={item.title}
                title={item.title}
                description={item.description}
                icon={item.icon}
                isFirst={index === 0}
              />
            ))}
          </div>
        </div>
      </section>

      <section id="camadas" className="bg-white px-4 py-16 md:px-6 md:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-8 lg:grid-cols-[0.92fr_1.08fr] lg:items-end">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--fire-orange)]">
                Camadas de visibilidade
              </p>
              <h2 className="fire360-display mt-4 text-3xl font-bold tracking-[-0.04em] text-[var(--fire-ink)] md:text-5xl">
                A mesma operação, lida em três níveis de necessidade.
              </h2>
              <p className="mt-5 text-base leading-8 text-[var(--fire-ink)]/72">
                Para o campo, o sistema orienta execução. Para o compliance técnico,
                valida risco e documentação. Para a gestão, entrega previsibilidade.
              </p>
            </div>

            <div className="rounded-[1.75rem] border border-[var(--fire-blue-soft)] bg-[var(--fire-shell)] px-5 py-5 text-sm leading-7 text-[var(--fire-ink)]/70">
              Do checklist digital à prova documental robusta, o produto acompanha
              o ritmo de maturidade da operação e transforma execução em previsibilidade.
            </div>
          </div>

          <div className="mt-10 grid gap-5 xl:grid-cols-3">
            {layerItems.map((item) => (
              <LayerCard key={item.title} {...item} />
            ))}
          </div>
        </div>
      </section>

      <section id="modulos" className="bg-[var(--fire-shell)] px-4 py-16 md:px-6 md:py-24">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.92fr_1.08fr] lg:items-start">
          <div className="rounded-[2rem] bg-[linear-gradient(180deg,#0a1f3e_0%,#08162d_100%)] p-6 text-white shadow-[0_34px_90px_rgba(7,22,47,0.24)]">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--fire-cyan)]">
              Infraestrutura da operação
            </p>
            <h2 className="fire360-display mt-4 text-3xl font-bold tracking-[-0.04em] md:text-5xl">
              Um verdadeiro SOC da segurança contra incêndio.
            </h2>
            <p className="mt-5 text-base leading-8 text-white/74">
              O Fire 360 reúne field service, controle contínuo de ativos críticos,
              compliance operacional e gestão executiva em uma única plataforma.
            </p>

            <div className="mt-8 grid gap-3">
              {[
                "Field service com fluxo assistido",
                "CMMS simplificado para equipamentos críticos",
                "Compliance com documentação pronta para auditoria",
                "Gestão com leitura executiva do que exige ação imediata",
              ].map((item) => (
                <div
                  key={item}
                  className="rounded-[1.3rem] border border-white/10 bg-white/6 px-4 py-3 text-sm font-semibold text-white/84"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {moduleItems.map((item) => (
              <ModuleCard key={item.title} {...item} />
            ))}
          </div>
        </div>
      </section>

      <section id="faq" className="bg-white px-4 py-16 md:px-6 md:py-24">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.92fr_1.08fr]">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--fire-blue)]">
              Perguntas frequentes
            </p>
            <h2 className="fire360-display mt-4 text-3xl font-bold tracking-[-0.04em] text-[var(--fire-ink)] md:text-5xl">
              O produto foi desenhado para crescer junto com a maturidade da sua operação.
            </h2>
            <p className="mt-5 text-base leading-8 text-[var(--fire-ink)]/72">
              Quando a conversa sai do checklist solto e entra em continuidade,
              rastreabilidade e prova operacional, estas são as perguntas que mais aparecem.
            </p>
          </div>

          <div className="rounded-[2rem] border border-[var(--fire-blue-soft)] bg-[var(--fire-shell)] px-5 py-4 shadow-[0_24px_70px_rgba(7,22,47,0.06)] md:px-8">
            <Accordion type="single" collapsible className="w-full">
              {faqItems.map((item, index) => (
                <AccordionItem
                  key={item.question}
                  value={`faq-${index}`}
                  className="border-[var(--fire-blue-soft)]"
                >
                  <AccordionTrigger className="py-5 text-left text-base font-semibold text-[var(--fire-ink)] hover:no-underline">
                    {item.question}
                  </AccordionTrigger>
                  <AccordionContent className="pb-5 text-sm leading-7 text-[var(--fire-ink)]/70">
                    {item.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </section>

      <section id="cta" className="bg-[var(--fire-ink)] px-4 py-14 text-white md:px-6 md:py-20">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-[2.2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] px-6 py-7 shadow-[0_32px_100px_rgba(0,0,0,0.32)] md:px-10 md:py-10">
            <div className="grid gap-8 lg:grid-cols-[1.02fr_0.98fr] lg:items-center">
              <div>
                <div className="inline-flex rounded-full border border-white/10 bg-white/6 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-[var(--fire-cyan)]">
                  Fire Tetraedro
                </div>
                <h2 className="fire360-display mt-4 text-3xl font-bold tracking-[-0.04em] md:text-5xl">
                  Transforme execução em previsibilidade com o FIRE 360.
                </h2>
                <p className="mt-5 max-w-2xl text-base leading-8 text-white/72">
                  A Fire Tetraedro apresenta uma plataforma criada para unir
                  inspeção, conformidade e inteligência operacional recorrente na
                  segurança contra incêndio.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-[1.7rem] bg-white px-5 py-5 text-[var(--fire-ink)]">
                  <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--fire-blue)]">
                    Entrada pública forte
                  </p>
                  <p className="mt-3 text-sm leading-7 text-[var(--fire-ink)]/72">
                    Marca Fire Tetraedro presente, mas com o Fire 360 como protagonista logo na abertura.
                  </p>
                </div>
                <div className="rounded-[1.7rem] border border-white/10 bg-white/6 px-5 py-5">
                  <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--fire-orange)]">
                    Posicionamento premium
                  </p>
                  <p className="mt-3 text-sm leading-7 text-white/74">
                    Vertical SaaS, field service, compliance e gestão contínua do risco físico.
                  </p>
                </div>
                <Link
                  to="/auth"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--fire-orange)] px-5 py-3 text-sm font-bold text-white shadow-[0_18px_40px_rgba(255,91,31,0.28)] transition-transform hover:-translate-y-0.5"
                >
                  Acessar a plataforma
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <a
                  href="#hero"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-white/8"
                >
                  Voltar ao topo
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="bg-[#050f22] px-4 py-10 text-white md:px-6">
        <div className="mx-auto grid max-w-7xl gap-8 md:grid-cols-[1.05fr_0.95fr_0.95fr]">
          <div>
            <div className="inline-flex rounded-[1.2rem] bg-white px-4 py-3">
              <img
                src={fireTetraedroLogo}
                alt="Logo Fire Tetraedro"
                className="h-12 w-auto"
              />
            </div>
            <p className="mt-4 max-w-md text-sm leading-7 text-white/64">
              Fire Tetraedro com foco em operação técnica, rastreabilidade,
              conformidade e inteligência contínua em segurança contra incêndio.
            </p>
          </div>

          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-white/52">
              Navegação
            </p>
            <div className="mt-4 grid gap-3 text-sm text-white/72">
              {navigationItems.map((item) => (
                <a key={item.href} href={item.href} className="hover:text-white">
                  {item.label}
                </a>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-white/52">
              Produto
            </p>
            <div className="mt-4 grid gap-3 text-sm text-white/72">
              <Link to="/auth" className="hover:text-white">
                Acessar plataforma
              </Link>
              <a href="#cta" className="hover:text-white">
                Solicitar demonstração
              </a>
              <span>Landing pública do Fire 360</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

const HeroPillar = ({
  title,
  description,
  icon: Icon,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
}) => (
  <div className="rounded-[1.5rem] border border-white/10 bg-white/6 px-4 py-4 shadow-[0_16px_40px_rgba(0,0,0,0.18)]">
    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-[var(--fire-orange)]">
      <Icon className="h-5 w-5" />
    </div>
    <p className="fire360-display mt-4 text-xl font-bold">{title}</p>
    <p className="mt-2 text-sm leading-6 text-white/72">{description}</p>
  </div>
);

const OrbitBadge = ({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
}) => (
  <div className="max-w-[11rem] rounded-[1.3rem] border border-white/10 bg-[rgba(7,22,47,0.82)] px-4 py-3 shadow-[0_20px_50px_rgba(0,0,0,0.34)] backdrop-blur">
    <div className="flex items-center gap-2">
      <div className="rounded-xl bg-white/8 p-2 text-[var(--fire-cyan)]">
        <Icon className="h-4 w-4" />
      </div>
      <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/62">
        {label}
      </span>
    </div>
    <p className="mt-3 text-sm font-semibold leading-6 text-white/86">{value}</p>
  </div>
);

const MetricCard = ({
  value,
  label,
}: {
  value: string;
  label: string;
}) => (
  <div className="rounded-[1.5rem] border border-white/10 bg-white/6 px-4 py-4 text-center shadow-[0_16px_40px_rgba(0,0,0,0.18)]">
    <p className="fire360-display text-3xl font-bold tracking-[-0.04em] text-white">
      {value}
    </p>
    <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/62">
      {label}
    </p>
  </div>
);

const ProblemCard = ({
  title,
  description,
  accentClassName,
}: {
  title: string;
  description: string;
  accentClassName: string;
}) => (
  <div className="rounded-[1.6rem] border border-slate-200 bg-[var(--fire-shell)] p-4 shadow-[0_14px_32px_rgba(7,22,47,0.04)]">
    <div className="flex items-start gap-4">
      <span className={`mt-1 h-3.5 w-3.5 rounded-full ${accentClassName}`} />
      <div>
        <p className="fire360-display text-xl font-bold tracking-tight text-[var(--fire-ink)]">
          {title}
        </p>
        <p className="mt-2 text-sm leading-7 text-[var(--fire-ink)]/70">
          {description}
        </p>
      </div>
    </div>
  </div>
);

const AdvantageCard = ({
  title,
  description,
  icon: Icon,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
}) => (
  <div className="rounded-[1.3rem] border border-white/10 bg-[rgba(255,255,255,0.04)] p-4">
    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/8 text-[var(--fire-cyan)]">
      <Icon className="h-5 w-5" />
    </div>
    <p className="fire360-display mt-4 text-xl font-bold tracking-tight text-white">
      {title}
    </p>
    <p className="mt-2 text-sm leading-7 text-white/72">{description}</p>
  </div>
);

const CycleStepCard = ({
  index,
  title,
  description,
  icon: Icon,
  toneClassName,
}: {
  index: number;
  title: string;
  description: string;
  icon: LucideIcon;
  toneClassName: string;
}) => (
  <div className="rounded-[1.7rem] border border-white/10 bg-white/6 p-5 shadow-[0_18px_44px_rgba(0,0,0,0.2)]">
    <div className="flex items-center justify-between gap-3">
      <div className={`rounded-2xl bg-white/8 p-3 ${toneClassName}`}>
        <Icon className="h-5 w-5" />
      </div>
      <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/62">
        {index}
      </span>
    </div>
    <p className="fire360-display mt-5 text-2xl font-bold tracking-tight">
      {title}
    </p>
    <p className="mt-3 text-sm leading-7 text-white/72">{description}</p>
  </div>
);

const TraceabilityCard = ({
  title,
  description,
  icon: Icon,
  isFirst,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  isFirst: boolean;
}) => (
  <div className="relative rounded-[1.7rem] border border-[var(--fire-blue-soft)] bg-white p-5 shadow-[0_18px_46px_rgba(7,22,47,0.06)]">
    {!isFirst ? (
      <div className="absolute left-[-22px] top-[44px] hidden h-px w-[22px] bg-[var(--fire-blue)]/30 lg:block" />
    ) : null}
    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--fire-ink)] text-[var(--fire-cyan)]">
      <Icon className="h-5 w-5" />
    </div>
    <p className="fire360-display mt-5 text-2xl font-bold tracking-tight text-[var(--fire-ink)]">
      {title}
    </p>
    <p className="mt-3 text-sm leading-7 text-[var(--fire-ink)]/70">
      {description}
    </p>
  </div>
);

const LayerCard = ({
  title,
  subtitle,
  description,
  surfaceClassName,
  borderClassName,
  items,
}: {
  title: string;
  subtitle: string;
  description: string;
  surfaceClassName: string;
  borderClassName: string;
  items: string[];
}) => (
  <div className={`rounded-[2rem] p-6 ${surfaceClassName}`}>
    <div className={`rounded-[1.5rem] border px-4 py-3 text-sm font-semibold uppercase tracking-[0.18em] ${borderClassName}`}>
      {subtitle}
    </div>
    <p className="fire360-display mt-5 text-3xl font-bold tracking-tight">{title}</p>
    <p className="mt-4 text-sm leading-7 opacity-80">{description}</p>
    <div className={`mt-6 rounded-[1.6rem] border px-4 py-4 ${borderClassName}`}>
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item} className="flex items-start gap-3">
            <span className="mt-2 h-2.5 w-2.5 rounded-full bg-[var(--fire-orange)]" />
            <p className="text-sm leading-6 opacity-86">{item}</p>
          </div>
        ))}
      </div>
    </div>
  </div>
);

const ModuleCard = ({
  title,
  description,
  icon: Icon,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
}) => (
  <div className="rounded-[1.7rem] border border-[var(--fire-blue-soft)] bg-white p-5 shadow-[0_18px_46px_rgba(7,22,47,0.06)]">
    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--fire-orange-soft)] text-[var(--fire-orange)]">
      <Icon className="h-5 w-5" />
    </div>
    <p className="fire360-display mt-5 text-2xl font-bold tracking-tight text-[var(--fire-ink)]">
      {title}
    </p>
    <p className="mt-3 text-sm leading-7 text-[var(--fire-ink)]/70">
      {description}
    </p>
  </div>
);

export default Fire360Landing;
