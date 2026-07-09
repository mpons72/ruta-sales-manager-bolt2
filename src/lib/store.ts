import { useEffect, useState, useSyncExternalStore } from "react";

export const DEFAULT_GROUP_ID = "g-default";
export type ProductGroup = { id: string; name: string };
export type Product = { id: string; name: string; price: number; description?: string; groupId?: string };
export type SpecialPricing = { enabled: boolean; prices: Record<string, number> };
export type Client = { id: string; name: string; address?: string; lat?: number; lng?: number; placeId?: string; verifiedAddress?: string; routeId: string; visitOrder: number; active?: boolean; credit?: boolean; specialPricing?: SpecialPricing; enabledGroupIds?: string[] };
export type Route = { id: string; name: string };

export type ClientSale = {
  // Venta = surtido − devolución − existenciaActual (existenciaAnterior es solo informativo)
  existenciaAnterior: Record<string, number>;
  existenciaActual: Record<string, number>;
  surtido: Record<string, number>;
  devolucion: Record<string, number>;
  completed: boolean;
  paymentType?: "cash" | "credit";
  // Snapshot de precios usados al momento de cerrar la venta (productId -> precio).
  // Permite que precios especiales por cliente se respeten en el historial aunque
  // el catálogo o el ajuste del cliente cambien después.
  priceSnapshot?: Record<string, number>;
  // Notas / incidentes del vendedor sobre esta venta.
  notes?: string;
};

export type ActiveRoute = {
  routeId: string;
  date: string;
  initialInventory: Record<string, number>;
  sales: Record<string, ClientSale>;
  // Cuando es una "venta fuera de ruta", se mezclan clientes de cualquier ruta.
  // `clientIds` define el subconjunto de clientes que conforman esta ruta temporal.
  temporary?: boolean;
  clientIds?: string[];
  label?: string;
};

export const TEMP_ROUTE_ID = "__tmp__";

export type Theme = "dark" | "light";

export type HistoryEntry = ActiveRoute & {
  endedAt: string;
  label?: string;
};

export type AuditEntry = {
  id: string;
  at: string;
  action: "delete_history" | "edit_history";
  target: string;
  details?: string;
};

export type AppState = {
  products: Product[];
  groups: ProductGroup[];
  clients: Client[];
  routes: Route[];
  active: ActiveRoute | null;
  history: HistoryEntry[];
  theme: Theme;
  adminPasswordHash: string | null;
  audit: AuditEntry[];
};

const STORAGE_KEY = "ruta-ventas-v2";
const LEGACY_STORAGE_KEYS = ["ruta-ventas-v1"];

const defaults: AppState = {
  groups: [{ id: DEFAULT_GROUP_ID, name: "Bolsa 280 gms" }],
  products: [
    { id: "p1", name: "Jalapeño Picosón", price: 12, groupId: DEFAULT_GROUP_ID },
    { id: "p2", name: "La de Árbol", price: 12, groupId: DEFAULT_GROUP_ID },
    { id: "p3", name: "La Taquera", price: 12, groupId: DEFAULT_GROUP_ID },
    { id: "p4", name: "Árbol Quemado", price: 12, groupId: DEFAULT_GROUP_ID },
    { id: "p5", name: "La Matona", price: 12, groupId: DEFAULT_GROUP_ID },
    { id: "p6", name: "Chipotle Ahumado", price: 12, groupId: DEFAULT_GROUP_ID },
    { id: "p7", name: "Habanero Extremo", price: 12, groupId: DEFAULT_GROUP_ID },
  ],
  routes: [{ id: "r1", name: "Ruta Principal" }],
  clients: [],
  active: null,
  history: [],
  theme: "dark",
  adminPasswordHash: null,
  audit: [],
};

// Contraseña por defecto si el admin no ha configurado una propia.
// Cámbiala desde Ajustes → Contraseña de Administrador.
export const DEFAULT_ADMIN_PASSWORD = "Admin123";

let state: AppState = load();
const listeners = new Set<() => void>();

function load(): AppState {
  if (typeof window === "undefined") return defaults;
  try {
    let sourceKey = STORAGE_KEY;
    let raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      sourceKey = LEGACY_STORAGE_KEYS.find((key) => localStorage.getItem(key)) ?? STORAGE_KEY;
      raw = localStorage.getItem(sourceKey);
    }
    if (!raw) return defaults;
    let migrated = { ...defaults, ...migrateImported(JSON.parse(raw)) };
    for (const key of LEGACY_STORAGE_KEYS) {
      const legacyRaw = localStorage.getItem(key);
      if (!legacyRaw || legacyRaw === raw) continue;
      const legacy = { ...defaults, ...migrateImported(JSON.parse(legacyRaw)) };
      migrated = mergeImportedStates(legacy, migrated);
    }
    if (sourceKey !== STORAGE_KEY || LEGACY_STORAGE_KEYS.some((key) => localStorage.getItem(key))) localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
    return migrated;
  } catch {
    return defaults;
  }
}

function mergeImportedStates(base: AppState, current: AppState): AppState {
  const byId = <T extends { id: string }>(items: T[]) => new Map(items.map((item) => [item.id, item]));
  const products = byId(base.products);
  for (const product of current.products) products.set(product.id, product);
  const routes = byId(base.routes);
  for (const route of current.routes) routes.set(route.id, route);
  const clients = byId(base.clients);
  for (const client of current.clients) clients.set(client.id, client);
  const history = new Map<string, HistoryEntry>();
  for (const entry of base.history) history.set(entry.endedAt ?? entry.date, entry);
  for (const entry of current.history) history.set(entry.endedAt ?? entry.date, entry);
  return {
    ...base,
    ...current,
    products: Array.from(products.values()),
    routes: Array.from(routes.values()),
    clients: Array.from(clients.values()),
    history: Array.from(history.values()).sort((a, b) => new Date(b.endedAt ?? b.date).getTime() - new Date(a.endedAt ?? a.date).getTime()),
  };
}

function persist() {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function setState(updater: (s: AppState) => AppState) {
  state = updater(state);
  persist();
  listeners.forEach((l) => l());
}

export function useStore<T>(selector: (s: AppState) => T): T {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    state = load();
    setHydrated(true);
    listeners.forEach((l) => l());
  }, []);
  const value = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => selector(state),
    () => selector(defaults),
  );
  // suppress unused warning
  void hydrated;
  return value;
}

const uid = () => Math.random().toString(36).slice(2, 10);

export const actions = {
  addProduct: (name: string, price: number, description?: string, groupId?: string) =>
    setState((s) => ({ ...s, products: [...s.products, { id: uid(), name, price, description, groupId: groupId ?? s.groups[0]?.id ?? DEFAULT_GROUP_ID }] })),
  updateProduct: (id: string, patch: Partial<Product>) =>
    setState((s) => ({ ...s, products: s.products.map((p) => (p.id === id ? { ...p, ...patch } : p)) })),
  removeProduct: (id: string) =>
    setState((s) => ({ ...s, products: s.products.filter((p) => p.id !== id) })),

  addGroup: (name: string) =>
    setState((s) => ({ ...s, groups: [...s.groups, { id: uid(), name }] })),
  updateGroup: (id: string, patch: Partial<ProductGroup>) =>
    setState((s) => ({ ...s, groups: s.groups.map((g) => (g.id === id ? { ...g, ...patch } : g)) })),
  removeGroup: (id: string) =>
    setState((s) => {
      if (s.groups.length <= 1) return s;
      const fallback = s.groups.find((g) => g.id !== id)?.id ?? DEFAULT_GROUP_ID;
      return {
        ...s,
        groups: s.groups.filter((g) => g.id !== id),
        products: s.products.map((p) => (p.groupId === id ? { ...p, groupId: fallback } : p)),
        clients: s.clients.map((c) =>
          c.enabledGroupIds ? { ...c, enabledGroupIds: c.enabledGroupIds.filter((g) => g !== id) } : c,
        ),
      };
    }),
  setClientEnabledGroups: (clientId: string, groupIds: string[] | undefined) =>
    setState((s) => ({
      ...s,
      clients: s.clients.map((c) => (c.id === clientId ? { ...c, enabledGroupIds: groupIds } : c)),
    })),

  exportData: (): string => JSON.stringify(state, null, 2),
  importData: (json: string) => {
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== "object") throw new Error("Archivo inválido");
    setState(() => ({ ...defaults, ...migrateImported(parsed) }));
  },

  addRoute: (name: string) =>
    setState((s) => ({ ...s, routes: [...s.routes, { id: uid(), name }] })),
  updateRoute: (id: string, patch: Partial<Route>) =>
    setState((s) => ({ ...s, routes: s.routes.map((r) => (r.id === id ? { ...r, ...patch } : r)) })),
  removeRoute: (id: string) =>
    setState((s) => ({
      ...s,
      routes: s.routes.filter((r) => r.id !== id),
      clients: s.clients.filter((c) => c.routeId !== id),
    })),

  addClient: (c: Omit<Client, "id">) =>
    setState((s) => {
      const sameRoute = s.clients.filter((x) => x.routeId === c.routeId);
      const requested = Number(c.visitOrder);
      const insertAt =
        Number.isFinite(requested) && requested > 0
          ? Math.min(requested, sameRoute.length + 1)
          : sameRoute.length + 1;
      const shifted = s.clients.map((x) =>
        x.routeId === c.routeId && x.visitOrder >= insertAt
          ? { ...x, visitOrder: x.visitOrder + 1 }
          : x,
      );
      return {
        ...s,
        clients: [...shifted, { id: uid(), ...c, visitOrder: insertAt }],
      };
    }),
  updateClient: (id: string, patch: Partial<Client>) =>
    setState((s) => {
      // Descartar claves cuyo valor sea `undefined` para no borrar campos existentes
      // (por ejemplo lat/lng cuando un editor sólo cambia nombre/dirección).
      const clean: Partial<Client> = {};
      for (const [k, v] of Object.entries(patch)) {
        if (v !== undefined) (clean as any)[k] = v;
      }
      return { ...s, clients: s.clients.map((c) => (c.id === id ? { ...c, ...clean } : c)) };
    }),
  clearClientVerification: (id: string) =>
    setState((s) => ({
      ...s,
      clients: s.clients.map((c) => {
        if (c.id !== id) return c;
        const { placeId, verifiedAddress, ...rest } = c;
        void placeId; void verifiedAddress;
        return rest;
      }),
    })),
  importClientLocationsFromGpx: (
    stops: { id?: string; name: string; lat: number; lng: number; address?: string }[],
  ): { matched: number; missed: string[] } => {
    let matched = 0;
    const missed: string[] = [];
    const normalize = (v: string) =>
      v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
    setState((s) => {
      const byId = new Map(s.clients.map((c) => [c.id, c]));
      const byName = new Map<string, Client>();
      for (const c of s.clients) byName.set(normalize(c.name), c);
      const updates = new Map<string, Partial<Client>>();
      for (const stop of stops) {
        let target: Client | undefined;
        if (stop.id && byId.has(stop.id)) target = byId.get(stop.id);
        if (!target) target = byName.get(normalize(stop.name));
        if (!target) {
          missed.push(stop.name);
          continue;
        }
        matched += 1;
        updates.set(target.id, {
          lat: stop.lat,
          lng: stop.lng,
          ...(stop.address && !target.address ? { address: stop.address } : {}),
        });
      }
      return {
        ...s,
        clients: s.clients.map((c) => (updates.has(c.id) ? { ...c, ...updates.get(c.id)! } : c)),
      };
    });
    return { matched, missed };
  },
  removeClient: (id: string) =>
    setState((s) => ({ ...s, clients: s.clients.filter((c) => c.id !== id) })),
  setClientVisitOrder: (id: string, newOrder: number) =>
    setState((s) => {
      const target = s.clients.find((c) => c.id === id);
      if (!target) return s;
      const siblings = s.clients
        .filter((c) => c.routeId === target.routeId)
        .sort((a, b) => a.visitOrder - b.visitOrder);
      const without = siblings.filter((c) => c.id !== id);
      const clamped = Math.max(1, Math.min(Math.floor(newOrder) || 1, siblings.length));
      const reordered = [...without.slice(0, clamped - 1), target, ...without.slice(clamped - 1)];
      const orderById = new Map(reordered.map((c, i) => [c.id, i + 1]));
      return {
        ...s,
        clients: s.clients.map((c) =>
          orderById.has(c.id) ? { ...c, visitOrder: orderById.get(c.id)! } : c,
        ),
      };
    }),
  moveClient: (id: string, dir: "up" | "down") =>
    setState((s) => {
      const target = s.clients.find((c) => c.id === id);
      if (!target) return s;
      const siblings = s.clients
        .filter((c) => c.routeId === target.routeId)
        .sort((a, b) => a.visitOrder - b.visitOrder);
      const idx = siblings.findIndex((c) => c.id === id);
      const swapIdx = dir === "up" ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= siblings.length) return s;
      const other = siblings[swapIdx];
      return {
        ...s,
        clients: s.clients.map((c) => {
          if (c.id === target.id) return { ...c, visitOrder: other.visitOrder };
          if (c.id === other.id) return { ...c, visitOrder: target.visitOrder };
          return c;
        }),
      };
    }),

  startRoute: (routeId: string, initialInventory: Record<string, number>) =>
    setState((s) => ({
      ...s,
      active: {
        routeId,
        date: new Date().toISOString(),
        initialInventory,
        sales: {},
      },
    })),

  startTemporaryRoute: (
    clientIds: string[],
    initialInventory: Record<string, number>,
    label?: string,
  ) =>
    setState((s) => ({
      ...s,
      active: {
        routeId: TEMP_ROUTE_ID,
        date: new Date().toISOString(),
        initialInventory,
        sales: {},
        temporary: true,
        clientIds: [...clientIds],
        label: label?.trim() || `Venta fuera de ruta · ${new Date().toLocaleDateString("es-MX")}`,
      },
    })),

  reorderActiveClients: (orderedIds: string[]) =>
    setState((s) => {
      if (!s.active) return s;
      const existing = s.active.clientIds;
      if (existing && existing.length > 0) {
        const set = new Set(orderedIds);
        const tail = existing.filter((id) => !set.has(id));
        return { ...s, active: { ...s.active, clientIds: [...orderedIds, ...tail] } };
      }
      // Override temporal sobre una ruta normal: no modifica los clientes guardados.
      return { ...s, active: { ...s.active, clientIds: [...orderedIds] } };
    }),

  saveClientSale: (clientId: string, sale: ClientSale) =>
    setState((s) => {
      if (!s.active) return s;
      return { ...s, active: { ...s.active, sales: { ...s.active.sales, [clientId]: sale } } };
    }),

  endRoute: () =>
    setState((s) => {
      if (!s.active) return s;
      return {
        ...s,
        active: null,
        history: [{ ...s.active, endedAt: new Date().toISOString() }, ...s.history].slice(0, 50),
      };
    }),

  cancelRoute: () => setState((s) => ({ ...s, active: null })),

  setTheme: (theme: Theme) => setState((s) => ({ ...s, theme })),
  toggleTheme: () =>
    setState((s) => ({ ...s, theme: s.theme === "dark" ? "light" : "dark" })),

  setAdminPassword: async (newPassword: string, currentPassword?: string) => {
    if (state.adminPasswordHash) {
      const ok = await verifyHash(currentPassword ?? "", state.adminPasswordHash);
      if (!ok) throw new Error("Contraseña actual incorrecta");
    }
    if (!newPassword || newPassword.length < 4) throw new Error("Mínimo 4 caracteres");
    const hash = await sha256(newPassword);
    setState((s) => ({ ...s, adminPasswordHash: hash }));
  },
  verifyAdminPassword: async (password: string): Promise<boolean> => {
    if (!state.adminPasswordHash) return password === DEFAULT_ADMIN_PASSWORD;
    return verifyHash(password, state.adminPasswordHash);
  },
  updateInitialInventory: (initialInventory: Record<string, number>) =>
    setState((s) => {
      if (!s.active) return s;
      return { ...s, active: { ...s.active, initialInventory } };
    }),

  deleteHistoryEntry: (endedAt: string) =>
    setState((s) => {
      const entry = s.history.find((h) => h.endedAt === endedAt);
      const audit: AuditEntry = {
        id: uid(),
        at: new Date().toISOString(),
        action: "delete_history",
        target: endedAt,
        details: entry ? `Ruta ${entry.routeId} (${new Date(entry.date).toLocaleDateString("es-MX")})` : undefined,
      };
      return {
        ...s,
        history: s.history.filter((h) => h.endedAt !== endedAt),
        audit: [audit, ...s.audit].slice(0, 200),
      };
    }),
  updateHistoryEntry: (endedAt: string, patch: Partial<HistoryEntry>) =>
    setState((s) => {
      const audit: AuditEntry = {
        id: uid(),
        at: new Date().toISOString(),
        action: "edit_history",
        target: endedAt,
        details: patch.label ? `Etiqueta: ${patch.label}` : undefined,
      };
      return {
        ...s,
        history: s.history.map((h) => (h.endedAt === endedAt ? { ...h, ...patch } : h)),
        audit: [audit, ...s.audit].slice(0, 200),
      };
    }),
};

// Migración de respaldos exportados con esquemas antiguos.
function migrateImported(raw: any): any {
  const out: any = { ...raw };

  // Grupos de productos: si no existen, crear el grupo por defecto.
  if (!Array.isArray(out.groups) || out.groups.length === 0) {
    out.groups = [{ id: DEFAULT_GROUP_ID, name: "Bolsa 280 gms" }];
  }
  const groupIdsSet = new Set<string>(out.groups.map((g: ProductGroup) => g.id));
  const fallbackGroupId: string = out.groups[0].id;
  if (Array.isArray(out.products)) {
    out.products = out.products.map((p: any) => ({
      ...p,
      groupId: p.groupId && groupIdsSet.has(p.groupId) ? p.groupId : fallbackGroupId,
    }));
  }

  if (Array.isArray(raw.clients)) {
    out.clients = raw.clients.map((c: any) => {
      const lat = toNumber(c.lat ?? c.latitude ?? c.location?.lat ?? c.coords?.lat);
      const lng = toNumber(c.lng ?? c.lon ?? c.longitude ?? c.location?.lng ?? c.location?.lon ?? c.coords?.lng ?? c.coords?.lon);
      return {
        ...c,
        address: c.address ?? c.direccion ?? c.direction ?? c.location?.address ?? c.ubicacion ?? "",
        ...(lat == null ? {} : { lat }),
        ...(lng == null ? {} : { lng }),
        visitOrder: c.visitOrder ?? c.order ?? c.orden ?? 0,
      };
    });
  }

  const migrateRouteLike = (r: any) => {
    if (!r || typeof r !== "object") return r;
    const next: any = { ...r };
    if (Array.isArray(next.sales)) {
      const sales: Record<string, any> = {};
      for (const v of next.sales) {
        const clientId = v?.clientId ?? v?.clienteId ?? v?.customerId ?? v?.clientName ?? v?.cliente ?? v?.customerName ?? v?.name ?? v?.id ?? v?.visitOrder ?? v?.order ?? v?.orden;
        if (!clientId) continue;
        sales[clientId] = { ...v, ...normalizeSale(v) };
      }
      next.sales = sales;
    }
    if (!next.sales && Array.isArray(r.visits)) {
      const sales: Record<string, any> = {};
      for (const v of r.visits) {
        const clientId = v?.clientId ?? v?.clienteId ?? v?.customerId ?? v?.clientName ?? v?.cliente ?? v?.customerName ?? v?.name ?? v?.id ?? v?.visitOrder ?? v?.order ?? v?.orden;
        if (!clientId) continue;
        sales[clientId] = { ...v, ...normalizeSale(v) };
      }
      next.sales = sales;
      delete next.visits;
    }
    if (!next.sales && Array.isArray(r.clientes)) {
      const sales: Record<string, any> = {};
      for (const v of r.clientes) {
        const clientId = v?.clientId ?? v?.clienteId ?? v?.customerId ?? v?.clientName ?? v?.cliente ?? v?.customerName ?? v?.name ?? v?.id ?? v?.visitOrder ?? v?.orden;
        if (!clientId) continue;
        sales[clientId] = { ...v, ...normalizeSale(v) };
      }
      next.sales = sales;
    }
    if (!next.sales && r.ventas && typeof r.ventas === "object") next.sales = r.ventas;
    if (next.sales && typeof next.sales === "object") {
      next.sales = Object.fromEntries(
        Object.entries(next.sales).map(([clientId, sale]) => [
          clientId,
          { ...(sale && typeof sale === "object" ? sale : {}), ...normalizeSale(sale) },
        ]),
      );
    }
    next.initialInventory = r.initialInventory ?? r.inventarioInicial ?? r.cargaInicial ?? {};
    return next;
  };

  if (Array.isArray(raw.history)) {
    out.history = raw.history.map((h: any) => {
      const m = migrateRouteLike(h);
      return { ...m, endedAt: m.endedAt ?? m.date ?? new Date().toISOString() };
    });
  }

  if (!Array.isArray(out.history) && Array.isArray(raw.historial)) {
    out.history = raw.historial.map((h: any) => {
      const m = migrateRouteLike(h);
      return { ...m, endedAt: m.endedAt ?? m.fechaCierre ?? m.date ?? new Date().toISOString() };
    });
  }

  if (!Array.isArray(out.history) && (raw.sales || raw.ventas) && (raw.date || raw.fecha || raw.route || raw.routeId)) {
    const reportLike = migrateRouteLike({
      routeId: raw.routeId ?? raw.route?.id ?? raw.rutaId ?? raw.ruta?.id ?? defaults.routes[0]?.id,
      date: raw.date ?? raw.fecha ?? raw.createdAt ?? new Date().toISOString(),
      endedAt: raw.endedAt ?? raw.fechaCierre ?? raw.date ?? raw.fecha ?? new Date().toISOString(),
      initialInventory: raw.initialInventory ?? raw.inventarioInicial ?? {},
      sales: raw.sales ?? raw.ventas,
      label: raw.label ?? raw.route?.name ?? raw.ruta?.name ?? raw.ruta?.nombre,
    });
    out.history = [{ ...reportLike, endedAt: reportLike.endedAt ?? new Date().toISOString() }];
  }

  if (raw.active || raw.currentDay) {
    out.active = migrateRouteLike(raw.active ?? raw.currentDay) ?? null;
  }
  delete out.currentDay;

  return out;
}

function toNumber(value: unknown): number | undefined {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) ? n : undefined;
}

function numberRecord(value: any): Record<string, number> {
  if (!value || typeof value !== "object") return {};
  if (Array.isArray(value)) {
    const out: Record<string, number> = {};
    for (const item of value) {
      const key = item?.productId ?? item?.productoId ?? item?.id ?? item?.name ?? item?.producto;
      if (!key) continue;
      out[key] = (out[key] ?? 0) + (Number(item?.qty ?? item?.quantity ?? item?.piezas ?? item?.units ?? item?.value) || 0);
    }
    return out;
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, val]) => [key, Number(val) || 0]),
  );
}

export function normalizeSale(v: any): ClientSale {
  return {
    existenciaAnterior: numberRecord(v?.existenciaAnterior ?? v?.previous ?? v?.antes ?? v?.piezasAntes ?? v?.anterior),
    surtido: numberRecord(v?.surtido ?? v?.supplied ?? v?.surtidas ?? v?.surt ?? v?.entregado ?? v?.entregadas ?? v?.piezasSurtidas),
    devolucion: numberRecord(v?.devolucion ?? v?.devoluciones ?? v?.returned ?? v?.dev ?? v?.merma ?? v?.mermas ?? v?.devueltas),
    existenciaActual: numberRecord(v?.existenciaActual ?? v?.current ?? v?.queda ?? v?.restante),
    completed: !!(v?.completed ?? v?.done ?? v?.finalizado ?? v?.atendido ?? v?.visitado ?? v?.cerrado ?? v?.estado === "atendido"),
    paymentType: v?.paymentType,
    priceSnapshot: v?.priceSnapshot && typeof v.priceSnapshot === "object"
      ? Object.fromEntries(Object.entries(v.priceSnapshot).map(([k, val]) => [k, Number(val) || 0]))
      : undefined,
  };
}

async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function verifyHash(password: string, hash: string): Promise<boolean> {
  const h = await sha256(password);
  return h === hash;
}

// Helpers
// Reglas de contabilidad:
// - `existenciaAnterior` es SOLO informativo (lo que el cliente tenía). NO se usa en cálculos.
// - `surtido` son las piezas entregadas al cliente por sabor: salen del inventario del vendedor.
// - `devolucion` son MERMAS / pérdidas: NO regresan al inventario del vendedor.
//   Pueden ser de cualquier sabor (el cliente puede sustituir un sabor por otro), por lo que
//   la devolución se descuenta del TOTAL de piezas vendidas, no por sabor específico.
export function computeRemaining(active: ActiveRoute, products: Product[]): Record<string, number> {
  const remaining: Record<string, number> = {};
  const sales = Object.values(active?.sales ?? {});
  for (const p of products) {
    const initial = active?.initialInventory?.[p.id] ?? 0;
    let surtidoTotal = 0;
    for (const sale of sales) {
      surtidoTotal += sale?.surtido?.[p.id] ?? 0;
    }
    // Las devoluciones son merma: no se devuelven al inventario.
    remaining[p.id] = initial - surtidoTotal;
  }
  return remaining;
}

export function getLastSaleForClient(
  clientId: string,
  history: HistoryEntry[],
): ClientSale | null {
  for (const entry of history) {
    const sale = entry.sales?.[clientId];
    if (sale) return sale;
  }
  return null;
}

// Piezas surtidas de un sabor específico al cliente. Las devoluciones NO se restan aquí
// porque pueden ser de un sabor distinto; se contabilizan al total con `clientNetUnits`.
export function clientUnitsSold(sale: ClientSale, productId: string): number {
  return sale?.surtido?.[productId] ?? 0;
}

// Total neto de piezas vendidas al cliente (todos los sabores): surtido total − devoluciones totales.
export function clientNetUnits(sale: ClientSale): number {
  if (!sale) return 0;
  const surt = Object.values(sale.surtido ?? {}).reduce((a, b) => a + (b ?? 0), 0);
  const dev = Object.values(sale.devolucion ?? {}).reduce((a, b) => a + (b ?? 0), 0);
  return surt - dev;
}

// Devuelve el precio efectivo de un producto para una venta. Si la venta tiene snapshot,
// se respeta; si no, se usa el catálogo.
export function priceFor(sale: ClientSale | undefined | null, product: Product): number {
  const snap = sale?.priceSnapshot?.[product.id];
  return typeof snap === "number" && Number.isFinite(snap) ? snap : product.price;
}

// Precios efectivos para un cliente (incluye precios especiales si los tiene activos).
export function getEffectivePrices(client: Client | undefined | null, products: Product[]): Record<string, number> {
  const out: Record<string, number> = {};
  const sp = client?.specialPricing;
  for (const p of products) {
    const override = sp?.enabled ? sp.prices?.[p.id] : undefined;
    out[p.id] = typeof override === "number" && Number.isFinite(override) ? override : p.price;
  }
  return out;
}

// Total $ de la venta:
// Las devoluciones descuentan del total de piezas de venta aunque sean de otro sabor.
export function clientSaleAmount(sale: ClientSale, products: Product[]): number {
  if (!sale) return 0;
  const surtido = sale.surtido ?? {};
  const devolucion = sale.devolucion ?? {};
  let surtPzas = 0;
  let devPzas = 0;
  let surtMonto = 0;
  for (const p of products) {
    const s = surtido[p.id] ?? 0;
    const d = devolucion[p.id] ?? 0;
    const price = priceFor(sale, p);
    surtPzas += s;
    devPzas += d;
    surtMonto += s * price;
  }
  if (surtPzas === 0) return -devPzas * priceFor(sale, products[0] ?? ({ price: 0 } as Product));
  const precioProm = surtMonto / surtPzas;
  const netas = surtPzas - devPzas;
  return netas * precioProm;
}

// Grupos habilitados para un cliente. Si no tiene `enabledGroupIds` definido,
// se considera que todos los grupos están habilitados.
export function getClientGroupIds(
  client: Client | undefined | null,
  groups: ProductGroup[],
): Set<string> {
  if (!client?.enabledGroupIds) return new Set(groups.map((g) => g.id));
  return new Set(client.enabledGroupIds);
}

// Filtra los productos del catálogo a los grupos habilitados para el cliente.
export function productsForClient(
  products: Product[],
  groups: ProductGroup[],
  client: Client | undefined | null,
): Product[] {
  const allowed = getClientGroupIds(client, groups);
  return products.filter((p) => allowed.has(p.groupId ?? groups[0]?.id ?? DEFAULT_GROUP_ID));
}

// Union de productos para una lista de clientes (usado en carga inicial / inicio de ruta).
export function productsForClients(
  products: Product[],
  groups: ProductGroup[],
  clients: Client[],
): Product[] {
  if (clients.length === 0) return products;
  const allowed = new Set<string>();
  for (const c of clients) for (const g of getClientGroupIds(c, groups)) allowed.add(g);
  return products.filter((p) => allowed.has(p.groupId ?? groups[0]?.id ?? DEFAULT_GROUP_ID));
}

