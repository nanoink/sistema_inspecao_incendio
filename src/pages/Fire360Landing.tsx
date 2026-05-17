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
  Building2,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Flame,
  Gauge,
  Layers3,
  QrCode,
  ScanSearch,
  ShieldCheck,
  Siren,
  Smartphone,
  Users,
  type LucideIcon,
} from "lucide-react";

const pageFontStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Lexend:wght@500;600;700;800&display=swap');

  .fire360-landing {
    font-family: 'Inter', sans-serif;
  }

  .fire360-display {
    font-family: 'Lexend', sans-serif;
  }
`;

const navigationItems = [
  { href: "#plataforma", label: "Plataforma" },
  { href: "#modulos", label: "Modulos" },
  { href: "#beneficios", label: "Beneficios" },
  { href: "#camadas", label: "Como funciona" },
  { href: "#faq", label: "FAQ" },
];

const benefitItems: Array<{
  title: string;
  description: string;
  icon: LucideIcon;
}> = [
  {
    title: "Checklists inteligentes",
    description:
      "Modelos tecnicos por sistema, execucao orientada e leitura imediata do que esta conforme, pendente ou critico.",
    icon: ClipboardCheck,
  },
  {
    title: "Fluxo de field service",
    description:
      "Visitas em campo, equipes, historico de salvamentos e andamento operacional centralizados em uma unica rotina.",
    icon: Users,
  },
  {
    title: "Nao conformidades tecnicas",
    description:
      "Registro estruturado, plano de correcao, criticidade e rastreabilidade de cada item avaliado.",
    icon: Siren,
  },
  {
    title: "Controle documental",
    description:
      "Relatorios, ART, anexos e evidencias vinculados ao ciclo tecnico correto, sem dispersao entre pastas e conversas.",
    icon: FileText,
  },
  {
    title: "Conformidade recorrente",
    description:
      "A plataforma acompanha o processo inteiro, da inspecao inicial ao fechamento das pendencias e nova validacao.",
    icon: ShieldCheck,
  },
  {
    title: "Reducao de custo oculto",
    description:
      "Menos retrabalho, menos perda de contexto e mais previsibilidade para operacao, engenharia e gestao executiva.",
    icon: Gauge,
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
      "Cadastro, QR individual, checklist proprio, vencimentos e visualizacao consolidada sem perder a inspecao unitara.",
    icon: Flame,
  },
  {
    title: "Hidrantes",
    description:
      "Controle de mangueiras, componentes, recalque, testes e pendencias operacionais associadas ao ponto certo.",
    icon: Building2,
  },
  {
    title: "Luminarias",
    description:
      "Acompanhamento do parque instalado, status operacional, historico de verificacoes e nao conformidades.",
    icon: Layers3,
  },
  {
    title: "Relatorios tecnicos",
    description:
      "Consolidacao por ciclo, anexos, assinatura, ART e uma narrativa tecnica pronta para auditoria e apresentacao.",
    icon: FileText,
  },
];

const layerItems = [
  {
    title: "Operacao em Campo",
    subtitle: "Para vistoriadores e equipes tecnicas",
    accent: "bg-[#f58220]",
    surface: "bg-white",
    text: "text-[#11213c]",
    border: "border-white/30",
    items: [
      "Checklists por sistema e por equipamento",
      "Salvamento de execucao com autoria",
      "Nao conformidades com evidencias",
      "Leitura rapida do status em visita",
    ],
  },
  {
    title: "Compliance Tecnico",
    subtitle: "Para engenharia, responsaveis tecnicos e auditoria",
    accent: "bg-[#0b57c9]",
    surface: "bg-[#11213c]",
    text: "text-white",
    border: "border-white/15",
    items: [
      "Rastreabilidade completa por ciclo",
      "Relatorios, ART e anexos centralizados",
      "Plano de correcao por criticidade",
      "Historico tecnico de inspecao",
    ],
  },
  {
    title: "Gestao Executiva",
    subtitle: "Para decisao, visibilidade e recorrencia",
    accent: "bg-[#11213c]",
    surface: "bg-[#fff7ef]",
    text: "text-[#11213c]",
    border: "border-[#11213c]/10",
    items: [
      "Visao consolidada das frentes criticas",
      "Leitura clara de risco e conformidade",
      "Prioridade operacional por impacto",
      "Base unica para crescimento recorrente",
    ],
  },
];

const faqItems = [
  {
    question: "O FIRE 360 e apenas um checklist digital?",
    answer:
      "Nao. O FIRE 360 conecta execucao operacional, controle de equipamentos, nao conformidades, relatorios, rastreabilidade e conformidade documental em um unico fluxo.",
  },
  {
    question: "Como a plataforma ajuda as equipes que atuam em campo?",
    answer:
      "A equipe executa checklists por sistema e por equipamento, registra salvamentos ao longo da visita, acompanha pendencias e devolve tudo para a gestao com contexto tecnico preservado.",
  },
  {
    question: "Quais frentes o sistema acompanha hoje?",
    answer:
      "O FIRE 360 apoia checklists gerais e o controle operacional de extintores, hidrantes, luminarias, relatorios tecnicos, anexos e rastreabilidade por ciclo.",
  },
  {
    question: "O sistema ajuda na conformidade legal e na auditoria?",
    answer:
      "Sim. A proposta central e organizar a conformidade recorrente, gerar trilha de execucao, consolidar documentacao tecnica e facilitar demonstracao de historico e correcao.",
  },
  {
    question: "Como o FIRE 360 se posiciona no mercado?",
    answer:
      "Como uma plataforma vertical de gestao continua de seguranca contra incendio, combinando SaaS, compliance operacional e field service management.",
  },
];

const fireStats = [
  { value: "360", label: "visao continua da operacao" },
  { value: "01", label: "plataforma para campo, tecnica e gestao" },
  { value: "03", label: "frentes criticas de equipamentos controladas" },
  { value: "24/7", label: "historico tecnico disponivel no sistema" },
];

const Fire360Landing = () => {
  return (
    <div className="fire360-landing min-h-screen bg-[#fff7ef] text-[#11213c]">
      <style>{pageFontStyles}</style>

      <div className="fixed inset-x-0 top-3 z-50 px-3 md:top-5">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 rounded-full border border-white/70 bg-white/90 px-4 py-3 shadow-[0_18px_45px_rgba(17,33,60,0.12)] backdrop-blur md:px-6">
          <a href="#hero" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#0b57c9] text-white shadow-[0_12px_24px_rgba(11,87,201,0.28)]">
              <Flame className="h-5 w-5" />
            </div>
            <div>
              <p className="fire360-display text-sm font-semibold uppercase tracking-[0.26em] text-[#0b57c9]">
                FIRE
              </p>
              <p className="fire360-display -mt-1 text-xl font-bold tracking-tight text-[#11213c]">
                360
              </p>
            </div>
          </a>

          <div className="hidden items-center gap-6 lg:flex">
            {navigationItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="text-sm font-semibold text-[#11213c]/78 transition-colors hover:text-[#f58220]"
              >
                {item.label}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/auth"
              className="hidden rounded-full border border-[#0b57c9]/18 px-4 py-2 text-sm font-semibold text-[#0b57c9] transition-colors hover:bg-[#0b57c9]/6 md:inline-flex"
            >
              Acessar plataforma
            </Link>
            <a
              href="#cta"
              className="inline-flex items-center gap-2 rounded-full bg-[#f58220] px-4 py-2.5 text-sm font-bold text-white shadow-[0_16px_30px_rgba(245,130,32,0.30)] transition-transform hover:-translate-y-0.5"
            >
              Solicitar demonstracao
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>

      <section
        id="hero"
        className="relative overflow-hidden bg-[#f58220] pb-16 pt-32 md:pb-24 md:pt-36"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,214,171,0.35),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.18),transparent_28%)]" />
        <div className="absolute -left-16 top-20 h-40 w-40 rounded-full bg-white/12 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-56 w-56 rounded-full bg-[#0b57c9]/22 blur-3xl" />

        <div className="relative mx-auto grid max-w-6xl gap-12 px-4 md:px-6 lg:grid-cols-[1.02fr_0.98fr] lg:items-center">
          <div className="max-w-2xl text-white">
            <span className="inline-flex rounded-full border border-white/30 bg-white/12 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-white/90">
              Plataforma de gestao continua de seguranca contra incendio
            </span>
            <h1 className="fire360-display mt-6 text-4xl font-extrabold leading-[1.02] tracking-[-0.04em] text-white md:text-6xl">
              Inspecao, conformidade e operacao tecnica no mesmo sistema.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-white/84 md:text-lg">
              O FIRE 360 conecta checklists, equipamentos, nao conformidades,
              relatorios, equipe em campo e rastreabilidade documental em uma
              unica experiencia operacional.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <a
                href="#plataforma"
                className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-bold text-[#11213c] transition-transform hover:-translate-y-0.5"
              >
                Ver a plataforma
                <ArrowRight className="h-4 w-4" />
              </a>
              <a
                href="#camadas"
                className="inline-flex items-center gap-2 rounded-full border border-white/35 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-white/10"
              >
                Entender as camadas
              </a>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <HeroChip
                icon={ClipboardCheck}
                label="Checklists por sistema"
              />
              <HeroChip
                icon={QrCode}
                label="QR por equipamento"
              />
              <HeroChip
                icon={FileText}
                label="Relatorio por ciclo"
              />
            </div>
          </div>

          <div className="relative">
            <div className="absolute right-4 top-3 inline-flex rounded-full bg-[#ffb547] px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-[#11213c] shadow-[0_14px_28px_rgba(255,181,71,0.28)]">
              visao operacional + compliance
            </div>

            <div className="rounded-[34px] bg-[#11213c] p-5 shadow-[0_24px_80px_rgba(17,33,60,0.30)]">
              <div className="rounded-[28px] bg-white p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0b57c9]">
                      Painel FIRE 360
                    </p>
                    <h2 className="fire360-display mt-2 text-2xl font-bold tracking-tight text-[#11213c]">
                      Risco sob controle
                    </h2>
                  </div>
                  <div className="rounded-2xl bg-[#fff3e7] px-3 py-2 text-right">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#f58220]">
                      ciclo ativo
                    </p>
                    <p className="fire360-display mt-1 text-2xl font-bold text-[#11213c]">
                      01
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
                  <div className="rounded-[24px] bg-[#fff7ef] p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-[#11213c]">
                        Conformidade recorrente
                      </p>
                      <span className="rounded-full bg-[#0b57c9] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-white">
                        360
                      </span>
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-3">
                      <MetricOrb
                        tone="bg-[#0b57c9]"
                        value="C"
                        label="conforme"
                      />
                      <MetricOrb
                        tone="bg-[#f58220]"
                        value="NC"
                        label="nao conforme"
                      />
                      <MetricOrb
                        tone="bg-[#11213c]"
                        value="RT"
                        label="rastreado"
                      />
                    </div>
                    <div className="mt-5 space-y-3">
                      <ProgressRow
                        label="Checklists executados"
                        percent="84%"
                        barClassName="w-[84%] bg-[#0b57c9]"
                      />
                      <ProgressRow
                        label="Equipamentos auditados"
                        percent="71%"
                        barClassName="w-[71%] bg-[#f58220]"
                      />
                      <ProgressRow
                        label="Pendencias com plano"
                        percent="92%"
                        barClassName="w-[92%] bg-[#11213c]"
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <StatusCard
                      title="Inspecoes em campo"
                      value="Fluxo assistido"
                      description="Equipe salva por etapa, sem perder autoria e contexto."
                      tone="bg-[#0b57c9]"
                    />
                    <StatusCard
                      title="Relatorios tecnicos"
                      value="Ciclo auditavel"
                      description="Anexos, ART e assinatura no mesmo encadeamento."
                      tone="bg-[#f58220]"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="absolute -bottom-10 -left-4 w-48 rotate-[-10deg] rounded-[28px] bg-white p-4 shadow-[0_22px_50px_rgba(17,33,60,0.22)] md:w-56">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#f58220]">
                    QR individual
                  </p>
                  <p className="mt-1 text-sm font-semibold text-[#11213c]">
                    Equipamento auditado
                  </p>
                </div>
                <Smartphone className="h-5 w-5 text-[#0b57c9]" />
              </div>
              <div className="mt-4 rounded-[22px] bg-[#11213c] p-4 text-white">
                <div className="flex items-center justify-between">
                  <QrCode className="h-8 w-8" />
                  <span className="rounded-full bg-white/14 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]">
                    extintor 01
                  </span>
                </div>
                <div className="mt-3 space-y-2 text-[11px] leading-5 text-white/80">
                  <p>Checklist proprio</p>
                  <p>Historico preservado</p>
                  <p>Sem heranca indevida entre equipamentos</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="plataforma" className="bg-white py-16 md:py-24">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 md:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div className="relative">
            <div className="rounded-[34px] bg-[#fff7ef] p-4 shadow-[0_20px_56px_rgba(17,33,60,0.08)]">
              <div className="rounded-[30px] border border-[#11213c]/8 bg-white p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0b57c9]">
                      tudo em um so lugar
                    </p>
                    <h2 className="fire360-display mt-2 text-3xl font-bold tracking-tight text-[#11213c]">
                      Inspecao, documento e decisao.
                    </h2>
                  </div>
                  <div className="rounded-full bg-[#f58220]/12 px-3 py-2 text-xs font-bold uppercase tracking-[0.14em] text-[#f58220]">
                    vertical SaaS
                  </div>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-[1.1fr_0.9fr]">
                  <div className="rounded-[24px] bg-[#11213c] p-4 text-white">
                    <p className="text-sm font-semibold text-white">
                      Linha de execucao
                    </p>
                    <div className="mt-4 space-y-3">
                      {[
                        "Cadastro da empresa e enquadramento",
                        "Checklist geral e por equipamento",
                        "Nao conformidade com evidencias",
                        "Relatorio final com trilha tecnica",
                      ].map((item) => (
                        <div
                          key={item}
                          className="flex items-center gap-3 rounded-2xl bg-white/8 px-3 py-3"
                        >
                          <CheckCircle2 className="h-4 w-4 text-[#ffb547]" />
                          <span className="text-sm text-white/84">{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <CalloutCard
                      title="Inspecoes"
                      description="Execucao orientada por sistema e por equipamento."
                    />
                    <CalloutCard
                      title="Relatorios"
                      description="Consolidacao com assinaturas, anexos e ART."
                    />
                    <CalloutCard
                      title="Rastreabilidade"
                      description="Cada item ligado ao ciclo tecnico correto."
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="absolute -right-2 bottom-6 rounded-[26px] bg-[#0b57c9] p-4 text-white shadow-[0_22px_50px_rgba(11,87,201,0.28)] md:-right-6">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/70">
                status ao vivo
              </p>
              <p className="fire360-display mt-2 text-2xl font-bold">
                checklist + equipamentos + relatorio
              </p>
            </div>
          </div>

          <div className="max-w-xl">
            <span className="inline-flex rounded-full bg-[#fff3e7] px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#f58220]">
              plataforma de compliance operacional
            </span>
            <h3 className="fire360-display mt-5 text-3xl font-bold leading-tight tracking-[-0.03em] text-[#11213c] md:text-5xl">
              O FIRE 360 nao organiza apenas dados. Ele organiza a rotina tecnica.
            </h3>
            <p className="mt-5 text-base leading-8 text-[#11213c]/72">
              Em vez de operar com planilhas, conversas soltas, laudos isolados e
              controles descentralizados, a plataforma cria uma espinha dorsal
              para a seguranca contra incendio: execucao, analise, prova,
              acompanhamento e revalidacao.
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <StoryBadge
                title="Field service"
                description="Equipe em campo com fluxo e acompanhamento."
              />
              <StoryBadge
                title="CMMS simplificado"
                description="Controle tecnico de equipamentos criticos."
              />
              <StoryBadge
                title="Compliance"
                description="Documentacao e trilha tecnica preparadas para auditoria."
              />
              <StoryBadge
                title="Gestao"
                description="Leitura executiva do que exige acao imediata."
              />
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#0b57c9] py-10 text-white">
        <div className="mx-auto grid max-w-6xl gap-4 px-4 md:grid-cols-4 md:px-6">
          {fireStats.map((stat) => (
            <div
              key={stat.value}
              className="rounded-[28px] border border-white/12 bg-white/10 px-5 py-5"
            >
              <p className="fire360-display text-4xl font-bold tracking-tight">
                {stat.value}
              </p>
              <p className="mt-2 text-sm leading-6 text-white/78">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section
        id="beneficios"
        className="relative overflow-hidden bg-[#f58220] py-16 md:py-24"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.16),transparent_32%)]" />
        <div className="relative mx-auto max-w-6xl px-4 md:px-6">
          <div className="max-w-3xl rounded-[30px] border border-white/18 bg-white/8 px-5 py-6 text-white md:px-8">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/75">
              beneficios do FIRE 360
            </p>
            <h3 className="fire360-display mt-3 text-3xl font-bold tracking-tight md:text-4xl">
              Uma plataforma de gestao continua para quem precisa manter risco sob vigilancia permanente.
            </h3>
            <p className="mt-4 text-sm leading-7 text-white/80 md:text-base">
              O sistema foi pensado para afastar a empresa da guerra de preco do
              checklist solto e aproximar a operacao de um modelo recorrente de
              inteligencia tecnica.
            </p>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {benefitItems.map((item) => (
              <BenefitCard key={item.title} {...item} />
            ))}
          </div>
        </div>
      </section>

      <section id="modulos" className="bg-white py-16 md:py-24">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 md:px-6 lg:grid-cols-[0.98fr_1.02fr] lg:items-center">
          <div className="rounded-[34px] bg-[#0b57c9] p-4 shadow-[0_24px_64px_rgba(11,87,201,0.22)]">
            <div className="rounded-[30px] bg-[#11213c] px-5 py-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/70">
                    modulos tecnicos
                  </p>
                  <h3 className="fire360-display mt-2 text-3xl font-bold tracking-tight">
                    Do equipamento ao parecer final.
                  </h3>
                </div>
                <div className="rounded-full bg-white/10 px-3 py-2 text-xs font-bold uppercase tracking-[0.16em] text-[#ffb547]">
                  compliance engine
                </div>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {moduleItems.map((item) => (
                  <div
                    key={item.title}
                    className="rounded-[24px] bg-white/8 px-4 py-4"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f58220] text-white">
                      <item.icon className="h-5 w-5" />
                    </div>
                    <p className="mt-4 fire360-display text-xl font-bold">
                      {item.title}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-white/78">
                      {item.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div>
            <span className="inline-flex rounded-full bg-[#eff4ff] px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#0b57c9]">
              uma plataforma, multiplos contextos
            </span>
            <h3 className="fire360-display mt-5 text-3xl font-bold leading-tight tracking-[-0.03em] text-[#11213c] md:text-5xl">
              FIRE 360 e o encontro entre software vertical, compliance e operacao de campo.
            </h3>
            <p className="mt-5 text-base leading-8 text-[#11213c]/72">
              Ele nao se comporta como um software generico. Ele foi desenhado
              para a realidade de quem precisa acompanhar extintores, hidrantes,
              luminarias, nao conformidades, documentos tecnicos e decisoes de
              priorizacao sem perder continuidade entre visita e gestao.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <ModulePill
                icon={ScanSearch}
                title="Checklists executados"
                description="Itens gerais e individuais consolidados com logica tecnica."
              />
              <ModulePill
                icon={QrCode}
                title="QR por ativo"
                description="Cada equipamento com identidade propria e historico preservado."
              />
              <ModulePill
                icon={BarChart3}
                title="Leitura executiva"
                description="Gestao enxerga progresso, pendencias e riscos sem entrar na operacao."
              />
              <ModulePill
                icon={ShieldCheck}
                title="Prova documental"
                description="Relatorio, anexos e assinatura no mesmo encadeamento de evidencia."
              />
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#fff7ef] py-16 md:py-24">
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <div className="grid gap-6 lg:grid-cols-[0.86fr_1.14fr]">
            <div className="rounded-[34px] bg-white px-6 py-7 shadow-[0_22px_60px_rgba(17,33,60,0.08)]">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#f58220]">
                posicionamento estrategico
              </p>
              <h3 className="fire360-display mt-4 text-3xl font-bold leading-tight tracking-[-0.03em] text-[#11213c]">
                Um SOC da seguranca contra incendio, com foco em continuidade.
              </h3>
              <p className="mt-4 text-base leading-8 text-[#11213c]/72">
                O cliente nao compra apenas uma tela. Ele passa a operar com uma
                camada continua de inteligencia operacional para conformidade,
                risco e evidencias tecnicas.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                {[
                  "Vertical SaaS",
                  "Compliance operacional",
                  "Field service management",
                  "Gestao continua de risco",
                ].map((chip) => (
                  <span
                    key={chip}
                    className="rounded-full border border-[#11213c]/10 bg-[#fff7ef] px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#11213c]"
                  >
                    {chip}
                  </span>
                ))}
              </div>
            </div>

            <div className="rounded-[34px] bg-[#11213c] p-5 text-white shadow-[0_28px_74px_rgba(17,33,60,0.20)]">
              <div className="grid gap-4 md:grid-cols-3">
                <PositioningCard
                  title="Gestao"
                  description="Visao consolidada, priorizacao e leitura de maturidade operacional."
                  icon={BarChart3}
                />
                <PositioningCard
                  title="Conformidade"
                  description="Documentacao, historico e encadeamento tecnico dos ciclos de inspecao."
                  icon={FileText}
                />
                <PositioningCard
                  title="Operacao"
                  description="Campo, equipamentos, evidencias e salvamentos ligados ao ativo correto."
                  icon={Users}
                />
              </div>
              <div className="mt-4 rounded-[26px] border border-white/12 bg-white/8 px-5 py-5">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/64">
                  por que isso importa
                </p>
                <p className="mt-3 fire360-display text-2xl font-bold leading-tight">
                  Quanto maior a operacao, maior o custo de perder contexto tecnico.
                </p>
                <p className="mt-3 text-sm leading-7 text-white/76">
                  O FIRE 360 foi pensado para diminuir esse custo estrutural:
                  menos retrabalho, mais rastreabilidade, melhor recorrencia e
                  mais clareza sobre o que precisa ser corrigido agora.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        id="camadas"
        className="relative overflow-hidden bg-[#f58220] py-16 md:py-24"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.16),transparent_28%)]" />
        <div className="relative mx-auto max-w-6xl px-4 md:px-6">
          <div className="max-w-2xl text-white">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/72">
              camadas de visibilidade
            </p>
            <h3 className="fire360-display mt-4 text-3xl font-bold tracking-[-0.03em] md:text-5xl">
              A mesma operacao, lida de tres formas.
            </h3>
            <p className="mt-4 text-base leading-8 text-white/82">
              Inspirada no ritmo comercial do site de referencia, esta secao
              mostra como o FIRE 360 entrega valor diferente para quem executa,
              valida tecnicamente e decide estrategicamente.
            </p>
          </div>

          <div className="mt-10 grid gap-5 xl:grid-cols-3">
            {layerItems.map((item) => (
              <LayerCard key={item.title} {...item} />
            ))}
          </div>
        </div>
      </section>

      <section id="faq" className="bg-white py-16 md:py-24">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 md:px-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="max-w-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#f58220]">
              perguntas frequentes
            </p>
            <h3 className="fire360-display mt-4 text-3xl font-bold tracking-[-0.03em] text-[#11213c] md:text-5xl">
              Uma plataforma pensada para crescer junto com a maturidade da operacao.
            </h3>
            <p className="mt-5 text-base leading-8 text-[#11213c]/72">
              O posicionamento do FIRE 360 fica mais forte quando a conversa sai
              do simples checklist e entra em continuidade, conformidade e prova
              operacional. Estas sao as perguntas que normalmente surgem nessa
              transicao.
            </p>
          </div>

          <div className="rounded-[34px] border border-[#11213c]/8 bg-[#fff7ef] px-5 py-4 shadow-[0_18px_54px_rgba(17,33,60,0.06)] md:px-8">
            <Accordion type="single" collapsible className="w-full">
              {faqItems.map((item, index) => (
                <AccordionItem
                  key={item.question}
                  value={`faq-${index}`}
                  className="border-[#11213c]/10"
                >
                  <AccordionTrigger className="py-5 text-left text-base font-semibold text-[#11213c] hover:no-underline">
                    {item.question}
                  </AccordionTrigger>
                  <AccordionContent className="pb-5 text-sm leading-7 text-[#11213c]/70">
                    {item.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </section>

      <section id="cta" className="bg-[#0b57c9] py-14 text-white md:py-20">
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <div className="rounded-[36px] bg-white px-6 py-7 text-[#11213c] shadow-[0_24px_70px_rgba(7,43,102,0.22)] md:px-10 md:py-10">
            <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#f58220]">
                  pronto para apresentar o FIRE 360
                </p>
                <h3 className="fire360-display mt-4 text-3xl font-bold tracking-[-0.03em] md:text-5xl">
                  Transforme inspeção em inteligencia operacional recorrente.
                </h3>
                <p className="mt-4 max-w-2xl text-base leading-8 text-[#11213c]/74">
                  Esta landing foi desenhada para apresentar o sistema sem tocar
                  no software principal: narrativa comercial, identidade visual
                  propria e posicionamento claro de mercado para o FIRE 360.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-[26px] bg-[#fff7ef] px-5 py-5">
                  <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#0b57c9]">
                    Melhor narrativa
                  </p>
                  <p className="mt-3 text-sm leading-7 text-[#11213c]/72">
                    Saia da disputa por checklist e entre na conversa de
                    gestao continua de seguranca contra incendio.
                  </p>
                </div>
                <div className="rounded-[26px] bg-[#11213c] px-5 py-5 text-white">
                  <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#ffb547]">
                    Entrada publica
                  </p>
                  <p className="mt-3 text-sm leading-7 text-white/74">
                    Rota publica separada para apresentar o produto sem expor o
                    ambiente autenticado do sistema.
                  </p>
                </div>
                <Link
                  to="/auth"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-[#f58220] px-5 py-3 text-sm font-bold text-white shadow-[0_16px_30px_rgba(245,130,32,0.28)] transition-transform hover:-translate-y-0.5"
                >
                  Acessar plataforma
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <a
                  href="#hero"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-[#11213c]/10 px-5 py-3 text-sm font-bold text-[#11213c] transition-colors hover:bg-[#11213c]/4"
                >
                  Voltar ao topo
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="bg-[#11213c] py-10 text-white">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 md:grid-cols-[1.1fr_0.9fr_0.9fr] md:px-6">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#f58220] text-white">
                <Flame className="h-5 w-5" />
              </div>
              <div>
                <p className="fire360-display text-sm font-semibold uppercase tracking-[0.24em] text-[#ffb547]">
                  FIRE
                </p>
                <p className="fire360-display -mt-1 text-2xl font-bold tracking-tight">
                  360
                </p>
              </div>
            </div>
            <p className="mt-4 max-w-md text-sm leading-7 text-white/68">
              Plataforma de gestao continua de seguranca contra incendio,
              compliance operacional e field service para equipes que precisam
              transformar execucao em previsibilidade.
            </p>
          </div>

          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-white/56">
              Navegacao
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
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-white/56">
              Entrada
            </p>
            <div className="mt-4 grid gap-3 text-sm text-white/72">
              <Link to="/auth" className="hover:text-white">
                Acessar plataforma
              </Link>
              <a href="#cta" className="hover:text-white">
                Solicitar demonstracao
              </a>
              <span>Landing publica do produto FIRE 360</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

const HeroChip = ({
  icon: Icon,
  label,
}: {
  icon: LucideIcon;
  label: string;
}) => (
  <div className="inline-flex items-center gap-3 rounded-full border border-white/24 bg-white/10 px-4 py-3 text-sm font-semibold text-white/90">
    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#f58220]">
      <Icon className="h-4 w-4" />
    </div>
    {label}
  </div>
);

const MetricOrb = ({
  tone,
  value,
  label,
}: {
  tone: string;
  value: string;
  label: string;
}) => (
  <div className="rounded-[22px] bg-white px-3 py-3 text-center shadow-sm">
    <div
      className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full text-sm font-bold uppercase text-white ${tone}`}
    >
      {value}
    </div>
    <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#11213c]/68">
      {label}
    </p>
  </div>
);

const ProgressRow = ({
  label,
  percent,
  barClassName,
}: {
  label: string;
  percent: string;
  barClassName: string;
}) => (
  <div>
    <div className="mb-2 flex items-center justify-between text-[12px] font-semibold text-[#11213c]">
      <span>{label}</span>
      <span>{percent}</span>
    </div>
    <div className="h-3 rounded-full bg-white">
      <div className={`h-3 rounded-full ${barClassName}`} />
    </div>
  </div>
);

const StatusCard = ({
  title,
  value,
  description,
  tone,
}: {
  title: string;
  value: string;
  description: string;
  tone: string;
}) => (
  <div className="rounded-[24px] border border-[#11213c]/6 bg-white p-4 shadow-sm">
    <div className={`inline-flex rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-white ${tone}`}>
      {title}
    </div>
    <p className="fire360-display mt-3 text-xl font-bold tracking-tight text-[#11213c]">
      {value}
    </p>
    <p className="mt-2 text-sm leading-6 text-[#11213c]/64">{description}</p>
  </div>
);

const CalloutCard = ({
  title,
  description,
}: {
  title: string;
  description: string;
}) => (
  <div className="rounded-[22px] border border-[#11213c]/6 bg-[#fff7ef] px-4 py-4">
    <p className="fire360-display text-lg font-bold tracking-tight text-[#11213c]">
      {title}
    </p>
    <p className="mt-2 text-sm leading-6 text-[#11213c]/68">{description}</p>
  </div>
);

const StoryBadge = ({
  title,
  description,
}: {
  title: string;
  description: string;
}) => (
  <div className="rounded-[24px] border border-[#11213c]/8 bg-white px-4 py-4 shadow-[0_10px_24px_rgba(17,33,60,0.04)]">
    <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#0b57c9]">
      {title}
    </p>
    <p className="mt-2 text-sm leading-6 text-[#11213c]/66">{description}</p>
  </div>
);

const BenefitCard = ({
  title,
  description,
  icon: Icon,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
}) => (
  <div className="rounded-[30px] border border-white/16 bg-[#ff8d32] px-5 py-5 text-white shadow-[0_18px_46px_rgba(196,93,16,0.18)]">
    <div className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-white text-[#f58220]">
      <Icon className="h-6 w-6" />
    </div>
    <p className="fire360-display mt-5 text-2xl font-bold tracking-tight">
      {title}
    </p>
    <p className="mt-3 text-sm leading-7 text-white/82">{description}</p>
  </div>
);

const ModulePill = ({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) => (
  <div className="rounded-[26px] border border-[#11213c]/8 bg-[#fff7ef] px-4 py-4">
    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#11213c] text-white">
      <Icon className="h-5 w-5" />
    </div>
    <p className="mt-4 fire360-display text-xl font-bold tracking-tight text-[#11213c]">
      {title}
    </p>
    <p className="mt-2 text-sm leading-6 text-[#11213c]/68">{description}</p>
  </div>
);

const PositioningCard = ({
  title,
  description,
  icon: Icon,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
}) => (
  <div className="rounded-[28px] border border-white/12 bg-white/8 px-4 py-4">
    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#f58220] text-white">
      <Icon className="h-5 w-5" />
    </div>
    <p className="mt-4 fire360-display text-xl font-bold">{title}</p>
    <p className="mt-2 text-sm leading-7 text-white/76">{description}</p>
  </div>
);

const LayerCard = ({
  title,
  subtitle,
  accent,
  surface,
  text,
  border,
  items,
}: {
  title: string;
  subtitle: string;
  accent: string;
  surface: string;
  text: string;
  border: string;
  items: string[];
}) => (
  <div className={`rounded-[34px] ${surface} ${text} px-5 py-5 shadow-[0_22px_60px_rgba(17,33,60,0.14)]`}>
    <div className={`inline-flex rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-white ${accent}`}>
      {title}
    </div>
    <p className="mt-4 fire360-display text-3xl font-bold tracking-tight">
      {title}
    </p>
    <p className="mt-2 text-sm leading-7 opacity-75">{subtitle}</p>
    <div className={`mt-5 rounded-[28px] border ${border} px-4 py-4`}>
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item} className="flex items-start gap-3">
            <div className={`mt-1 h-2.5 w-2.5 rounded-full ${accent}`} />
            <p className="text-sm leading-6 opacity-85">{item}</p>
          </div>
        ))}
      </div>
    </div>
  </div>
);

export default Fire360Landing;
