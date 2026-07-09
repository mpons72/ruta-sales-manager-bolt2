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
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { actions, useStore, productsForClients, getLastSaleForClient, type ClientSale } from "@/lib/store";
import { AdminPasswordPrompt } from "@/components/AdminPasswordPrompt";
import {
  Sparkles,
  Lock,
  PlayCircle,
  Search,
  Users,
  MapPin,
  Plus,
  X,
  ArrowUp,
  ArrowDown,
  Navigation,
  CreditCard,
} from "lucide-react";
import { toast } from "sonner";

export function StartTemporaryRouteDialog({
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
  const allClients = useStore((s) => s.clients);
  const routes = useStore((s) => s.routes);
  const lastInitial = useStore((s) => s.active?.initialInventory);
  const history = useStore((s) => s.history);

  const [step, setStep] = useState<"clients" | "load">("clients");
  // Orden de selección preservado en array
  const [selected, setSelected] = useState<string[]>([]);
  const [filter, setFilter] = useState("");
  const [routeFilter, setRouteFilter] = useState<string>("all");
  const [label, setLabel] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [unlocked, setUnlocked] = useState(false);
  const [askPwd, setAskPwd] = useState(false);
  const [optimizing, setOptimizing] = useState(false);

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

  const selectedClientObjs = useMemo(
    () => selected.map((id) => allClients.find((c) => c.id === id)).filter(Boolean) as typeof allClients,
    [selected, allClients],
  );
  const products = useMemo(
    () => productsForClients(allProducts, groups, selectedClientObjs),
    [allProducts, groups, selectedClientObjs],
  );

  useEffect(() => {
    if (!open) return;
    setStep("clients");
    setSelected([]);
    setFilter("");
    setRouteFilter("all");
    setLabel("");
    setUnlocked(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setValues(
      Object.fromEntries(
        products.map((p) => [p.id, String(lastInitial?.[p.id] ?? 50)]),
      ),
    );
  }, [open, products, lastInitial]);

  const routeNameById = useMemo(
    () => Object.fromEntries(routes.map((r) => [r.id, r.name])),
    [routes],
  );
  const clientById = useMemo(
    () => Object.fromEntries(allClients.map((c) => [c.id, c])),
    [allClients],
  );

  const visibleClients = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return allClients
      .filter((c) => c.active !== false)
      .filter((c) => routeFilter === "all" || c.routeId === routeFilter)
      .filter((c) => {
        if (!q) return true;
        return (
          c.name.toLowerCase().includes(q) ||
          (c.address ?? "").toLowerCase().includes(q) ||
          (routeNameById[c.routeId] ?? "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        // Agrupar por ruta y respetar visitOrder
        if (a.routeId !== b.routeId) {
          return (routeNameById[a.routeId] ?? "").localeCompare(
            routeNameById[b.routeId] ?? "",
          );
        }
        return (a.visitOrder ?? 0) - (b.visitOrder ?? 0);
      });
  }, [allClients, filter, routeFilter, routeNameById]);

  const totalUnits = useMemo(
    () => products.reduce((acc, p) => acc + Number(values[p.id] || 0), 0),
    [products, values],
  );

  const isSelected = (id: string) => selected.includes(id);
  const toggle = (id: string) =>
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  const remove = (id: string) =>
    setSelected((prev) => prev.filter((x) => x !== id));
  const move = (id: string, dir: -1 | 1) =>
    setSelected((prev) => {
      const i = prev.indexOf(id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  // Optimizar orden por cercanía (nearest-neighbor) desde mi ubicación actual.
  const optimizarRecorrido = async () => {
    if (selected.length < 2) {
      toast.info("Agrega al menos 2 clientes para optimizar");
      return;
    }
    setOptimizing(true);
    try {
      const { getCurrentPosition } = await import("@/lib/geo");
      let origin: { lat: number; lng: number } | null = null;
      try {
        origin = await getCurrentPosition();
      } catch {
        // Sin geo: usar el primer cliente seleccionado con coordenadas
        const first = selected
          .map((id) => clientById[id])
          .find((c) => c?.lat != null && c?.lng != null);
        if (first?.lat != null && first?.lng != null) {
          origin = { lat: first.lat, lng: first.lng };
        }
      }
      if (!origin) {
        toast.error(
          "No hay ubicación disponible ni clientes con coordenadas para optimizar",
        );
        return;
      }
      const withCoords = selected
        .map((id) => clientById[id])
        .filter((c) => c && c.lat != null && c.lng != null);
      const without = selected.filter(
        (id) =>
          !(clientById[id]?.lat != null && clientById[id]?.lng != null),
      );
      const order: string[] = [];
      const pool = [...withCoords];
      let cur = origin;
      const dist = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
        const dx = a.lat - b.lat;
        const dy = a.lng - b.lng;
        return dx * dx + dy * dy;
      };
      while (pool.length) {
        let bi = 0;
        let bd = Infinity;
        for (let i = 0; i < pool.length; i++) {
          const c = pool[i];
          const d = dist(cur, { lat: c.lat!, lng: c.lng! });
          if (d < bd) {
            bd = d;
            bi = i;
          }
        }
        const next = pool.splice(bi, 1)[0];
        order.push(next.id);
        cur = { lat: next.lat!, lng: next.lng! };
      }
      setSelected([...order, ...without]);
      toast.success("Orden optimizado por cercanía");
      if (without.length) {
        toast.info(
          `${without.length} cliente(s) sin coordenadas se colocaron al final`,
        );
      }
    } catch (e) {
      toast.error((e as Error).message || "No se pudo optimizar");
    } finally {
      setOptimizing(false);
    }
  };

  const start = () => {
    if (selected.length === 0) {
      toast.error("Selecciona al menos un cliente");
      return;
    }
    const inv: Record<string, number> = {};
    for (const p of products) inv[p.id] = Math.max(0, Number(values[p.id] || 0));

    actions.startTemporaryRoute(selected, inv, label);

    for (const clientId of selected) {
      const lastSale = getLastSaleForClient(clientId, history);
      if (lastSale && !lastSale.completed) {
        actions.saveClientSale(clientId, {
          existenciaAnterior: lastSale.existenciaAnterior ?? {},
          existenciaActual: lastSale.existenciaActual ?? {},
          surtido: lastSale.surtido ?? {},
          devolucion: lastSale.devolucion ?? {},
          completed: false,
          paymentType: lastSale.paymentType,
          priceSnapshot: lastSale.priceSnapshot,
          notes: lastSale.notes,
        });
      }
    }

    toast.success(`Ruta temporal iniciada con ${selected.length} clientes`);
    onStarted();
    onClose();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" /> Venta fuera de ruta
            </DialogTitle>
          </DialogHeader>

          {step === "clients" ? (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Mezcla clientes de cualquier ruta. Selecciona los que vas a visitar
                y arma el recorrido manualmente o deja que se optimice por cercanía.
              </p>

              <div className="grid gap-2">
                <Label>Etiqueta (opcional)</Label>
                <Input
                  placeholder="Ej. Pedido sábado, Evento, etc."
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-[1fr_auto] gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nombre, dirección o ruta…"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    className="pl-8"
                  />
                </div>
                <Select value={routeFilter} onValueChange={setRouteFilter}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Ruta" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las rutas</SelectItem>
                    {routes.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Lista de clientes activos */}
              <div className="rounded-md border border-border/50 bg-muted/20">
                <div className="flex items-center justify-between border-b border-border/40 px-3 py-2 text-xs">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Users className="h-3.5 w-3.5" /> {visibleClients.length} clientes activos
                  </span>
                  <span className="font-semibold text-primary">
                    {selected.length} seleccionados
                  </span>
                </div>
                <div className="max-h-[32vh] space-y-1 overflow-y-auto p-2">
                  {visibleClients.map((c) => {
                    const checked = isSelected(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => toggle(c.id)}
                        className={`flex w-full items-start gap-2 rounded-md border px-2.5 py-2 text-left transition-colors ${
                          checked
                            ? "border-primary bg-primary/10"
                            : "border-border/60 bg-background/40 hover:bg-muted/60"
                        }`}
                      >
                        <div
                          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                            checked
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-muted-foreground/40"
                          }`}
                        >
                          {checked ? (
                            <span className="text-[10px] font-bold">
                              {selected.indexOf(c.id) + 1}
                            </span>
                          ) : (
                            <Plus className="h-3 w-3 text-muted-foreground" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate text-sm font-medium">
                              {c.name}
                            </span>
                            {c.credit && (
                              <Badge
                                variant="outline"
                                className="h-4 gap-0.5 border-warning/50 bg-warning/10 px-1 text-[9px] text-warning"
                              >
                                <CreditCard className="h-2.5 w-2.5" /> Crédito
                              </Badge>
                            )}
                          </div>
                          <div className="truncate text-[11px] text-muted-foreground">
                            <span className="font-medium text-foreground/70">
                              {routeNameById[c.routeId] ?? "Sin ruta"}
                            </span>
                            {c.address ? ` · ${c.address}` : ""}
                          </div>
                          {c.lat != null && c.lng != null && (
                            <div className="mt-0.5 flex items-center gap-1 text-[10px] text-success/80">
                              <MapPin className="h-2.5 w-2.5" /> Ubicación guardada
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                  {visibleClients.length === 0 && (
                    <p className="py-6 text-center text-xs text-muted-foreground">
                      No hay clientes que coincidan.
                    </p>
                  )}
                </div>
              </div>

              {/* Lista de seleccionados ordenada */}
              {selected.length > 0 && (
                <div className="rounded-md border border-primary/40 bg-primary/5">
                  <div className="flex items-center justify-between border-b border-primary/30 px-3 py-2">
                    <span className="text-xs font-semibold text-primary">
                      Orden de visita ({selected.length})
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={optimizing || selected.length < 2}
                      onClick={optimizarRecorrido}
                      className="h-7 gap-1 text-[11px]"
                    >
                      <Navigation className="h-3 w-3" />
                      {optimizing ? "Optimizando…" : "Optimizar por cercanía"}
                    </Button>
                  </div>
                  <ol className="max-h-[28vh] space-y-1 overflow-y-auto p-2">
                    {selected.map((id, i) => {
                      const c = clientById[id];
                      if (!c) return null;
                      return (
                        <li
                          key={id}
                          className="flex items-center gap-2 rounded-md bg-background/60 px-2 py-1.5"
                        >
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                            {i + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium">
                              {c.name}
                            </div>
                            <div className="truncate text-[10px] text-muted-foreground">
                              {routeNameById[c.routeId] ?? "Sin ruta"}
                            </div>
                          </div>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            disabled={i === 0}
                            onClick={() => move(id, -1)}
                          >
                            <ArrowUp className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            disabled={i === selected.length - 1}
                            onClick={() => move(id, 1)}
                          >
                            <ArrowDown className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 text-destructive"
                            onClick={() => remove(id)}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              )}

              <DialogFooter className="gap-2 sm:gap-2">
                <Button variant="outline" onClick={onClose}>
                  Cancelar
                </Button>
                <Button
                  onClick={() => setStep("load")}
                  disabled={selected.length === 0}
                >
                  Siguiente: carga inicial
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-xs">
                <span className="text-muted-foreground">
                  Carga inicial por producto (piezas)
                </span>
                {unlocked ? (
                  <span className="font-semibold text-success">Desbloqueado</span>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => setAskPwd(true)}>
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

              <DialogFooter className="gap-2 sm:gap-2">
                <Button variant="outline" onClick={() => setStep("clients")}>
                  Atrás
                </Button>
                <Button onClick={start}>
                  <PlayCircle className="mr-2 h-4 w-4" /> Iniciar ruta temporal
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AdminPasswordPrompt
        open={askPwd}
        title="Modificar carga inicial"
        description="Ingresa la contraseña de administrador para editar las cantidades."
        onConfirm={handlePasswordConfirm}
        onClose={() => setAskPwd(false)}
      />
    </>
  );
}
