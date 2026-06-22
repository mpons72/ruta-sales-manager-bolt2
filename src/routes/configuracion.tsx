import { createFileRoute, Link } from "@tanstack/react-router";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { backupFilename } from "@/lib/backup";
import { actions, useStore, productsForClient, type SpecialPricing, type ProductGroup } from "@/lib/store";
import { captureLocation, mapsUrl, openMapChooser } from "@/lib/geo";
import { getAskEachTime } from "@/lib/nav-provider";
import { parseGpx } from "@/lib/gpx";
import { VerifyAddressDialog, type VerifiedAddress } from "@/components/VerifyAddressDialog";
import { Trash2, Plus, MapPin, Loader2, ExternalLink, Save, Download, Upload, Pencil, X, BarChart3, Search, CreditCard, ArrowUp, ArrowDown, Power, Tag, Layers, FileUp, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Client, Product, Route as AppRoute } from "@/lib/store";
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
  const products = useStore((s) => s.products);
  const routes = useStore((s) => s.routes);
  const clients = useStore((s) => s.clients);
  const groups = useStore((s) => s.groups);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [placeId, setPlaceId] = useState<string | null>(null);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [routeId, setRouteId] = useState(routes[0]?.id ?? "");
  const [order, setOrder] = useState("");
  const [newEnabledGroups, setNewEnabledGroups] = useState<Set<string>>(
    () => new Set(groups.map((g) => g.id)),
  );
  useEffect(() => {
    // Por defecto: TODOS los grupos quedan habilitados al crear un cliente
    // nuevo. Si en algún momento aparecen grupos nuevos en el catálogo,
    // también quedan habilitados automáticamente.
    setNewEnabledGroups((prev) => {
      const allIds = groups.map((g) => g.id);
      if (allIds.length === 0) return prev;
      // Si el set previo no incluía a todos los grupos existentes,
      // asumimos que es estado inicial/desactualizado y lo reseteamos.
      const missingAny = allIds.some((id) => !prev.has(id));
      if (missingAny) return new Set(allIds);
      // Quitar ids que ya no existen
      const next = new Set<string>();
      for (const id of allIds) if (prev.has(id)) next.add(id);
      return next.size === 0 ? new Set(allIds) : next;
    });
  }, [groups]);
  const [capturingNew, setCapturingNew] = useState(false);
  const [capturingId, setCapturingId] = useState<string | null>(null);
  const [filterRouteId, setFilterRouteId] = useState<string>("all");
  const [search, setSearch] = useState("");
  const q = search.trim().toLowerCase();
  const matches = (c: { name: string; address?: string }) =>
    !q ||
    c.name.toLowerCase().includes(q) ||
    (c.address ?? "").toLowerCase().includes(q);

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
      actions.updateClient(id, { address: r.address, lat: r.lat, lng: r.lng });
      toast.success("Ubicación actualizada");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setCapturingId(null);
    }
  };

  return (
    <Card className="p-5">
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
        <Button
          onClick={() => {
            if (!name.trim() || !routeId) return;
            const visitOrder = Number(order || (clients.filter((c) => c.routeId === routeId).length + 1));
            const allIds = groups.map((g) => g.id);
            const enabledIds = allIds.filter((id) => newEnabledGroups.has(id));
            actions.addClient({
              name: name.trim(),
              address: address.trim(),
              routeId,
              visitOrder,
              ...(coords ? { lat: coords.lat, lng: coords.lng } : {}),
              ...(placeId ? { placeId, verifiedAddress: address.trim() } : {}),
              ...(enabledIds.length && enabledIds.length !== allIds.length
                ? { enabledGroupIds: enabledIds }
                : {}),
            });
            setName(""); setAddress(""); setOrder(""); setCoords(null); setPlaceId(null);
            setNewEnabledGroups(new Set(allIds));
          }}
        >
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

      <GpxImportRow />


      <div className="mb-3 grid gap-2 md:grid-cols-[1fr_2fr]">
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
            className="pl-9"
          />
        </div>
      </div>

      {(() => {
        const routeIds = new Set(routes.map((r) => r.id));
        const filtered = clients
          .filter((c) =>
            filterRouteId === "all" ? true : c.routeId === filterRouteId,
          )
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

function ClientEditRow({
  client,
  products,
  capturing,
  onCapture,
}: {
  client: Client;
  products: Product[];
  capturing: boolean;
  onCapture: () => void;
}) {
  const routes = useStore((s) => s.routes);
  const allClients = useStore((s) => s.clients);
  const [open, setOpen] = useState(false);
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
  const isActive = client.active !== false;

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
  };

  const stop = (fn: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    fn();
  };

  return (
    <div
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
            if (confirm(`¿Eliminar al cliente "${client.name}"? Esta acción no se puede deshacer.`)) {
              actions.removeClient(client.id);
            }
          }}
          title="Eliminar cliente"
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>

      {open && (
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

  const generate = async () => {
    try {
      const json = actions.exportData();
      const filename = backupFilename();

      const nav = navigator as Navigator & {
        share?: (d: ShareData) => Promise<void>;
        canShare?: (d: ShareData) => boolean;
      };

      // 1) Web Share API con archivo (Android moderno, iOS, WebView con share habilitado)
      if (nav.share && typeof File !== "undefined") {
        try {
          const file = new File([json], filename, { type: "application/json" });
          const shareData: ShareData = {
            files: [file],
            title: filename,
            text: "Respaldo de Ventas Salsa",
          };
          if (!nav.canShare || nav.canShare(shareData)) {
            await nav.share(shareData);
            toast.success("Respaldo compartido");
            return;
          }
        } catch (err) {
          if ((err as Error)?.name === "AbortError") return;
          // continúa a fallback
        }
      }

      // 2) Web Share solo con texto — comparte el JSON como texto
      if (nav.share) {
        try {
          await nav.share({ title: filename, text: json });
          toast.success("Respaldo compartido como texto");
          return;
        } catch (err) {
          if ((err as Error)?.name === "AbortError") return;
        }
      }

      // 3) Descarga clásica con anchor (data URL para máxima compatibilidad en WebView)
      const dataUrl = "data:application/json;charset=utf-8," + encodeURIComponent(json);
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = filename;
      a.rel = "noopener";
      a.target = "_blank";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success("Respaldo descargado");
    } catch (e) {
      toast.error("No se pudo generar: " + (e as Error).message);
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
        <Button onClick={generate}>
          <Download className="mr-2 h-4 w-4" /> Generar Respaldo
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
        toast.success(`Ubicaciones restauradas en ${matched} cliente(s)`);
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
