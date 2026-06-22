import { Link, useLocation } from "@tanstack/react-router";
import { Flame, Home, Truck, Users, MapPin, BarChart3, Tag, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { to: "/", label: "Inicio", icon: Home },
  { to: "/ruta", label: "Ruta del día", icon: Truck },
  { to: "/clientes", label: "Clientes", icon: Users },
  { to: "/rutas", label: "Rutas", icon: MapPin },
  { to: "/historial", label: "Historial", icon: BarChart3 },
  { to: "/productos", label: "Productos", icon: Tag },
  { to: "/ajustes", label: "Ajustes", icon: Settings },
] as const;

export function AppHeader() {
  const location = useLocation();
  return (
    <header className="sticky top-0 z-40 border-b border-border/40 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
        <Link to="/" className="flex items-center gap-2.5">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl text-primary-foreground shadow-glow"
            style={{ background: "var(--gradient-primary)" }}
            aria-hidden
          >
            <Flame className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <div className="text-base font-bold">SalsaRuta</div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Control de venta
            </div>
          </div>
        </Link>
      </div>
      <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {links.map((l) => {
          const Icon = l.icon;
          const active =
            l.to === "/" ? location.pathname === "/" : location.pathname.startsWith(l.to);
          return (
            <Link
              key={l.to}
              to={l.to}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-all",
                active
                  ? "bg-primary text-primary-foreground shadow-elevated"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{l.label}</span>
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
