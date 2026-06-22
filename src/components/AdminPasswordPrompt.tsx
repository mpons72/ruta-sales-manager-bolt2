import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { actions } from "@/lib/store";
import { ShieldAlert, Unlock } from "lucide-react";
import { toast } from "sonner";

export function AdminPasswordPrompt({
  open,
  title = "Acción protegida",
  description = "Ingresa la contraseña de administrador para continuar.",
  onConfirm,
  onClose,
  closeOnConfirm = true,
}: {
  open: boolean;
  title?: string;
  description?: string;
  onConfirm: () => void;
  onClose: () => void;
  closeOnConfirm?: boolean;
}) {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) setPassword("");
  }, [open]);

  const submit = async () => {
    setLoading(true);
    try {
      const ok = await actions.verifyAdminPassword(password);
      if (!ok) {
        toast.error("Acceso denegado: contraseña incorrecta");
        setLoading(false);
        return;
      }
      onConfirm();
      if (closeOnConfirm) {
        onClose();
      }
    } catch (error) {
      console.error("Error verifying password:", error);
      toast.error("Error al verificar contraseña");
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-warning" />
            {title}
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{description}</p>
        <div className="grid gap-2">
          <Label>Contraseña de administrador</Label>
          <Input
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="••••"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={loading}>
            <Unlock className="mr-2 h-4 w-4" /> Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
