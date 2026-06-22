import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { actions, useStore } from "@/lib/store";
import { Lock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export function AdminPasswordCard() {
  const isSet = useStore((s) => !!s.adminPasswordHash);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (next.length < 4) {
      toast.error("La contraseña debe tener al menos 4 caracteres");
      return;
    }
    if (next !== confirm) {
      toast.error("Las contraseñas no coinciden");
      return;
    }
    setLoading(true);
    try {
      await actions.setAdminPassword(next, current);
      toast.success(isSet ? "Contraseña actualizada" : "Contraseña establecida");
      setCurrent(""); setNext(""); setConfirm("");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-5">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
          {isSet ? <ShieldCheck className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
        </div>
        <div>
          <div className="font-semibold">Contraseña de Administrador</div>
          <div className="text-xs text-muted-foreground">
            {isSet
              ? "Requerida para modificar la carga inicial."
              : "Configura una contraseña para proteger la carga inicial."}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3">
        {isSet && (
          <div>
            <Label>Contraseña actual</Label>
            <Input
              type="password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              placeholder="••••"
            />
          </div>
        )}
        <div>
          <Label>{isSet ? "Nueva contraseña" : "Contraseña"}</Label>
          <Input
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            placeholder="Mínimo 4 caracteres"
          />
        </div>
        <div>
          <Label>Confirmar</Label>
          <Input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Repite la contraseña"
          />
        </div>
        <Button onClick={submit} disabled={loading}>
          {isSet ? "Cambiar contraseña" : "Guardar contraseña"}
        </Button>
      </div>
    </Card>
  );
}
