import {
  clientSaleAmount,
  clientNetUnits,
  normalizeSale,
  priceFor,
  type ActiveRoute,
  type Client,
  type ClientSale,
  type HistoryEntry,
  type Product,
} from "./store";

function norm(v: unknown) {
  return String(v ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function saleWithSource(value: any): ClientSale {
  return { ...(value && typeof value === "object" ? value : {}), ...normalizeSale(value) };
}

function totalRec(r: Record<string, number> | undefined) {
  return Object.values(r ?? {}).reduce((a, b) => a + (Number(b) || 0), 0);
}

function saleHasMovement(sale: ClientSale) {
  return totalRec(sale.surtido) > 0 || totalRec(sale.devolucion) > 0;
}

function entrySalesForClient(entry: ActiveRoute | HistoryEntry, client: Client): ClientSale[] {
  const out: ClientSale[] = [];
  const matches = (v: any) => {
    const id = v?.clientId ?? v?.clienteId ?? v?.customerId;
    const name = v?.clientName ?? v?.cliente ?? v?.customerName ?? v?.name;
    const order = Number(v?.visitOrder ?? v?.order ?? v?.orden);
    return (
      id === client.id ||
      norm(id) === norm(client.id) ||
      norm(id) === norm(client.name) ||
      norm(name) === norm(client.name) ||
      (Number.isFinite(order) && order === client.visitOrder)
    );
  };
  const add = (v: any) => {
    const sale = saleWithSource(v);
    if (saleHasMovement(sale) || sale.completed) out.push(sale);
  };
  const rawSales = (entry as any)?.sales;
  if (Array.isArray(rawSales)) rawSales.filter(matches).forEach(add);
  else if (rawSales && typeof rawSales === "object") {
    Object.entries(rawSales)
      .filter(
        ([key, value]) =>
          norm(key) === norm(client.id) ||
          norm(key) === norm(client.name) ||
          key === String(client.visitOrder) ||
          matches(value),
      )
      .forEach(([, value]) => add(value));
  }
  return out;
}

export type LastPurchase = {
  date: string;
  total: number;
  units: number;
  paymentType?: "cash" | "credit";
  notes?: string;
  items: {
    name: string;
    qty: number;
    price: number;
    surtido: number;
    devolucion: number;
    existenciaAnterior: number;
    existenciaActual: number;
  }[];
};

export function getLastPurchase(
  client: Client,
  history: HistoryEntry[],
  active: ActiveRoute | null,
  products: Product[],
): LastPurchase | null {
  type Hit = { date: string; sale: ClientSale };
  const hits: Hit[] = [];
  for (const h of history) {
    for (const s of entrySalesForClient(h, client)) {
      if (s.completed || saleHasMovement(s)) hits.push({ date: h.endedAt ?? h.date, sale: s });
    }
  }
  if (active) {
    for (const s of entrySalesForClient(active, client)) {
      // Sólo incluir la venta activa si ya está marcada como completada para
      // que coincida con "última compra real"
      if (s.completed) hits.push({ date: active.date, sale: s });
    }
  }
  if (hits.length === 0) return null;
  hits.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const top = hits[0];
  const items = products
    .map((p) => {
      const surtido = Number(top.sale.surtido?.[p.id] ?? 0);
      const devolucion = Number(top.sale.devolucion?.[p.id] ?? 0);
      const existenciaAnterior = Number(top.sale.existenciaAnterior?.[p.id] ?? 0);
      const existenciaActual = Number(top.sale.existenciaActual?.[p.id] ?? 0);
      const qty = surtido - devolucion;
      return {
        name: p.name,
        qty,
        price: priceFor(top.sale, p),
        surtido,
        devolucion,
        existenciaAnterior,
        existenciaActual,
      };
    })
    .filter(
      (x) =>
        x.qty !== 0 ||
        x.surtido !== 0 ||
        x.devolucion !== 0 ||
        x.existenciaAnterior !== 0 ||
        x.existenciaActual !== 0,
    );
  return {
    date: top.date,
    total: clientSaleAmount(top.sale, products),
    units: clientNetUnits(top.sale),
    paymentType: top.sale.paymentType,
    notes: top.sale.notes,
    items,
  };
}

export type ProductStat = { id: string; name: string; units: number; visits: number; avg: number };

export function getClientTopProducts(
  client: Client,
  history: HistoryEntry[],
  active: ActiveRoute | null,
  products: Product[],
  limit = 5,
): { visits: number; perProduct: ProductStat[]; top: ProductStat | null } {
  const sales: ClientSale[] = [];
  for (const h of history) sales.push(...entrySalesForClient(h, client));
  if (active) sales.push(...entrySalesForClient(active, client));
  const visits = sales.filter((s) => s.completed || saleHasMovement(s)).length;
  const perProduct: ProductStat[] = products.map((p) => {
    let units = 0;
    let visitsWithUnits = 0;
    for (const s of sales) {
      const u = Number(s.surtido?.[p.id] ?? 0);
      if (u > 0) {
        units += u;
        visitsWithUnits += 1;
      }
    }
    return { id: p.id, name: p.name, units, visits: visitsWithUnits, avg: visits ? units / visits : 0 };
  });
  const top = perProduct.filter((p) => p.units > 0).sort((a, b) => b.units - a.units)[0] ?? null;
  return { visits, perProduct: perProduct.sort((a, b) => b.units - a.units).slice(0, limit), top };
}
