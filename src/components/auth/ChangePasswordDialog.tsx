import { useEffect, useMemo, useState } from "react";
import { Loader2, LockKeyhole } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface ChangePasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  forceAttention?: boolean;
}

export const ChangePasswordDialog = ({
  open,
  onOpenChange,
  forceAttention = false,
}: ChangePasswordDialogProps) => {
  const { toast } = useToast();
  const { updatePassword } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setPassword("");
      setConfirmPassword("");
    }
  }, [open]);

  const validationMessage = useMemo(() => {
    if (!password && !confirmPassword) {
      return "";
    }

    if (password.length < 6) {
      return "A nova senha precisa ter no minimo 6 caracteres.";
    }

    if (password !== confirmPassword) {
      return "As senhas informadas nao coincidem.";
    }

    return "";
  }, [confirmPassword, password]);

  const canSubmit =
    password.length >= 6 &&
    confirmPassword.length >= 6 &&
    password === confirmPassword &&
    !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) {
      return;
    }

    try {
      setSubmitting(true);
      const { error } = await updatePassword(password);

      if (error) {
        throw error;
      }

      toast({
        title: "Senha atualizada",
        description: "Sua senha foi alterada com sucesso.",
      });
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Erro ao atualizar senha",
        description:
          error instanceof Error
            ? error.message
            : "Nao foi possivel atualizar a senha neste momento.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onPointerDownOutside={(event) => {
          if (forceAttention) {
            event.preventDefault();
          }
        }}
        className="sm:max-w-md"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LockKeyhole className="h-5 w-5" />
            Alterar Senha
          </DialogTitle>
          <DialogDescription>
            Use esta area para trocar sua senha provisoria ou atualizar sua senha
            atual com seguranca.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="change-password-new">Nova senha</Label>
            <Input
              id="change-password-new"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={submitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="change-password-confirm">Confirmar nova senha</Label>
            <Input
              id="change-password-confirm"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              disabled={submitting}
            />
          </div>

          {validationMessage ? (
            <p className="text-sm text-destructive">{validationMessage}</p>
          ) : null}

          <div className="flex justify-end gap-2">
            {!forceAttention ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
              >
                Cancelar
              </Button>
            ) : null}
            <Button type="button" onClick={() => void handleSubmit()} disabled={!canSubmit}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Salvar senha
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
