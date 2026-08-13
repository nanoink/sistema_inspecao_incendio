import { useEffect } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Download,
  ExternalLink,
  FileText,
  FolderOpen,
  LogIn,
  ShieldCheck,
} from "lucide-react";

import fireTetraedroLogo from "@/assets/firetetraedro-logo.svg";
import fire360Hero from "@/assets/fire360-frontend-hero.jpg";
import { FirePageHeader, FirePageShell } from "@/components/branding/FirePageShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const portfolioDocuments = [
  {
    title: "Plataforma FIRE 360",
    description:
      "Conheça a plataforma que conecta inspeções em campo, compliance técnico, rastreabilidade e gestão contínua da segurança contra incêndio.",
    href: "/downloads/plataforma-fire-360.pdf",
    fileName: "plataforma-fire-360.pdf",
    fileSize: "1,8 MB",
    kind: "platform" as const,
  },
  {
    title: "Portfólio Fire Tetraedro 2026",
    description:
      "Acesse a apresentação institucional da Fire Tetraedro e conheça o conjunto de soluções, serviços e capacidades técnicas da empresa.",
    href: "/downloads/portfolio-fire-tetraedro-2026.pdf",
    fileName: "portfolio-fire-tetraedro-2026.pdf",
    fileSize: "40,3 MB",
    kind: "company" as const,
  },
];

const PublicPortfolio = () => {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = "Portfólio | FIRE 360";

    return () => {
      document.title = previousTitle;
    };
  }, []);

  return (
    <FirePageShell containerClassName="py-4 md:py-8">
      <FirePageHeader
        icon={FolderOpen}
        eyebrow="materiais oficiais"
        title="Portfólio Fire Tetraedro"
        description="Baixe as apresentações institucionais e conheça a plataforma FIRE 360, seus recursos e a atuação técnica da Fire Tetraedro."
        actions={
          <>
            <Button variant="outline" size="lg" asChild>
              <Link to="/">
                Conhecer o FIRE 360
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" asChild>
              <Link to="/auth">
                <LogIn className="mr-2 h-4 w-4" />
                Acessar plataforma
              </Link>
            </Button>
          </>
        }
        stats={[
          { value: "2", label: "materiais disponíveis" },
          { value: "PDF", label: "download direto" },
        ]}
      />

      <section className="mx-auto max-w-6xl space-y-6" aria-labelledby="portfolio-documents-title">
        <div className="fire-app-surface px-5 py-6 md:px-8 md:py-7">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="fire-app-chip">
                <ShieldCheck className="h-4 w-4" />
                Conteúdo institucional
              </div>
              <h2
                id="portfolio-documents-title"
                className="fire-display mt-4 text-2xl font-bold tracking-[-0.03em] text-slate-950 md:text-3xl"
              >
                Escolha o material que deseja acessar
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground md:text-base">
                Os documentos são disponibilizados diretamente pelo ambiente oficial e podem ser visualizados no navegador ou baixados para consulta.
              </p>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-primary/10 bg-primary/[0.06] px-4 py-3 text-sm font-semibold text-slate-700">
              <FileText className="h-5 w-5 text-primary" />
              Acesso público, sem necessidade de login
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {portfolioDocuments.map((document) => (
            <Card
              key={document.href}
              className="fire-app-surface overflow-hidden border-white/70 transition-transform duration-300 hover:-translate-y-1"
            >
              {document.kind === "platform" ? (
                <div className="relative aspect-[16/9] overflow-hidden bg-slate-950">
                  <img
                    src={fire360Hero}
                    alt="Apresentação visual da plataforma FIRE 360"
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/65 via-transparent to-transparent" />
                  <div className="absolute bottom-4 left-4 rounded-full border border-white/15 bg-slate-950/70 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-white backdrop-blur">
                    Plataforma digital
                  </div>
                </div>
              ) : (
                <div className="relative flex aspect-[16/9] items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_80%_15%,rgba(255,91,31,0.28),transparent_28%),linear-gradient(135deg,#07162f,#0d2c54)] p-8">
                  <div className="absolute inset-0 bg-[linear-gradient(rgba(115,231,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(115,231,255,0.08)_1px,transparent_1px)] bg-[size:34px_34px]" />
                  <div className="relative text-center">
                    <div className="mx-auto inline-flex rounded-[1.6rem] bg-white px-6 py-5 shadow-[0_22px_60px_rgba(0,0,0,0.24)]">
                      <img
                        src={fireTetraedroLogo}
                        alt="Fire Tetraedro"
                        className="h-16 w-auto md:h-20"
                      />
                    </div>
                    <p className="mt-5 text-sm font-bold uppercase tracking-[0.2em] text-cyan-200">
                      Portfólio corporativo 2026
                    </p>
                  </div>
                </div>
              )}

              <CardHeader className="space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="fire-app-chip">Documento PDF</div>
                  <span className="text-xs font-semibold text-muted-foreground">
                    {document.fileSize}
                  </span>
                </div>
                <CardTitle className="fire-display text-2xl text-slate-950">
                  {document.title}
                </CardTitle>
                <CardDescription className="text-sm leading-6 md:text-base">
                  {document.description}
                </CardDescription>
              </CardHeader>

              <CardContent className="flex flex-col gap-3 sm:flex-row">
                <Button className="flex-1" size="lg" asChild>
                  <a href={document.href} download={document.fileName}>
                    <Download className="mr-2 h-5 w-5" />
                    Baixar arquivo
                  </a>
                </Button>
                <Button className="flex-1" variant="outline" size="lg" asChild>
                  <a href={document.href} target="_blank" rel="noreferrer">
                    <ExternalLink className="mr-2 h-5 w-5" />
                    Visualizar PDF
                  </a>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <footer className="fire-app-note text-center text-sm leading-6 text-muted-foreground">
          Materiais oficiais da Fire Tetraedro. Para uma melhor experiência em dispositivos móveis, aguarde a conclusão do download antes de abrir o arquivo.
        </footer>
      </section>
    </FirePageShell>
  );
};

export default PublicPortfolio;
