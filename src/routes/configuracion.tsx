import { createFileRoute, Link } from "@tanstack/react-router";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { backupFilename } from "@/lib/backup";
import { saveAndShareFile } from "@/lib/nativeIO";
import { actions, getChainBranchBalances, getCreditBalance, getCreditInvoiceBalance, getInvoiceBranchBalances, useStore, productsForClient, type CreditInvoice, type SpecialPricing, type ProductGroup, type ProspectResult } from "@/lib/store";
import { captureLocation, mapsUrl, openMapChooser } from "@/lib/geo";
import { getAskEachTime } from "@/lib/nav-provider";
import { parseGpx } from "@/lib/gpx";
import { VerifyAddressDialog, type VerifiedAddress } from "@/components/VerifyAddressDialog";
import { ArchivedClientsTab, ProspectsTab } from "@/components/ClientArchiveAndProspects";
import { Trash2, Plus, MapPin, Loader2, ExternalLink, Save, Download, Upload, Pencil, X, BarChart3, Search, CreditCard, ArrowUp, ArrowDown, Power, Tag, Layers, FileUp, ShieldCheck, Archive, RotateCcw, History } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Client, CreditType, Product, Route as AppRoute } from "@/lib/store";
import { toast } from "sonner";

export const Route = createFileRoute("/configuracion")({
  head: () => ({
    meta: [
      { title: "Configuración — RutaVenta" },
      { name: "description", content: "Administra productos, rutas y clientes con orden de visita." },
    ],
  }),
  component: ConfigPage,
});

function ConfigPage() {
  return (
    <div className="min-h-screen" style={{ background: "var(--gradient-warm)" }}>
      <AppHeader />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <h1 className="mb-6 text-3xl font-bold">Configuración</h1>
        <Tabs defaultValue="productos">
          <TabsList>
            <TabsTrigger value="productos">Catálogo</TabsTrigger>
            <TabsTrigger value="rutas">Rutas</TabsTrigger>
            <TabsTrigger value="clientes">Clientes</TabsTrigger>
            <TabsTrigger value="backup">Respaldo</TabsTrigger>
          </TabsList>
          <TabsContent value="productos" className="mt-4">
            <ProductsTab />
          </TabsContent>
          <TabsContent value="rutas" className="mt-4">
            <RoutesTab />
          </TabsContent>
          <TabsContent value="clientes" className="mt-4">
            <ClientsTab />
          </TabsContent>
          <TabsContent value="backup" className="mt-4">
            <BackupTab />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function ChainsTab() {
  const chains = useStore((s) => s.chains);
  const clients = useStore((s) => s.clients);
  const clientNameSnapshots = useStore((s) => s.clientNameSnapshots);
  const ledger = useStore((s) => s.creditLedger);
  const invoices = useStore((s) => s.creditInvoices);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [selectedChainId, setSelectedChainId] = useState<string | null>(null);

  useEffect(() => {
    if (selectedChainId && !chains.some((chain) => chain.id === selectedChainId)) setSelectedChainId(null);
  }, [chains, selectedChainId]);

  return (
    <Card className="space-y-4 p-4">
      <div>
        <h2 className="font-semibold">Cadenas y matrices</h2>
        <p className="text-xs text-muted-foreground">Crea aquí cada matriz, asigna sus sucursales desde la edición del cliente (tipo de crédito B) y abre el detalle para revisar saldos, sucursales y facturas.</p>
      </div>
      <div className="flex gap-2">
        <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nombre de la matriz o cadena" />
        <Button
          disabled={!newName.trim()}
          onClick={() => { actions.addCreditChain(newName); setNewName(""); toast.success("Cadena agregada"); }}
        >
          <Plus className="mr-2 h-4 w-4" /> Agregar
        </Button>
      </div>
      <div className="space-y-2">
        {chains.map((chain) => {
          const branches = clients.filter((client) => client.creditType === "B" && client.chainId === chain.id);
          const balance = getCreditBalance(ledger, "chain", chain.id);
          const hasCreditHistory = ledger.some((movement) => movement.accountType === "chain" && movement.accountId === chain.id) || invoices.some((invoice) => invoice.chainId === chain.id);
          const editing = editingId === chain.id;
          return (
            <div key={chain.id} className="rounded-lg border bg-card p-3">
              <div className="flex items-center gap-2">
                {editing ? (
                  <Input value={editingName} onChange={(e) => setEditingName(e.target.value)} />
                ) : (
                  <div className="min-w-0 flex-1 font-medium">{chain.name}</div>
                )}
                <Button size="sm" variant={selectedChainId === chain.id ? "default" : "outline"} onClick={() => setSelectedChainId(selectedChainId === chain.id ? null : chain.id)}>
                  {selectedChainId === chain.id ? "Ocultar detalle" : "Saldo y factura"}
                </Button>
                {editing ? (
                  <>
                    <Button size="sm" onClick={() => {
                      if (!editingName.trim()) return;
                      actions.updateCreditChain(chain.id, editingName);
                      setEditingId(null); toast.success("Cadena actualizada");
                    }}>Guardar</Button>
                    <Button size="icon" variant="ghost" onClick={() => setEditingId(null)} title="Cancelar"><X className="h-4 w-4" /></Button>
                  </>
                ) : (
                  <Button size="icon" variant="ghost" onClick={() => { setEditingId(chain.id); setEditingName(chain.name); }} title="Editar cadena"><Pencil className="h-4 w-4" /></Button>
                )}
                <Button
                  size="icon" variant="ghost" title={hasCreditHistory ? "No se puede borrar una cadena con movimientos o facturas" : "Borrar cadena"} disabled={hasCreditHistory}
                  onClick={() => {
                    if (!confirm(`¿Borrar "${chain.name}"? Las sucursales quedarán sin cadena y los movimientos históricos se conservarán.`)) return;
                    actions.removeCreditChain(chain.id);
                    toast.success("Cadena eliminada");
                  }}
                ><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {branches.length ? `Sucursales: ${branches.map((client) => client.name).join(", ")}` : "Sin sucursales asignadas. En Clientes, edita una sucursal, elige crédito B y vincúlala aquí."}
              </p>
              <p className="mt-2 text-xs font-semibold tabular-nums">Pendiente por facturar: {balance.pieces} pzas · ${balance.amount.toFixed(2)}</p>
            </div>
          );
        })}
        {chains.length === 0 && <p className="text-sm text-muted-foreground">Todavía no hay cadenas.</p>}
      </div>
      {selectedChainId && chains.some((chain) => chain.id === selectedChainId) && (
        <ChainCreditDetails chainId={selectedChainId} />
      )}
    </Card>
  );
}

function ChainCreditDetails({ chainId }: { chainId: string }) {
  const chain = useStore((s) => s.chains.find((item) => item.id === chainId));
  const clients = useStore((s) => s.clients);
  const clientNameSnapshots = useStore((s) => s.clientNameSnapshots);
  const ledger = useStore((s) => s.creditLedger);
  const allInvoices = useStore((s) => s.creditInvoices);
  const invoices = useMemo(
    () => allInvoices.filter((invoice) => invoice.chainId === chainId).sort((a, b) => b.date.localeCompare(a.date)),
    [allInvoices, chainId],
  );
  const balance = getCreditBalance(ledger, "chain", chainId);
  const branchBalances = getChainBranchBalances(chainId, ledger, clients, clientNameSnapshots);
  const openInvoice = invoices.find((invoice) => {
    const due = getCreditInvoiceBalance(invoice, ledger);
    return due.pieces > 0 || due.amount > 0;
  });
  const openInvoiceDue = openInvoice ? getCreditInvoiceBalance(openInvoice, ledger) : null;
  const [folio, setFolio] = useState("");
  const [adjustPieces, setAdjustPieces] = useState("0");
  const [adjustAmount, setAdjustAmount] = useState("0");
  const [adjustNote, setAdjustNote] = useState("");
  const [paymentPieces, setPaymentPieces] = useState("0");
  const [paymentAmount, setPaymentAmount] = useState("0");

  useEffect(() => {
    setPaymentPieces(String(openInvoiceDue?.pieces ?? 0));
    setPaymentAmount(String(openInvoiceDue?.amount ?? 0));
  }, [openInvoice?.id, openInvoiceDue?.pieces, openInvoiceDue?.amount]);

  if (!chain) return null;
  const money = (value: number) => `$${value.toFixed(2)}`;

  return (
    <div className="space-y-4 rounded-xl border border-primary/30 bg-primary/5 p-4">
      <div>
        <h3 className="text-lg font-semibold">Saldo de {chain.name}</h3>
        <div className="mt-1 flex flex-wrap gap-4 text-sm font-bold tabular-nums">
          <span>{balance.pieces} piezas pendientes</span><span>{money(balance.amount)} pendientes</span>
        </div>
      </div>

      <div className="space-y-1">
        <h4 className="text-sm font-semibold">Desglose actual por sucursal</h4>
        {branchBalances.map((branch, index) => (
          <div key={`${branch.branchId ?? "adjustment"}-${index}`} className="flex justify-between gap-2 rounded bg-background/60 px-3 py-2 text-xs">
            <span>{branch.name}</span><span className="tabular-nums">{branch.pieces} pzas · {money(branch.amount)}</span>
          </div>
        ))}
        {branchBalances.length === 0 && <p className="text-xs text-muted-foreground">Sin saldo pendiente.</p>}
      </div>

      <div className="space-y-2 rounded-lg border bg-background/50 p-3">
        <h4 className="text-sm font-semibold">Saldo inicial o ajuste manual</h4>
        <p className="text-[11px] text-muted-foreground">Usa valores positivos para aumentar el saldo y negativos para reducirlo.</p>
        <div className="grid grid-cols-2 gap-2">
          <div><Label>Piezas</Label><Input type="number" step={1} value={adjustPieces} onChange={(e) => setAdjustPieces(e.target.value)} /></div>
          <div><Label>Dinero</Label><Input type="number" step="0.01" value={adjustAmount} onChange={(e) => setAdjustAmount(e.target.value)} /></div>
          <div className="col-span-2"><Label>Nota (opcional)</Label><Input value={adjustNote} onChange={(e) => setAdjustNote(e.target.value)} placeholder="Saldo anterior a la app..." /></div>
        </div>
        <Button size="sm" disabled={(Number(adjustPieces) || 0) === 0 && (Number(adjustAmount) || 0) === 0} onClick={() => {
          actions.adjustChainCreditBalance(chainId, Number(adjustPieces) || 0, Number(adjustAmount) || 0, adjustNote);
          setAdjustPieces("0"); setAdjustAmount("0"); setAdjustNote(""); toast.success("Saldo ajustado");
        }}>Guardar ajuste</Button>
      </div>

      <div className="space-y-2 rounded-lg border bg-background/50 p-3">
        <h4 className="text-sm font-semibold">Facturación</h4>
        {openInvoice ? (
          <div className="space-y-2">
            <p className="text-xs">Factura abierta <strong>{openInvoice.folio}</strong> · pendiente {openInvoiceDue?.pieces ?? 0} pzas · {money(openInvoiceDue?.amount ?? 0)}</p>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Piezas del pago</Label><Input type="number" min={0} max={openInvoiceDue?.pieces} step={1} value={paymentPieces} onChange={(e) => setPaymentPieces(e.target.value)} /></div>
              <div><Label>Dinero del pago</Label><Input type="number" min={0} max={openInvoiceDue?.amount} step="0.01" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} /></div>
            </div>
            <Button size="sm" disabled={(Number(paymentPieces) || 0) === 0 && (Number(paymentAmount) || 0) === 0} onClick={() => {
              actions.registerChainPayment(openInvoice.id, Number(paymentPieces) || 0, Number(paymentAmount) || 0);
              toast.success("Pago registrado");
            }}>Registrar pago</Button>
            <Button size="sm" variant="outline" onClick={() => {
              actions.registerChainPayment(openInvoice.id, openInvoiceDue?.pieces ?? 0, openInvoiceDue?.amount ?? 0);
              toast.success(`Factura ${openInvoice.folio} saldada`);
            }}>Saldar factura completa</Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-48 flex-1"><Label>Folio</Label><Input value={folio} onChange={(e) => setFolio(e.target.value)} placeholder="Se genera automáticamente si se deja vacío" /></div>
            <Button disabled={balance.pieces <= 0 && balance.amount <= 0} onClick={() => {
              const invoice = actions.createChainInvoice(chainId, folio);
              if (!invoice) { toast.error("No se pudo generar la factura. Revisa que haya saldo pendiente."); return; }
              setFolio(""); toast.success(`Factura ${invoice.folio} generada`);
            }}>Generar factura</Button>
          </div>
        )}
        {invoices.map((invoice) => (
          <InvoiceSummary key={invoice.id} invoice={invoice} ledger={ledger} />
        ))}
      </div>

      <div className="space-y-1">
        <h4 className="text-sm font-semibold">Movimientos</h4>
        {ledger.filter((movement) => movement.accountType === "chain" && movement.accountId === chainId).slice().reverse().map((movement) => {
          const branchName = clients.find((client) => client.id === movement.branchId)?.name;
          const typeLabel = movement.type === "venta" ? "Producto colocado" : movement.type === "ajuste" ? "Ajuste" : movement.type === "factura" ? "Factura" : movement.type === "pago" ? "Pago" : "Cobro";
          return (
            <div key={movement.id} className="grid grid-cols-[1fr_auto] gap-2 rounded bg-background/60 px-3 py-2 text-xs">
              <span>{new Date(movement.date).toLocaleDateString("es-MX")} · {typeLabel}{branchName ? ` · ${branchName}` : ""}{movement.note ? ` · ${movement.note}` : ""}</span>
              <span className="text-right tabular-nums">{movement.pieces} pzas · {money(movement.amount)}</span>
            </div>
          );
        })}
        {!ledger.some((movement) => movement.accountType === "chain" && movement.accountId === chainId) && <p className="text-xs text-muted-foreground">Sin movimientos.</p>}
      </div>
    </div>
  );
}

function InvoiceSummary({ invoice, ledger }: { invoice: CreditInvoice; ledger: import("@/lib/store").CreditMovement[] }) {
  const due = getCreditInvoiceBalance(invoice, ledger);
  const settled = due.pieces <= 0 && due.amount <= 0;
  return (
    <details className="rounded border bg-background/70 p-2 text-xs">
      <summary className="cursor-pointer font-medium">Factura {invoice.folio} · {new Date(invoice.date).toLocaleDateString("es-MX")} · {settled ? "Saldada" : "Pendiente"}: {due.pieces} pzas · ${due.amount.toFixed(2)}</summary>
      <div className="mt-2 space-y-1">
        <div>Al generar: {invoice.pieces} piezas · ${invoice.amount.toFixed(2)}</div>
        {invoice.branchBreakdown.map((branch, index) => <div key={`${branch.branchId ?? "adjustment"}-${index}`} className="text-muted-foreground">{branch.name}: {branch.pieces} pzas · ${branch.amount.toFixed(2)}</div>)}
      </div>
    </details>
  );
}

export function ProductsTab() {
  const products = useStore((s) => s.products);
  const groups = useStore((s) => s.groups);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [groupId, setGroupId] = useState<string>(groups[0]?.id ?? "");
  const [newGroupName, setNewGroupName] = useState("");

  useEffect(() => {
    if (!groupId || !groups.some((g) => g.id === groupId)) {
      setGroupId(groups[0]?.id ?? "");
    }
  }, [groups, groupId]);

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
          <Layers className="h-5 w-5 text-primary" /> Grupos de productos
        </h2>
        <p className="mb-3 text-xs text-muted-foreground">
          Agrupa el catálogo (p. ej. <em>Bolsa 280 gms</em>, <em>Botella PET 200 ml</em>).
          En la pestaña Clientes podrás elegir qué grupos verá cada cliente al cargar la ruta.
        </p>
        <div className="mb-3 grid gap-2 sm:grid-cols-[1fr_auto]">
          <Input
            placeholder="Nombre del nuevo grupo"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
          />
          <Button
            onClick={() => {
              const n = newGroupName.trim();
              if (!n) { toast.error("Nombre requerido"); return; }
              actions.addGroup(n);
              setNewGroupName("");
              toast.success("Grupo agregado");
            }}
          >
            <Plus className="mr-2 h-4 w-4" /> Grupo
          </Button>
        </div>
        <div className="space-y-2">
          {groups.map((g) => (
            <GroupEditRow key={g.id} group={g} canDelete={groups.length > 1} />
          ))}
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="mb-4 text-lg font-semibold">Catálogo de Productos</h2>
        <div className="mb-4 grid gap-3 md:grid-cols-[1fr_1fr_8rem_10rem_auto]">
          <Input placeholder="Nombre" value={name} onChange={(e) => setName(e.target.value)} />
          <Input placeholder="Descripción (opcional)" value={description} onChange={(e) => setDescription(e.target.value)} />
          <Input type="number" min={0} step="0.01" placeholder="Precio" value={price} onChange={(e) => setPrice(e.target.value)} />
          <Select value={groupId} onValueChange={setGroupId}>
            <SelectTrigger><SelectValue placeholder="Grupo" /></SelectTrigger>
            <SelectContent>
              {groups.map((g) => (
                <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={() => {
              if (!name.trim()) { toast.error("Nombre requerido"); return; }
              if (!groupId) { toast.error("Selecciona un grupo"); return; }
              actions.addProduct(name.trim(), Number(price || 0), description.trim() || undefined, groupId);
              setName(""); setDescription(""); setPrice("");
              toast.success("Producto agregado");
            }}
          >
            <Plus className="mr-2 h-4 w-4" /> Agregar
          </Button>
        </div>
        <div className="space-y-4">
          {groups.map((g) => {
            const list = products.filter((p) => (p.groupId ?? groups[0]?.id) === g.id);
            return (
              <div key={g.id}>
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  {g.name} <span className="ml-1 text-xs normal-case text-muted-foreground/70">({list.length})</span>
                </h3>
                <div className="space-y-2">
                  {list.map((p) => (
                    <ProductEditRow key={p.id} product={p} groups={groups} />
                  ))}
                  {list.length === 0 && (
                    <p className="rounded-md border border-dashed p-3 text-center text-xs text-muted-foreground">
                      Sin productos en este grupo.
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

function GroupEditRow({ group, canDelete }: { group: ProductGroup; canDelete: boolean }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(group.name);
  useEffect(() => setName(group.name), [group.name]);

  const save = () => {
    const n = name.trim();
    if (!n) { toast.error("Nombre requerido"); return; }
    if (n === group.name) { setEditing(false); return; }
    actions.updateGroup(group.id, { name: n });
    toast.success("Grupo actualizado");
    setEditing(false);
  };

  return (
    <div className="grid grid-cols-[1fr_auto_auto] items-center gap-2 rounded-md border bg-card p-2">
      {editing ? (
        <Input autoFocus value={name} onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") { setName(group.name); setEditing(false); } }} />
      ) : (
        <span className="px-2 font-medium">{group.name}</span>
      )}
      {editing ? (
        <Button size="sm" onClick={save}><Save className="mr-1.5 h-4 w-4" /> Guardar</Button>
      ) : (
        <Button size="icon" variant="ghost" onClick={() => setEditing(true)} title="Editar"><Pencil className="h-4 w-4" /></Button>
      )}
      <Button
        size="icon"
        variant="ghost"
        disabled={!canDelete}
        onClick={() => {
          if (!confirm(`¿Eliminar el grupo "${group.name}"? Sus productos se moverán a otro grupo.`)) return;
          actions.removeGroup(group.id);
          toast.success("Grupo eliminado");
        }}
        title={canDelete ? "Eliminar grupo" : "Debe existir al menos un grupo"}
      >
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
    </div>
  );
}

export function RoutesTab() {
  const routes = useStore((s) => s.routes);
  const [name, setName] = useState("");
  return (
    <Card className="p-5">
      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_auto]">
        <Input placeholder="Nombre de la ruta" value={name} onChange={(e) => setName(e.target.value)} />
        <Button
          onClick={() => {
            if (!name.trim()) return;
            actions.addRoute(name.trim());
            setName("");
          }}
        >
          <Plus className="mr-2 h-4 w-4" /> Agregar
        </Button>
      </div>
      <div className="space-y-2">
        {routes.map((r) => (
          <RouteEditRow key={r.id} route={r} />
        ))}
      </div>
    </Card>
  );
}

export function ClientsTab() {
  return (
    <Tabs defaultValue="lista-clientes">
      <TabsList className="mb-3 flex h-auto flex-wrap">
        <TabsTrigger value="lista-clientes">Clientes</TabsTrigger>
        <TabsTrigger value="cadenas-matrices">Cadenas o matrices</TabsTrigger>
        <TabsTrigger value="archivados">Archivados</TabsTrigger>
        <TabsTrigger value="prospectos">Prospectos</TabsTrigger>
      </TabsList>
      <TabsContent value="lista-clientes"><ClientRegistryTab /></TabsContent>
      <TabsContent value="cadenas-matrices"><ChainsTab /></TabsContent>
      <TabsContent value="archivados"><ArchivedClientsTab /></TabsContent>
      <TabsContent value="prospectos"><ProspectsTab /></TabsContent>
    </Tabs>
  );
}

function ClientRegistryTab() {
  const products = useStore((s) => s.products);
  const routes = useStore((s) => s.routes);
  const clients = useStore((s) => s.clients);
  const active = useStore((s) => s.active);
  const prospects = useStore((s) => s.prospects);
  const clientNameSnapshots = useStore((s) => s.clientNameSnapshots);
  const groups = useStore((s) => s.groups);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [placeId, setPlaceId] = useState<string | null>(null);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [routeId, setRouteId] = useState(() => routes.find((route) => route.id === active?.routeId)?.id ?? routes[0]?.id ?? "");
  const [order, setOrder] = useState("");
  const [orderPromptOpen, setOrderPromptOpen] = useState(false);
  const [manualActivePosition, setManualActivePosition] = useState("");
  // Al agregar un cliente nuevo, habilita Bolsa 290 gms. La botella
  // salsera 200 ml y Bolsa 200 gms quedan deshabilitadas hasta activarlas.
  const pickDefaultGroups = (gs: { id: string; name: string }[]) => {
    const bolsa = gs.find((g) => /bolsa\s*290\s*gms?/i.test(g.name))
      ?? gs.find((g) => /bolsa/i.test(g.name) && !/200\s*gms?/i.test(g.name));
    const fallback = bolsa ?? gs[0];
    return new Set<string>(fallback ? [fallback.id] : []);
  };
  const [newEnabledGroups, setNewEnabledGroups] = useState<Set<string>>(
    () => pickDefaultGroups(groups),
  );
  useEffect(() => {
    // Sincroniza con el catálogo: quita ids que ya no existen y, si el
    // conjunto queda vacío, vuelve al grupo por defecto (Bolsa 290 gms). Nunca
    // habilita grupos nuevos automáticamente: eso es decisión manual.
    setNewEnabledGroups((prev) => {
      const allIds = groups.map((g) => g.id);
      if (allIds.length === 0) return prev;
      const next = new Set<string>();
      for (const id of allIds) if (prev.has(id)) next.add(id);
      return next.size === 0 ? pickDefaultGroups(groups) : next;
    });
  }, [groups]);
  const [capturingNew, setCapturingNew] = useState(false);
  const [capturingId, setCapturingId] = useState<string | null>(null);
  const [filterRouteId, setFilterRouteId] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [focusClientId, setFocusClientId] = useState<string | null>(null);
  useEffect(() => {
    const requestedId = localStorage.getItem("clientes:focus-client");
    if (!requestedId) return;
    localStorage.removeItem("clientes:focus-client");
    const target = clients.find((client) => client.id === requestedId && !client.archivedAt);
    if (!target) return;
    setFocusClientId(target.id);
    setFilterRouteId(target.routeId);
    setSearch(target.name);
  }, [clients]);
  const q = search.trim().toLowerCase();
  const normalized = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
  const distanceMeters = (a: { lat?: number; lng?: number }, b: { lat?: number; lng?: number }) => {
    if (a.lat == null || a.lng == null || b.lat == null || b.lng == null) return Infinity;
    const rad = (value: number) => value * Math.PI / 180;
    const dLat = rad(b.lat - a.lat); const dLng = rad(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  };
  const comparison = { name: normalized(name), address: normalized(address), lat: coords?.lat, lng: coords?.lng };
  const archiveMatches = clients.filter((client) => client.archivedAt && (
    (comparison.name.length >= 3 && normalized(client.name) === comparison.name) ||
    (comparison.address.length >= 6 && normalized(client.address ?? "") === comparison.address) ||
    distanceMeters(comparison, client) <= 100
  ));
  const prospectMatches = prospects.filter((prospect) => !prospect.convertedClientId && (
    (comparison.name.length >= 3 && normalized(prospect.name) === comparison.name) ||
    (comparison.address.length >= 6 && normalized(prospect.address ?? "") === comparison.address) ||
    distanceMeters(comparison, prospect) <= 100
  ));
  const deletedNameMatch = Object.entries(clientNameSnapshots).find(([id, savedName]) =>
    !clients.some((client) => client.id === id) && comparison.name.length >= 3 && normalized(savedName) === comparison.name,
  );
  const matches = (c: { name: string; address?: string }) =>
    !q ||
    c.name.toLowerCase().includes(q) ||
    (c.address ?? "").toLowerCase().includes(q);

  const activeSequence = (() => {
    if (!active) return [] as string[];
    const ids = active.clientIds?.filter((id) => clients.some((client) => client.id === id && !client.archivedAt)) ?? [];
    if (!active.temporary) {
      const known = new Set(ids);
      ids.push(...clients
        .filter((client) => !client.archivedAt && client.routeId === active.routeId && !known.has(client.id))
        .sort((a, b) => a.visitOrder - b.visitOrder)
        .map((client) => client.id));
    }
    if (ids.length) return ids;
    return clients.filter((client) => !client.archivedAt && client.routeId === active.routeId)
      .sort((a, b) => a.visitOrder - b.visitOrder).map((client) => client.id);
  })();
  const lastVisitedIndex = activeSequence.reduce((last, id, index) => active?.sales[id]?.completed ? index : last, -1);
  const afterLastVisitedPosition = lastVisitedIndex + 2;
  const appliesToActiveRoute = !!active && (active.temporary || active.routeId === routeId);

  const captureForNew = async () => {
    setCapturingNew(true);
    try {
      const r = await captureLocation();
      setAddress(r.address);
      setCoords({ lat: r.lat, lng: r.lng });
      setPlaceId(null);
      toast.success("Ubicación capturada — verifícala con Google para mayor exactitud");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setCapturingNew(false);
    }
  };

  const captureForExisting = async (id: string) => {
    setCapturingId(id);
    try {
      const r = await captureLocation();
      actions.updateClient(id, {
        address: r.address,
        lat: r.lat,
        lng: r.lng,
        placeId: undefined,
        verifiedAddress: undefined,
      });
      toast.success("Ubicación GPS actualizada — para mayor exactitud usa 'Verificar' con Google");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setCapturingId(null);
    }
  };

  const submitNewClient = (positionMode?: "after-last" | "other") => {
    if (!name.trim() || !routeId) return;
    const oldClient = archiveMatches[0];
    if (oldClient) {
      const restore = window.confirm(`“${oldClient.name}” ya estaba registrado y fue archivado el ${new Date(oldClient.archivedAt!).toLocaleDateString("es-MX")}. ¿Reactivar el registro anterior y conservar su historial? Pulsa Cancelar para continuar con un cliente nuevo.`);
      if (restore) {
        actions.restoreClient(oldClient.id, routeId);
        toast.success("Cliente reactivado; se conservó su historial");
        setName(""); setAddress(""); setOrder(""); setCoords(null); setPlaceId(null); setOrderPromptOpen(false);
        return;
      }
    }
    if (deletedNameMatch && !window.confirm(`Ya se había eliminado permanentemente un cliente llamado “${deletedNameMatch[1]}”. ¿Confirmas que deseas crear un registro nuevo?`)) return;
    if (prospectMatches.length > 0 && !window.confirm(`Ya hay un prospecto registrado para este nombre o ubicación (“${prospectMatches[0].name}”). ¿Deseas crear el cliente y conservar el antecedente de la visita?`)) return;

    const routeClientCount = clients.filter((client) => !client.archivedAt && client.routeId === routeId).length;
    let visitOrder = Number(order || (routeClientCount + 1));
    let activeRoutePosition: number | undefined;
    if (active && appliesToActiveRoute && positionMode === "after-last") {
      activeRoutePosition = afterLastVisitedPosition;
      visitOrder = !active.temporary && active.routeId === routeId ? afterLastVisitedPosition : routeClientCount + 1;
    } else if (active && appliesToActiveRoute && positionMode === "other") {
      const specifiedPosition = Number(manualActivePosition || order);
      activeRoutePosition = Number.isFinite(specifiedPosition) && specifiedPosition > 0
        ? specifiedPosition
        : activeSequence.length + 1;
      visitOrder = active.routeId === routeId && !active.temporary
        ? activeRoutePosition
        : Number(order || (routeClientCount + 1));
    }

    const allIds = groups.map((g) => g.id);
    const enabledIds = allIds.filter((id) => newEnabledGroups.has(id));
    actions.addClient({
      name: name.trim(),
      address: address.trim(),
      routeId,
      visitOrder,
      ...(coords ? { lat: coords.lat, lng: coords.lng } : {}),
      ...(placeId ? { placeId, verifiedAddress: address.trim() } : {}),
      ...(enabledIds.length && enabledIds.length !== allIds.length ? { enabledGroupIds: enabledIds } : {}),
    }, activeRoutePosition != null ? { activeRoutePosition } : undefined);
    setName(""); setAddress(""); setOrder(""); setCoords(null); setPlaceId(null); setOrderPromptOpen(false); setManualActivePosition("");
    setNewEnabledGroups(pickDefaultGroups(groups));
    toast.success(activeRoutePosition != null ? "Cliente agregado a la secuencia de la ruta activa" : "Cliente agregado");
  };

  return (
    <Card className="p-5">
      <div className="mb-4 rounded-lg border-2 border-primary/30 bg-primary/5 p-3">
        <p className="text-xs font-semibold text-primary mb-2 flex items-center gap-1">
          <Search className="h-3.5 w-3.5" /> Buscar cliente
        </p>
        <div className="grid gap-2 md:grid-cols-[1fr_2fr]">
          <Select value={filterRouteId} onValueChange={setFilterRouteId}>
            <SelectTrigger>
              <SelectValue placeholder="Filtrar por ruta" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las rutas</SelectItem>
              {routes.map((r) => (
                <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar cliente o negocio…"
              className="pl-9 text-base h-11 font-medium"
            />
          </div>
        </div>
      </div>

      <div className="mb-2 grid gap-3 md:grid-cols-[1fr_1fr_10rem_6rem_auto]">
        <Input placeholder="Nombre del cliente" value={name} onChange={(e) => setName(e.target.value)} />
        <div className="flex gap-2">
          <Input
            placeholder="Dirección"
            value={address}
            onChange={(e) => { setAddress(e.target.value); setCoords(null); setPlaceId(null); }}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setVerifyOpen(true)}
            title="Verificar dirección con Google Maps"
          >
            <ShieldCheck className="h-4 w-4 text-primary" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={captureForNew}
            disabled={capturingNew}
            title="Usar mi ubicación GPS actual"
          >
            {capturingNew ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
          </Button>
        </div>
        <Select value={routeId} onValueChange={setRouteId}>
          <SelectTrigger>
            <SelectValue placeholder="Ruta" />
          </SelectTrigger>
          <SelectContent>
            {routes.map((r) => (
              <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input type="number" min={1} placeholder="Orden" value={order} onChange={(e) => setOrder(e.target.value)} />
        <Button onClick={() => {
          if (!name.trim() || !routeId) return;
          if (active && appliesToActiveRoute) {
            setManualActivePosition(order || String(activeSequence.length + 1));
            setOrderPromptOpen(true);
          } else {
            submitNewClient();
          }
        }}>
          <Plus className="mr-2 h-4 w-4" /> Agregar
        </Button>
      </div>
      <VerifyAddressDialog
        open={verifyOpen}
        onClose={() => setVerifyOpen(false)}
        initialAddress={address}
        onConfirm={(v) => {
          setAddress(v.address);
          setCoords({ lat: v.lat, lng: v.lng });
          setPlaceId(v.placeId);
          toast.success("Dirección verificada con Google");
        }}
      />
      <Dialog open={orderPromptOpen} onOpenChange={setOrderPromptOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿En qué posición agregarlo a la ruta activa?</DialogTitle>
            <DialogDescription>
              {lastVisitedIndex >= 0
                ? `El último cliente visitado en la secuencia es ${clients.find((client) => client.id === activeSequence[lastVisitedIndex])?.name ?? "el último cliente"}.`
                : "Todavía no hay clientes visitados en esta ruta."}
              {" "}Puedes colocarlo automáticamente después de esa visita o elegir otra posición.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="active-route-position">Número de visita para otra posición</Label>
            <Input id="active-route-position" type="number" min={1} value={manualActivePosition} onChange={(event) => setManualActivePosition(event.target.value)} />
          </div>
          <DialogFooter className="flex-col sm:flex-row">
            <Button variant="outline" onClick={() => setOrderPromptOpen(false)}>Cancelar</Button>
            <Button variant="outline" onClick={() => submitNewClient("other")}>Usar otra posición</Button>
            <Button onClick={() => submitNewClient("after-last")}>Después del último visitado</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {groups.length > 1 && (
        <div className="mb-3 rounded-lg border border-border/40 bg-muted/30 p-2.5">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold">
            <Layers className="h-3.5 w-3.5 text-primary" /> Tipos de producto que manejará el cliente
          </div>
          <p className="mb-2 text-[10px] text-muted-foreground">
            Selecciona los grupos (bolsas, botes, etc.) que se ofrecerán a este cliente. Puedes cambiarlo después.
          </p>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {groups.map((g) => {
              const checked = newEnabledGroups.has(g.id);
              return (
                <label
                  key={g.id}
                  className="flex items-center justify-between gap-2 rounded-md bg-background/40 px-2 py-1.5"
                >
                  <span className="truncate text-xs font-medium">{g.name}</span>
                  <Switch
                    checked={checked}
                    onCheckedChange={(v) => {
                      setNewEnabledGroups((prev) => {
                        const next = new Set(prev);
                        if (v) next.add(g.id); else next.delete(g.id);
                        return next;
                      });
                    }}
                  />
                </label>
              );
            })}
          </div>
        </div>
      )}
      {coords && (
        <p className="mb-3 text-xs text-muted-foreground">
          📍 {placeId ? "Ubicación VERIFICADA con Google" : "GPS guardado"}: {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
          {!placeId && " — pulsa el botón ✅ para verificarla y fijar el lugar exacto"}
        </p>
      )}

      {(archiveMatches.length > 0 || prospectMatches.length > 0 || deletedNameMatch) && (
        <div className="mb-3 space-y-1 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          <p className="font-semibold text-amber-700 dark:text-amber-300">Coincidencias encontradas</p>
          {archiveMatches.map((client) => <p key={client.id}>Cliente archivado: <strong>{client.name}</strong>{client.address ? ` · ${client.address}` : ""}</p>)}
          {deletedNameMatch && <p>Cliente eliminado anteriormente: <strong>{deletedNameMatch[1]}</strong>. Su historial anterior permanece guardado.</p>}
          {prospectMatches.map((prospect) => <p key={prospect.id}>Prospecto visitado: <strong>{prospect.name}</strong>{prospect.visits.length ? ` · última visita ${new Date(prospect.visits[prospect.visits.length - 1].date).toLocaleDateString("es-MX")}` : ""}</p>)}
          <p className="text-xs text-muted-foreground">Se compara nombre, dirección y una ubicación dentro de 100 metros. Confirma que sea el mismo lugar antes de continuar.</p>
        </div>
      )}

      <GpxImportRow />

      {(() => {
        const routeIds = new Set(routes.map((r) => r.id));
        const filtered = clients
          .filter((c) => !c.archivedAt && (filterRouteId === "all" || c.routeId === filterRouteId))
          .filter(matches);
        const totalShown = filtered.length;
        const visibleRoutes =
          filterRouteId === "all"
            ? routes
            : routes.filter((r) => r.id === filterRouteId);
        const orphans =
          filterRouteId === "all"
            ? filtered.filter((c) => !routeIds.has(c.routeId))
            : [];
        return (
          <>
            <p className="mb-3 text-xs text-muted-foreground">
              Mostrando {totalShown} {totalShown === 1 ? "cliente" : "clientes"}
              {filterRouteId !== "all" &&
                ` de ${routes.find((r) => r.id === filterRouteId)?.name ?? ""}`}
            </p>
            {totalShown === 0 && (
              <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
                No hay clientes que coincidan con el filtro.
              </p>
            )}
            {visibleRoutes.map((r) => {
              const list = filtered
                .filter((c) => c.routeId === r.id)
                .sort((a, b) => a.visitOrder - b.visitOrder);
              if (list.length === 0) return null;
              return (
                <div key={r.id} className="mb-4">
                  <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    {r.name}
                  </h3>
                  <div className="space-y-2">
                    {list.map((c) => (
                      <ClientEditRow
                        key={c.id}
                        client={c}
                        products={products}
                        focusOnOpen={focusClientId === c.id}
                        capturing={capturingId === c.id}
                        onCapture={() => captureForExisting(c.id)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
            {orphans.length > 0 && (
              <div className="mb-4">
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-destructive">
                  Sin ruta asignada
                </h3>
                <div className="space-y-2">
                  {orphans
                    .sort((a, b) => a.visitOrder - b.visitOrder)
                    .map((c) => (
                      <ClientEditRow
                        key={c.id}
                        client={c}
                        products={products}
                        focusOnOpen={focusClientId === c.id}
                        capturing={capturingId === c.id}
                        onCapture={() => captureForExisting(c.id)}
                      />
                    ))}
                </div>
              </div>
            )}
          </>
        );
      })()}
    </Card>
  );
}

function ClientEditForm({
  client,
  products,
  onClose,
}: {
  client: Client;
  products: Product[];
  onClose: () => void;
}) {
  const routes = useStore((s) => s.routes);
  const allClients = useStore((s) => s.clients);
  const chains = useStore((s) => s.chains);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [name, setName] = useState(client.name);
  const [address, setAddress] = useState(client.address ?? "");
  const [order, setOrder] = useState<string>(String(client.visitOrder));
  const [routeId, setRouteId] = useState<string>(client.routeId);
  const sp = client.specialPricing;
  const [spEnabled, setSpEnabled] = useState<boolean>(!!sp?.enabled);
  const [spPrices, setSpPrices] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      products.map((p) => [p.id, String(sp?.prices?.[p.id] ?? p.price)]),
    ),
  );

  useEffect(() => {
    setName(client.name);
    setAddress(client.address ?? "");
    setOrder(String(client.visitOrder));
    setRouteId(client.routeId);
    const cur = client.specialPricing;
    setSpEnabled(!!cur?.enabled);
    setSpPrices(
      Object.fromEntries(
        products.map((p) => [p.id, String(cur?.prices?.[p.id] ?? p.price)]),
      ),
    );
  }, [client.id, client.name, client.address, client.visitOrder, client.routeId, client.specialPricing, products]);

  const orderNum = Number(order);
  const dirty =
    name !== client.name ||
    (address ?? "") !== (client.address ?? "") ||
    routeId !== client.routeId ||
    (Number.isFinite(orderNum) && orderNum !== client.visitOrder);

  const save = () => {
    if (!name.trim()) {
      toast.error("El nombre no puede estar vacío");
      return;
    }
    const newAddr = address.trim();
    // Si la dirección cambió manualmente, invalidamos la verificación previa
    // (placeId/lat/lng/verifiedAddress) para que el usuario re-verifique.
    const addrChanged = newAddr !== (client.address ?? "");
    const verifiedStillValid =
      client.verifiedAddress && newAddr === client.verifiedAddress;
    const patch: Partial<Client> = { name: name.trim(), address: newAddr };
    if (routeId !== client.routeId) {
      // Al cambiar de ruta, asignamos el siguiente orden disponible en la nueva ruta
      const nextOrder =
        allClients.filter((c) => c.routeId === routeId && c.id !== client.id).length + 1;
      patch.routeId = routeId;
      patch.visitOrder = nextOrder;
    }
    actions.updateClient(client.id, patch);
    if (
      routeId === client.routeId &&
      Number.isFinite(orderNum) &&
      orderNum !== client.visitOrder
    ) {
      actions.setClientVisitOrder(client.id, orderNum);
    }
    if (addrChanged && !verifiedStillValid && client.placeId) {
      actions.clearClientVerification(client.id);
      toast.warning("Dirección cambiada — verifícala de nuevo con Google");
    } else {
      toast.success("Cambios guardados");
    }
    onClose();
  };

  const stop = (fn: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    fn();
  };

  return (
    <div className="mt-3 space-y-2 rounded-lg border border-border/40 bg-background/50 p-3">
          <div>
            <Label className="text-[10px] uppercase text-muted-foreground">Nombre</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label className="text-[10px] uppercase text-muted-foreground">Orden de visita</Label>
            <Input
              type="number"
              min={1}
              value={order}
              onChange={(e) => setOrder(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-[10px] uppercase text-muted-foreground">Ruta</Label>
            <Select value={routeId} onValueChange={setRouteId}>
              <SelectTrigger>
                <SelectValue placeholder="Ruta" />
              </SelectTrigger>
              <SelectContent>
                {routes.map((r) => (
                  <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {routeId !== client.routeId && (
              <p className="mt-1 text-[10px] text-warning">
                ⚠ Al guardar, el cliente se moverá a "{routes.find((r) => r.id === routeId)?.name}" con el siguiente orden disponible.
              </p>
            )}
          </div>
          <div>
            <Label className="text-[10px] uppercase text-muted-foreground">Dirección</Label>
            <div className="flex gap-2">
              <Input value={address} onChange={(e) => setAddress(e.target.value)} />
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={(e) => { e.stopPropagation(); setVerifyOpen(true); }}
                title="Verificar dirección con Google Maps"
              >
                <ShieldCheck className="mr-1 h-4 w-4 text-primary" /> Verificar
              </Button>
            </div>
            {client.placeId ? (
              <p className="mt-1 text-[10px] text-success">
                ✓ Ubicación verificada con Google · el botón Mapa abrirá el lugar exacto
              </p>
            ) : (
              <p className="mt-1 text-[10px] text-warning">
                ⚠ Sin verificar — pulsa "Verificar" para fijar el lugar exacto en Google Maps
              </p>
            )}
          </div>
          <VerifyAddressDialog
            open={verifyOpen}
            onClose={() => setVerifyOpen(false)}
            initialAddress={address || client.address || client.name}
            onConfirm={(v) => {
              setAddress(v.address);
              actions.updateClient(client.id, {
                address: v.address,
                lat: v.lat,
                lng: v.lng,
                placeId: v.placeId,
                verifiedAddress: v.address,
              });
              toast.success("Dirección verificada y guardada");
            }}
          />
          <ClientGroupsEditor client={client} />
          <div className="rounded-lg border border-border/40 bg-muted/30 p-2.5">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold">
                <Tag className="h-3.5 w-3.5 text-primary" /> Precio especial
              </div>
              <Button
                size="sm"
                type="button"
                variant={spEnabled ? "default" : "outline"}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const nextEnabled = !spEnabled;
                  setSpEnabled(nextEnabled);
                  // Persistir inmediatamente para que el cambio surta efecto
                  // sin requerir pulsar "Guardar".
                  const prices: Record<string, number> = {};
                  for (const p of products) {
                    const n = Number(spPrices[p.id]);
                    prices[p.id] = Number.isFinite(n) && n >= 0 ? n : p.price;
                  }
                  const merged = { ...(sp?.prices ?? {}), ...prices };
                  actions.updateClient(client.id, {
                    specialPricing: { enabled: nextEnabled, prices: merged },
                  });
                  toast.success(
                    nextEnabled ? "Precio especial activado" : "Precio especial desactivado",
                  );
                }}
              >
                {spEnabled ? "Activado" : "Desactivado"}
              </Button>
            </div>
            <p className="mb-2 text-[10px] text-muted-foreground">
              Si está activo, estos precios se usarán para este cliente. Solo se muestran
              los productos de los grupos habilitados para este cliente.
            </p>
            {spEnabled && (
              <ClientSpecialPricingList
                client={client}
                spPrices={spPrices}
                setSpPrices={setSpPrices}
              />
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="min-w-44">
              <Label className="text-[10px] uppercase text-muted-foreground">Tipo de crédito</Label>
              <Select
                value={client.creditType ?? "ninguno"}
                onValueChange={(value: CreditType) => actions.updateClient(client.id, { creditType: value })}
              >
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ninguno">Ninguno</SelectItem>
                  <SelectItem value="A">A · Por visita</SelectItem>
                  <SelectItem value="B">B · Cadena</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {client.creditType === "B" && (
              <div className="min-w-48">
                <Label className="text-[10px] uppercase text-muted-foreground">Cadena / matriz</Label>
                <Select
                  value={client.chainId ?? "__none__"}
                  onValueChange={(value) => actions.updateClient(client.id, { chainId: value === "__none__" ? null : value })}
                >
                  <SelectTrigger className="h-9"><SelectValue placeholder="Seleccionar cadena" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sin cadena</SelectItem>
                    {chains.map((chain) => <SelectItem key={chain.id} value={chain.id}>{chain.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button
              size="sm"
              variant={client.credit ? "default" : "outline"}
              onClick={() => actions.updateClient(client.id, { credit: !client.credit })}
            >
              <CreditCard className="mr-1.5 h-3.5 w-3.5" />
              {client.credit ? "Crédito" : "Contado"}
            </Button>
            <Button
              size="sm"
              onClick={() => {
                const prices: Record<string, number> = {};
                for (const p of products) {
                  const n = Number(spPrices[p.id]);
                  prices[p.id] = Number.isFinite(n) && n >= 0 ? n : p.price;
                }
                const next: SpecialPricing | undefined = spEnabled
                  ? { enabled: true, prices }
                  : sp
                    ? { enabled: false, prices: sp.prices ?? prices }
                    : undefined;
                actions.updateClient(client.id, { specialPricing: next });
                save();
              }}
              disabled={
                !dirty &&
                !!sp?.enabled === spEnabled &&
                products.every(
                  (p) => Number(spPrices[p.id]) === (sp?.prices?.[p.id] ?? p.price),
                )
              }
            >
              <Save className="mr-2 h-4 w-4" /> Guardar
            </Button>
          </div>
        </div>
  );
}

function ClientEditRow({
  client,
  products,
  focusOnOpen = false,
  capturing,
  onCapture,
}: {
  client: Client;
  products: Product[];
  focusOnOpen?: boolean;
  capturing: boolean;
  onCapture: () => void;
}) {
  const [open, setOpen] = useState(focusOnOpen);
  const rowRef = useRef<HTMLDivElement>(null);
  const isActive = client.active !== false;

  useEffect(() => {
    if (!focusOnOpen) return;
    setOpen(true);
    const timer = window.setTimeout(() => rowRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 120);
    return () => window.clearTimeout(timer);
  }, [focusOnOpen]);

  const stop = (fn: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    fn();
  };

  return (
    <div
      ref={rowRef}
      className={`rounded-xl border bg-card p-3 transition ${isActive ? "" : "opacity-60"}`}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-3 text-left"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary">
          {client.visitOrder}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h4 className="truncate font-semibold">{client.name}</h4>
          </div>
          <div className="mt-1 flex flex-wrap gap-1">
            {client.credit && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-600">
                <CreditCard className="h-3 w-3" /> Crédito
              </span>
            )}
            {client.specialPricing?.enabled && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                <Tag className="h-3 w-3" /> Precio especial
              </span>
            )}
          </div>
          {client.address && (
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{client.address}</p>
          )}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-medium text-primary">
            {client.lat != null && client.lng != null ? (
              <a
                href={mapsUrl(client.lat, client.lng, client.address, client.placeId)}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => {
                  e.stopPropagation();
                  if (getAskEachTime()) {
                    e.preventDefault();
                    openMapChooser(client.lat, client.lng, client.address, client.placeId);
                  }
                }}
                className="inline-flex items-center gap-1 hover:underline"
              >
                <ExternalLink className="h-3 w-3" /> Ver en Maps
                {client.placeId && (
                  <ShieldCheck className="h-3 w-3 text-success" aria-label="Verificada" />
                )}
              </a>
            ) : null}
            <button
              type="button"
              onClick={stop(onCapture)}
              disabled={capturing}
              className="inline-flex items-center gap-1 hover:underline disabled:opacity-50"
            >
              {capturing ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <MapPin className="h-3 w-3" />
              )}
              {client.lat != null ? "Actualizar GPS" : "Capturar GPS"}
            </button>
            <Link
              to="/clientes/$clientId"
              params={{ clientId: client.id }}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 hover:underline"
            >
              <BarChart3 className="h-3 w-3" /> Estadísticas
            </Link>
          </div>
        </div>
      </button>

      <div className="mt-2 flex items-center justify-end gap-1 border-t border-border/40 pt-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setOpen((v) => !v)}
          title="Editar"
        >
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => actions.moveClient(client.id, "up")}
          title="Subir en la secuencia"
        >
          <ArrowUp className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => actions.moveClient(client.id, "down")}
          title="Bajar en la secuencia"
        >
          <ArrowDown className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => actions.updateClient(client.id, { active: !isActive })}
          title={isActive ? "Desactivar cliente" : "Activar cliente"}
        >
          <Power className={`h-4 w-4 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => {
            if (confirm(`¿Archivar al cliente "${client.name}"? Saldrá de las rutas, pero sus ventas e historial se conservarán y podrás reactivarlo después.`)) {
              actions.removeClient(client.id);
              toast.success("Cliente archivado; su historial se conservó");
            }
          }}
          title="Archivar cliente y conservar su historial"
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>

      {open && (
        <ClientEditForm
          client={client}
          products={products}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

function ProductEditRow({ product, groups }: { product: Product; groups: ProductGroup[] }) {
  const [name, setName] = useState(product.name);
  const [description, setDescription] = useState(product.description ?? "");
  const [price, setPrice] = useState<number>(product.price);
  const fallbackGroup = product.groupId ?? groups[0]?.id ?? "";
  const [groupId, setGroupId] = useState<string>(fallbackGroup);

  useEffect(() => {
    setName(product.name);
    setDescription(product.description ?? "");
    setPrice(product.price);
    setGroupId(product.groupId ?? groups[0]?.id ?? "");
  }, [product.name, product.description, product.price, product.groupId, groups]);

  const dirty =
    name !== product.name ||
    (description ?? "") !== (product.description ?? "") ||
    Number(price) !== product.price ||
    groupId !== (product.groupId ?? groups[0]?.id ?? "");

  const save = () => {
    if (!name.trim()) { toast.error("Nombre requerido"); return; }
    actions.updateProduct(product.id, {
      name: name.trim(),
      description: description.trim() || undefined,
      price: Number(price) || 0,
      groupId: groupId || undefined,
    });
    toast.success("Producto actualizado");
  };

  return (
    <div className="grid grid-cols-1 items-end gap-2 rounded-md border bg-card p-2 md:grid-cols-[1fr_1fr_7rem_9rem_auto_auto]">
      <div>
        <Label className="text-[10px] uppercase text-muted-foreground">Nombre</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <Label className="text-[10px] uppercase text-muted-foreground">Descripción</Label>
        <Input value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div>
        <Label className="text-[10px] uppercase text-muted-foreground">Precio</Label>
        <Input
          type="number"
          min={0}
          step="0.01"
          value={price}
          onChange={(e) => setPrice(Number(e.target.value || 0))}
        />
      </div>
      <div>
        <Label className="text-[10px] uppercase text-muted-foreground">Grupo</Label>
        <Select value={groupId} onValueChange={setGroupId}>
          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            {groups.map((g) => (
              <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button onClick={save} disabled={!dirty} size="sm">
        <Save className="mr-2 h-4 w-4" /> Guardar
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => {
          if (!confirm(`¿Eliminar el producto "${product.name}"? Esta acción no se puede deshacer.`)) return;
          actions.removeProduct(product.id);
          toast.success("Producto eliminado");
        }}
        title="Eliminar producto"
      >
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
    </div>
  );
}

function ClientGroupsEditor({ client }: { client: Client }) {
  const groups = useStore((s) => s.groups);
  const enabled = useMemo(() => {
    const set = new Set(client.enabledGroupIds ?? groups.map((g) => g.id));
    return set;
  }, [client.enabledGroupIds, groups]);

  const toggle = (id: string, on: boolean) => {
    const current = new Set(client.enabledGroupIds ?? groups.map((g) => g.id));
    if (on) current.add(id); else current.delete(id);
    const next = groups.map((g) => g.id).filter((g) => current.has(g));
    actions.setClientEnabledGroups(client.id, next);
  };

  return (
    <div className="rounded-lg border border-border/40 bg-muted/30 p-2.5">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold">
        <Layers className="h-3.5 w-3.5 text-primary" /> Grupos de productos del cliente
      </div>
      <p className="mb-2 text-[10px] text-muted-foreground">
        Al iniciar la ruta del día, sólo aparecerá la carga de los grupos habilitados aquí
        (sumados con los grupos del resto de clientes seleccionados).
      </p>
      <div className="grid gap-1.5 sm:grid-cols-2">
        {groups.map((g) => (
          <label
            key={g.id}
            className="flex items-center justify-between gap-2 rounded-md bg-background/40 px-2 py-1.5"
          >
            <span className="truncate text-xs font-medium">{g.name}</span>
            <Switch
              checked={enabled.has(g.id)}
              onCheckedChange={(v) => toggle(g.id, v)}
            />
          </label>
        ))}
      </div>
    </div>
  );
}

function ClientSpecialPricingList({
  client,
  spPrices,
  setSpPrices,
}: {
  client: Client;
  spPrices: Record<string, string>;
  setSpPrices: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}) {
  const products = useStore((s) => s.products);
  const groups = useStore((s) => s.groups);
  const visible = useMemo(
    () => productsForClient(products, groups, client),
    [products, groups, client],
  );
  return (
    <div className="grid gap-1.5 sm:grid-cols-2">
      {visible.map((p) => (
        <div key={p.id} className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-xs">{p.name}</span>
          <span className="text-[10px] text-muted-foreground tabular-nums">
            cat. ${p.price.toFixed(2)}
          </span>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={spPrices[p.id] ?? String(p.price)}
            onChange={(e) =>
              setSpPrices((s) => ({ ...s, [p.id]: e.target.value }))
            }
            className="h-8 w-24 text-right"
          />
        </div>
      ))}
      {visible.length === 0 && (
        <p className="col-span-full text-[10px] text-muted-foreground">
          Este cliente no tiene grupos habilitados.
        </p>
      )}
    </div>
  );
}

export function BackupTab() {
  const fileRef = useRef<HTMLInputElement>(null);

  const exportBackup = async () => {
    try {
      const json = actions.exportData();
      const filename = backupFilename();
      await saveAndShareFile({
        filename,
        data: json,
        mimeType: "application/json",
      });
    } catch (e) {
      toast.error("No se pudo generar el respaldo: " + ((e as Error)?.message ?? "error"));
    }
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ok = window.confirm(
      "⚠️ Esto reemplazará TODOS los datos actuales (clientes, rutas, productos, historial) con los del archivo. ¿Continuar?",
    );
    if (!ok) { e.target.value = ""; return; }
    try {
      const text = await file.text();
      actions.importData(text);
      toast.success("Datos importados correctamente");
    } catch (err) {
      toast.error("Archivo inválido: " + (err as Error).message);
    } finally {
      e.target.value = "";
    }
  };

  return (
    <Card className="p-5">
      <h2 className="mb-2 text-lg font-semibold">Copia de Seguridad</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Exporta todos tus datos (clientes, rutas, productos, ventas e historial) a un archivo JSON,
        o restaura desde un respaldo previo.
      </p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button onClick={exportBackup}>
          <Download className="mr-2 h-4 w-4" /> Generar respaldo
        </Button>
        <Button variant="outline" onClick={() => fileRef.current?.click()}>
          <Upload className="mr-2 h-4 w-4" /> Importar Datos
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={onFile}
        />
      </div>
    </Card>
  );
}


function RouteEditRow({ route }: { route: AppRoute }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(route.name);

  useEffect(() => { setName(route.name); }, [route.name]);

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed) { toast.error("El nombre de la ruta no puede estar vacío"); return; }
    if (trimmed === route.name) { setEditing(false); return; }
    actions.updateRoute(route.id, { name: trimmed });
    toast.success("Ruta actualizada");
    setEditing(false);
  };

  const cancel = () => { setName(route.name); setEditing(false); };

  return (
    <div className="grid grid-cols-[1fr_auto_auto] items-center gap-2 rounded-md border bg-card p-2">
      {editing ? (
        <Input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") cancel();
          }}
        />
      ) : (
        <span className="px-2 font-medium">{route.name}</span>
      )}
      {editing ? (
        <>
          <Button size="sm" onClick={save}>
            <Save className="mr-2 h-4 w-4" /> Guardar
          </Button>
          <Button size="icon" variant="ghost" onClick={cancel} title="Cancelar">
            <X className="h-4 w-4" />
          </Button>
        </>
      ) : (
        <>
          <Button size="icon" variant="ghost" onClick={() => setEditing(true)} title="Editar nombre">
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              if (!confirm(`¿Eliminar la ruta "${route.name}"? Esta acción no se puede deshacer.`)) return;
              actions.removeRoute(route.id);
              toast.success("Ruta eliminada");
            }}
            title="Eliminar"
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </>
      )}
    </div>
  );
    }

function GpxImportRow() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);

  const onFile = async (file: File) => {
    setLoading(true);
    try {
      const text = await file.text();
      const stops = parseGpx(text);
      if (stops.length === 0) {
        toast.error("El archivo .gpx no contiene paradas válidas");
        return;
      }
      const { matched, missed } = actions.importClientLocationsFromGpx(stops);
      if (matched === 0) {
        toast.error(
          `No se encontró ningún cliente que coincida con los nombres del .gpx (${stops.length} paradas)`,
        );
      } else {
        toast.success(`${matched} cliente(s) procesados (actualizados o creados desde GPX)`);
      }
      if (missed.length > 0) {
        toast.warning(
          `Sin coincidencia (${missed.length}): ${missed.slice(0, 4).join(", ")}${missed.length > 4 ? "…" : ""}`,
          { duration: 7000 },
        );
      }
    } catch (e) {
      toast.error("No se pudo leer el archivo .gpx");
      console.error(e);
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-primary/30 bg-primary/5 px-3 py-2">
      <FileUp className="h-4 w-4 text-primary" />
      <div className="min-w-0 flex-1 text-xs text-muted-foreground">
        Restaura las ubicaciones GPS perdidas importando un archivo .gpx generado desde
        "Exportar ruta a .GPX". Coincide por nombre o ID del cliente.
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".gpx,application/gpx+xml,application/xml,text/xml"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
      />
      <Button
        size="sm"
        variant="outline"
        disabled={loading}
        onClick={() => inputRef.current?.click()}
        className="border-primary/40 text-primary hover:bg-primary/10"
      >
        {loading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <FileUp className="mr-1.5 h-3.5 w-3.5" />}
        Importar .GPX
      </Button>
    </div>
  );
}
