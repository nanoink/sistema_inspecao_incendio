import { useEffect, useMemo, useState } from "react";
import { Download, ExternalLink, Loader2, QrCode } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

interface PortfolioQrDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const buildPublicPortfolioUrl = () => {
  if (typeof window === "undefined") {
    return "/portfolio";
  }

  return new URL("/portfolio", window.location.origin).toString();
};

export const PortfolioQrDialog = ({ open, onOpenChange }: PortfolioQrDialogProps) => {
  const { toast } = useToast();
  const portfolioUrl = useMemo(buildPublicPortfolioUrl, [open]);
  const [qrCodePng, setQrCodePng] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const generateQrCode = async () => {
      if (!open) {
        return;
      }

      try {
        setLoading(true);
        const { toDataURL } = await import("qrcode");
        const dataUrl = await toDataURL(portfolioUrl, {
          type: "image/png",
          errorCorrectionLevel: "H",
          margin: 2,
          width: 960,
          color: {
            dark: "#07162f",
            light: "#ffffffff",
          },
        });

        if (!cancelled) {
          setQrCodePng(dataUrl);
        }
      } catch (error) {
        console.error("Error generating portfolio QR code:", error);

        if (!cancelled) {
          setQrCodePng("");
          toast({
            title: "Erro ao gerar QR Code",
            description: "Nao foi possivel gerar o QR Code do portfolio.",
            variant: "destructive",
          });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void generateQrCode();

    return () => {
      cancelled = true;
    };
  }, [open, portfolioUrl, toast]);

  const handleDownloadPng = () => {
    if (!qrCodePng) {
      return;
    }

    const link = document.createElement("a");
    link.href = qrCodePng;
    link.download = "qrcode-portfolio-fire-360.png";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md overflow-hidden border-white/70 p-0">
        <div className="bg-[radial-gradient(circle_at_85%_10%,rgba(255,91,31,0.24),transparent_30%),linear-gradient(135deg,#07162f,#0d2c54)] px-6 pb-5 pt-6 text-white">
          <DialogHeader>
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-cyan-200">
              <QrCode className="h-6 w-6" />
            </div>
            <DialogTitle className="fire-display text-2xl text-white">
              QR Code do portfólio
            </DialogTitle>
            <DialogDescription className="leading-6 text-white/70">
              A URL é montada dinamicamente para o ambiente atual. Ao ler o código, o visitante acessará a página pública de downloads.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-4 px-6 pb-6">
          <div className="mx-auto -mt-2 flex aspect-square max-w-[280px] items-center justify-center rounded-[1.75rem] border bg-white p-4 shadow-[0_20px_60px_rgba(7,22,47,0.12)]">
            {loading ? (
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            ) : qrCodePng ? (
              <img
                src={qrCodePng}
                alt="QR Code para a página pública do portfólio Fire 360"
                className="h-full w-full"
              />
            ) : (
              <p className="px-4 text-center text-sm text-muted-foreground">
                QR Code indisponível.
              </p>
            )}
          </div>

          <div className="break-all rounded-xl border bg-muted/25 p-3 text-xs leading-5 text-muted-foreground">
            {portfolioUrl}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" asChild>
              <a href={portfolioUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                Abrir página
              </a>
            </Button>
            <Button
              type="button"
              onClick={handleDownloadPng}
              disabled={!qrCodePng || loading}
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              Baixar PNG
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
