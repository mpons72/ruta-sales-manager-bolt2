import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  actions,
  clientSaleAmount,
  computeRemaining,
  getEffectivePrices,
  productsForClient,
  productsForClients,
  useStore,
  type ClientSale,
} from "@/lib/store";
import { mapsUrl, captureLocation, openMapChooser } from "@/lib/geo";
import { useNavProvider, useAskEachTime, openSygic, GOOGLE_MAX_PER_SEGMENT } from "@/lib/nav-provider";
import { CargaInicialDialog } from "@/components/CargaInicialDialog";
import { VerifyAddressDialog } from "@/components/VerifyAddressDialog";
import { buildGpx, downloadGpx } from "@/lib/gpx";
import { getLastPurchase, getClientTopProducts } from "@/lib/client-stats";
import { toast } from "sonner";
import { CheckCircle2, MapPin, Truck, ArrowRight, Flag, Sparkles, Navigation, Lock, ChevronDown, ChevronUp, CreditCard, Banknote, Crosshair, Loader2, Printer, Download, BarChart3, History, ShieldCheck } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { ReceiptDialog } from "@/components/ReceiptDialog";
import type { RemisionData } from "@/lib/remision";

export const Route = createFileRoute("/ruta")({
  head: () => ({
    meta: [
      { title: "Ruta en curso — RutaVenta" },
      { name: "description", content: "Visita clientes, registra surtidos, devoluciones y existencias en cada parada." },
    ],
  }),
  component: RutaPage,
});

function RutaPage() {
  const active = useStore((s) => s.active);
  const allProducts = useStore((s) => s.products);
  const groups = useStore((s) => s.groups);
  const allClients = useStore((s) => s.clients);
  const routes = useStore((s) => s.routes);
  const navProvider = useNavProvider();
  const askEachTime = useAskEachTime();
  const navigate = useNavigate();

  const [openClient, setOpenClient] = useState<string | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [openCarga, setOpenCarga] = useState(false);
  const [capturandoId, setCapturandoId] = useState<string | null>(null);
  const [tramosFrozen, setTramosFrozen] = useState<string[][] | null>(null);
  const [abriendoTramo, setAbriendoTramo] = useState<number | null>(null);
  const [verifyClientId, setVerifyClientId] = useState<string | null>(null);
  const [receiptData, setReceiptData] = useState<RemisionData | null>(null);

  const capturarUbicacion = async (clientId: string) => {
    setCapturandoId(clientId);
    try {
      const { lat, lng, address } = await captureLocation();
      actions.updateClient(clientId, { lat, lng, address });
      toast.success("Ubicación guardada en el cliente");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setCapturandoId(null);
    }
  };

  const clients = useMemo(() => {
    if (!active) return [];
    if (active.clientIds && active.clientIds.length > 0) {
      const order = new Map(active.clientIds.map((id, i) => [id, i + 1]));
      const orderedClients = allClients
        .filter((c) => order.has(c.id))
        .map((c) => ({ ...c, visitOrder: order.get(c.id) ?? c.visitOrder }))
        .sort((a, b) => a.visitOrder - b.visitOrder);
      if (active.temporary) return orderedClients;
      const included = new Set(active.clientIds);
      const newRouteClients = allClients
        .filter((c) => c.routeId === active.routeId && !included.has(c.id))
        .sort((a, b) => a.visitOrder - b.visitOrder);
      return [...orderedClients, ...newRouteClients];
    }
    return allClients
      .filter((c) => c.routeId === active.routeId)
      .sort((a, b) => a.visitOrder - b.visitOrder);
  }, [allClients, active]);

  const products = useMemo(
    () => productsForClients(allProducts, groups, clients),
    [allProducts, groups, clients],
  );

  const remaining = useMemo(
    () => (active ? computeRemaining(active, allProducts) : {}),
    [active, allProducts],
  );

  const exportarGpx = () => {
    if (!active) return;
    const conGps = clients.filter((c) => c.lat != null && c.lng != null);
    if (conGps.length === 0) {
      toast.error("Ningún cliente de la ruta tiene coordenadas GPS");
      return;
    }
    const routeName = active.label ?? routes.find((r) => r.id === active.routeId)?.name ?? "Ruta";
    const fecha = new Date(active.date).toISOString().slice(0, 10);
    const gpx = buildGpx(conGps, `${routeName} · ${fecha}`);
    downloadGpx(`ruta-${fecha}.gpx`, gpx);
    toast.success(`GPX generado con ${conGps.length} parada(s)`);
  };

  if (!active) {
    return (
      <div className="min-h-screen" style={{ background: "var(--gradient-warm)" }}>
        <AppHeader />
        <main className="mx-auto max-w-2xl px-4 py-12 text-center">
          <h1 className="text-2xl font-bold">No hay ruta activa</h1>
          <p className="mt-2 text-muted-foreground">Inicia una ruta desde la pantalla de inicio.</p>
          <Button asChild className="mt-4">
            <Link to="/">Ir a inicio</Link>
          </Button>
        </main>
      </div>
    );
  }

  const routeName = active.label ?? routes.find((r) => r.id === active.routeId)?.name ?? "Ruta";
  const visited = clients.filter((c) => active.sales[c.id]?.completed).length;

  // Inventario inicial / actual de la camioneta (suma total de unidades)
  const inicialTotal = products.reduce((acc, p) => acc + (active.initialInventory[p.id] ?? 0), 0);
  const quedaTotal = products.reduce((acc, p) => acc + (remaining[p.id] ?? 0), 0);

  // Totales efectivo / crédito
  let efectivo = 0;
  let credito = 0;
  for (const c of clients) {
    const sale = active.sales[c.id];
    if (!sale?.completed) continue;
    const amt = clientSaleAmount(sale, products);
    if (sale.paymentType === "credit" || c.credit) credito += amt;
    else efectivo += amt;
  }

  const proxima = clients.find((c) => !active.sales[c.id]?.completed);

  const optimizarRecorrido = async () => {
    try {
      const { getCurrentPosition } = await import("@/lib/geo");
      const pendientes = clients.filter((c) => !active.sales[c.id]?.completed);
      const conGps = pendientes.filter((c) => c.lat != null && c.lng != null);
      const sinGps = pendientes.filter((c) => c.lat == null || c.lng == null);

      if (conGps.length === 0) {
        toast.error("Ningún cliente pendiente tiene coordenadas para optimizar");
        return;
      }

      // Elegir origen: ubicación actual → último completado con GPS → primer pendiente con GPS
      let origin: { lat: number; lng: number } | null = null;
      let origenFuente = "tu ubicación actual";
      try {
        const pos = await getCurrentPosition();
        origin = { lat: pos.lat, lng: pos.lng };
      } catch {
        const ultimoCompletado = [...clients]
          .reverse()
          .find((c) => active.sales[c.id]?.completed && c.lat != null && c.lng != null);
        if (ultimoCompletado) {
          origin = { lat: ultimoCompletado.lat!, lng: ultimoCompletado.lng! };
          origenFuente = `última visita (${ultimoCompletado.name})`;
        } else {
          origin = { lat: conGps[0].lat!, lng: conGps[0].lng! };
          origenFuente = `primer cliente con GPS (${conGps[0].name})`;
        }
      }

      // Nearest-neighbor desde el origen elegido
      const order: string[] = [];
      let cur = origin;
      const pool = [...conGps];
      while (pool.length) {
        let bi = 0;
        let bd = Infinity;
        for (let i = 0; i < pool.length; i++) {
          const d = Math.hypot(pool[i].lat! - cur.lat, pool[i].lng! - cur.lng);
          if (d < bd) { bd = d; bi = i; }
        }
        const next = pool.splice(bi, 1)[0];
        order.push(next.id);
        cur = { lat: next.lat!, lng: next.lng! };
      }

      // Clientes sin GPS conservan su orden relativo actual y van al final
      const sinGpsIds = sinGps.map((c) => c.id);

      // El optimizador NUNCA modifica el orden permanente del cliente.
      // Sólo aplica un orden temporal sobre la ruta activa via active.clientIds.
      const completadosIds = clients
        .filter((c) => active.sales[c.id]?.completed)
        .map((c) => c.id);
      const baseIds = active.clientIds && active.clientIds.length > 0
        ? active.clientIds
        : clients.map((c) => c.id);
      const conocidos = new Set([...completadosIds, ...order, ...sinGpsIds]);
      const otros = baseIds.filter((id) => !conocidos.has(id));
      actions.reorderActiveClients([...completadosIds, ...order, ...sinGpsIds, ...otros]);

      // Congelar tramos basados en el nuevo orden, en grupos del tamaño que admita el proveedor.
      // Sygic: 1 parada por enlace (los enlaces multi-stop no son confiables en la versión móvil).
      const MAX = navProvider === "sygic" ? 1 : GOOGLE_MAX_PER_SEGMENT;
      const nuevos: string[][] = [];
      for (let i = 0; i < order.length; i += MAX) nuevos.push(order.slice(i, i + MAX));
      setTramosFrozen(nuevos);

      toast.success(
        `Recorrido optimizado · ${order.length} parada(s) desde ${origenFuente}`,
      );
      if (sinGps.length > 0) {
        toast.warning(
          `${sinGps.length} sin GPS al final: ${sinGps
            .slice(0, 3)
            .map((c) => c.name)
            .join(", ")}${sinGps.length > 3 ? "…" : ""}`,
          { duration: 6000 },
        );
      }
    } catch (e) {
      console.error(e);
      toast.error((e as Error).message || "No se pudo optimizar");
    }
  };

  // Pendientes con GPS, en orden de visita (visitOrder ya viene ordenado en `clients`)
  const pendientesConGps = clients.filter(
    (c) => !active.sales[c.id]?.completed && c.lat != null && c.lng != null,
  );

  // Google Maps permite origin + destination + ~8 waypoints (10 paradas máx).
  // Sygic recibe 1 parada por enlace (próxima pendiente).
  const MAX_PER_SEGMENT = navProvider === "sygic" ? 1 : GOOGLE_MAX_PER_SEGMENT;

  // Construir tramos: usar congelados si cubren a todos los pendientes; si no, derivar dinámicos
  const clientById = new Map(clients.map((c) => [c.id, c]));
  type Tramo = { idsOriginales: string[]; pendientes: typeof pendientesConGps; total: number; visitados: number };
  const tramos: Tramo[] = (() => {
    if (pendientesConGps.length === 0) return [];
    const pendientesIdSet = new Set(pendientesConGps.map((c) => c.id));
    const cubreTodo =
      tramosFrozen &&
      [...pendientesIdSet].every((id) => tramosFrozen!.some((t) => t.includes(id)));
    const fuente: string[][] = cubreTodo
      ? tramosFrozen!
      : (() => {
          const segs: string[][] = [];
          for (let i = 0; i < pendientesConGps.length; i += MAX_PER_SEGMENT) {
            segs.push(pendientesConGps.slice(i, i + MAX_PER_SEGMENT).map((c) => c.id));
          }
          return segs;
        })();
    return fuente.map((ids) => {
      const total = ids.length;
      const pendientes = ids
        .map((id) => clientById.get(id))
        .filter((c): c is NonNullable<typeof c> => !!c && !active.sales[c.id]?.completed && c.lat != null && c.lng != null);
      return { idsOriginales: ids, pendientes, total, visitados: total - pendientes.length };
    });
  })();

  const abrirTramoEnMaps = async (idx: number) => {
    const tramo = tramos[idx];
    if (!tramo || tramo.pendientes.length === 0) return;
    setAbriendoTramo(idx);

    // Selector del sistema: una parada a la vez (la próxima pendiente).
    if (askEachTime) {
      try {
        const stop = tramo.pendientes[0];
        openMapChooser(stop.lat, stop.lng, stop.address);
      } finally {
        setAbriendoTramo(null);
      }
      return;
    }

    // Sygic: 1 sola parada por enlace (la próxima pendiente del tramo).
    if (navProvider === "sygic") {
      try {
        const stop = tramo.pendientes[0];
        openSygic(stop.lat!, stop.lng!);
        setTimeout(() => {
          toast.message(
            "Si Sygic no abrió, verifica que esté instalado y permite abrir enlaces externos.",
          );
        }, 1500);
      } finally {
        setAbriendoTramo(null);
      }
      return;
    }

    let originParam = "";
    try {
      const { getCurrentPosition } = await import("@/lib/geo");
      const pos = await Promise.race([
        getCurrentPosition(),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), 5000)),
      ]);
      originParam = `${pos.lat},${pos.lng}`;
    } catch {
      // Sin GPS: usar la primera parada pendiente como origen
      const first = tramo.pendientes[0];
      originParam = `${first.lat},${first.lng}`;
    } finally {
      setAbriendoTramo(null);
    }
    const stops = tramo.pendientes;
    const destino = stops[stops.length - 1];
    // Si usamos GPS como origen, todas las paradas excepto la última son waypoints.
    // Si usamos la primera parada como origen, el resto intermedio son waypoints.
    const usandoGpsOrigen = originParam !== `${stops[0].lat},${stops[0].lng}`;
    const wpStops = usandoGpsOrigen ? stops.slice(0, -1) : stops.slice(1, -1);
    const waypoints = wpStops.map((c) => `${c.lat},${c.lng}`).join("|");
    const url =
      `https://www.google.com/maps/dir/?api=1` +
      `&origin=${originParam}` +
      `&destination=${destino.lat},${destino.lng}` +
      (waypoints ? `&waypoints=${encodeURIComponent(waypoints)}` : "") +
      `&travelmode=driving&dir_action=navigate`;
    window.open(url, "_blank");
  };

  const iniciarEnMaps = () => {
    const idx = tramos.findIndex((t) => t.pendientes.length > 0);
    if (idx >= 0) abrirTramoEnMaps(idx);
  };

  return (
    <div className="min-h-screen" style={{ background: "var(--gradient-warm)" }}>
      <AppHeader />
      <main className="mx-auto max-w-3xl px-4 py-5">
        <div className="mb-3">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Ruta en curso</div>
          <h1 className="text-2xl font-extrabold">{routeName}</h1>
          <p className="text-sm text-muted-foreground">
            {visited}/{clients.length} visitas completadas
          </p>
        </div>

        {/* Camioneta */}
        <Card
          className="relative overflow-hidden border-0 p-5 text-primary-foreground shadow-elevated"
          style={{ background: "var(--gradient-hero)" }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              <h2 className="text-lg font-bold">Camioneta</h2>
            </div>
            <Button
              size="icon"
              variant="outline"
              className="border-white/30 bg-black/30 text-white hover:bg-black/50"
              onClick={() => setOpenCarga(true)}
            >
              <Lock className="mr-1.5 h-3.5 w-3.5" /> Modificar carga
            </Button>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Stat label="Efectivo" value={`$${efectivo.toFixed(2)}`} />
            <Stat label="Crédito" value={`$${credito.toFixed(2)}`} />
            <Stat label="Inicial" value={String(inicialTotal)} />
            <Stat label="Queda" value={String(quedaTotal)} />
          </div>
        </Card>

        {/* Próxima parada + acciones */}
        {proxima && (
          <Card className="mt-4 border-border/40 bg-card/70 p-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
              <MapPin className="h-3.5 w-3.5" /> Próxima parada
            </div>
            <div className="mt-1 text-lg font-bold">{proxima.name}</div>
            <div className="text-xs text-muted-foreground">
              {clients.length - visited} clientes pendientes en la ruta
            </div>
            <Button onClick={optimizarRecorrido} size="lg" className="mt-3 w-full">
              <Sparkles className="mr-2 h-4 w-4" />
              Optimizar Recorrido (menor tiempo y combustible)
            </Button>
            {tramos.length > 0 && (
              <div className="mt-2 grid gap-2">
                {(navProvider === "sygic"
                  ? tramos.slice(0, 1)
                  : tramos
                ).map((tramo, idx) => {
                  const start = idx * MAX_PER_SEGMENT + 1;
                  const end = start + tramo.total - 1;
                  const todosVisitados = tramo.pendientes.length === 0;
                  const cargando = abriendoTramo === idx;
                  const sygic = navProvider === "sygic";
                  const nextName = tramo.pendientes[0]?.name ?? "";
                  const label = sygic
                    ? `Próxima parada en Sygic${nextName ? `: ${nextName}` : ""}`
                    : tramos.length === 1
                      ? "Iniciar Recorrido en Maps"
                      : `Tramo ${idx + 1}: clientes ${start}–${end}`;
                  return (
                    <Button
                      key={idx}
                      variant="outline"
                      size="lg"
                      disabled={todosVisitados || cargando}
                      onClick={() => abrirTramoEnMaps(idx)}
                      className="w-full border-primary/40 text-primary hover:bg-primary/10 disabled:opacity-60"
                    >
                      {cargando ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : todosVisitados ? (
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                      ) : (
                        <Navigation className="mr-2 h-4 w-4" />
                      )}
                      <span className="flex-1 text-left">{label}</span>
                      <Badge
                        variant="secondary"
                        className="ml-2 bg-primary/15 text-primary"
                      >
                        {sygic
                          ? `${pendientesConGps.length} pendientes`
                          : todosVisitados
                            ? "✓ completo"
                            : `${tramo.visitados}/${tramo.total} visitados`}
                      </Badge>
                    </Button>
                  );
                })}
                {navProvider === "sygic" ? (
                  <p className="text-[11px] text-muted-foreground">
                    Sygic móvil sólo acepta una parada por enlace. El botón abre Sygic en la
                    próxima parada pendiente; al regresar, vuelve a tocarlo para la siguiente.
                  </p>
                ) : tramos.length > 1 ? (
                  <p className="text-[11px] text-muted-foreground">
                    Google Maps limita cada ruta a 10 paradas. Se dividió en {tramos.length} tramos
                    de hasta {MAX_PER_SEGMENT} clientes cada uno; cada tramo usa tu ubicación GPS
                    como origen y omite a los ya visitados.
                  </p>
                ) : null}
              </div>
            )}
            <p className="mt-3 text-[11px] text-muted-foreground">
              La opción optimizada usa tu ubicación GPS y reordena los clientes para recorrer la
              menor distancia posible, ahorrando tiempo y combustible.
            </p>
          </Card>
        )}

        {/* Lista de clientes */}
        <div className="mt-4 grid gap-2.5">
          {clients.map((c) => {
            const sale = active.sales[c.id];
            const done = sale?.completed;
            const amount = sale ? clientSaleAmount(sale, products) : 0;
            return (
              <Card
                key={c.id}
                className={`flex items-center gap-3 rounded-2xl border-border/40 p-3 transition-all hover:border-primary/40 ${
                  done ? "border-success/40 bg-success/5" : "bg-card/70"
                }`}
              >
                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-base font-bold ${
                    done
                      ? "bg-success/20 text-success"
                      : "bg-primary/15 text-primary"
                  }`}
                >
                  {done ? <CheckCircle2 className="h-5 w-5" /> : c.visitOrder}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold break-words">{c.name}</h3>
                    {c.credit && (
                      <Badge variant="outline" className="border-warning/50 bg-warning/10 text-warning">
                        <CreditCard className="mr-1 h-3 w-3" /> Crédito
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {done ? (
                      <span className="font-medium text-success">
                        <Banknote className="mr-1 inline h-3 w-3" />${amount.toFixed(2)}
                      </span>
                    ) : (
                      "Pendiente"
                    )}
                  </div>
                  {(c.address || c.lat != null) && (
                    <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3 text-primary" />
                      <span className="break-words">
                        {c.address ?? `${c.lat?.toFixed(6)}, ${c.lng?.toFixed(6)}`}
                      </span>
                    </div>
                  )}
                </div>
                {c.lat != null && c.lng != null ? (
                  askEachTime ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        openMapChooser(c.lat, c.lng, c.address, c.placeId);
                      }}
                      className="border-primary/40 text-primary hover:bg-primary/10"
                    >
                      <MapPin className="mr-1.5 h-3.5 w-3.5" /> Mapa
                    </Button>
                  ) : navProvider === "sygic" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        openSygic(c.lat!, c.lng!);
                      }}
                      className="border-primary/40 text-primary hover:bg-primary/10"
                    >
                      <MapPin className="mr-1.5 h-3.5 w-3.5" /> Sygic
                    </Button>
                  ) : (
                    <Button
                      asChild
                      size="sm"
                      variant="outline"
                      className="border-primary/40 text-primary hover:bg-primary/10"
                    >
                      <a
                        href={mapsUrl(c.lat, c.lng, c.address, c.placeId)}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MapPin className="mr-1.5 h-3.5 w-3.5" /> Mapa
                      </a>
                    </Button>
                  )
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={capturandoId === c.id}
                    onClick={(e) => { e.stopPropagation(); capturarUbicacion(c.id); }}
                    className="border-primary/40 text-primary hover:bg-primary/10"
                  >
                    {capturandoId === c.id ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Crosshair className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    Guardar
                  </Button>
                )}
                <Button
                  size="icon"
                  variant="outline"
                  title="Verificar dirección con Google"
                  onClick={(e) => {
                    e.stopPropagation();
                    setVerifyClientId(c.id);
                  }}
                  className="border-primary/40 text-primary hover:bg-primary/10 h-8 w-8"
                >
                  <ShieldCheck className="h-4 w-4" />
                </Button>
                {done && (
                  <Button
                    size="icon"
                    variant="outline"
                    title="Generar nota de remisión"
                    className="border-primary/40 text-primary hover:bg-primary/10 h-8 w-8"
                    onClick={(e) => {
                      e.stopPropagation();
                      setReceiptData({
                        client: { name: c.name, address: c.address },
                        sale: sale!,
                        products,
                        date: active.date,
                      });
                    }}
                  >
                    <Printer className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setOpenClient(c.id)}
                  aria-label={done ? "Editar" : "Atender"}
                >
                  {done ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </Card>
            );
          })}
        </div>

        <Button
          variant="outline"
          size="lg"
          onClick={exportarGpx}
          className="mt-3 w-full border-primary/50 text-primary hover:bg-primary/10"
        >
          <Download className="mr-2 h-4 w-4" /> Exportar ruta a .GPX (Sygic, OsmAnd, etc.)
        </Button>

        <Button
          variant="outline"
          size="lg"
          onClick={() => setConfirmEnd(true)}
          className="mt-3 w-full border-primary/50 text-primary hover:bg-primary/10"
        >
          <Flag className="mr-2 h-4 w-4" /> Cerrar ruta y ver reporte
        </Button>
      </main>

      {pendientesConGps.length > 0 && (
        <button
          type="button"
          onClick={iniciarEnMaps}
          className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-bold text-primary-foreground shadow-elevated transition-transform hover:scale-105 active:scale-95"
          aria-label={navProvider === "sygic" ? "Iniciar recorrido en Sygic" : "Iniciar recorrido en Google Maps"}
        >
          <Navigation className="h-5 w-5" />
          <span className="hidden sm:inline">{navProvider === "sygic" ? "Iniciar Recorrido en Sygic" : "Iniciar Recorrido en Maps"}</span>
          <span className="rounded-full bg-black/25 px-2 py-0.5 text-xs">
            {pendientesConGps.length}
          </span>
        </button>
      )}

      {openClient && (
        <ClientDialog
          clientId={openClient}
          onClose={() => setOpenClient(null)}
          remaining={remaining}
        />
      )}

      {(() => {
        const client = clients.find((c) => c.id === verifyClientId);
        if (!client) return null;
        return (
          <VerifyAddressDialog
            open={verifyClientId != null}
            onClose={() => setVerifyClientId(null)}
            initialAddress={client.address || client.name}
            onConfirm={(v) => {
              actions.updateClient(client.id, {
                address: v.address,
                lat: v.lat,
                lng: v.lng,
                placeId: v.placeId,
                verifiedAddress: v.address,
              });
              toast.success("Dirección verificada y guardada");
              setVerifyClientId(null);
            }}
          />
        );
      })()}

      <CargaInicialDialog open={openCarga} onClose={() => setOpenCarga(false)} />

      <ReceiptDialog 
        open={receiptData !== null}
        onOpenChange={(open) => !open && setReceiptData(null)}
        data={receiptData || undefined}
      />

      <Dialog open={confirmEnd} onOpenChange={setConfirmEnd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Cerrar la ruta?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Se generará el reporte final y la ruta se moverá al historial.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmEnd(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                actions.endRoute();
                setConfirmEnd(false);
                navigate({ to: "/reporte" });
              }}
            >
              Cerrar y ver reporte
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-black/25 p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-white/70">
        {label}
      </div>
      <div className="mt-0.5 text-xl font-extrabold tabular-nums">{value}</div>
    </div>
  );
}

function FieldCell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-0.5 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      {children}
    </div>
  );
}

function ClientDialog({
  clientId,
  onClose,
  remaining,
}: {
  clientId: string;
  onClose: () => void;
  remaining: Record<string, number>;
}) {
  const allProducts = useStore((s) => s.products);
  const groups = useStore((s) => s.groups);
  const client = useStore((s) => s.clients.find((c) => c.id === clientId));
  const existing = useStore((s) => s.active?.sales[clientId]);
  const active = useStore((s) => s.active);
  const products = useMemo(
    () => productsForClient(allProducts, groups, client),
    [allProducts, groups, client],
  );

  const [existenciaAnterior, setExistenciaAnterior] = useState<Record<string, string>>(() =>
    Object.fromEntries(products.map((p) => [p.id, String(existing?.existenciaAnterior[p.id] ?? "")])),
  );
  const [surtido, setSurtido] = useState<Record<string, string>>(() =>
    Object.fromEntries(products.map((p) => [p.id, String(existing?.surtido[p.id] ?? "")])),
  );
  const [devolucion, setDevolucion] = useState<Record<string, string>>(() =>
    Object.fromEntries(products.map((p) => [p.id, String(existing?.devolucion[p.id] ?? "")])),
  );
  const [paymentType, setPaymentType] = useState<"cash" | "credit">(
    existing?.paymentType ?? (client?.credit ? "credit" : "cash"),
  );
  const [notes, setNotes] = useState<string>(existing?.notes ?? "");

  if (!client || !active) return null;

  // 'Queda' reactiva: Carga inicial − suma de surtidas globales. Las devoluciones son merma
  // y NO regresan al inventario; tampoco son necesariamente del mismo sabor.
  const computeQueda = (productId: string) => {
    const initial = active.initialInventory[productId] ?? 0;
    let surtTotal = 0;
    for (const [cid, sale] of Object.entries(active.sales)) {
      if (cid === clientId) continue;
      surtTotal += sale.surtido[productId] ?? 0;
    }
    surtTotal += Number(surtido[productId] || 0);
    return initial - surtTotal;
  };

  const effectivePrices = getEffectivePrices(client, products);

  const buildSale = (completed: boolean): ClientSale => ({
    completed,
    paymentType,
    existenciaAnterior: Object.fromEntries(products.map((p) => [p.id, Number(existenciaAnterior[p.id] || 0)])),
    surtido: Object.fromEntries(products.map((p) => [p.id, Number(surtido[p.id] || 0)])),
    devolucion: Object.fromEntries(products.map((p) => [p.id, Number(devolucion[p.id] || 0)])),
    existenciaActual: Object.fromEntries(products.map((p) => [p.id, 0])),
    priceSnapshot: { ...effectivePrices },
    notes: notes.trim() ? notes.trim() : undefined,
  });

  const total = clientSaleAmount(buildSale(true), products);

  const handleSave = (completed: boolean) => {
    actions.saveClientSale(clientId, buildSale(completed));
    onClose();
  };

  const handleSaveAndPrint = () => {
    const sale = buildSale(true);
    actions.saveClientSale(clientId, sale);
    setReceiptData({
      client: { name: client.name, address: client.address },
      sale,
      products,
      date: active.date,
    });
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[95vh] w-[95vw] max-w-3xl flex-col gap-3 p-4 sm:p-6">
        <DialogHeader className="shrink-0">
          <DialogTitle>
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Cliente #{client.visitOrder}
            </span>
            <div className="text-xl break-words whitespace-normal">{client.name}</div>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto -mx-1 px-1 space-y-3">

        <ClientStatsPanel clientId={client.id} />

        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/40 p-2">
          <span className="text-xs font-semibold uppercase text-muted-foreground">
            Pago:
          </span>
          <Button
            type="button"
            size="icon"
            variant={paymentType === "cash" ? "default" : "outline"}
            onClick={() => setPaymentType("cash")}
          >
            <Banknote className="mr-1.5 h-3.5 w-3.5" /> Contado
          </Button>
          <Button
            type="button"
            size="icon"
            variant={paymentType === "credit" ? "default" : "outline"}
            onClick={() => setPaymentType("credit")}
          >
            <CreditCard className="mr-1.5 h-3.5 w-3.5" /> Crédito
          </Button>
        </div>


        <div>
          <div className="space-y-2">
            {products.map((p) => {
              const sur = Number(surtido[p.id] || 0);
              const dev = Number(devolucion[p.id] || 0);
              const sold = sur - dev;
              const price = effectivePrices[p.id] ?? p.price;
              const isSpecial = price !== p.price;
              const lineTotal = Math.max(0, sold) * price;
              const queda = computeQueda(p.id);
              return (
                <div
                  key={p.id}
                  className="rounded-lg bg-muted/40 px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold break-words leading-tight">
                        {p.name}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        ${price.toFixed(2)}{isSpecial ? " ⭐" : ""} · vta {sold}
                      </div>
                    </div>
                    <div
                      className={`shrink-0 text-right text-base font-bold tabular-nums ${
                        sold < 0 ? "text-destructive" : "text-primary"
                      }`}
                    >
                      ${lineTotal.toFixed(2)}
                    </div>
                  </div>
                  <div className="mt-2 grid grid-cols-4 gap-1.5">
                    <FieldCell label="Antes">
                      <Input
                        type="number" min={0} inputMode="numeric" value={existenciaAnterior[p.id]}
                        onChange={(e) => setExistenciaAnterior({ ...existenciaAnterior, [p.id]: e.target.value })}
                        className="h-9 px-1 text-center" placeholder="0"
                      />
                    </FieldCell>
                    <FieldCell label="Surt.">
                      <Input
                        type="number" min={0} inputMode="numeric" value={surtido[p.id]}
                        onChange={(e) => setSurtido({ ...surtido, [p.id]: e.target.value })}
                        className="h-9 px-1 text-center font-semibold" placeholder="0"
                      />
                    </FieldCell>
                    <FieldCell label="Dev.">
                      <Input
                        type="number" min={0} inputMode="numeric" value={devolucion[p.id]}
                        onChange={(e) => setDevolucion({ ...devolucion, [p.id]: e.target.value })}
                        className="h-9 px-1 text-center" placeholder="0"
                      />
                    </FieldCell>
                    <FieldCell label="Queda">
                      <div
                        className={`flex h-9 items-center justify-center rounded-md border border-input bg-background text-sm font-bold tabular-nums ${
                          queda < 0 ? "text-destructive" : "text-foreground"
                        }`}
                        title="Carga inicial − surtidas (las devoluciones son merma, no regresan al inventario)"
                      >
                        {queda}
                      </div>
                    </FieldCell>
                  </div>
                </div>
              );
            })}
          </div>
          {(() => {
            const totals = products.reduce(
              (acc, p) => {
                acc.ant += Number(existenciaAnterior[p.id] || 0);
                acc.sur += Number(surtido[p.id] || 0);
                acc.dev += Number(devolucion[p.id] || 0);
                acc.queda += computeQueda(p.id);
                return acc;
              },
              { ant: 0, sur: 0, dev: 0, queda: 0 },
            );
            const entregado = totals.sur - totals.dev;
            return (
              <div className="mt-3 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Totales
                  </div>
                  <div className="text-[11px] font-medium text-muted-foreground">
                    Entregadas: <span className="font-bold text-foreground">{entregado}</span> pzas
                  </div>
                </div>
                <div className="mt-1.5 grid grid-cols-4 gap-1.5 text-center text-sm font-bold tabular-nums">
                  <div><div className="text-[10px] font-medium text-muted-foreground">Antes</div>{totals.ant}</div>
                  <div className="text-primary"><div className="text-[10px] font-medium text-muted-foreground">Surt.</div>{totals.sur}</div>
                  <div className="text-warning"><div className="text-[10px] font-medium text-muted-foreground">Dev.</div>{totals.dev}</div>
                  <div><div className="text-[10px] font-medium text-muted-foreground">Queda</div>{totals.queda}</div>
                </div>
              </div>
            );
          })()}
        </div>

        <div className="rounded-lg border border-border/40 bg-muted/30 p-3">
          <Label htmlFor={`notes-${clientId}`} className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Notas / incidentes
          </Label>
          <Textarea
            id={`notes-${clientId}`}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Observaciones, aclaraciones, faltantes, devoluciones especiales..."
            rows={3}
            className="mt-1 resize-y"
          />
        </div>


        <div className="flex items-center justify-between rounded-md bg-primary/10 px-4 py-3">
          <div className="text-sm font-medium">Total venta cliente</div>
          <div className="text-2xl font-bold text-primary">${total.toFixed(2)}</div>
        </div>
        </div>

        <DialogFooter className="flex-wrap gap-2 shrink-0">
          <Button variant="outline" onClick={() => handleSave(false)}>
            Guardar borrador
          </Button>
          <Button variant="outline" onClick={handleSaveAndPrint}>
            <Printer className="mr-2 h-4 w-4" /> Visitar e imprimir nota
          </Button>
          <Button onClick={() => handleSave(true)}>
            <CheckCircle2 className="mr-2 h-4 w-4" /> Marcar visitado
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ClientStatsPanel({ clientId }: { clientId: string }) {
  const client = useStore((s) => s.clients.find((c) => c.id === clientId));
  const allProducts = useStore((s) => s.products);
  const groups = useStore((s) => s.groups);
  const history = useStore((s) => s.history);
  const active = useStore((s) => s.active);
  const [open, setOpen] = useState(false);
  const products = useMemo(
    () => productsForClient(allProducts, groups, client),
    [allProducts, groups, client],
  );
  const last = useMemo(
    () => (client ? getLastPurchase(client, history, active, products) : null),
    [client, history, active, products],
  );
  const stats = useMemo(
    () => (client ? getClientTopProducts(client, history, active, products, 5) : null),
    [client, history, active, products],
  );

  if (!client) return null;

  const summary = last
    ? `Última: ${new Date(last.date).toLocaleDateString("es-MX", { day: "2-digit", month: "short" })} · $${last.total.toFixed(2)} · ${last.units} pzas`
    : "Sin compras previas";
  const topName = stats?.top?.name;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-left transition hover:bg-primary/10"
      >
        <div className="flex min-w-0 items-center gap-2">
          <BarChart3 className="h-4 w-4 shrink-0 text-primary" />
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-primary">
              Estadísticas y última compra
            </div>
            <div className="truncate text-xs text-muted-foreground">
              {summary}
              {topName ? ` · ⭐ ${topName}` : ""}
            </div>
          </div>
        </div>
        <ArrowRight className="h-4 w-4 shrink-0 text-primary" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[95vw] max-w-lg p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>
              <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Estadísticas del cliente
              </div>
              <div className="text-lg break-words">{client.name}</div>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-primary">
                <History className="h-3.5 w-3.5" /> Última compra
              </div>
              {last ? (
                <div className="mt-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div className="text-sm font-semibold">
                      {new Date(last.date).toLocaleDateString("es-MX", {
                        weekday: "short",
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </div>
                    <div className="text-lg font-extrabold text-primary tabular-nums">
                      ${last.total.toFixed(2)}
                    </div>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {last.units} pzas netas
                    {last.paymentType ? ` · ${last.paymentType === "credit" ? "Crédito" : "Contado"}` : ""}
                  </div>
                  {last.items.length > 0 && (
                    <div className="mt-2 overflow-x-auto">
                      <table className="w-full text-[11px]">
                        <thead>
                          <tr className="text-left text-[10px] uppercase text-muted-foreground">
                            <th className="py-1 pr-2">Sabor</th>
                            <th className="py-1 px-1 text-right">Ant.</th>
                            <th className="py-1 px-1 text-right">Surt.</th>
                            <th className="py-1 px-1 text-right">Dev.</th>
                            <th className="py-1 px-1 text-right">Exist.</th>
                            <th className="py-1 px-1 text-right">Vend.</th>
                            <th className="py-1 pl-1 text-right">$</th>
                          </tr>
                        </thead>
                        <tbody>
                          {last.items.map((it) => (
                            <tr key={it.name} className="border-t border-border/40">
                              <td className="py-1 pr-2 font-medium">{it.name}</td>
                              <td className="py-1 px-1 text-right tabular-nums text-muted-foreground">{it.existenciaAnterior}</td>
                              <td className="py-1 px-1 text-right tabular-nums">{it.surtido}</td>
                              <td className="py-1 px-1 text-right tabular-nums">{it.devolucion}</td>
                              <td className="py-1 px-1 text-right tabular-nums text-muted-foreground">{it.existenciaActual}</td>
                              <td className="py-1 px-1 text-right font-semibold tabular-nums">{it.qty}</td>
                              <td className="py-1 pl-1 text-right tabular-nums text-primary">${(it.qty * it.price).toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {last.notes && (
                    <div className="mt-2 rounded-md border border-border/60 bg-card/60 p-2">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Notas / incidentes
                      </div>
                      <div className="mt-0.5 whitespace-pre-wrap text-xs">{last.notes}</div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">
                  Este cliente aún no tiene compras registradas.
                </p>
              )}
            </div>

            <div className="rounded-lg border border-border/60 bg-card/60 p-3">
              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                <BarChart3 className="h-3.5 w-3.5 text-primary" /> Productos más comprados
                <span className="ml-auto font-normal">{stats?.visits ?? 0} visitas</span>
              </div>
              {stats && stats.perProduct.some((p) => p.units > 0) ? (
                <div className="mt-2 space-y-1.5">
                  {stats.perProduct
                    .filter((p) => p.units > 0)
                    .map((p) => {
                      const max = stats.perProduct[0]?.units || 1;
                      const pct = (p.units / max) * 100;
                      return (
                        <div key={p.id}>
                          <div className="flex items-center justify-between text-xs">
                            <span className="truncate font-medium">{p.name}</span>
                            <span className="shrink-0 tabular-nums text-muted-foreground">
                              {p.units} pzas · prom {p.avg.toFixed(1)}
                            </span>
                          </div>
                          <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${pct}%`,
                                background:
                                  p.id === stats.top?.id ? "var(--color-primary)" : "var(--color-accent)",
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                </div>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">Sin historial de surtido.</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
