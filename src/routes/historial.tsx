import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { actions, useStore, clientSaleAmount, getLastSaleForClient, type HistoryEntry, type ClientSale } from "@/lib/store";
import { AdminPasswordPrompt } from "@/components/AdminPasswordPrompt";
import { ReceiptDialog } from "@/components/ReceiptDialog";
import type { RemisionData } from "@/lib/remision";
import { Lock, Pencil, Trash2, FileText, ShieldCheck, Printer, Receipt, Plus, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/historial")({
  head: () => ({
    meta: [
      { title: "Historial — SalsaRuta" },
      { name: "description", content: "Reportes y registros pasados de rutas." },
    ],
  }),
  component: HistorialPage,
});

function currency(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
}

type Pending =
  | { kind: "delete"; endedAt: string }
  | { kind: "edit"; endedAt: string; label: string }
  | { kind: "addSale"; endedAt: string; sale: Record<string, ClientSale> };

function HistorialPage() {
  const history = useStore((s) => s.history);
  const routes = useStore((s) => s.routes);
  const products = useStore((s) => s.products);
  const allClients = useStore((s) => s.clients);
  const audit = useStore((s) => s.audit);
  const hasActiveRoute = useStore((s) => s.active !== null);

  const [pending, setPending] = useState<Pending | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [labelDraft, setLabelDraft] = useState("");
  const [notasFor, setNotasFor] = useState<HistoryEntry | null>(null);
  const [receiptData, setReceiptData] = useState<RemisionData | null>(null);
  
  // Estado para agregar venta
  const [addSaleFor, setAddSaleFor] = useState<HistoryEntry | null>(null);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [productQuantities, setProductQuantities] = useState<Record<string, string>>({});
  const [productDevoluciones, setProductDevoluciones] = useState<Record<string, string>>({});
  const [productAntes, setProductAntes] = useState<Record<string, string>>({});
  const [addSalePassword, setAddSalePassword] = useState(false);
  
  // Estado para filtro por ruta
  const [selectedRouteId, setSelectedRouteId] = useState<string>("all");

  const totalsFor = (h: HistoryEntry) => {
    let total = 0;
    let visits = 0;
    for (const sale of Object.values(h.sales ?? {})) {
      if (!sale?.completed) continue;
      visits += 1;
      total += clientSaleAmount(sale, products);
    }
    return { total, visits };
  };

  // Filtrar historial por ruta (incluir rutas temporales cuando se selecciona "all")
  const filteredHistory = selectedRouteId === "all"
    ? history
    : history.filter(h => h.routeId === selectedRouteId && !h.temporary && h.routeId !== "__tmp__");

  const confirmAction = () => {
    if (!pending) return;
    if (pending.kind === "delete") {
      actions.deleteHistoryEntry(pending.endedAt);
      toast.success("Registro eliminado");
    } else if (pending.kind === "edit") {
      actions.updateHistoryEntry(pending.endedAt, { label: pending.label });
      toast.success("Etiqueta actualizada");
      setEditingId(null);
    } else if (pending.kind === "addSale") {
      actions.updateHistoryEntry(pending.endedAt, { sales: pending.sale });
      toast.success("Venta agregada");
      setAddSaleFor(null);
      setSelectedClientId("");
      setProductQuantities({});
      setProductDevoluciones({});
      setProductAntes({});
    }
  };

  return (
    <div className="min-h-screen" style={{ background: "var(--gradient-warm)" }}>
      <AppHeader />
      <main className="mx-auto max-w-3xl px-4 py-5 space-y-4">
        <div>
          <h1 className="mb-1 text-3xl font-extrabold">Historial</h1>
          <p className="text-sm text-muted-foreground">
            Rutas cerradas. La modificación, eliminación y agregación de ventas están protegidas
            con contraseña de administrador.
          </p>
        </div>

        {/* Filtro por ruta */}
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Filtrar por ruta:</label>
          <Select value={selectedRouteId} onValueChange={setSelectedRouteId}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Todas las rutas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las rutas</SelectItem>
              {routes.map((r) => {
                // Obtener fechas de visita para esta ruta
                const routeDates = history
                  .filter(h => h.routeId === r.id)
                  .map(h => new Date(h.date).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" }));
                const uniqueDates = [...new Set(routeDates)].sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
                const dateText = uniqueDates.length > 0 ? ` (${uniqueDates.join(", ")})` : "";
                return (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}{dateText}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        {filteredHistory.length === 0 && (
          <Card className="p-6 text-center text-sm text-muted-foreground">
            {selectedRouteId === "all" ? "Aún no hay rutas en el historial." : "No hay registros para esta ruta."}
          </Card>
        )}

        <div className="space-y-3">
          {filteredHistory.map((h) => {
            const route = routes.find((r) => r.id === h.routeId);
            const { total, visits } = totalsFor(h);
            const date = new Date(h.date);
            const isEditing = editingId === h.endedAt;
            const isTemporary = h.temporary || h.routeId === "__tmp__";
            const routeName = isTemporary ? (h.label || "Venta fuera de ruta") : (route?.name || "Ruta desconocida");
            return (
              <Card key={h.endedAt} className="p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    {isEditing ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <Input
                          autoFocus
                          value={labelDraft}
                          onChange={(e) => setLabelDraft(e.target.value)}
                          placeholder="Etiqueta del registro"
                          className="max-w-xs"
                        />
                        <Button
                          size="sm"
                          onClick={() => {
                            if (!labelDraft.trim()) {
                              toast.error("La etiqueta no puede estar vacía");
                              return;
                            }
                            setPending({
                              kind: "edit",
                              endedAt: h.endedAt,
                              label: labelDraft.trim(),
                            });
                          }}
                        >
                          <Lock className="mr-1.5 h-3.5 w-3.5" /> Guardar
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                          Cancelar
                        </Button>
                      </div>
                    ) : (
                      <>
                        <div className="text-lg font-extrabold break-words">
                          {routeName}
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          {date.toLocaleDateString("es-MX", {
                            weekday: "short",
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </div>
                        <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
                          <span className="text-2xl font-extrabold tabular-nums text-primary">
                            {currency(total)}
                          </span>
                          <span className="text-base font-semibold tabular-nums">
                            {visits} visitas
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    <Button asChild size="sm" variant="outline">
                      <Link to="/reporte" search={{ h: h.endedAt }}>
                        <FileText className="mr-1.5 h-3.5 w-3.5" /> Ver
                      </Link>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      title="Agregar venta faltante (requiere contraseña)"
                      onClick={() => {
                        setAddSaleFor(h);
                        setSelectedClientId("");
                        setProductQuantities({});
                        setProductDevoluciones({});
                        setProductAntes({});
                      }}
                    >
                      <Lock className="mr-1 h-3 w-3" />
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      title="Notas de remisión"
                      onClick={() => setNotasFor(h)}
                    >
                      <Receipt className="mr-1.5 h-3.5 w-3.5" /> Notas
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      title="Modificar (requiere contraseña)"
                      onClick={() => {
                        setLabelDraft(h.label ?? route?.name ?? "");
                        setEditingId(h.endedAt);
                      }}
                    >
                      <Lock className="mr-1 h-3 w-3" />
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      title="Eliminar (requiere contraseña)"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setPending({ kind: "delete", endedAt: h.endedAt })}
                    >
                      <Lock className="mr-1 h-3 w-3" />
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {audit.length > 0 && (
          <Card className="p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <ShieldCheck className="h-4 w-4 text-primary" /> Registro de seguridad
            </div>
            <ul className="space-y-1.5 text-xs text-muted-foreground">
              {audit.slice(0, 10).map((a) => (
                <li key={a.id} className="flex flex-wrap gap-x-2">
                  <span className="tabular-nums">
                    {new Date(a.at).toLocaleString("es-MX")}
                  </span>
                  <span className="font-medium text-foreground">
                    {a.action === "delete_history" ? "Eliminó" : "Editó"} registro
                  </span>
                  {a.details && <span>· {a.details}</span>}
                  <span>· admin</span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </main>

      <AdminPasswordPrompt
        open={!!pending}
        title={pending?.kind === "delete" ? "Eliminar registro" : pending?.kind === "addSale" ? "Agregar venta" : "Modificar registro"}
        description={
          pending?.kind === "delete"
            ? "Esta acción no se puede deshacer. Confirma con la contraseña de administrador."
            : pending?.kind === "addSale"
            ? "Esta corrección se aplicará al mismo día de la ruta cerrada (mismo día detectado). Confirma con la contraseña de administrador."
            : "Ingresa la contraseña de administrador para guardar los cambios."
        }
        onConfirm={confirmAction}
        onClose={() => {
          setPending(null);
          setAddSalePassword(false);
        }}
      />

      <Dialog open={!!notasFor} onOpenChange={(o) => !o && setNotasFor(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Notas de remisión</DialogTitle>
          </DialogHeader>
          {notasFor && (() => {
            const entries = Object.entries(notasFor.sales ?? {}).filter(([, s]) => s?.completed);
            if (entries.length === 0) {
              return <p className="text-sm text-muted-foreground">Esta ruta no tiene ventas registradas.</p>;
            }
            return (
              <div className="max-h-[60vh] space-y-2 overflow-y-auto">
                {entries.map(([cid, sale]) => {
                  const c = allClients.find((x) => x.id === cid);
                  const name = c?.name ?? `Cliente ${cid.slice(0, 6)}`;
                  const amount = clientSaleAmount(sale, products);
                  return (
                    <div key={cid} className="flex items-center justify-between gap-2 rounded-lg border p-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">{name}</div>
                        <div className="text-xs text-muted-foreground">${amount.toFixed(2)}</div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setReceiptData({
                            client: { name, address: c?.address },
                            sale,
                            products,
                            date: notasFor.date,
                            folio: new Date(notasFor.endedAt).getTime().toString(36).toUpperCase().slice(-6) + "-" + cid.slice(0, 3).toUpperCase(),
                          })
                        }
                      >
                        <Printer className="mr-1.5 h-3.5 w-3.5" /> Imprimir
                      </Button>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      <Dialog open={!!addSaleFor} onOpenChange={(o) => !o && setAddSaleFor(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Agregar venta faltante</DialogTitle>
          </DialogHeader>
          {addSaleFor && (() => {
            const routeClients = allClients.filter((c) => c.routeId === addSaleFor.routeId && c.active !== false);
            const clientsWithoutSale = routeClients.filter((c) => !addSaleFor.sales?.[c.id]?.completed);
            
            const handleAddSale = () => {
              if (!selectedClientId) {
                toast.error("Selecciona un cliente");
                return;
              }

              const surtido: Record<string, number> = {};
              for (const [pid, qtyStr] of Object.entries(productQuantities)) {
                const qty = parseInt(qtyStr, 10) || 0;
                if (qty > 0) surtido[pid] = qty;
              }

              const devolucion: Record<string, number> = {};
              for (const [pid, qtyStr] of Object.entries(productDevoluciones)) {
                const qty = parseInt(qtyStr, 10) || 0;
                if (qty > 0) devolucion[pid] = qty;
              }

              const existenciaAnterior: Record<string, number> = {};
              for (const [pid, qtyStr] of Object.entries(productAntes)) {
                const qty = parseInt(qtyStr, 10);
                if (Number.isFinite(qty) && qty >= 0) existenciaAnterior[pid] = qty;
              }

              if (Object.keys(surtido).length === 0) {
                toast.error("Agrega al menos un producto con cantidad de surtido");
                return;
              }

              const sale: ClientSale = {
                completed: true,
                surtido,
                devolucion,
                existenciaAnterior,
                existenciaActual: {},
                paymentType: "cash",
                notes: "",
              };

              // Comparar fecha de la ruta histórica vs hoy. Si son el mismo día,
              // se asume que la ruta se cerró por error el mismo día y se corrige
              // directamente en ese registro histórico. Si hoy es una fecha posterior,
              // significa que el cliente se está atendiendo durante una ruta diferente
              // actualmente activa, y la venta + descuento de inventario debe aplicarse
              // a esa ruta activa de HOY, no al historial viejo.
              const historyDateStr = new Date(addSaleFor.date).toDateString();
              const todayStr = new Date().toDateString();
              const isSameDay = historyDateStr === todayStr;

              if (isSameDay) {
                setPending({
                  kind: "addSale",
                  endedAt: addSaleFor.endedAt,
                  sale: { ...addSaleFor.sales, [selectedClientId]: sale },
                });
                setAddSaleFor(null);
              } else {
                if (!hasActiveRoute) {
                  toast.error(
                    "No hay una ruta activa hoy. Inicia la ruta del día actual antes de completar esta venta — así el inventario se descuenta correctamente del día de hoy."
                  );
                  return;
                }
                actions.saveClientSale(selectedClientId, sale);
                toast.success(
                  "Venta registrada en la ruta activa de hoy — el inventario se descontó del día actual."
                );
                setAddSaleFor(null);
                setSelectedClientId("");
                setProductQuantities({});
                setProductDevoluciones({});
                setProductAntes({});
              }
            };
            
            return (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Cliente faltante</label>
                  <select
                    value={selectedClientId}
                    onChange={(e) => {
                      const clientId = e.target.value;
                      setSelectedClientId(clientId);
                      if (clientId) {
                        const draft = getLastSaleForClient(clientId, history);
                        if (draft && !draft.completed && draft.existenciaAnterior) {
                          const prefilled: Record<string, string> = {};
                          for (const [pid, val] of Object.entries(draft.existenciaAnterior)) {
                            prefilled[pid] = String(val);
                          }
                          setProductAntes(prefilled);
                          toast.info("Se recuperaron datos de existencia capturados en campo");
                        } else {
                          setProductAntes({});
                        }
                      } else {
                        setProductAntes({});
                      }
                    }}
                    className="w-full mt-1 p-2 border rounded-md"
                  >
                    <option value="">-- Seleccionar cliente --</option>
                    {clientsWithoutSale.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                
                {selectedClientId && (
                  <div>
                    <label className="text-sm font-medium">Productos vendidos (Antes / Surtidas / Devoluciones / Total)</label>
                    <div className="max-h-[40vh] space-y-2 overflow-y-auto mt-1">
                      {products.map((p) => {
                        const surtido = parseInt(productQuantities[p.id]) || 0;
                        const devolucion = parseInt(productDevoluciones[p.id]) || 0;
                        const total = surtido - devolucion;
                        return (
                          <div key={p.id} className="flex items-center gap-2">
                            <span className="flex-1 text-sm">{p.name}</span>
                            <Input
                              type="number"
                              min={0}
                              value={productAntes[p.id] ?? ""}
                              onChange={(e) => setProductAntes({ ...productAntes, [p.id]: e.target.value })}
                              className="w-16"
                              placeholder="Antes"
                              title="Existencia anterior"
                            />
                            <Input
                              type="number"
                              min={0}
                              value={productQuantities[p.id] ?? ""}
                              onChange={(e) => setProductQuantities({ ...productQuantities, [p.id]: e.target.value })}
                              className="w-16"
                              placeholder="Surtidas"
                              title="Surtidas"
                            />
                            <Input
                              type="number"
                              min={0}
                              value={productDevoluciones[p.id] ?? ""}
                              onChange={(e) => setProductDevoluciones({ ...productDevoluciones, [p.id]: e.target.value })}
                              className="w-16"
                              placeholder="Devoluciones"
                              title="Devoluciones"
                            />
                            <span className="w-16 text-center text-sm font-medium">{total}</span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex items-center gap-2 mt-2 pt-2 border-t">
                      <span className="flex-1 text-sm font-semibold">Totales</span>
                      <span className="w-16 text-center text-sm font-semibold">
                        {Object.values(productAntes).reduce((sum, val) => sum + (parseInt(val) || 0), 0)}
                      </span>
                      <span className="w-16 text-center text-sm font-semibold">
                        {Object.values(productQuantities).reduce((sum, val) => sum + (parseInt(val) || 0), 0)}
                      </span>
                      <span className="w-16 text-center text-sm font-semibold">
                        {Object.values(productDevoluciones).reduce((sum, val) => sum + (parseInt(val) || 0), 0)}
                      </span>
                      <span className="w-16 text-center text-sm font-semibold">
                        {Object.values(productQuantities).reduce((sum, val) => sum + (parseInt(val) || 0), 0) - Object.values(productDevoluciones).reduce((sum, val) => sum + (parseInt(val) || 0), 0)}
                      </span>
                    </div>
                    <div className="mt-3 pt-3 border-t space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-semibold">Total piezas vendidas:</span>
                        <span className="text-sm font-bold">
                          {Object.values(productQuantities).reduce((sum, val) => sum + (parseInt(val) || 0), 0) - Object.values(productDevoluciones).reduce((sum, val) => sum + (parseInt(val) || 0), 0)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-semibold">Total dinero cobrando:</span>
                        <span className="text-sm font-bold">
                          {currency(
                            products.reduce((total, p) => {
                              const surtido = parseInt(productQuantities[p.id]) || 0;
                              const devolucion = parseInt(productDevoluciones[p.id]) || 0;
                              const vendidas = surtido - devolucion;
                              return total + (vendidas * p.price);
                            }, 0)
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
                
                <DialogFooter>
                  <Button variant="outline" onClick={() => setAddSaleFor(null)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleAddSale} disabled={!selectedClientId}>
                    <Lock className="mr-1.5 h-3.5 w-3.5" /> Guardar
                  </Button>
                </DialogFooter>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      <ReceiptDialog 
        open={receiptData !== null}
        onOpenChange={(open) => !open && setReceiptData(null)}
        data={receiptData || undefined}
      />
    </div>
  );
}
