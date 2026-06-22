import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { VerifyAddressDialog } from "@/components/VerifyAddressDialog";
import { useStore, actions, normalizeSale, type Client, type ClientSale, type HistoryEntry, type Product, type ActiveRoute } from "@/lib/store";
import { getLastPurchase } from "@/lib/client-stats";
import { mapsUrl, openMapChooser } from "@/lib/geo";
import { useAskEachTime } from "@/lib/nav-provider";
import { ArrowLeft, BarChart3, MapPin, ExternalLink, TrendingUp, Package, History, Pencil, ShieldCheck, Save, X, CalendarSearch } from "lucide-react";
import { useMemo, useState, useEffect } from "react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { priceFor } from "@/lib/store";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from "recharts";

export const Route = createFileRoute("/clientes/$clientId")({
  head: () => ({
    meta: [
      { title: "Estadísticas de cliente — SalsaRuta" },
      { name: "description", content: "Volumen de compra por producto y promedio por visita." },
    ],
  }),
  component: ClienteDetallePage,
});

function currency(n: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(n);
}

function recordUnits(record: Record<string, number> | undefined, product: Product) {
  const normalizedName = product.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const match = Object.entries(record ?? {}).find(([key]) => {
    const normalizedKey = key.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    return key === product.id || key === product.name || normalizedKey === normalizedName;
  });
  return Number(match?.[1]) || 0;
}

function totalRecordUnits(record: Record<string, number> | undefined) {
  return Object.values(record ?? {}).reduce((acc, value) => acc + (Number(value) || 0), 0);
}

function normalizeText(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function saleWithSource(value: any): ClientSale {
  return { ...(value && typeof value === "object" ? value : {}), ...normalizeSale(value) };
}

function salesFromEntry(entry: ActiveRoute | HistoryEntry, client: Client): ClientSale[] {
  const rawSales = (entry as any)?.sales;
  const found: ClientSale[] = [];
  const add = (value: any) => {
    const sale = saleWithSource(value);
    if (saleHasMovement(sale) || sale.completed) found.push(sale);
  };
  const matchesClient = (v: any) => {
    const rawClientId = v?.clientId ?? v?.clienteId ?? v?.customerId;
    const rawClientName = v?.clientName ?? v?.cliente ?? v?.customerName ?? v?.name;
    const rawOrder = Number(v?.visitOrder ?? v?.order ?? v?.orden);
    return (
      rawClientId === client.id ||
      rawClientId === client.name ||
      normalizeText(rawClientId) === normalizeText(client.id) ||
      normalizeText(rawClientId) === normalizeText(client.name) ||
      normalizeText(rawClientName) === normalizeText(client.name) ||
      (Number.isFinite(rawOrder) && rawOrder === client.visitOrder)
    );
  };
  if (Array.isArray(rawSales)) {
    rawSales.filter(matchesClient).forEach(add);
  }
  if (rawSales && typeof rawSales === "object") {
    Object.entries(rawSales)
      .filter(
        ([key, value]) =>
          normalizeText(key) === normalizeText(client.id) ||
          normalizeText(key) === normalizeText(client.name) ||
          key === String(client.visitOrder) ||
          matchesClient(value),
      )
      .forEach(([, value]) => add(value));
  }
  for (const source of [(entry as any)?.visits, (entry as any)?.clientes, (entry as any)?.ventas]) {
    if (Array.isArray(source)) source.filter(matchesClient).forEach(add);
    else if (source && typeof source === "object") {
      Object.entries(source)
        .filter(([key, value]) => normalizeText(key) === normalizeText(client.name) || key === String(client.visitOrder) || matchesClient(value))
        .forEach(([, value]) => add(value));
    }
  }
  return found;
}

function saleHasMovement(sale: ClientSale) {
  return totalRecordUnits(sale.surtido) > 0 || totalRecordUnits(sale.devolucion) > 0;
}

function LastPurchaseCard({
  client,
  products,
  history,
  active,
}: {
  client: Client;
  products: Product[];
  history: HistoryEntry[];
  active: ActiveRoute | null;
}) {
  const last = useMemo(
    () => getLastPurchase(client, history, active, products),
    [client, history, active, products],
  );

  return (
    <Card className="mt-4 p-5">
      <div className="mb-3 flex items-center gap-2">
        <History className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Última compra
        </h2>
      </div>
      {last ? (
        <div>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div className="text-base font-semibold">
              {new Date(last.date).toLocaleDateString("es-MX", {
                weekday: "short",
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </div>
            <div className="text-2xl font-extrabold text-primary tabular-nums">
              {currency(last.total)}
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            {last.units} pzas netas
            {last.paymentType ? ` · ${last.paymentType === "credit" ? "Crédito" : "Contado"}` : ""}
          </div>
          {last.items.length > 0 && (
            <ul className="mt-3 grid gap-1 sm:grid-cols-2">
              {last.items.map((it) => (
                <li
                  key={it.name}
                  className="flex items-center justify-between rounded-lg border border-border/40 bg-card/60 px-2 py-1 text-sm"
                >
                  <span className="truncate">{it.name}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {it.qty} × ${it.price.toFixed(2)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Este cliente aún no tiene compras registradas.
        </p>
      )}
    </Card>
  );
}

function ClienteDetallePage() {
  const { clientId } = useParams({ from: "/clientes/$clientId" });
  const client = useStore((s) => s.clients.find((c) => c.id === clientId));
  const products = useStore((s) => s.products);
  const history = useStore((s) => s.history);
  const active = useStore((s) => s.active);
  const updateClient = actions.updateClient;
  const clearClientVerification = actions.clearClientVerification;
  const askEachTime = useAskEachTime();

  const [editingAddr, setEditingAddr] = useState(false);
  const [addrDraft, setAddrDraft] = useState(client?.address ?? "");
  const [verifyOpen, setVerifyOpen] = useState(false);
  useEffect(() => {
    setAddrDraft(client?.address ?? "");
    setEditingAddr(false);
  }, [client?.id, client?.address]);


  const salesWithDate = useMemo(() => {
    if (!client) return [] as { date: string; sale: ClientSale }[];
    const list: { date: string; sale: ClientSale }[] = [];
    for (const h of history) {
      const d = h.endedAt ?? h.date;
      for (const s of salesFromEntry(h, client)) list.push({ date: d, sale: s });
    }
    if (active) {
      const d = active.date;
      for (const s of salesFromEntry(active, client)) {
        if (s.completed || saleHasMovement(s)) list.push({ date: d, sale: s });
      }
    }
    return list
      .filter(({ sale }) => sale.completed || saleHasMovement(sale))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [client, history, active]);

  const data = useMemo(() => {
    if (!client) return { visits: 0, totalAmount: 0, totalUnits: 0, totalReturns: 0, netUnits: 0, avgPiecePrice: 0, perProduct: [], top: undefined, handledIds: new Set<string>() };
    const sales = salesWithDate.map((x) => x.sale);
    const visits = sales.length;

    const totalReturns = sales.reduce((acc, sale) => acc + totalRecordUnits(sale.devolucion), 0);
    const perProduct = products.map((p) => {
      let units = 0;
      let returned = 0;
      let visitsWithUnits = 0;
      let totalAntes = 0;
      for (const sale of sales) {
        const u = recordUnits(sale.surtido, p);
        const d = recordUnits(sale.devolucion, p);
        if (u > 0) {
          units += u;
          visitsWithUnits += 1;
        }
        returned += d;
        totalAntes += recordUnits(sale.existenciaAnterior, p);
        returned += d;
      }
      const avg = visits > 0 ? units / visits : 0;
      const avgAntes = visits > 0 ? totalAntes / visits : 0;
      return {
        id: p.id,
        name: p.name,
        short: p.name.length > 12 ? p.name.slice(0, 11) + "…" : p.name,
        units,
        returned,
        revenue: units * p.price,
        avg,
        avgAntes,
        visitsWithUnits,
      };
    });
    const handledIds = new Set(perProduct.filter((p) => p.units > 0 || p.returned > 0).map((p) => p.id));
    const totalAntes = perProduct.reduce((a, b) => a + (b.avgAntes || 0), 0);
    const totalUnits = perProduct.reduce((a, b) => a + b.units, 0);
    const netUnits = Math.max(0, totalUnits - totalReturns);
    const grossAmount = perProduct.reduce((acc, p) => acc + p.revenue, 0);
    const avgPiecePrice = totalUnits > 0 ? grossAmount / totalUnits : products[0]?.price ?? 0;
    const totalAmount = netUnits * avgPiecePrice;
    const top = perProduct
      .filter((x) => x.units > 0)
      .sort((a, b) => b.units - a.units)[0];

    return { visits, totalAmount, totalUnits, totalReturns, netUnits, avgPiecePrice, perProduct, top, handledIds, totalAntes };
  }, [salesWithDate, client, products]);

  const handledProducts = useMemo(
    () => data.perProduct.filter((p) => data.handledIds.has(p.id)),
    [data.perProduct, data.handledIds],
  );


  if (!client) {
    return (
      <div className="min-h-screen" style={{ background: "var(--gradient-warm)" }}>
        <AppHeader />
        <main className="mx-auto max-w-3xl px-4 py-10 text-center">
          <h1 className="text-xl font-bold">Cliente no encontrado</h1>
          <Button asChild className="mt-4">
            <Link to="/clientes">Volver a clientes</Link>
          </Button>
        </main>
      </div>
    );
  }

  const hasData = data.visits > 0 && (data.totalUnits > 0 || data.totalReturns > 0);

  return (
    <div className="min-h-screen" style={{ background: "var(--gradient-warm)" }}>
      <AppHeader />
      <main className="mx-auto max-w-3xl px-4 py-5">
        <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
          <Link to="/clientes">
            <ArrowLeft className="mr-1 h-4 w-4" /> Clientes
          </Link>
        </Button>

        <Card className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Cliente
              </div>
              <h1 className="text-2xl font-extrabold break-words">{client.name}</h1>
              {!editingAddr && (
                <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3 text-primary" />{" "}
                  {client.address || <span className="italic">Sin dirección</span>}
                  <button
                    type="button"
                    onClick={() => { setAddrDraft(client.address ?? ""); setEditingAddr(true); }}
                    className="ml-1 inline-flex items-center gap-1 text-primary hover:underline"
                    title="Editar dirección"
                  >
                    <Pencil className="h-3 w-3" /> Editar
                  </button>
                </p>
              )}
              {client.placeId ? (
                <p className="mt-0.5 text-[10px] text-success">✓ Ubicación verificada con Google</p>
              ) : client.address ? (
                <p className="mt-0.5 text-[10px] text-warning">⚠ Sin verificar — pulsa Verificar</p>
              ) : null}
            </div>
            {client.lat != null && client.lng != null && (
              askEachTime ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openMapChooser(client.lat, client.lng, client.address, client.placeId)}
                >
                  <ExternalLink className="mr-1 h-3.5 w-3.5" /> Mapa
                </Button>
              ) : (
                <Button asChild size="sm" variant="outline">
                  <a
                    href={mapsUrl(client.lat, client.lng, client.address, client.placeId)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ExternalLink className="mr-1 h-3.5 w-3.5" /> Maps
                  </a>
                </Button>
              )
            )}
          </div>

          {editingAddr && (
            <div className="mt-3 rounded-lg border border-border/40 bg-background/60 p-3">
              <Label className="text-[10px] uppercase text-muted-foreground">Dirección</Label>
              <div className="mt-1 flex gap-2">
                <Input
                  value={addrDraft}
                  onChange={(e) => setAddrDraft(e.target.value)}
                  placeholder="Calle, número, colonia, ciudad"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setVerifyOpen(true)}
                  title="Verificar dirección con Google Maps"
                >
                  <ShieldCheck className="mr-1 h-4 w-4 text-primary" /> Verificar
                </Button>
              </div>
              <div className="mt-2 flex gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    const newAddr = addrDraft.trim();
                    const addrChanged = newAddr !== (client.address ?? "");
                    const verifiedStillValid =
                      client.verifiedAddress && newAddr === client.verifiedAddress;
                    updateClient(client.id, { address: newAddr });
                    if (addrChanged && !verifiedStillValid && client.placeId) {
                      clearClientVerification(client.id);
                      toast.warning("Dirección cambiada — verifícala de nuevo con Google");
                    } else {
                      toast.success("Dirección guardada");
                    }
                    setEditingAddr(false);
                  }}
                >
                  <Save className="mr-1 h-4 w-4" /> Guardar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => { setAddrDraft(client.address ?? ""); setEditingAddr(false); }}
                >
                  <X className="mr-1 h-4 w-4" /> Cancelar
                </Button>
              </div>
              <p className="mt-2 text-[10px] text-muted-foreground">
                Para mayor exactitud, usa "Verificar" para fijar el lugar exacto en Google Maps.
              </p>
            </div>
          )}

          <VerifyAddressDialog
            open={verifyOpen}
            onClose={() => setVerifyOpen(false)}
            initialAddress={addrDraft || client.address || client.name}
            onConfirm={(v) => {
              setAddrDraft(v.address);
              updateClient(client.id, {
                address: v.address,
                lat: v.lat,
                lng: v.lng,
                placeId: v.placeId,
                verifiedAddress: v.address,
              });
              toast.success("Dirección verificada y guardada");
              setEditingAddr(false);
            }}
          />



          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <KPI label="Visitas" value={String(data.visits)} />
            <KPI label="Surtidas" value={String(data.totalUnits)} />
            <KPI label="Vendidas" value={String(data.netUnits)} />
            <KPI label="Total" value={currency(data.totalAmount)} />
          </div>
        </Card>

        <SalesByDateCard client={client} products={products} salesWithDate={salesWithDate} handledIds={data.handledIds} />

        <LastPurchaseCard client={client} products={products} history={history} active={active} />




        <Card className="mt-4 p-5">
          <div className="mb-4 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Estadísticas de venta — Volumen por producto
            </h2>
          </div>

          {hasData ? (
            <>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={handledProducts.filter((p) => p.units > 0)}
                    margin={{ top: 4, right: 8, bottom: 8, left: 0 }}
                  >
                    <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="short"
                      stroke="var(--color-muted-foreground)"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      interval={0}
                    />
                    <YAxis
                      stroke="var(--color-muted-foreground)"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      width={32}
                    />
                    <Tooltip
                      cursor={{ fill: "var(--color-muted)", opacity: 0.4 }}
                      contentStyle={{
                        background: "var(--color-popover)",
                        border: "1px solid var(--color-border)",
                        borderRadius: 12,
                        color: "var(--color-popover-foreground)",
                        fontSize: 12,
                      }}
                      formatter={(value: number, _name, props) => {
                        const p = props.payload;
                        return [
                          `${value} pzas · ${currency(p.revenue)}`,
                          p.name,
                        ];
                      }}
                      labelFormatter={() => ""}
                    />
                    <Bar dataKey="units" radius={[8, 8, 0, 0]}>
                      {handledProducts
                        .filter((p) => p.units > 0)
                        .map((p) => (
                          <Cell
                            key={p.id}
                            fill={p.id === data.top?.id ? "var(--color-primary)" : "var(--color-accent)"}
                          />
                        ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-4 flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-2 text-xs text-primary">
                <TrendingUp className="h-4 w-4" />
                Producto estrella:{" "}
                <strong className="font-semibold">{data.top?.name}</strong> ({data.top?.units} pzas)
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Aún no hay ventas registradas para este cliente. Las estadísticas aparecerán cuando
              cierres tu primera ruta con una venta a este cliente.
            </p>
          )}
        </Card>

        <Card className="mt-4 p-5">
          <div className="mb-3 flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Promedio por visita
            </h2>
          </div>
          <div className="space-y-1.5">
            {handledProducts.map((p) => {
              const max = Math.max(1, ...handledProducts.map((x) => x.avg));
              const pct = (p.avg / max) * 100;
              return (
                <div
                  key={p.id}
                  className="rounded-xl border border-border/40 bg-card/60 p-3"
                >
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{p.name}</span>
                    <span className="tabular-nums text-muted-foreground">
                      promedio{" "}
                      <strong className="text-foreground">{p.avg.toFixed(1)}</strong> pzas/visita
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${pct}%`,
                        background:
                          p.id === data.top?.id
                            ? "var(--color-primary)"
                            : "var(--color-accent)",
                      }}
                    />
                  </div>
                </div>
              );
            })}
            {data.visits === 0 && (
              <p className="text-sm text-muted-foreground">
                Sin visitas registradas todavía.
              </p>
            )}
          </div>
        </Card>

        <Card className="mt-4 p-5">
          <div className="mb-3 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Cuadro histórico de compras
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="py-2 pr-2">Producto</th>
                  <th className="py-2 px-2 text-right">Surtidas</th>
                  <th className="py-2 px-2 text-right">Dev.</th>
                  <th className="py-2 px-2 text-right">Visitas</th>
                  <th className="py-2 px-2 text-right">Prom/visita</th>
                  <th className="py-2 pl-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {handledProducts.map((p) => (
                  <tr key={p.id} className="border-b border-border/30 last:border-0">
                    <td className="py-2 pr-2 font-medium">{p.name}</td>
                    <td className="py-2 px-2 text-right tabular-nums">{p.units}</td>
                    <td className="py-2 px-2 text-right tabular-nums">{p.returned}</td>
                    <td className="py-2 px-2 text-right tabular-nums">{p.visitsWithUnits}</td>
                    <td className="py-2 px-2 text-right tabular-nums">{p.avg.toFixed(2)}</td>
                    <td className="py-2 pl-2 text-right tabular-nums">{currency(p.revenue)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border/60 font-semibold">
                  <td className="py-2 pr-2">Total</td>
                  <td className="py-2 px-2 text-right tabular-nums">{data.totalUnits}</td>
                  <td className="py-2 px-2 text-right tabular-nums">{data.totalReturns}</td>
                  <td className="py-2 px-2 text-right tabular-nums">{data.visits}</td>
                  <td className="py-2 px-2 text-right tabular-nums">
                    {data.visits > 0 ? (data.netUnits / data.visits).toFixed(2) : "0.00"}
                  </td>
                  <td className="py-2 pl-2 text-right tabular-nums text-primary">
                    {currency(data.totalAmount)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          {data.visits === 0 && (
            <p className="mt-3 text-sm text-muted-foreground">
              Sin compras históricas registradas.
            </p>
          )}
          {data.visits > 0 && (
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
              <KPI label="Devoluciones" value={String(data.totalReturns)} />
              <KPI label="Pzas netas" value={String(data.netUnits)} />
              <KPI label="Prom/pieza" value={currency(data.avgPiecePrice)} />
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}

function KPI({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/40 bg-card/60 p-3 text-center">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-lg font-extrabold tabular-nums">{value}</div>
    </div>
  );
}

function SalesByDateCard({
  client,
  products,
  salesWithDate,
  handledIds,
}: {
  client: Client;
  products: Product[];
  salesWithDate: { date: string; sale: ClientSale }[];
  handledIds: Set<string>;
}) {
  const options = useMemo(
    () =>
      salesWithDate.map(({ date, sale }, idx) => ({
        key: `${date}-${idx}`,
        date,
        sale,
        label: new Date(date).toLocaleDateString("es-MX", {
          weekday: "short",
          day: "2-digit",
          month: "short",
          year: "numeric",
        }),
      })),
    [salesWithDate],
  );
  const [selected, setSelected] = useState<string | undefined>(options[0]?.key);
  useEffect(() => {
    setSelected(options[0]?.key);
  }, [client.id, options.length]);

  const chosen = options.find((o) => o.key === selected) ?? options[0];

  const items = useMemo(() => {
    if (!chosen) return [];
    const base = handledIds.size > 0 ? products.filter((p) => handledIds.has(p.id)) : products;
    return base
      .map((p) => {
        const surtido = recordUnits(chosen.sale.surtido, p);
        const devolucion = recordUnits(chosen.sale.devolucion, p);
        const existenciaAnterior = recordUnits(chosen.sale.existenciaAnterior, p);
        const existenciaActual = recordUnits(chosen.sale.existenciaActual, p);
        const qty = surtido - devolucion;
        const price = priceFor(chosen.sale, p);
        return { id: p.id, name: p.name, qty, price, surtido, devolucion, existenciaAnterior, existenciaActual };
      })
      .filter((x) => x.surtido !== 0 || x.devolucion !== 0 || x.existenciaAnterior !== 0 || x.existenciaActual !== 0);
  }, [chosen, products, handledIds]);

  const total = items.reduce((acc, it) => acc + it.qty * it.price, 0);
  const netUnits = items.reduce((acc, it) => acc + it.qty, 0);

  return (
    <Card className="mt-4 p-5">
      <div className="mb-3 flex items-center gap-2">
        <CalendarSearch className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Compra por fecha
        </h2>
      </div>
      {options.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Aún no hay visitas registradas para este cliente.
        </p>
      ) : (
        <>
          <div className="mb-3">
            <Label className="text-[10px] uppercase text-muted-foreground">Selecciona una fecha</Label>
            <Select value={selected} onValueChange={setSelected}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Elegir fecha" />
              </SelectTrigger>
              <SelectContent>
                {options.map((o) => (
                  <SelectItem key={o.key} value={o.key}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {chosen && (
            <>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="text-sm text-muted-foreground">
                  {netUnits} pzas netas
                  {chosen.sale.paymentType
                    ? ` · ${chosen.sale.paymentType === "credit" ? "Crédito" : "Contado"}`
                    : ""}
                </div>
                <div className="text-xl font-extrabold text-primary tabular-nums">
                  {currency(total)}
                </div>
              </div>

              {items.length > 0 ? (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/60 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                        <th className="py-2 pr-2">Producto</th>
                        <th className="py-2 px-2 text-right">Antes</th>
                        <th className="py-2 px-2 text-right">Surt.</th>
                        <th className="py-2 px-2 text-right">Dev.</th>
                        <th className="py-2 px-2 text-right">Precio</th>
                        <th className="py-2 pl-2 text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((it) => (
                        <tr key={it.id} className="border-b border-border/30 last:border-0">
                          <td className="py-2 pr-2 font-medium">{it.name}</td>
                          <td className="py-2 px-2 text-right tabular-nums">{it.existenciaAnterior}</td>
                          <td className="py-2 px-2 text-right tabular-nums">{it.surtido}</td>
                          <td className="py-2 px-2 text-right tabular-nums">{it.devolucion}</td>
                          <td className="py-2 px-2 text-right tabular-nums">${it.price.toFixed(2)}</td>
                          <td className="py-2 pl-2 text-right tabular-nums">
                            {currency(it.qty * it.price)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">
                  Esta visita no registró movimiento de productos.
                </p>
              )}

              {chosen.sale.notes && (
                <p className="mt-3 rounded-lg border border-border/40 bg-background/60 p-2 text-xs text-muted-foreground">
                  <strong className="text-foreground">Notas:</strong> {chosen.sale.notes}
                </p>
              )}
            </>
          )}
        </>
      )}
    </Card>
  );
}





