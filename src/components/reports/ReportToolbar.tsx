import { useState } from "react";
import { ArrowLeft, FileCheck, Loader2, Printer, RefreshCcw, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ReportToolbarProps {
  navigateBack: () => void;
  onSync: () => void;
  onPrint: () => void;
  onSaveDraft: () => void;
  onFinalize: () => void;
  onStartNewCycle?: () => void;
  saving: boolean;
  printing?: boolean;
  snapshotIsCurrent: boolean;
  statusLabel: string;
  finalizeLabel: string;
  showStartNewCycle?: boolean;
}

export const ReportToolbar = ({
  navigateBack, onSync, onPrint, onSaveDraft, onFinalize, onStartNewCycle,
  saving, printing = false, snapshotIsCurrent, statusLabel, finalizeLabel,
  showStartNewCycle = false,
}: ReportToolbarProps) => {
  const [confirmNewCycle, setConfirmNewCycle] = useState(false);
  return (
    <div className="report-controls flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="ghost" size="sm" className="w-full sm:w-auto" onClick={navigateBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />Voltar
        </Button>
        <Badge variant="outline">{statusLabel}</Badge>
        <Badge variant="outline">{snapshotIsCurrent ? "Checklist sincronizado" : "Checklist desatualizado"}</Badge>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap" data-testid="report-actions">
        <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={onSync} disabled={saving}>
          <RefreshCcw className="mr-2 h-4 w-4" />Atualizar com checklist
        </Button>
        <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={onPrint} disabled={saving || printing}>
          {printing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Preparando PDF</> : <><Printer className="mr-2 h-4 w-4" />Imprimir / PDF</>}
        </Button>
        <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={onSaveDraft} disabled={saving}>
          {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando</> : <><Save className="mr-2 h-4 w-4" />Salvar rascunho</>}
        </Button>
        {/* Finalizar mantém sempre a mesma posição, inclusive depois de salvar. */}
        <Button type="button" className="w-full sm:w-auto" onClick={onFinalize} disabled={saving}>
          {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando</> : <><FileCheck className="mr-2 h-4 w-4" />{finalizeLabel}</>}
        </Button>
        {showStartNewCycle && onStartNewCycle ? (
          <Button type="button" variant="outline" className="w-full border-amber-300 text-amber-900 sm:w-auto" onClick={() => setConfirmNewCycle(true)} disabled={saving}>
            <RefreshCcw className="mr-2 h-4 w-4" />Encerrar ciclo e iniciar novo
          </Button>
        ) : null}
      </div>
      <AlertDialog open={confirmNewCycle} onOpenChange={setConfirmNewCycle}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Encerrar ciclo e iniciar novo?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação arquiva o ciclo atual e abre um novo ciclo com checklists pendentes.
              Ela não é necessária para finalizar ou imprimir o relatório. Continue somente
              se quiser iniciar uma nova rodada de inspeções.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancelar e manter ciclo atual</AlertDialogCancel>
            <AlertDialogAction disabled={saving || !showStartNewCycle || !onStartNewCycle} onClick={() => onStartNewCycle?.()}>
              Confirmar início de novo ciclo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
