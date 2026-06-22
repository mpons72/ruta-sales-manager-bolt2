import { createFileRoute } from "@tanstack/react-router";
import { AppHeader } from "@/components/AppHeader";
import { RoutesTab } from "@/routes/configuracion";

export const Route = createFileRoute("/rutas")({
  head: () => ({
    meta: [
      { title: "Rutas — SalsaRuta" },
      { name: "description", content: "Define las rutas que cubre el vendedor." },
    ],
  }),
  component: RutasPage,
});

function RutasPage() {
  return (
    <div className="min-h-screen" style={{ background: "var(--gradient-warm)" }}>
      <AppHeader />
      <main className="mx-auto max-w-3xl px-4 py-5">
        <h1 className="mb-1 text-3xl font-extrabold">Rutas</h1>
        <p className="mb-4 text-sm text-muted-foreground">
          Define las rutas que cubre el vendedor.
        </p>
        <RoutesTab />
      </main>
    </div>
  );
}
