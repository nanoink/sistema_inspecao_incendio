import { useEffect } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  Flame,
  Layers3,
  QrCode,
  ShieldCheck,
  Siren,
  TrendingUp,
  Waypoints,
  type LucideIcon,
} from "lucide-react";

import fireTetraedroLogo from "@/assets/firetetraedro-logo.svg";
import fire360OfficialLogo from "@/assets/fire360-logo-oficial.png";
import heroVisual from "@/assets/fire360-frontend-hero.jpg";
import problemVisual from "@/assets/fire360-frontend-problema.jpg";
import paradigmVisual from "@/assets/fire360-frontend-paradigma.jpg";
import motorVisual from "@/assets/fire360-frontend-motor.jpg";
import cycleVisual from "@/assets/fire360-frontend-ciclo.jpg";
import traceabilityVisual from "@/assets/fire360-frontend-rastreabilidade.jpg";
import layersVisual from "@/assets/fire360-frontend-camadas.jpg";
import fieldVisual from "@/assets/fire360-frontend-campo.jpg";
import complianceVisual from "@/assets/fire360-frontend-compliance.jpg";
import managementVisual from "@/assets/fire360-frontend-gestao.jpg";
import socVisual from "@/assets/fire360-frontend-soc.jpg";
import scalabilityVisual from "@/assets/fire360-frontend-escalabilidade.jpg";
import ctaVisual from "@/assets/fire360-frontend-cta.jpg";

const pageFontStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Space+Grotesk:wght@500;600;700&display=swap');

  .fire360-landing {
    --fire-ink: #07162f;
    --fire-ink-2: #0d2345;
    --fire-blue: #236bff;
    --fire-cyan: #73e7ff;
    --fire-orange: #ff5b1f;
    --fire-red: #ff3448;
    --fire-cream: #fff5ea;
    --fire-paper: #f7f9fc;
    --fire-line: rgba(115, 231, 255, 0.2);
    color: var(--fire-ink);
    background:
      radial-gradient(circle at 16% 9%, rgba(255, 91, 31, 0.18), transparent 28rem),
      radial-gradient(circle at 86% 4%, rgba(115, 231, 255, 0.2), transparent 31rem),
      linear-gradient(180deg, #07162f 0%, #081d3a 30rem, #f7f9fc 30rem, #f7f9fc 100%);
    font-family: 'Manrope', sans-serif;
  }

  .fire360-display {
    font-family: 'Space Grotesk', sans-serif;
  }

  .fire360-grid {
    background-image:
      linear-gradient(rgba(115, 231, 255, 0.1) 1px, transparent 1px),
      linear-gradient(90deg, rgba(115, 231, 255, 0.1) 1px, transparent 1px);
    background-size: 42px 42px;
    mask-image: linear-gradient(180deg, rgba(0, 0, 0, 0.9), transparent);
  }

  .fire360-visual {
    position: relative;
    aspect-ratio: 16 / 9;
    overflow: hidden;
    border: 1px solid rgba(7, 22, 47, 0.08);
    border-radius: 2rem;
    background: #07162f;
    box-shadow: 0 28px 80px rgba(7, 22, 47, 0.16);
  }

  .fire360-visual::after {
    display: none;
  }

  .fire360-proof-image {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: contain;
    object-position: center;
    transform: none;
  }

  .fire360-float {
    animation: fire360Float 8s ease-in-out infinite;
  }

  .fire360-pulse {
    animation: fire360Pulse 5.5s ease-in-out infinite;
  }

  @keyframes fire360Float {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-12px); }
  }

  @keyframes fire360Pulse {
    0%, 100% { opacity: 0.55; transform: scale(1); }
    50% { opacity: 0.9; transform: scale(1.06); }
  }
`;

const navItems = [
  { label: "Problema", href: "#problema" },
  { label: "Paradigma", href: "#paradigma" },
  { label: "Motor", href: "#motor" },
  { label: "Camadas", href: "#camadas" },
  { label: "SOC", href: "#soc" },
];

const heroMetrics = [
  { value: "Campo", label: "execução assistida" },
  { value: "Compliance", label: "trilha técnica ativa" },
  { value: "Gestão", label: "decisão com contexto" },
];

const problemPoints = [
  "Inspeções viram registros soltos em planilhas, mensagens e laudos isolados.",
  "A empresa perde contexto técnico entre uma visita e outra.",
  "A diretoria só enxerga o risco quando o problema já virou urgência.",
];

const paradigmCards = [
  {
    title: "Modelo comum",
    description:
      "Checklist pontual, relatório entregue e baixa visibilidade sobre reincidências.",
  },
  {
    title: "Padrão Fire 360",
    description:
      "Ciclo contínuo com evidência, rastreabilidade, prioridade e acompanhamento.",
  },
];

const motorSteps = [
  {
    icon: ClipboardCheck,
    title: "Execução",
    description: "Inspeções e checklists em campo com padrão operacional.",
  },
  {
    icon: ShieldCheck,
    title: "Análise",
    description: "Risco, criticidade e exigências conectadas à empresa.",
  },
  {
    icon: FileCheck2,
    title: "Prova",
    description: "Relatórios, anexos, evidências e histórico por ciclo.",
  },
  {
    icon: TrendingUp,
    title: "Acompanhamento",
    description: "Pendências, correções e prioridades permanecem visíveis.",
  },
  {
    icon: Waypoints,
    title: "Revalidação",
    description: "O ciclo retorna ao campo e melhora a maturidade da operação.",
  },
];

const cycleSteps = [
  "Cadastro técnico da empresa",
  "Verificação de exigências",
  "Checklists gerais e por equipamento",
  "QR Code para ativos físicos",
  "Relatório técnico com evidências",
  "Base documental para AVCB e compliance",
];

const traceabilityItems = [
  {
    icon: QrCode,
    title: "Ativo físico",
    description: "Cada equipamento possui identidade e histórico próprio.",
  },
  {
    icon: ClipboardCheck,
    title: "Inspeção",
    description: "A execução fica vinculada ao item, ao usuário e ao momento.",
  },
  {
    icon: Siren,
    title: "Desvio",
    description: "Não conformidades ganham foto, descrição e prioridade.",
  },
  {
    icon: FileCheck2,
    title: "Prova legal",
    description: "O relatório consolida evidências antes da ART.",
  },
];

const layerCards = [
  {
    image: fieldVisual,
    icon: ClipboardCheck,
    title: "Operação em campo",
    description:
      "Checklists, fotos, QR Codes e execução técnica padronizada para a equipe externa.",
  },
  {
    image: complianceVisual,
    icon: ShieldCheck,
    title: "Compliance técnico",
    description:
      "Rastreabilidade, não conformidades, exigências e histórico organizados por empresa.",
  },
  {
    image: managementVisual,
    icon: Building2,
    title: "Gestão executiva",
    description:
      "Visão clara de risco, maturidade, pendências e decisões que dependem de prioridade.",
  },
];

const socPillars = [
  "Monitoramento contínuo de risco",
  "Inteligência operacional em campo",
  "Compliance documental rastreável",
  "Gestão recorrente de segurança contra incêndio",
];

const scaleStages = [
  {
    title: "Hoje",
    description: "Inspeções, equipamentos, relatórios e anexos em uma base única.",
  },
  {
    title: "Expansão",
    description: "Mais empresas, usuários e ciclos técnicos sem perder padrão.",
  },
  {
    title: "Maturidade",
    description: "Indicadores, previsibilidade e governança de segurança contra incêndio.",
  },
];

interface SectionHeaderProps {
  eyebrow: string;
  title: string;
  description?: string;
  align?: "left" | "center";
}

interface VisualFrameProps {
  src: string;
  alt: string;
  priority?: boolean;
  className?: string;
}

interface IconCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
}

const SectionHeader = ({
  eyebrow,
  title,
  description,
  align = "left",
}: SectionHeaderProps) => (
  <div
    className={
      align === "center"
        ? "mx-auto max-w-3xl text-center"
        : "max-w-3xl text-left"
    }
  >
    <p className="text-xs font-extrabold uppercase tracking-[0.28em] text-[#ff5b1f]">
      {eyebrow}
    </p>
    <h2 className="fire360-display mt-4 text-4xl font-bold tracking-[-0.05em] text-[#07162f] md:text-6xl">
      {title}
    </h2>
    {description ? (
      <p className="mt-5 text-lg leading-8 text-slate-600">{description}</p>
    ) : null}
  </div>
);

const VisualFrame = ({ src, alt, priority, className = "" }: VisualFrameProps) => (
  <figure className={`fire360-visual ${className}`}>
    <img
      src={src}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      className="fire360-proof-image"
    />
  </figure>
);

const IconCard = ({ icon: Icon, title, description }: IconCardProps) => (
  <article className="rounded-[1.7rem] border border-slate-200 bg-white p-5 shadow-[0_18px_50px_rgba(7,22,47,0.08)]">
    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#07162f] text-[#73e7ff]">
      <Icon className="h-5 w-5" />
    </div>
    <h3 className="fire360-display mt-5 text-xl font-bold text-[#07162f]">
      {title}
    </h3>
    <p className="mt-3 text-sm leading-6 text-slate-600">{description}</p>
  </article>
);

export default function Fire360Landing() {
  useEffect(() => {
    document.title = "Fire Tetraedro | Fire 360";

    const description =
      "Fire 360 é a plataforma da Fire Tetraedro para gestão contínua de segurança contra incêndio, compliance operacional e inteligência em campo.";
    const descriptionMeta = document.querySelector('meta[name="description"]');
    const ogTitleMeta = document.querySelector('meta[property="og:title"]');
    const ogDescriptionMeta = document.querySelector(
      'meta[property="og:description"]',
    );

    descriptionMeta?.setAttribute("content", description);
    ogTitleMeta?.setAttribute("content", "Fire Tetraedro | Fire 360");
    ogDescriptionMeta?.setAttribute("content", description);
  }, []);

  return (
    <main className="fire360-landing min-h-screen overflow-hidden">
      <style>{pageFontStyles}</style>

      <header className="fixed inset-x-0 top-0 z-50 px-4 py-4">
        <nav className="mx-auto flex max-w-7xl items-center justify-between gap-4 rounded-full border border-white/10 bg-[#07162f]/[0.82] px-4 py-3 shadow-[0_18px_70px_rgba(0,0,0,0.28)] backdrop-blur-2xl">
          <a href="#hero" className="flex items-center gap-3">
            <span className="rounded-full bg-white px-4 py-2 shadow-[0_10px_28px_rgba(255,91,31,0.2)]">
              <img
                src={fireTetraedroLogo}
                alt="Fire Tetraedro"
                className="h-8 w-auto"
              />
            </span>
            <span className="hidden rounded-full bg-white px-4 py-2 shadow-[0_10px_28px_rgba(115,231,255,0.12)] sm:inline-flex">
              <img src={fire360OfficialLogo} alt="Fire 360" className="h-8 w-auto" />
            </span>
          </a>

          <div className="hidden items-center gap-1 lg:flex">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="rounded-full px-4 py-2 text-sm font-semibold text-white/70 transition hover:bg-white/[0.08] hover:text-white"
              >
                {item.label}
              </a>
            ))}
          </div>

          <Link
            to="/auth"
            className="inline-flex items-center gap-2 rounded-full bg-[#ff5b1f] px-5 py-3 text-sm font-extrabold text-white shadow-[0_18px_38px_rgba(255,91,31,0.35)] transition hover:-translate-y-0.5 hover:bg-[#ff6b32]"
          >
            Entrar
            <ArrowRight className="h-4 w-4" />
          </Link>
        </nav>
      </header>

      <section id="hero" className="relative overflow-hidden px-4 pb-16 pt-32 text-white md:pb-24 md:pt-40">
        <div className="fire360-grid absolute inset-0 opacity-70" />
        <div className="fire360-pulse absolute left-[8%] top-28 h-60 w-60 rounded-full bg-[#ff5b1f]/18 blur-3xl" />
        <div className="fire360-pulse absolute right-[10%] top-20 h-72 w-72 rounded-full bg-[#73e7ff]/18 blur-3xl" />

        <div className="relative mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[0.95fr_1.05fr]">
          <div>
            <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white px-4 py-2 text-[#07162f] shadow-[0_18px_45px_rgba(0,0,0,0.22)]">
              <img src={fire360OfficialLogo} alt="Fire 360" className="h-9 w-auto" />
              <span className="hidden h-8 w-px bg-slate-200 sm:block" />
              <span className="hidden text-xs font-extrabold uppercase tracking-[0.2em] text-slate-600 sm:block">
                Fire Safety Compliance
              </span>
            </div>

            <h1 className="fire360-display mt-8 max-w-4xl text-4xl font-bold tracking-[-0.06em] sm:text-5xl md:text-6xl xl:text-7xl">
              Transforme inspeção em inteligência operacional recorrente.
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-white/80 md:text-lg">
              O Fire 360 é a plataforma da Fire Tetraedro para gestão contínua
              de segurança contra incêndio: campo, compliance, equipamentos,
              não conformidades e relatórios conectados em uma única operação.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/auth"
                className="inline-flex items-center justify-center gap-3 rounded-full bg-[#ff5b1f] px-7 py-4 text-base font-extrabold text-white shadow-[0_22px_48px_rgba(255,91,31,0.36)] transition hover:-translate-y-1 hover:bg-[#ff6b32]"
              >
                Acessar Fire 360
                <ArrowRight className="h-5 w-5" />
              </Link>
              <a
                href="#motor"
                className="inline-flex items-center justify-center gap-3 rounded-full border border-white/15 bg-white/[0.08] px-7 py-4 text-base font-extrabold text-white backdrop-blur transition hover:-translate-y-1 hover:bg-white/[0.12]"
              >
                Ver como funciona
              </a>
            </div>

            <div className="mt-9 grid gap-3 sm:grid-cols-3">
              {heroMetrics.map((metric) => (
                <div
                  key={metric.value}
                  className="rounded-[1.4rem] border border-white/10 bg-white/[0.08] p-4 backdrop-blur"
                >
                  <p className="fire360-display text-2xl font-bold">
                    {metric.value}
                  </p>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-white/60">
                    {metric.label}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <VisualFrame
              src={heroVisual}
              alt="Visão conceitual do Fire 360 conectando campo, compliance e gestão"
              priority
              className="fire360-float"
            />
            <div className="mt-4 rounded-[1.6rem] border border-white/10 bg-[#07162f]/[0.88] p-5 text-white shadow-[0_24px_55px_rgba(0,0,0,0.25)] backdrop-blur-xl md:ml-auto md:w-80">
              <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#73e7ff]">
                Visão 360
              </p>
              <p className="fire360-display mt-2 text-2xl font-bold">
                Do extintor físico à decisão de diretoria.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="problema" className="px-4 py-20 md:py-28">
        <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[1.04fr_0.96fr]">
          <VisualFrame
            src={problemVisual}
            alt="Diagrama sobre o custo oculto da dispersão técnica"
            className="w-full"
          />
          <div>
            <SectionHeader
              eyebrow="O problema"
              title="O custo oculto da dispersão técnica"
              description="Segurança contra incêndio não falha apenas por ausência de checklist. Ela falha quando dados, evidências e decisões ficam espalhados."
            />
            <div className="mt-8 space-y-3">
              {problemPoints.map((item) => (
                <div
                  key={item}
                  className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_12px_32px_rgba(7,22,47,0.06)]"
                >
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#ff5b1f]" />
                  <p className="text-sm leading-6 text-slate-600">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="paradigma" className="bg-white px-4 py-20 md:py-28">
        <div className="mx-auto max-w-7xl">
          <SectionHeader
            eyebrow="Mudança de paradigma"
            title="De checklist pontual para plataforma de gestão contínua"
            description="O Fire 360 muda o centro da operação: o cliente não compra apenas uma lista digital, ele passa a operar uma rotina viva de controle, evidência e conformidade."
            align="center"
          />
          <div className="mt-12 grid items-center gap-8 lg:grid-cols-[0.85fr_1.15fr]">
            <div className="grid gap-4">
              {paradigmCards.map((card, index) => (
                <article
                  key={card.title}
                  className={`rounded-[1.8rem] border p-6 shadow-[0_18px_45px_rgba(7,22,47,0.08)] ${
                    index === 1
                      ? "border-[#ff5b1f]/20 bg-[#07162f] text-white"
                      : "border-slate-200 bg-slate-50 text-[#07162f]"
                  }`}
                >
                  <p
                    className={`text-xs font-extrabold uppercase tracking-[0.22em] ${
                      index === 1 ? "text-[#73e7ff]" : "text-slate-400"
                    }`}
                  >
                    {index === 1 ? "Novo padrão" : "Padrão antigo"}
                  </p>
                  <h3 className="fire360-display mt-3 text-2xl font-bold">
                    {card.title}
                  </h3>
                  <p
                    className={`mt-3 leading-7 ${
                      index === 1 ? "text-white/75" : "text-slate-600"
                    }`}
                  >
                    {card.description}
                  </p>
                </article>
              ))}
            </div>
            <VisualFrame
              src={paradigmVisual}
              alt="Comparativo visual entre checklist pontual e gestão contínua Fire 360"
              className="w-full"
            />
          </div>
        </div>
      </section>

      <section id="motor" className="px-4 py-20 md:py-28">
        <div className="mx-auto max-w-7xl">
          <div className="grid items-end gap-8 lg:grid-cols-[0.9fr_1.1fr]">
            <SectionHeader
              eyebrow="Como funciona"
              title="O motor operacional do Fire 360"
              description="A plataforma organiza a segurança contra incêndio em um ciclo que sai do campo, passa pela análise técnica e volta para a gestão com provas e prioridade."
            />
            <VisualFrame
              src={motorVisual}
              alt="Motor circular com as etapas da operação Fire 360"
              className="w-full"
            />
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {motorSteps.map((step) => (
              <IconCard
                key={step.title}
                icon={step.icon}
                title={step.title}
                description={step.description}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#07162f] px-4 py-20 text-white md:py-28">
        <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[1.08fr_0.92fr]">
          <VisualFrame
            src={cycleVisual}
            alt="Ciclo inteligente de gestão de risco no Fire 360"
            className="w-full border-white/10 bg-[#0d2345]"
          />
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.28em] text-[#73e7ff]">
              Ciclo inteligente
            </p>
            <h2 className="fire360-display mt-4 text-4xl font-bold tracking-[-0.05em] md:text-6xl">
              Um fluxo único para empresa, ativo, inspeção e relatório.
            </h2>
            <p className="mt-5 text-lg leading-8 text-white/70">
              O Fire 360 transforma a operação em um ciclo técnico auditável:
              cada etapa alimenta a próxima, sem perder histórico ou contexto.
            </p>
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {cycleSteps.map((step, index) => (
                <div
                  key={step}
                  className="rounded-2xl border border-white/10 bg-white/[0.07] p-4"
                >
                  <span className="fire360-display text-2xl font-bold text-[#ff5b1f]">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <p className="mt-2 text-sm font-semibold leading-6 text-white/80">
                    {step}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-20 md:py-28">
        <div className="mx-auto max-w-7xl">
          <SectionHeader
            eyebrow="Rastreabilidade"
            title="Cada não conformidade tem origem, evidência e destino"
            description="O sistema conecta ativo físico, inspeção, foto, descrição, responsável e relatório técnico. É menos ruído e mais prova operacional."
            align="center"
          />
          <div className="mt-12 grid gap-8 lg:grid-cols-[1fr_1fr]">
            <VisualFrame
              src={traceabilityVisual}
              alt="Encadeamento de rastreabilidade da operação Fire 360"
              className="w-full"
            />
            <div className="grid gap-4 sm:grid-cols-2">
              {traceabilityItems.map((item) => (
                <IconCard
                  key={item.title}
                  icon={item.icon}
                  title={item.title}
                  description={item.description}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="camadas" className="bg-white px-4 py-20 md:py-28">
        <div className="mx-auto max-w-7xl">
          <div className="grid items-center gap-10 lg:grid-cols-[0.9fr_1.1fr]">
            <SectionHeader
              eyebrow="Camadas da plataforma"
              title="Do campo ao executivo, sem quebrar a cadeia técnica"
              description="A mesma operação alimenta três camadas de valor: execução, compliance e gestão. Cada uma enxerga o que precisa, sem fragmentar o dado."
            />
            <VisualFrame
              src={layersVisual}
              alt="Camadas de visibilidade da plataforma Fire 360"
              className="w-full"
            />
          </div>

          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {layerCards.map((layer) => {
              const Icon = layer.icon;

              return (
                <article
                  key={layer.title}
                  className="overflow-hidden rounded-[2rem] border border-slate-200 bg-[#f7f9fc] shadow-[0_22px_55px_rgba(7,22,47,0.08)]"
                >
                  <VisualFrame
                    src={layer.image}
                    alt={layer.title}
                    className="rounded-none border-0 shadow-none"
                  />
                  <div className="p-6">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#ff5b1f] text-white">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="fire360-display mt-5 text-2xl font-bold text-[#07162f]">
                      {layer.title}
                    </h3>
                    <p className="mt-3 leading-7 text-slate-600">
                      {layer.description}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section id="soc" className="px-4 py-20 md:py-28">
        <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[1.08fr_0.92fr]">
          <VisualFrame
            src={socVisual}
            alt="Infraestrutura operacional do Fire 360 como SOC de segurança contra incêndio"
            className="w-full"
          />
          <div>
            <SectionHeader
              eyebrow="SOC da segurança contra incêndio"
              title="O cliente não compra apenas software. Ele ganha inteligência operacional."
              description="O Fire 360 posiciona a Fire Tetraedro como uma central de gestão contínua: dados de campo, risco, evidências e decisão no mesmo ecossistema."
            />
            <div className="mt-8 grid gap-3">
              {socPillars.map((pillar) => (
                <div
                  key={pillar}
                  className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_12px_30px_rgba(7,22,47,0.06)]"
                >
                  <Flame className="h-5 w-5 shrink-0 text-[#ff5b1f]" />
                  <span className="font-semibold text-slate-700">{pillar}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#07162f] px-4 py-20 text-white md:py-28">
        <div className="mx-auto max-w-7xl">
          <div className="grid items-center gap-10 lg:grid-cols-[0.86fr_1.14fr]">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.28em] text-[#73e7ff]">
                Escalabilidade
              </p>
              <h2 className="fire360-display mt-4 text-4xl font-bold tracking-[-0.05em] md:text-6xl">
                Uma base para crescer sem perder governança.
              </h2>
              <p className="mt-5 text-lg leading-8 text-white/70">
                A plataforma foi desenhada para recorrência: quanto mais ciclos,
                mais histórico, previsibilidade e maturidade operacional.
              </p>
              <div className="mt-8 grid gap-4">
                {scaleStages.map((stage) => (
                  <div
                    key={stage.title}
                    className="rounded-[1.5rem] border border-white/10 bg-white/[0.07] p-5"
                  >
                    <p className="fire360-display text-2xl font-bold text-[#ff5b1f]">
                      {stage.title}
                    </p>
                    <p className="mt-2 leading-7 text-white/70">
                      {stage.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
            <VisualFrame
              src={scalabilityVisual}
              alt="Mapa de escalabilidade e maturidade do Fire 360"
              className="w-full border-white/10 bg-[#0d2345]"
            />
          </div>
        </div>
      </section>

      <section id="cta" className="relative px-4 py-20 md:py-28">
        <div className="absolute inset-x-0 top-0 h-40 bg-[#07162f]" />
        <div className="relative mx-auto grid max-w-7xl overflow-hidden rounded-[2.3rem] border border-slate-200 bg-white shadow-[0_32px_95px_rgba(7,22,47,0.16)] lg:grid-cols-[1fr_1fr]">
          <div className="p-7 md:p-12 lg:p-14">
            <div className="inline-flex rounded-full bg-[#fff5ea] px-4 py-2 text-xs font-extrabold uppercase tracking-[0.22em] text-[#ff5b1f]">
              Proposta única de valor
            </div>
            <h2 className="fire360-display mt-6 text-4xl font-bold tracking-[-0.05em] text-[#07162f] md:text-6xl">
              Risco sob controle permanente.
            </h2>
            <p className="mt-5 text-lg leading-8 text-slate-600">
              O Fire 360 conecta gestão, conformidade, operação e
              rastreabilidade em uma plataforma vertical para segurança contra
              incêndio e emergência.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/auth"
                className="inline-flex items-center justify-center gap-3 rounded-full bg-[#ff5b1f] px-7 py-4 text-base font-extrabold text-white shadow-[0_18px_42px_rgba(255,91,31,0.28)] transition hover:-translate-y-1 hover:bg-[#ff6b32]"
              >
                Entrar no sistema
                <ArrowRight className="h-5 w-5" />
              </Link>
              <a
                href="#hero"
                className="inline-flex items-center justify-center gap-3 rounded-full border border-slate-200 bg-white px-7 py-4 text-base font-extrabold text-[#07162f] transition hover:-translate-y-1 hover:bg-slate-50"
              >
                Rever apresentação
              </a>
            </div>
          </div>
          <VisualFrame
            src={ctaVisual}
            alt="Chamada final do Fire 360 para gestão de risco sob controle"
            className="rounded-none border-0 shadow-none"
          />
        </div>
      </section>

      <footer className="bg-[#07162f] px-4 py-10 text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-white px-4 py-2">
              <img
                src={fireTetraedroLogo}
                alt="Fire Tetraedro"
                className="h-8 w-auto"
              />
            </span>
            <span className="rounded-full bg-white px-4 py-2">
              <img src={fire360OfficialLogo} alt="Fire 360" className="h-8 w-auto" />
            </span>
          </div>
          <p className="max-w-xl text-sm leading-6 text-white/60">
            Plataforma de gestão contínua de segurança contra incêndio,
            compliance operacional e inteligência em campo.
          </p>
        </div>
      </footer>
    </main>
  );
}
