import { createFileRoute } from "@tanstack/react-router";
import { AppHeader } from "@/components/AppHeader";
import { ProductsTab } from "@/routes/configuracion";

export const Route = createFileRoute("/productos")({
  head: () => ({
    meta: [
      { title: "Productos — SalsaRuta" },
      { name: "description", content: "Catálogo de productos y precios." },
    ],
  }),
  component: ProductosPage,
});

function ProductosPage() {
  return (
    <div className="min-h-screen" style={{ background: "var(--gradient-warm)" }}>
      <AppHeader />
      <main className="mx-auto max-w-3xl px-4 py-5">
        <h1 className="mb-1 text-3xl font-extrabold">Catálogo de productos</h1>
        <p className="mb-4 text-sm text-muted-foreground">
          Los precios actualizados se reflejan en ventas y reportes nuevos.
        </p>
        <ProductsTab />
      </main>
    </div>
  );
}
