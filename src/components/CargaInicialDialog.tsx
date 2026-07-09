import { useEffect, useMemo, useState } from "react";
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
import { actions, useStore, productsForClients } from "@/lib/store";
import { Lock, Unlock, ShieldAlert, RotateCcw } from "lucide-react";
import { toast } from "sonner";

export function CargaInicialDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const allProducts = useStore((s) => s.products);
  const groups = useStore((s) => s.groups);
  const allClients = useStore((s) => s.clients);
  const active = useStore((s) => s.active);
  const hasPassword = useStore((s) => !!s.adminPasswordHash);

  const routeClients = useMemo(() => {
    if (!active) return [];
    if (active.clientIds && active.clientIds.length > 0) {
      const set = new Set(active.clientIds);
      return allClients.filter((c) => set.has(c.id));
    }
    return allClients.filter((c) => c.routeId === active.routeId && c.active !== false);
  }, [allClients, active]);

  const products = useMemo(
    () => productsForClients(allProducts, groups, routeClients),
    [allProducts, groups, routeClients],
  );

  const [unlocked, setUnlocked] = useState(false);
  const [password, setPassword] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setUnlocked(false);
      setPassword("");
      setValues(
        Object.fromEntries(
          products.map((p) => [p.id, String(active?.initialInventory[p.id] ?? 0)]),
        ),
      );
    }
  }, [open, products, active]);

  const tryUnlock = async () => {
    if (!hasPassword) {
      toast.error("Configura una contraseña de administrador en Ajustes");
      return;
    }
    try {
      const ok = await actions.verifyAdminPassword(password);
      if (!ok) {
        toast.error("Contraseña incorrecta");
        return;
      }
      setUnlocked(true);
      toast.success("Edición desbloqueada");
    } catch (error) {
      console.error("Error unlocking:", error);
      toast.error("Error al desbloquear edición");
    }
  };

  const save = () => {
    const inv: Record<string, number> = {};
    for (const p of products) inv[p.id] = Math.max(0, Number(values[p.id] || 0));
    actions.updateInitialInventory(inv);
    toast.success("Carga inicial actualizada");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {unlocked ? <Unlock className="h-4 w-4 text-success" /> : <Lock className="h-4 w-4" />}
            Modificar carga inicial
          </DialogTitle>
        </DialogHeader>

        {!unlocked && (
          <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs">
            <div className="flex items-center gap-2 font-semibold text-warning">
              <ShieldAlert className="h-4 w-4" /> Acción protegida
            </div>
            <p className="mt-1 text-muted-foreground">
              {hasPassword
                ? "Ingresa la contraseña de administrador para desbloquear los campos."
                : "No hay contraseña configurada. Ve a Ajustes y crea una antes de continuar."}
            </p>
          </div>
        )}

        {!unlocked && hasPassword && (
          <div className="grid gap-2">
            <Label>Contraseña de administrador</Label>
            <Input
              type="password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && tryUnlock()}
              placeholder="••••"
            />
            <Button onClick={tryUnlock}>
              <Unlock className="mr-2 h-4 w-4" /> Desbloquear
            </Button>
          </div>
        )}

        <div className="max-h-[50vh] space-y-2 overflow-y-auto">
          {products.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-2 rounded-md bg-muted/40 px-2 py-1.5"
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium break-words">{p.name}</div>
                <div className="text-[10px] text-muted-foreground">
                  ${p.price.toFixed(2)}
                </div>
              </div>
              <Input
                type="number"
                min={0}
                value={values[p.id] ?? ""}
                disabled={!unlocked}
                onChange={(e) => setValues({ ...values, [p.id]: e.target.value })}
                className="h-9 w-20 text-center"
              />
            </div>
          ))}
        </div>

        <DialogFooter className="flex flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            disabled={!unlocked}
            onClick={() => {
              setValues(Object.fromEntries(products.map((p) => [p.id, "0"])));
              toast.info("Todos los valores en 0");
            }}
            className="sm:mr-auto"
          >
            <RotateCcw className="mr-2 h-4 w-4" /> Todo en 0
          </Button>
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
          <Button onClick={save} disabled={!unlocked}>
            Guardar carga
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
