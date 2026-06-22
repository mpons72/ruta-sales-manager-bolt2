import {
  clientSaleAmount,
  computeRemaining,
  priceFor,
  type ActiveRoute,
  type Client,
  type Product,
  type Route as RouteT,
} from "./store";

export function buildReportData(
  target: ActiveRoute,
  products: Product[],
  clients: Client[],
  routes: RouteT[],
) {
  const route = routes.find((r) => r.id === target.routeId);
  const remaining = computeRemaining(target, products);
  const clientList = clients
    .filter((c) => c.routeId === target.routeId)
    .sort((a, b) => a.visitOrder - b.visitOrder);

  let totalDinero = 0;
  let totalUnidades = 0;
  let clientesAtendidos = 0;
  const porProducto: Record<
    string,
    { surtido: number; devolucion: number; venta: number; dinero: number }
  > = {};
  for (const p of products) porProducto[p.id] = { surtido: 0, devolucion: 0, venta: 0, dinero: 0 };

  for (const sale of Object.values(target.sales)) {
    if (sale.completed) clientesAtendidos++;
    for (const p of products) {
      const s = sale.surtido[p.id] ?? 0;
      const d = sale.devolucion[p.id] ?? 0;
      porProducto[p.id].surtido += s;
      porProducto[p.id].devolucion += d;
      porProducto[p.id].venta += s - d;
      porProducto[p.id].dinero += (s - d) * priceFor(sale, p);
    }
    totalDinero += clientSaleAmount(sale, products);
  }
  for (const v of Object.values(porProducto)) totalUnidades += v.venta;

  return {
    route,
    remaining,
    clientList,
    totalDinero,
    totalUnidades,
    clientesAtendidos,
    porProducto,
  };
}

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const csvEscape = (v: string | number) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function exportReportCSV(
  target: ActiveRoute,
  products: Product[],
  clients: Client[],
  routes: RouteT[],
) {
  const data = buildReportData(target, products, clients, routes);
  const lines: string[] = [];
  lines.push(`Reporte de Ruta,${csvEscape(data.route?.name ?? "")}`);
  lines.push(`Fecha,${new Date(target.date).toLocaleString()}`);
  lines.push(`Total vendido,${data.totalDinero.toFixed(2)}`);
  lines.push(`Unidades vendidas,${data.totalUnidades}`);
  lines.push(`Clientes atendidos,${data.clientesAtendidos}/${data.clientList.length}`);
  lines.push("");
  lines.push("RESUMEN POR PRODUCTO");
  lines.push(["Producto", "Precio", "Inicial", "Surtido", "Devolución", "Vendido", "Restante", "Total $"].map(csvEscape).join(","));
  for (const p of products) {
    const v = data.porProducto[p.id];
    lines.push(
      [
        p.name,
        p.price.toFixed(2),
        target.initialInventory[p.id] ?? 0,
        v.surtido,
        v.devolucion,
        v.venta,
        data.remaining[p.id],
        v.dinero.toFixed(2),
      ].map(csvEscape).join(","),
    );
  }
  lines.push("");
  lines.push("VENTAS POR CLIENTE");
  const header = ["#", "Cliente", "Estado", ...products.flatMap((p) => [`${p.name} surt`, `${p.name} dev`]), "Total $"];
  lines.push(header.map(csvEscape).join(","));
  for (const c of data.clientList) {
    const sale = target.sales[c.id];
    const row: (string | number)[] = [
      c.visitOrder,
      c.name,
      sale?.completed ? "Atendido" : "Pendiente",
    ];
    for (const p of products) {
      row.push(sale?.surtido[p.id] ?? 0);
      row.push(sale?.devolucion[p.id] ?? 0);
    }
    row.push(sale ? clientSaleAmount(sale, products).toFixed(2) : "0.00");
    lines.push(row.map(csvEscape).join(","));
  }
  const filename = `reporte-${data.route?.name ?? "ruta"}-${new Date(target.date).toISOString().slice(0, 10)}.csv`;
  downloadBlob("\uFEFF" + lines.join("\n"), filename, "text/csv;charset=utf-8");
}

export function exportReportPDF(
  target: ActiveRoute,
  products: Product[],
  clients: Client[],
  routes: RouteT[],
) {
  const data = buildReportData(target, products, clients, routes);
  const fmt = (n: number) => `$${n.toFixed(2)}`;

  const productRows = products
    .map((p) => {
      const v = data.porProducto[p.id];
      return `<tr><td>${p.name}</td><td>${fmt(p.price)}</td><td>${target.initialInventory[p.id] ?? 0}</td><td>${v.venta}</td><td>${data.remaining[p.id]}</td><td>${fmt(v.dinero)}</td></tr>`;
    })
    .join("");

  const clientRows = data.clientList
    .map((c) => {
      const sale = target.sales[c.id];
      const amount = sale ? clientSaleAmount(sale, products) : 0;
      const units = sale
        ? products.reduce((acc, p) => acc + ((sale.surtido[p.id] ?? 0) - (sale.devolucion[p.id] ?? 0)), 0)
        : 0;
      return `<tr><td>${c.visitOrder}</td><td>${c.name}</td><td>${sale?.completed ? "Atendido" : "Pendiente"}</td><td>${units}</td><td>${fmt(amount)}</td></tr>`;
    })
    .join("");

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Reporte ${data.route?.name ?? ""}</title>
<style>
* { box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #1a1a1a; padding: 24px; }
h1 { margin: 0 0 4px; font-size: 24px; }
.muted { color: #666; font-size: 12px; }
.kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 20px 0; }
.kpi { border: 1px solid #eee; border-radius: 8px; padding: 12px; }
.kpi .label { font-size: 10px; text-transform: uppercase; color: #888; letter-spacing: .5px; }
.kpi .value { font-size: 20px; font-weight: 700; margin-top: 4px; }
.kpi.primary { background: #ff6b35; color: white; border-color: #ff6b35; }
.kpi.primary .label { color: rgba(255,255,255,.85); }
h2 { font-size: 14px; text-transform: uppercase; letter-spacing: .5px; margin: 24px 0 8px; color: #444; }
table { width: 100%; border-collapse: collapse; font-size: 12px; }
th, td { border-bottom: 1px solid #eee; padding: 8px; text-align: left; }
th { background: #fafafa; font-size: 10px; text-transform: uppercase; color: #666; }
td:not(:nth-child(2)), th:not(:nth-child(2)) { text-align: right; }
@media print { body { padding: 0; } }
</style></head><body>
<h1>${data.route?.name ?? "Ruta"}</h1>
<div class="muted">Reporte generado el ${new Date().toLocaleString()} · Ruta del ${new Date(target.date).toLocaleString()}</div>
<div class="kpis">
  <div class="kpi primary"><div class="label">Total vendido</div><div class="value">${fmt(data.totalDinero)}</div></div>
  <div class="kpi"><div class="label">Unidades</div><div class="value">${data.totalUnidades}</div></div>
  <div class="kpi"><div class="label">Clientes</div><div class="value">${data.clientesAtendidos}/${data.clientList.length}</div></div>
  <div class="kpi"><div class="label">Productos</div><div class="value">${products.length}</div></div>
</div>
<h2>Resumen por producto</h2>
<table><thead><tr><th>Producto</th><th>Precio</th><th>Inicial</th><th>Vendido</th><th>Restante</th><th>Total $</th></tr></thead><tbody>${productRows}</tbody></table>
<h2>Ventas por cliente</h2>
<table><thead><tr><th>#</th><th>Cliente</th><th>Estado</th><th>Unidades</th><th>Total $</th></tr></thead><tbody>${clientRows}</tbody></table>
<script>window.onload=()=>setTimeout(()=>window.print(),300);</script>
</body></html>`;

  const w = window.open("", "_blank");
  if (!w) {
    alert("Permite ventanas emergentes para descargar el PDF.");
    return;
  }
  w.document.write(html);
  w.document.close();
}

export function exportReportJSON(
  target: ActiveRoute,
  products: Product[],
  clients: Client[],
  routes: RouteT[],
) {
  const data = buildReportData(target, products, clients, routes);
  const payload = {
    route: data.route,
    date: target.date,
    initialInventory: target.initialInventory,
    products,
    clients: data.clientList,
    sales: target.sales,
    summary: {
      totalDinero: data.totalDinero,
      totalUnidades: data.totalUnidades,
      clientesAtendidos: data.clientesAtendidos,
      remaining: data.remaining,
      porProducto: data.porProducto,
    },
  };
  const filename = `reporte-${data.route?.name ?? "ruta"}-${new Date(target.date).toISOString().slice(0, 10)}.json`;
  const json = JSON.stringify(payload, null, 2);

  const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void>; canShare?: (d: ShareData) => boolean };
  if (nav.share && typeof File !== "undefined") {
    try {
      const file = new File([json], filename, { type: "application/json" });
      const shareData: ShareData = { files: [file], title: filename, text: `Reporte ${data.route?.name ?? ""}` };
      if (!nav.canShare || nav.canShare(shareData)) {
        nav.share(shareData).catch(() => downloadBlob(json, filename, "application/json"));
        return;
      }
    } catch {
      // fallback
    }
  }
  downloadBlob(json, filename, "application/json");
}
