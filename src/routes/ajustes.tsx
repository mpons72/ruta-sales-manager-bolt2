import { createFileRoute } from "@tanstack/react-router";
import { AppHeader } from "@/components/AppHeader";
import { BackupTab } from "@/routes/configuracion";
import { ScheduledBackupCard } from "@/components/ScheduledBackupCard";
import { AdminPasswordCard } from "@/components/AdminPasswordCard";
import { BusinessInfoCard } from "@/components/BusinessInfoCard";
import { NavProviderCard } from "@/components/NavProviderCard";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { actions, useStore } from "@/lib/store";
import { Moon, Sun } from "lucide-react";

export const Route = createFileRoute("/ajustes")({
  head: () => ({
    meta: [
      { title: "Ajustes — SalsaRuta" },
      { name: "description", content: "Tema, respaldo, importación y configuración general." },
    ],
  }),
  component: AjustesPage,
});

function AjustesPage() {
  const theme = useStore((s) => s.theme);
  const isDark = theme === "dark";

  return (
    <div className="min-h-screen" style={{ background: "var(--gradient-warm)" }}>
      <AppHeader />
      <main className="mx-auto max-w-3xl px-4 py-5 space-y-4">
        <div>
          <h1 className="mb-1 text-3xl font-extrabold">Ajustes</h1>
          <p className="text-sm text-muted-foreground">
            Tema, copia de seguridad, importación de datos y administración.
          </p>
        </div>

        <Card className="p-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
                {isDark ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
              </div>
              <div>
                <div className="font-semibold">Tema de la aplicación</div>
                <div className="text-xs text-muted-foreground">
                  {isDark ? "Modo oscuro activado" : "Modo claro activado"} · se guarda en este dispositivo
                </div>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={isDark}
              onClick={() => actions.toggleTheme()}
              className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${
                isDark ? "bg-primary" : "bg-muted"
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                  isDark ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button
              variant={isDark ? "outline" : "default"}
              onClick={() => actions.setTheme("light")}
            >
              <Sun className="mr-2 h-4 w-4" /> Claro
            </Button>
            <Button
              variant={isDark ? "default" : "outline"}
              onClick={() => actions.setTheme("dark")}
            >
              <Moon className="mr-2 h-4 w-4" /> Oscuro
            </Button>
          </div>
        </Card>

        <AdminPasswordCard />

        <NavProviderCard />

        <BusinessInfoCard />

        <BackupTab />

        <ScheduledBackupCard />
      </main>
    </div>
  );
}
