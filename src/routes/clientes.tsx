import { createFileRoute, Outlet, useLocation } from "@tanstack/react-router";
import { AppHeader } from "@/components/AppHeader";
import { ClientsTab } from "@/routes/configuracion";

export const Route = createFileRoute("/clientes")({
  head: () => ({
    meta: [
      { title: "Clientes — SalsaRuta" },
      { name: "description", content: "Da de alta, edita y ordena tus clientes por ruta." },
    ],
  }),
  component: ClientesPage,
});

function ClientesPage() {
  const location = useLocation();

  if (location.pathname !== "/clientes") {
    return <Outlet />;
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--gradient-warm)" }}>
      <AppHeader />
      <main className="mx-auto max-w-3xl px-4 py-5">
        <h1 className="mb-1 text-3xl font-extrabold">Clientes</h1>
        <p className="mb-4 text-sm text-muted-foreground">
          Ordena la secuencia de visita y da de alta/baja clientes.
        </p>
        <ClientsTab />
      </main>
    </div>
  );
}
