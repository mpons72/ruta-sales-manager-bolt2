import { createFileRoute, Link } from "@tanstack/react-router";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  clientSaleAmount,
  computeRemaining,
  priceFor,
  productsForClients,
  useStore,
  type ActiveRoute,
  type Client,
  type Product,
} from "@/lib/store";
import { getLastPurchase } from "@/lib/client-stats";
import { exportReportCSV, exportReportJSON, exportReportPDF } from "@/lib/export";
import { DollarSign, Users, TrendingUp, FileDown, FileText, Share2 } from "lucide-react";
import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/reporte")({
  head: () => ({
    meta: [
      { title: "Reporte de ruta — RutaVenta" },
      { name: "description", content: "Resumen de ventas, devoluciones e inventario al cierre de la ruta." },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => ({ h: typeof s.h === "string" ? s.h : undefined }),
  component: ReportePage,
});

function ReportePage() {
  const active = useStore((s) => s.active);
  const history = useStore((s) => s.history);
  const allProducts = useStore((s) => s.products);
  const groups = useStore((s) => s.groups);
  const clients = useStore((s) => s.clients);
  const routes = useStore((s) => s.routes);
  const search = Route.useSearch();

  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(search.h ?? null);

  const target: (ActiveRoute & { endedAt?: string }) | null = (() => {
    const wantedId = selectedHistoryId ?? search.h;
    if (wantedId) {
      const found = history.find((h) => h.endedAt === wantedId);
      if (found) return found;
    }
    if (active) return active;
    return history[0] ?? null;
  })();

  if (!target) {
    return (
      <div className="min-h-screen" style={{ background: "var(--gradient-warm)" }}>
        <AppHeader />
        <main className="mx-auto max-w-2xl px-4 py-12 text-center">
          <h1 className="text-2xl font-bold">Sin reportes aún</h1>
          <p className="mt-2 text-muted-foreground">Inicia y cierra una ruta para ver tu reporte.</p>
          <Button asChild className="mt-4">
            <Link to="/">Iniciar ruta</Link>
          </Button>
        </main>
      </div>
    );
  }
  // Determinar los clientes que pertenecen a esta ruta para filtrar productos
  // a sólo los grupos que realmente manejan los clientes.
  const routeClientsForFilter: Client[] = (() => {
    const tempIds = (target as ActiveRoute).clientIds;
    if (tempIds && tempIds.length > 0) {
      const set = new Set(tempIds);
      return (clients as Client[]).filter((c) => set.has(c.id));
    }
    return (clients as Client[]).filter((c) => c.routeId === target.routeId);
  })();
  const products = useMemo(
    () => productsForClients(allProducts, groups, routeClientsForFilter),
    [allProducts, groups, routeClientsForFilter],
  );

  return (
    <div className="min-h-screen" style={{ background: "var(--gradient-warm)" }}>
      <AppHeader />
      <main className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              {active ? "Reporte en vivo" : "Reporte histórico"}
            </div>
            <h1 className="text-3xl font-bold">
              {(target as ActiveRoute).label ?? routes.find((r) => r.id === target.routeId)?.name ?? "Ruta"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {new Date(target.date).toLocaleDateString()}{" "}
              {target.endedAt && `· cerrada ${new Date(target.endedAt).toLocaleTimeString()}`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {history.length > 0 && !active && (
              <select
                value={selectedHistoryId ?? history[0].endedAt}
                onChange={(e) => setSelectedHistoryId(e.target.value)}
                className="rounded-md border bg-background px-3 py-2 text-sm"
              >
                {history.map((h) => (
                  <option key={h.endedAt} value={h.endedAt}>
                    {h.label ?? routes.find((r) => r.id === h.routeId)?.name ?? "Ruta"} —{" "}
                    {new Date(h.endedAt).toLocaleString()}
                  </option>
                ))}
              </select>
            )}
            <Button variant="outline" size="sm" onClick={() => exportReportCSV(target, products, clients, routes)}>
              <FileDown className="mr-1.5 h-4 w-4" /> CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportReportPDF(target, products, clients, routes)}>
              <FileText className="mr-1.5 h-4 w-4" /> PDF
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportReportJSON(target, products, clients, routes)}>
              <Share2 className="mr-1.5 h-4 w-4" /> JSON
            </Button>
          </div>
        </div>


        <ReportBody target={target} products={products} clients={clients} history={history} />
      </main>
    </div>
  );
}

function ReportBody({
  target,
  products,
  clients,
  history,
}: {
  target: ActiveRoute & { endedAt?: string };
  products: Product[];
  clients: any;
  history: (ActiveRoute & { endedAt: string })[];
}) {
  const remaining = useMemo(() => computeRemaining(target, products), [target, products]);

  const summary = useMemo(() => {
    let totalDinero = 0;
    let totalEfectivo = 0;
    let totalCredito = 0;
    let totalUnidades = 0;
    let clientesAtendidos = 0;
    const porProducto: Record<string, { surtido: number; devolucion: number; venta: number; dinero: number }> = {};
    for (const p of products) porProducto[p.id] = { surtido: 0, devolucion: 0, venta: 0, dinero: 0 };

    const clientById = new Map(
      (clients as { id: string; credit?: boolean }[]).map((c) => [c.id, c]),
    );

    for (const [cid, sale] of Object.entries(target.sales ?? {})) {
      if (sale?.completed) clientesAtendidos++;
      const surtido = sale?.surtido ?? {};
      const devolucion = sale?.devolucion ?? {};
      for (const p of products) {
        const s = surtido[p.id] ?? 0;
        const d = devolucion[p.id] ?? 0;
        porProducto[p.id].surtido += s;
        porProducto[p.id].devolucion += d;
        porProducto[p.id].venta += s - d;
        porProducto[p.id].dinero += (s - d) * priceFor(sale, p);
      }
      const amt = clientSaleAmount(sale, products);
      totalDinero += amt;
      const isCredit = sale?.paymentType === "credit" || clientById.get(cid)?.credit;
      if (isCredit) totalCredito += amt;
      else totalEfectivo += amt;
    }
    for (const v of Object.values(porProducto)) totalUnidades += v.venta;
    return { totalDinero, totalEfectivo, totalCredito, totalUnidades, clientesAtendidos, porProducto };
  }, [target, products, clients]);

  const allClientsTyped = clients as { id: string; name: string; visitOrder: number; routeId: string }[];
  const tempIds = (target as ActiveRoute).clientIds;
  const clientList = tempIds && tempIds.length > 0
    ? tempIds
        .map((id, i) => {
          const c = allClientsTyped.find((x) => x.id === id);
          return c ? { ...c, visitOrder: i + 1 } : null;
        })
        .filter((c): c is { id: string; name: string; visitOrder: number; routeId: string } => !!c)
    : allClientsTyped
        .filter((c) => c.routeId === target.routeId)
        .sort((a, b) => a.visitOrder - b.visitOrder);

  return (
    <>
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={DollarSign} label="Total efectivo" value={`$${summary.totalEfectivo.toFixed(2)}`} highlight />
        <Stat icon={DollarSign} label="Total crédito" value={`$${summary.totalCredito.toFixed(2)}`} />
        <Stat icon={TrendingUp} label="Total general" value={`$${summary.totalDinero.toFixed(2)}`} />
        <Stat icon={Users} label="Clientes atendidos" value={`${summary.clientesAtendidos} / ${clientList.length}`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-4 text-lg font-semibold">Resumen por producto</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-base">
              <thead>
                <tr className="border-b text-left text-sm uppercase text-muted-foreground">
                  <th className="py-2">Producto</th>
                  <th className="py-2 text-right">Inicial</th>
                  <th className="py-2 text-right">Vendido</th>
                  <th className="py-2 text-right">Restante</th>
                  <th className="py-2 text-right">$</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => {
                  const v = summary.porProducto[p.id];
                  return (
                    <tr key={p.id} className="border-b last:border-0">
                      <td className="py-2.5 font-semibold">{p.name}</td>
                      <td className="py-2.5 text-right text-lg tabular-nums">{target.initialInventory?.[p.id] ?? 0}</td>
                      <td className="py-2.5 text-right text-lg font-semibold tabular-nums">{v.venta}</td>
                      <td className={`py-2.5 text-right text-lg font-bold tabular-nums ${remaining[p.id] < 0 ? "text-destructive" : ""}`}>
                        {remaining[p.id]}
                      </td>
                      <td className="py-2.5 text-right text-lg font-extrabold tabular-nums text-primary">${v.dinero.toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 text-lg font-semibold">Ventas por cliente</h2>
          <p className="mb-2 text-xs text-muted-foreground">
            Toca un cliente para ver el detalle por sabor de ese día.
          </p>
          <ClientSalesList
            clientList={clientList}
            target={target}
            products={products}
            history={history.filter((h) => h.endedAt !== (target as any).endedAt)}
            allClients={clients as Client[]}
          />
        </Card>
      </div>
    </>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  highlight,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <Card
      className={`p-4 ${highlight ? "border-primary/30 shadow-elevated" : ""}`}
      style={highlight ? { background: "var(--gradient-primary)" } : undefined}
    >
      <div className={`flex items-center gap-2 text-xs font-medium uppercase tracking-wider ${highlight ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <div className={`mt-2 text-2xl font-bold ${highlight ? "text-primary-foreground" : ""}`}>
        {value}
      </div>
    </Card>
  );
}

function ClientSalesList({
  clientList,
  target,
  products,
  history,
  allClients,
}: {
  clientList: { id: string; name: string; visitOrder: number; routeId: string }[];
  target: ActiveRoute;
  products: Product[];
  history: (ActiveRoute & { endedAt: string })[];
  allClients: Client[];
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      {clientList.map((c) => {
        const sale = target.sales?.[c.id];
        const amount = sale ? clientSaleAmount(sale, products) : 0;
        const units = sale
          ? products.reduce(
              (acc, p) =>
                acc + ((sale.surtido?.[p.id] ?? 0) - (sale.devolucion?.[p.id] ?? 0)),
              0,
            )
          : 0;
        const hasAntes = !!sale && products.some((p) => (sale.existenciaAnterior?.[p.id] ?? 0) > 0);
        const isOpen = openId === c.id;
        const hasSale = !!sale && (sale.completed || units !== 0 || hasAntes);
        const fullClient = allClients.find((x) => x.id === c.id) ?? (c as unknown as Client);
        const last = getLastPurchase(fullClient, history as any, null, products);
        return (
          <div key={c.id} className="rounded-md border bg-card">
            <button
              type="button"
              onClick={() => setOpenId(isOpen ? null : c.id)}
              className="flex w-full items-center justify-between px-3 py-3 text-left"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-base font-bold">
                  {c.visitOrder}
                </div>
                <div>
                  <div className="flex items-center gap-1.5 text-base font-semibold">
                    {hasSale ? (
                      isOpen ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )
                    ) : null}
                    {c.name}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {sale?.completed
                      ? `${units} unidades`
                      : hasAntes
                        ? "Pendiente (existencia registrada)"
                        : "Sin atender"}
                  </div>
                  {last && (
                    <div className="mt-0.5 text-[11px] text-muted-foreground">
                      Última visita:{" "}
                      {new Date(last.date).toLocaleDateString("es-MX", {
                        day: "2-digit",
                        month: "short",
                      })}{" "}
                      · {last.units} u · ${last.total.toFixed(2)}
                    </div>
                  )}
                </div>
              </div>
              <div className={`text-xl font-extrabold tabular-nums ${sale?.completed ? "text-primary" : "text-muted-foreground"}`}>
                ${amount.toFixed(2)}
              </div>
            </button>
            {isOpen && hasSale && (
              <div className="border-t bg-muted/30 px-3 py-3">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Detalle por sabor
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase text-muted-foreground">
                      <th className="py-1 pr-2">Sabor</th>
                      <th className="py-1 px-2 text-right">Antes</th>
                      <th className="py-1 px-2 text-right">Surtido</th>
                      <th className="py-1 px-2 text-right">Dev.</th>
                      <th className="py-1 px-2 text-right">Vendido</th>
                      <th className="py-1 pl-2 text-right">$</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((p) => {
                      const ant = sale?.existenciaAnterior?.[p.id] ?? 0;
                      const s = sale?.surtido?.[p.id] ?? 0;
                      const d = sale?.devolucion?.[p.id] ?? 0;
                      const v = s - d;
                      if (s === 0 && d === 0 && ant === 0) return null;
                      return (
                        <tr key={p.id} className="border-t border-border/40">
                          <td className="py-1.5 pr-2 font-medium">{p.name}</td>
                          <td className="py-1.5 px-2 text-right tabular-nums text-muted-foreground">{ant}</td>
                          <td className="py-1.5 px-2 text-right tabular-nums">{s}</td>
                          <td className="py-1.5 px-2 text-right tabular-nums">{d}</td>
                          <td className="py-1.5 px-2 text-right font-semibold tabular-nums">{v}</td>
                          <td className="py-1.5 pl-2 text-right tabular-nums text-primary">
                            ${(v * priceFor(sale, p)).toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                    {products.every((p) => !(sale?.surtido?.[p.id] || sale?.devolucion?.[p.id] || sale?.existenciaAnterior?.[p.id])) && (
                      <tr>
                        <td colSpan={6} className="py-2 text-center text-xs text-muted-foreground">
                          Sin movimientos por sabor.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
