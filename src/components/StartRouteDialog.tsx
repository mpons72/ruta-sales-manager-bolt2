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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { actions, useStore, productsForClients } from "@/lib/store";
import { AdminPasswordPrompt } from "@/components/AdminPasswordPrompt";
import { Truck, Lock, PlayCircle } from "lucide-react";
import { toast } from "sonner";

export function StartRouteDialog({
  open,
  onClose,
  onStarted,
}: {
  open: boolean;
  onClose: () => void;
  onStarted: () => void;
}) {
  const allProducts = useStore((s) => s.products);
  const groups = useStore((s) => s.groups);
  const routes = useStore((s) => s.routes);
  const allClients = useStore((s) => s.clients);
  const lastInitial = useStore((s) => s.active?.initialInventory);

  const [routeId, setRouteId] = useState(routes[0]?.id ?? "");
  const [values, setValues] = useState<Record<string, string>>({});
  const [unlocked, setUnlocked] = useState(false);
  const [askPwd, setAskPwd] = useState(false);

  const handlePasswordConfirm = () => {
    setUnlocked(true);
    toast.success("Edición desbloqueada");
    setAskPwd(false);
  };

  const handleDialogOpenChange = (open: boolean) => {
    if (!open && askPwd) {
      // Prevenir que el diálogo principal se cierre mientras el diálogo de contraseña está abierto
      return;
    }
    if (!open) {
      onClose();
    }
  };

  const routeClients = useMemo(
    () => allClients.filter((c) => c.routeId === routeId && c.active !== false),
    [allClients, routeId],
  );
  const products = useMemo(
    () => productsForClients(allProducts, groups, routeClients),
    [allProducts, groups, routeClients],
  );

  useEffect(() => {
    if (!open) return;
    setRouteId(routes[0]?.id ?? "");
    setUnlocked(false);
  }, [open, routes]);

  useEffect(() => {
    if (!open) return;
    setValues(
      Object.fromEntries(
        products.map((p) => [p.id, String(lastInitial?.[p.id] ?? 50)]),
      ),
    );
  }, [open, products, lastInitial]);

  const totalUnits = useMemo(
    () => products.reduce((acc, p) => acc + Number(values[p.id] || 0), 0),
    [products, values],
  );

  const start = () => {
    if (!routeId) {
      toast.error("Selecciona una ruta");
      return;
    }
    const inv: Record<string, number> = {};
    for (const p of products) inv[p.id] = Math.max(0, Number(values[p.id] || 0));
    actions.startRoute(routeId, inv);
    toast.success("Ruta iniciada con la carga indicada");
    onStarted();
    onClose();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-primary" /> Preparación de carga
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-2">
            <Label>Ruta</Label>
            <Select value={routeId} onValueChange={setRouteId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona una ruta" />
              </SelectTrigger>
              <SelectContent>
                {routes.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-xs">
            <span className="text-muted-foreground">
              Carga inicial por producto (piezas)
            </span>
            {unlocked ? (
              <span className="font-semibold text-success">Desbloqueado</span>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setAskPwd(true)}
              >
                <Lock className="mr-1.5 h-3.5 w-3.5" /> Desbloquear edición
              </Button>
            )}
          </div>

          <div className="max-h-[45vh] space-y-2 overflow-y-auto">
            {products.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-2 rounded-md bg-muted/30 px-2 py-1.5"
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

          <div className="flex items-center justify-between rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-sm font-bold">
            <span className="text-muted-foreground">Total piezas</span>
            <span className="tabular-nums">{totalUnits}</span>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={start}>
              <PlayCircle className="mr-2 h-4 w-4" /> Iniciar ruta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AdminPasswordPrompt
        open={askPwd}
        title="Modificar carga inicial"
        description="Ingresa la contraseña de administrador para editar las cantidades."
        onConfirm={handlePasswordConfirm}
        onClose={() => setAskPwd(false)}
        closeOnConfirm={false}
      />
    </>
  );
}
