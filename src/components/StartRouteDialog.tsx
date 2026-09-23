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
import { Truck, Lock, Unlock, PlayCircle, RotateCcw, ShieldAlert } from "lucide-react";
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
  const hasPassword = useStore((s) => !!s.adminPasswordHash);

  const [routeId, setRouteId] = useState(routes[0]?.id ?? "");
  const [values, setValues] = useState<Record<string, string>>({});
  const [unlocked, setUnlocked] = useState(false);
  const [showPasswordField, setShowPasswordField] = useState(false);
  const [password, setPassword] = useState("");
  const [verifying, setVerifying] = useState(false);

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
    setShowPasswordField(false);
    setPassword("");
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

  const tryUnlock = async () => {
    if (!hasPassword) {
      toast.error("Configura una contraseña de administrador en Ajustes");
      return;
    }
    setVerifying(true);
    try {
      const ok = await actions.verifyAdminPassword(password);
      if (!ok) {
        toast.error("Contraseña incorrecta");
        setVerifying(false);
        return;
      }
      setUnlocked(true);
      setShowPasswordField(false);
      setPassword("");
      toast.success("Edición desbloqueada");
    } catch (error) {
      console.error("Error unlocking:", error);
      toast.error("Error al verificar contraseña");
    } finally {
      setVerifying(false);
    }
  };

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
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
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
            <span className="font-semibold text-success flex items-center gap-1">
              <Unlock className="h-3.5 w-3.5" /> Desbloqueado
            </span>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowPasswordField(true)}
            >
              <Lock className="mr-1.5 h-3.5 w-3.5" /> Desbloquear edición
            </Button>
          )}
        </div>

        {showPasswordField && !unlocked && (
          <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-warning">
              <ShieldAlert className="h-4 w-4" /> Contraseña de administrador
            </div>
            <div className="flex gap-2">
              <Input
                type="password"
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && tryUnlock()}
                placeholder="••••"
                className="flex-1"
              />
              <Button
                size="sm"
                onClick={tryUnlock}
                disabled={verifying}
              >
                <Unlock className="mr-1 h-3.5 w-3.5" />
                {verifying ? "..." : "OK"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => { setShowPasswordField(false); setPassword(""); }}
              >
                ✕
              </Button>
            </div>
          </div>
        )}

        <div className="max-h-[40vh] space-y-2 overflow-y-auto">
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
                onChange={(e) =>
                  setValues({ ...values, [p.id]: e.target.value })
                }
                className="h-9 w-20 text-center"
              />
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-sm font-bold">
          <span className="text-muted-foreground">Total piezas</span>
          <span className="tabular-nums">{totalUnits}</span>
        </div>

        <DialogFooter className="flex flex-col gap-2 sm:flex-row">
          {unlocked && (
            <Button
              variant="outline"
              onClick={() =>
                setValues(Object.fromEntries(products.map((p) => [p.id, "0"])))
              }
              className="sm:mr-auto"
            >
              <RotateCcw className="mr-2 h-4 w-4" /> Todo en 0
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={start}>
            <PlayCircle className="mr-2 h-4 w-4" /> Iniciar ruta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
