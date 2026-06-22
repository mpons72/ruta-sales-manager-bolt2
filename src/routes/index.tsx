import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { actions, useStore, clientSaleAmount } from "@/lib/store";
import { StartRouteDialog } from "@/components/StartRouteDialog";
import { StartTemporaryRouteDialog } from "@/components/StartTemporaryRouteDialog";
import {
  Flame,
  ListChecks,
  Sparkles,
  History as HistoryIcon,
  MapPin,
  Users,
  Tag,
  Settings,
  ArrowRight,
} from "lucide-react";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SalsaRuta — Control de venta en ruta" },
      {
        name: "description",
        content:
          "Lleva tu venta, surtido y devoluciones bajo control en cada parada de la ruta.",
      },
    ],
  }),
  component: Home,
});

function currency(n: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(n);
}

function Home() {
  const products = useStore((s) => s.products);
  const routes = useStore((s) => s.routes);
  const clients = useStore((s) => s.clients);
  const active = useStore((s) => s.active);
  const navigate = useNavigate();
  const [openStart, setOpenStart] = useState(false);
  const [openTemp, setOpenTemp] = useState(false);

  const stats = useMemo(() => {
    if (!active) {
      const totalClients = clients.filter((c) => c.active !== false).length;
      return { cash: 0, credit: 0, visited: 0, total: totalClients };
    }
    const routeClients = clients.filter(
      (c) => c.routeId === active.routeId && c.active !== false,
    );
    let cash = 0;
    let credit = 0;
    let visited = 0;
    for (const c of routeClients) {
      const sale = active.sales[c.id];
      if (!sale || !sale.completed) continue;
      visited += 1;
      const amount = clientSaleAmount(sale, products);
      if (sale.paymentType === "credit" || c.credit) credit += amount;
      else cash += amount;
    }
    return { cash, credit, visited, total: routeClients.length };
  }, [active, clients, products]);

  const startNew = () => setOpenStart(true);

  return (
    <div className="min-h-screen" style={{ background: "var(--gradient-warm)" }}>
      <AppHeader />
      <main className="mx-auto max-w-3xl px-4 py-5">
        {/* Hero */}
        <Card
          className="relative overflow-hidden border-0 p-6 text-primary-foreground shadow-elevated"
          style={{ background: "var(--gradient-hero)" }}
        >
          <div
            className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full opacity-30 blur-3xl"
            style={{ background: "white" }}
            aria-hidden
          />
          <div className="relative flex items-start gap-3">
            <Flame className="h-9 w-9 shrink-0 text-white drop-shadow" />
            <div>
              <h1 className="text-2xl font-extrabold leading-tight">
                Hoy es día de ruta <span aria-hidden>🔥</span>
              </h1>
              <p className="mt-1 text-sm text-white/85">
                Lleva tu venta, surtido y devoluciones bajo control en cada parada.
              </p>
            </div>
          </div>

          <div className="relative mt-5 grid grid-cols-3 gap-3 rounded-2xl bg-black/20 p-3">
            <Stat label="Efectivo" value={currency(stats.cash)} />
            <Stat label="Crédito" value={currency(stats.credit)} />
            <Stat label="Visitas" value={`${stats.visited}/${stats.total}`} />
          </div>

          <div className="relative mt-5 flex flex-wrap gap-2">
            {active ? (
              <Button asChild size="lg" className="bg-black/40 text-white hover:bg-black/55">
                <Link to="/ruta">
                  <ListChecks className="mr-2 h-4 w-4" /> Continuar ruta
                </Link>
              </Button>
            ) : (
              <Button
                size="lg"
                onClick={startNew}
                className="bg-black/40 text-white hover:bg-black/55"
              >
                <ListChecks className="mr-2 h-4 w-4" /> Iniciar ruta
              </Button>
            )}
            <Button
              variant="outline"
              size="lg"
              className="border-white/30 bg-black/30 text-white hover:bg-black/45"
              onClick={() => setOpenTemp(true)}
            >
              <Sparkles className="mr-2 h-4 w-4" /> Venta fuera de ruta
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="border-white/40 bg-transparent text-white hover:bg-white/10"
              asChild
            >
              <Link to="/historial">Ver historial</Link>
            </Button>
          </div>
        </Card>

        {/* Quick links */}
        <div className="mt-5 space-y-3">
          <QuickLink
            to="/rutas"
            icon={MapPin}
            title="Rutas"
            subtitle={`${routes.length} configuradas`}
          />
          <QuickLink
            to="/clientes"
            icon={Users}
            title="Clientes"
            subtitle={`${clients.filter((c) => c.active !== false).length} activos`}
          />
          <QuickLink
            to="/productos"
            icon={Tag}
            title="Productos"
            subtitle={`${products.length} en catálogo`}
          />
          <QuickLink
            to="/historial"
            icon={HistoryIcon}
            title="Historial"
            subtitle="Reportes y respaldos"
          />
          <QuickLink to="/ajustes" icon={Settings} title="Ajustes" subtitle="Datos y seguridad" />
        </div>
      </main>

      <StartRouteDialog
        open={openStart}
        onClose={() => setOpenStart(false)}
        onStarted={() => navigate({ to: "/ruta" })}
      />
      <StartTemporaryRouteDialog
        open={openTemp}
        onClose={() => setOpenTemp(false)}
        onStarted={() => navigate({ to: "/ruta" })}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-white/70">
        {label}
      </div>
      <div className="mt-1 text-xl font-extrabold tabular-nums">{value}</div>
    </div>
  );
}

function QuickLink({
  to,
  icon: Icon,
  title,
  subtitle,
}: {
  to: "/rutas" | "/clientes" | "/productos" | "/historial" | "/ajustes";
  icon: typeof MapPin;
  title: string;
  subtitle: string;
}) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-3 rounded-2xl border border-border/40 bg-card/60 p-3.5 transition-all hover:border-primary/40 hover:bg-card"
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1">
        <div className="font-semibold">{title}</div>
        <div className="text-xs text-muted-foreground">{subtitle}</div>
      </div>
      <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

// suppress unused warning
void actions;
