import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { actions, useStore, clientSaleAmount, type HistoryEntry, type ClientSale } from "@/lib/store";
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

        {history.length === 0 && (
          <Card className="p-6 text-center text-sm text-muted-foreground">
            Aún no hay rutas en el historial.
          </Card>
        )}

        <div className="space-y-3">
          {history.map((h) => {
            const route = routes.find((r) => r.id === h.routeId);
            const { total, visits } = totalsFor(h);
            const date = new Date(h.date);
            const isEditing = editingId === h.endedAt;
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
                          {h.label ?? route?.name ?? "Ruta"}
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
            ? "Confirma la contraseña de administrador para agregar la venta faltante."
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
            
            const handleClientChange = (clientId: string) => {
              setSelectedClientId(clientId);
              if (clientId && addSaleFor?.sales?.[clientId]) {
                const draft = addSaleFor.sales[clientId];
                const antes: Record<string, string> = {};
                for (const [pid, qty] of Object.entries(draft.existenciaAnterior ?? {})) {
                  if (qty > 0) antes[pid] = String(qty);
                }
                setProductAntes(antes);
                const surtido: Record<string, string> = {};
                for (const [pid, qty] of Object.entries(draft.surtido ?? {})) {
                  if (qty > 0) surtido[pid] = String(qty);
                }
                setProductQuantities(surtido);
                const dev: Record<string, string> = {};
                for (const [pid, qty] of Object.entries(draft.devolucion ?? {})) {
                  if (qty > 0) dev[pid] = String(qty);
                }
                setProductDevoluciones(dev);
              } else {
                setProductAntes({});
                setProductQuantities({});
                setProductDevoluciones({});
              }
            };

            const handleAddSale = () => {
              if (!selectedClientId) {
                toast.error("Selecciona un cliente");
                return;
              }
              
              // Crear venta vacía
              const sale: ClientSale = {
                completed: true,
                surtido: {},
                devolucion: {},
                paymentType: "cash",
                existenciaAnterior: {},
                existenciaActual: {},
                notes: "",
              };
              
              // Agregar productos seleccionados (surtido)
              for (const [pid, qtyStr] of Object.entries(productQuantities)) {
                const qty = parseInt(qtyStr, 10) || 0;
                if (qty > 0) {
                  sale.surtido[pid] = qty;
                }
              }
              
              // Agregar devoluciones
              for (const [pid, qtyStr] of Object.entries(productDevoluciones)) {
                const qty = parseInt(qtyStr, 10) || 0;
                if (qty > 0) {
                  sale.devolucion[pid] = qty;
                }
              }
              
              // Agregar existencia anterior
              for (const [pid, qtyStr] of Object.entries(productAntes)) {
                const qty = parseInt(qtyStr, 10) || 0;
                if (qty >= 0) {
                  sale.existenciaAnterior[pid] = qty;
                }
              }
              
              if (Object.keys(sale.surtido).length === 0) {
                toast.error("Agrega al menos un producto con cantidad de surtido");
                return;
              }
              
              setPending({
                kind: "addSale",
                endedAt: addSaleFor.endedAt,
                sale: { ...addSaleFor.sales, [selectedClientId]: sale },
              });
              setAddSaleFor(null);
            };
            
            return (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Cliente faltante</label>
                  <select
                    value={selectedClientId}
                    onChange={(e) => handleClientChange(e.target.value)}
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
                    <label className="text-sm font-medium">Productos vendidos (Surtido / Devoluciones / Antes)</label>
                    <div className="max-h-[40vh] space-y-2 overflow-y-auto mt-1">
                      {products.map((p) => (
                        <div key={p.id} className="flex items-center gap-2">
                          <span className="flex-1 text-sm">{p.name}</span>
                          <Input
                            type="number"
                            min={0}
                            value={productQuantities[p.id] ?? ""}
                            onChange={(e) => setProductQuantities({ ...productQuantities, [p.id]: e.target.value })}
                            className="w-16"
                            placeholder="Surtido"
                            title="Surtido"
                          />
                          <Input
                            type="number"
                            min={0}
                            value={productDevoluciones[p.id] ?? ""}
                            onChange={(e) => setProductDevoluciones({ ...productDevoluciones, [p.id]: e.target.value })}
                            className="w-16"
                            placeholder="Devolución"
                            title="Devolución"
                          />
                          <Input
                            type="number"
                            min={0}
                            value={productAntes[p.id] ?? ""}
                            onChange={(e) => setProductAntes({ ...productAntes, [p.id]: e.target.value })}
                            className="w-16"
                            placeholder="Antes"
                            title="Existencia anterior"
                          />
                        </div>
                      ))}
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
