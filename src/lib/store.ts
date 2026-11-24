import { useEffect, useState, useSyncExternalStore } from "react";

export const DEFAULT_GROUP_ID = "g-default";
export type ProductGroup = { id: string; name: string };
export type Product = { id: string; name: string; price: number; description?: string; groupId?: string };
export type SpecialPricing = { enabled: boolean; prices: Record<string, number> };
export type CreditType = "ninguno" | "A" | "B";
export type DeletedClientCreditSnapshot = { creditType: CreditType; credit?: boolean };
export type CreditAccountType = "client" | "chain";
export type CreditMovementType = "venta" | "cobro" | "ajuste" | "factura" | "pago";
export type CreditChain = { id: string; name: string };
export type CreditBranchBalance = { branchId: string | null; name: string; pieces: number; amount: number };
export type CreditInvoice = {
  id: string;
  chainId: string;
  folio: string;
  date: string;
  pieces: number;
  amount: number;
  branchBreakdown: CreditBranchBalance[];
};
export type CreditMovement = {
  id: string;
  date: string;
  type: CreditMovementType;
  accountType: CreditAccountType;
  accountId: string;
  /** Branch that originated a chain-account movement. */
  branchId?: string;
  invoiceId?: string;
  branchAllocations?: { branchId: string | null; pieces: number; amount: number }[];
  /** Signed change: sales add; collections/payments subtract; adjustments may be either sign. */
  pieces: number;
  amount: number;
  /** Stable reference to the sale that originated this movement, when applicable. */
  saleRef?: string;
  note?: string;
};
export type Client = { id: string; name: string; address?: string; lat?: number; lng?: number; placeId?: string; verifiedAddress?: string; routeId: string; visitOrder: number; active?: boolean; archivedAt?: string; credit?: boolean; creditType?: CreditType; chainId?: string | null; specialPricing?: SpecialPricing; enabledGroupIds?: string[] };
export type ProspectResult = "no-quiso" | "volver-despues" | "interesado";
export type ProspectVisit = { id: string; date: string; result: ProspectResult; note?: string };
export type Prospect = { id: string; name: string; address?: string; lat?: number; lng?: number; createdAt: string; visits: ProspectVisit[]; convertedClientId?: string };
export type Route = { id: string; name: string };

export type ClientSale = {
  // Venta = surtido − devolución − existenciaActual (existenciaAnterior es solo informativo)
  existenciaAnterior: Record<string, number>;
  existenciaActual: Record<string, number>;
  surtido: Record<string, number>;
  /** Piezas de surtido entregadas como obsequio: salen de inventario, no se cobran. */
  obsequios?: Record<string, number>;
  devolucion: Record<string, number>;
  completed: boolean;
  paymentType?: "cash" | "credit";
  // Snapshot de precios usados al momento de cerrar la venta (productId -> precio).
  // Permite que precios especiales por cliente se respeten en el historial aunque
  // el catálogo o el ajuste del cliente cambien después.
  priceSnapshot?: Record<string, number>;
  // Notas / incidentes del vendedor sobre esta venta.
  notes?: string;
  // Cobro de deuda anterior para clientes tipo A; también se conserva en borradores.
  previousCreditPayment?: { pieces: number; amount: number };
  /** En borradores conserva si el cliente planea abonar su saldo anterior. */
  collectPreviousDebt?: boolean;
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
  /** Names retained for historical sales if an archived client is permanently deleted. */
  clientNameSnapshots: Record<string, string>;
  clientCreditSnapshots: Record<string, DeletedClientCreditSnapshot>;
  prospects: Prospect[];
  routes: Route[];
  active: ActiveRoute | null;
  history: HistoryEntry[];
  creditLedger: CreditMovement[];
  chains: CreditChain[];
  creditInvoices: CreditInvoice[];
  /** Prevents reprocessing old client debt adjustments when loading backups. */
  creditInitialDebtPriceMigration: number;
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
  clientNameSnapshots: {},
  clientCreditSnapshots: {},
  prospects: [],
  active: null,
  history: [],
  creditLedger: [],
  chains: [],
  creditInvoices: [],
  creditInitialDebtPriceMigration: 1,
  theme: "dark",
  adminPasswordHash: null,
  audit: [],
};

// Contraseña por defecto si el admin no ha configurado una propia.
// Cámbiala desde Ajustes → Contraseña de Administrador.
export const DEFAULT_ADMIN_PASSWORD = "Admin123";

let state: AppState = load();
const listeners = new Set<() => void>();

function compactVisitOrders(state: AppState): AppState {
  const byRoute = new Map<string, Client[]>();
  for (const c of state.clients.filter((client) => !client.archivedAt)) {
    const list = byRoute.get(c.routeId) ?? [];
    list.push(c);
    byRoute.set(c.routeId, list);
  }
  const updated = new Map<string, number>();
  for (const [routeId, clients] of byRoute) {
    const sorted = [...clients].sort((a, b) => a.visitOrder - b.visitOrder);
    sorted.forEach((c, i) => {
      if (c.visitOrder !== i + 1) {
        updated.set(c.id, i + 1);
      }
    });
  }
  if (updated.size === 0) return state;
  return {
    ...state,
    clients: state.clients.map((c) =>
      updated.has(c.id) ? { ...c, visitOrder: updated.get(c.id)! } : c,
    ),
  };
}

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
    const compacted = compactVisitOrders(migrated);
    if (compacted !== migrated) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(compacted));
    }
    return compacted;
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

function creditMovementsForSale(state: AppState, clientId: string, sale: ClientSale, saleRef: string): CreditMovement[] {
  if (!sale.completed) return [];
  const client = state.clients.find((item) => item.id === clientId);
  const date = new Date().toISOString();
  const amount = clientSaleAmount(sale, state.products);
  const pieces = clientNetUnits(sale);
  if (client?.creditType === "A") {
    const movements: CreditMovement[] = pieces !== 0 || amount !== 0 ? [{
      id: uid(), date, type: "venta", accountType: "client", accountId: clientId, pieces, amount, saleRef,
    }] : [];
    const payment = sale.previousCreditPayment;
    if (payment && (payment.pieces !== 0 || payment.amount !== 0)) {
      movements.push({
        id: uid(), date, type: "cobro", accountType: "client", accountId: clientId,
        pieces: -payment.pieces, amount: -payment.amount, saleRef,
      });
    }
    return movements;
  }
  if (client?.creditType === "B" && client.chainId) {
    if (pieces === 0 && amount === 0) return [];
    return [{
      id: uid(), date, type: "venta", accountType: "chain", accountId: client.chainId,
      branchId: clientId, pieces, amount, saleRef,
    }];
  }
  return [];
}

export const actions = {
  addCreditChain: (name: string) =>
    setState((s) => ({ ...s, chains: [...s.chains, { id: uid(), name: name.trim() }] })),
  updateCreditChain: (id: string, name: string) =>
    setState((s) => ({ ...s, chains: s.chains.map((chain) => chain.id === id ? { ...chain, name: name.trim() } : chain) })),
  removeCreditChain: (id: string) =>
    setState((s) => ({
      ...s,
      chains: s.chains.filter((chain) => chain.id !== id),
      clients: s.clients.map((client) => client.chainId === id ? { ...client, chainId: null } : client),
    })),
  adjustChainCreditBalance: (chainId: string, pieces: number, amount: number, note?: string) =>
    setState((s) => {
      if (pieces === 0 && amount === 0) return s;
      return {
        ...s,
        creditLedger: [...s.creditLedger, {
          id: uid(), date: new Date().toISOString(), type: "ajuste", accountType: "chain", accountId: chainId,
          pieces, amount, ...(note?.trim() ? { note: note.trim() } : {}),
        }],
      };
    }),
  createChainInvoice: (chainId: string, folio: string): CreditInvoice | null => {
    let created: CreditInvoice | null = null;
    setState((s) => {
      const openInvoice = s.creditInvoices.find((invoice) => {
        if (invoice.chainId !== chainId) return false;
        const balance = getCreditInvoiceBalance(invoice, s.creditLedger);
        return balance.pieces > 0 || balance.amount > 0;
      });
      if (openInvoice) return s;
      if (folio.trim() && s.creditInvoices.some((invoice) => invoice.chainId === chainId && invoice.folio.toLowerCase() === folio.trim().toLowerCase())) return s;
      const balance = getCreditBalance(s.creditLedger, "chain", chainId);
      if (balance.pieces <= 0 && balance.amount <= 0) return s;
      const date = new Date().toISOString();
      const sequence = s.creditInvoices.filter((invoice) => invoice.chainId === chainId).length + 1;
      const invoice: CreditInvoice = {
        id: uid(), chainId, folio: folio.trim() || `F-${date.slice(0, 10).replace(/-/g, "")}-${String(sequence).padStart(3, "0")}`,
        date, pieces: Math.max(0, balance.pieces), amount: Math.max(0, balance.amount),
        branchBreakdown: getChainBranchBalances(chainId, s.creditLedger, s.clients, s.clientNameSnapshots),
      };
      created = invoice;
      return {
        ...s,
        creditInvoices: [...s.creditInvoices, invoice],
        creditLedger: [...s.creditLedger, {
          id: uid(), date, type: "factura", accountType: "chain", accountId: chainId,
          pieces: invoice.pieces, amount: invoice.amount, invoiceId: invoice.id,
        }],
      };
    });
    return created;
  },
  registerChainPayment: (invoiceId: string, pieces: number, amount: number) =>
    setState((s) => {
      const invoice = s.creditInvoices.find((item) => item.id === invoiceId);
      if (!invoice) return s;
      const due = getCreditInvoiceBalance(invoice, s.creditLedger);
      const paidPieces = Math.min(Math.max(0, pieces), due.pieces);
      const paidAmount = Math.min(Math.max(0, amount), due.amount);
      if (paidPieces === 0 && paidAmount === 0) return s;
      const branchBalances = getInvoiceBranchBalances(invoice, s.creditLedger);
      const pieceAllocations = allocateInvoicePayment(paidPieces, branchBalances, "pieces");
      const amountAllocations = allocateInvoicePayment(paidAmount, branchBalances, "amount");
      const branchAllocations = branchBalances.map((branch) => ({
        branchId: branch.branchId,
        pieces: pieceAllocations.get(branchKey(branch.branchId)) ?? 0,
        amount: amountAllocations.get(branchKey(branch.branchId)) ?? 0,
      }));
      return {
        ...s,
        creditLedger: [...s.creditLedger, {
          id: uid(), date: new Date().toISOString(), type: "pago", accountType: "chain", accountId: invoice.chainId,
          pieces: -paidPieces, amount: -paidAmount, invoiceId, branchAllocations,
        }],
      };
    }),
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

  addClient: (c: Omit<Client, "id">, options?: { activeRoutePosition?: number }) =>
    setState((s) => {
      const sameRoute = s.clients.filter((x) => !x.archivedAt && x.routeId === c.routeId);
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
      const id = uid();
      const client = { id, ...c, creditType: c.creditType ?? "ninguno" as CreditType, visitOrder: insertAt };
      let active = s.active;
      if (active && options?.activeRoutePosition != null) {
        const selectedIds = active.clientIds?.filter((clientId) => s.clients.some((existing) => existing.id === clientId && !existing.archivedAt)) ?? [];
        const selectedSet = new Set(selectedIds);
        const additionalRouteIds = active.temporary
          ? []
          : s.clients
              .filter((existing) => !existing.archivedAt && existing.routeId === active!.routeId && !selectedSet.has(existing.id))
              .sort((a, b) => a.visitOrder - b.visitOrder)
              .map((existing) => existing.id);
        const currentIds = [...selectedIds, ...additionalRouteIds];
        const insertPosition = Math.max(1, Math.min(Math.floor(options.activeRoutePosition) || 1, currentIds.length + 1));
        currentIds.splice(insertPosition - 1, 0, id);
        active = { ...active, clientIds: currentIds };
      }
      return {
        ...s,
        clients: [...shifted, client],
        active,
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
    stops: { id?: string; name: string; lat: number; lng: number; address?: string; visitOrder?: number }[],
  ): { matched: number; missed: string[] } => {
    let matched = 0;
    const missed: string[] = [];
    const normalize = (v: string) =>
      v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
    setState((s_initial) => {
      let s = { ...s_initial, clients: [...s_initial.clients] };
      const byId = new Map(s.clients.map((c) => [c.id, c]));
      const byName = new Map<string, Client>();
      for (const c of s.clients) byName.set(normalize(c.name), c);
      const updates = new Map<string, Partial<Client>>();
      for (const stop of stops) {
        let target: Client | undefined;
        if (stop.id && byId.has(stop.id)) target = byId.get(stop.id);
        if (!target) target = byName.get(normalize(stop.name));
        if (!target) {
          // Client not found — create it from the GPX stop data
          // Use visitOrder from GPX if available, otherwise append at end
          const routeId = s.routes[0]?.id ?? "";
          if (!routeId) {
            missed.push(stop.name);
            continue;
          }
          const sameRoute = s.clients.filter((c) => c.routeId === routeId);
          const newOrder = stop.visitOrder ?? (sameRoute.length + 1 + matched);
          const newClient: Client = {
            id: uid(),
            name: stop.name,
            address: stop.address ?? "",
            lat: stop.lat,
            lng: stop.lng,
            routeId,
            visitOrder: newOrder,
            active: true,
          };
          // Add to clients array directly in this setState
          s = { ...s, clients: [...s.clients, newClient] };
          matched += 1;
          continue;
        }
        matched += 1;
        updates.set(target.id, {
          lat: stop.lat,
          lng: stop.lng,
          ...(stop.visitOrder !== undefined ? { visitOrder: stop.visitOrder } : {}),
          ...(stop.address && !target.address ? { address: stop.address } : {}),
        });
      }
      const updatedClients = s.clients.map((c) => (updates.has(c.id) ? { ...c, ...updates.get(c.id)! } : c));
      // Sort clients by routeId and then by visitOrder to ensure correct rendering
      updatedClients.sort((a, b) => {
        if (a.routeId !== b.routeId) return a.routeId.localeCompare(b.routeId);
        return (a.visitOrder || 999) - (b.visitOrder || 999);
      });
      return {
        ...s,
        clients: updatedClients,
      };
    });
    return { matched, missed };
  },
  removeClient: (id: string) =>
    setState((s) => {
      const now = new Date().toISOString();
      const archived = {
        ...s,
        clients: s.clients.map((c) => c.id === id ? { ...c, archivedAt: now, active: false } : c),
        active: s.active?.clientIds ? { ...s.active, clientIds: s.active.clientIds.filter((clientId) => clientId !== id) } : s.active,
      };
      return compactVisitOrders(archived);
    }),
  restoreClient: (id: string, routeId: string) =>
    setState((s) => {
      const target = s.clients.find((client) => client.id === id && client.archivedAt);
      if (!target) return s;
      const { archivedAt: _archivedAt, ...restored } = target;
      void _archivedAt;
      const sameRoute = s.clients.filter((client) => !client.archivedAt && client.routeId === routeId);
      const clients = s.clients.map((client) => client.id === id
        ? { ...restored, routeId, active: true, visitOrder: sameRoute.length + 1 }
        : client);
      return { ...s, clients };
    }),
  permanentlyDeleteArchivedClient: (id: string) =>
    setState((s) => {
      const target = s.clients.find((client) => client.id === id && client.archivedAt);
      if (!target) return s;
      return {
        ...s,
        clients: s.clients.filter((client) => client.id !== id),
        clientNameSnapshots: { ...s.clientNameSnapshots, [id]: target.name },
        clientCreditSnapshots: {
          ...s.clientCreditSnapshots,
          [id]: { creditType: target.creditType ?? "ninguno", ...(target.credit ? { credit: true } : {}) },
        },
      };
    }),
  addProspect: (input: Omit<Prospect, "id" | "createdAt" | "visits"> & { result: ProspectResult; note?: string }) =>
    setState((s) => ({
      ...s,
      prospects: [...s.prospects, {
        id: uid(),
        name: input.name.trim(),
        ...(input.address ? { address: input.address.trim() } : {}),
        ...(input.lat != null ? { lat: input.lat } : {}),
        ...(input.lng != null ? { lng: input.lng } : {}),
        createdAt: new Date().toISOString(),
        visits: [{ id: uid(), date: new Date().toISOString(), result: input.result, ...(input.note?.trim() ? { note: input.note.trim() } : {}) }],
      }],
    })),
  addProspectVisit: (id: string, result: ProspectResult, note?: string) =>
    setState((s) => ({
      ...s,
      prospects: s.prospects.map((prospect) => prospect.id === id
        ? { ...prospect, visits: [...prospect.visits, { id: uid(), date: new Date().toISOString(), result, ...(note?.trim() ? { note: note.trim() } : {}) }] }
        : prospect),
    })),
  convertProspectToClient: (id: string, routeId: string) =>
    setState((s) => {
      const prospect = s.prospects.find((item) => item.id === id);
      if (!prospect || prospect.convertedClientId) return s;
      const sameRoute = s.clients.filter((client) => !client.archivedAt && client.routeId === routeId);
      const client: Client = {
        id: uid(), name: prospect.name, address: prospect.address ?? "", routeId,
        visitOrder: sameRoute.length + 1, active: true,
        ...(prospect.lat != null ? { lat: prospect.lat } : {}),
        ...(prospect.lng != null ? { lng: prospect.lng } : {}),
      };
      return {
        ...s,
        clients: [...s.clients, client],
        prospects: s.prospects.map((item) => item.id === id ? { ...item, convertedClientId: client.id } : item),
      };
    }),
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
      const saleRef = `${s.active.routeId}:${s.active.date}:${clientId}`;
      const creditLedger = s.creditLedger.filter((movement) => movement.saleRef !== saleRef);
      creditLedger.push(...creditMovementsForSale(s, clientId, sale, saleRef));
      return {
        ...s,
        creditLedger,
        active: { ...s.active, sales: { ...s.active.sales, [clientId]: sale } },
      };
    }),

  adjustClientCreditBalance: (clientId: string, pieces: number, amount: number, note?: string) =>
    setState((s) => {
      if (pieces === 0 && amount === 0) return s;
      return {
        ...s,
        creditLedger: [
          ...s.creditLedger,
          {
            id: uid(),
            date: new Date().toISOString(),
            type: "ajuste",
            accountType: "client",
            accountId: clientId,
            pieces,
            amount,
            ...(note?.trim() ? { note: note.trim() } : {}),
          },
        ],
      };
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
      const entry = s.history.find((h) => h.endedAt === endedAt);
      let creditLedger = s.creditLedger;
      if (entry && patch.sales) {
        const previousSales = entry.sales ?? {};
        const nextSales = patch.sales;
        const changedIds = Array.from(new Set([...Object.keys(previousSales), ...Object.keys(nextSales)]))
          .filter((clientId) => JSON.stringify(previousSales[clientId]) !== JSON.stringify(nextSales[clientId]));
        const changedRefs = new Set(changedIds.map((clientId) => `${entry.routeId}:${entry.date}:${clientId}`));
        creditLedger = creditLedger.filter((movement) => !movement.saleRef || !changedRefs.has(movement.saleRef));
        for (const clientId of changedIds) {
          const sale = nextSales[clientId];
          if (!sale) continue;
          const saleRef = `${entry.routeId}:${entry.date}:${clientId}`;
          creditLedger.push(...creditMovementsForSale(s, clientId, sale, saleRef));
        }
      }
      const audit: AuditEntry = {
        id: uid(),
        at: new Date().toISOString(),
        action: "edit_history",
        target: endedAt,
        details: patch.label ? `Etiqueta: ${patch.label}` : undefined,
      };
      return {
        ...s,
        creditLedger,
        history: s.history.map((h) => (h.endedAt === endedAt ? { ...h, ...patch } : h)),
        audit: [audit, ...s.audit].slice(0, 200),
      };
    }),
};

// Migración de respaldos exportados con esquemas antiguos.
function migrateImported(raw: any): any {
  const out: any = { ...raw };
  out.clientNameSnapshots = raw.clientNameSnapshots && typeof raw.clientNameSnapshots === "object" && !Array.isArray(raw.clientNameSnapshots)
    ? Object.fromEntries(Object.entries(raw.clientNameSnapshots).map(([id, name]) => [String(id), String(name)]))
    : {};
  out.clientCreditSnapshots = raw.clientCreditSnapshots && typeof raw.clientCreditSnapshots === "object" && !Array.isArray(raw.clientCreditSnapshots)
    ? Object.fromEntries(Object.entries(raw.clientCreditSnapshots).map(([id, snapshot]: [string, any]) => [id, {
        creditType: snapshot?.creditType === "A" || snapshot?.creditType === "B" ? snapshot.creditType : "ninguno",
        ...(snapshot?.credit ? { credit: true } : {}),
      }]))
    : {};
  out.prospects = Array.isArray(raw.prospects) ? raw.prospects.filter((prospect: any) => prospect && typeof prospect === "object").map((prospect: any) => ({
    ...prospect,
    id: String(prospect.id ?? uid()),
    name: String(prospect.name ?? "Prospecto"),
    createdAt: String(prospect.createdAt ?? new Date(0).toISOString()),
    visits: Array.isArray(prospect.visits) ? prospect.visits.filter((visit: any) => visit && typeof visit === "object").map((visit: any) => ({
      ...visit,
      id: String(visit.id ?? uid()),
      date: String(visit.date ?? prospect.createdAt ?? new Date(0).toISOString()),
      result: visit.result === "volver-despues" || visit.result === "interesado" ? visit.result : "no-quiso",
    })) : [],
  })) : [];

  out.chains = Array.isArray(raw.chains)
    ? raw.chains.filter((chain: any) => chain && typeof chain === "object").map((chain: any) => ({
        ...chain,
        id: String(chain.id ?? uid()),
        name: String(chain.name ?? "Cadena sin nombre"),
      }))
    : [];
  const chainIds = new Set<string>(out.chains.map((chain: CreditChain) => chain.id));
  out.creditInvoices = Array.isArray(raw.creditInvoices)
    ? raw.creditInvoices.filter((invoice: any) => invoice && typeof invoice === "object").map((invoice: any) => ({
        ...invoice,
        id: String(invoice.id ?? uid()),
        chainId: String(invoice.chainId ?? ""),
        folio: String(invoice.folio ?? ""),
        date: String(invoice.date ?? new Date(0).toISOString()),
        pieces: Number.isFinite(Number(invoice.pieces)) ? Number(invoice.pieces) : 0,
        amount: Number.isFinite(Number(invoice.amount)) ? Number(invoice.amount) : 0,
        branchBreakdown: Array.isArray(invoice.branchBreakdown) ? invoice.branchBreakdown.map((branch: any) => ({
          branchId: typeof branch.branchId === "string" ? branch.branchId : null,
          name: String(branch.name ?? "Sucursal"),
          pieces: Number.isFinite(Number(branch.pieces)) ? Number(branch.pieces) : 0,
          amount: Number.isFinite(Number(branch.amount)) ? Number(branch.amount) : 0,
        })) : [],
      }))
    : [];

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
        // La marca histórica `credit` es solo una etiqueta y no asigna un tipo.
        creditType: c.creditType === "A" || c.creditType === "B" ? c.creditType : "ninguno",
        chainId: c.chainId && chainIds.has(c.chainId) ? c.chainId : undefined,
        address: c.address ?? c.direccion ?? c.direction ?? c.location?.address ?? c.ubicacion ?? "",
        ...(lat == null ? {} : { lat }),
        ...(lng == null ? {} : { lng }),
        visitOrder: c.visitOrder ?? c.order ?? c.orden ?? 0,
      };
    });
  }

  // Backups anteriores no incluyen ledger; mantenerlos válidos con uno vacío.
  let normalizedLedger: CreditMovement[] = Array.isArray(raw.creditLedger)
    ? raw.creditLedger
        .filter((m: any) => m && typeof m === "object")
        .map((m: any) => ({
          ...m,
          id: String(m.id ?? uid()),
          date: String(m.date ?? new Date(0).toISOString()),
          type: ["venta", "cobro", "ajuste", "factura", "pago"].includes(m.type) ? m.type : "ajuste",
          accountType: m.accountType === "chain" ? "chain" : "client",
          accountId: String(m.accountId ?? ""),
          ...(typeof m.branchId === "string" ? { branchId: m.branchId } : {}),
          ...(typeof m.invoiceId === "string" ? { invoiceId: m.invoiceId } : {}),
          ...(Array.isArray(m.branchAllocations) ? { branchAllocations: m.branchAllocations.map((item: any) => ({
            branchId: typeof item.branchId === "string" ? item.branchId : null,
            pieces: Number.isFinite(Number(item.pieces)) ? Number(item.pieces) : 0,
            amount: Number.isFinite(Number(item.amount)) ? Number(item.amount) : 0,
          })) } : {}),
          pieces: Number.isFinite(Number(m.pieces)) ? Number(m.pieces) : 0,
          amount: Number.isFinite(Number(m.amount)) ? Number(m.amount) : 0,
          ...(typeof m.saleRef === "string" ? { saleRef: m.saleRef } : {}),
        }))
    : [];
  if (raw.creditInitialDebtPriceMigration !== 1) {
    normalizedLedger = normalizedLedger.map((movement) => {
      if (
        movement.accountType !== "client" || movement.type !== "ajuste" ||
        movement.pieces <= 0 || movement.amount !== 0
      ) return movement;
      const client = out.clients?.find((item: Client) => item.id === movement.accountId);
      if (client?.creditType !== "A") return movement;
      const note = movement.note ?? "";
      const normalizedNote = note.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      const notedProduct = out.products?.find((product: Product) =>
        normalizedNote.includes(product.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()),
      );
      const enabledProducts = productsForClient(out.products ?? [], out.groups ?? [], client);
      const product = notedProduct ?? enabledProducts[0] ?? out.products?.[0];
      if (!product) return movement;
      const unitPrice = getEffectivePrices(client, [product])[product.id] ?? product.price;
      const amount = Math.round(movement.pieces * unitPrice * 100) / 100;
      if (amount <= 0) return movement;
      return {
        ...movement,
        amount,
        note: note ? `${note} · monto calculado al cargar la app` : `Saldo anterior recalculado: ${product.name} a $${unitPrice.toFixed(2)} por pieza`,
      };
    });
  }
  out.creditInitialDebtPriceMigration = 1;
  const seenMovementKeys = new Set<string>();
  out.creditLedger = normalizedLedger.reverse().filter((movement) => {
    const key = movement.saleRef && (movement.type === "venta" || movement.type === "cobro")
      ? `sale:${movement.saleRef}:${movement.type}`
      : `id:${movement.id}`;
    if (seenMovementKeys.has(key)) return false;
    seenMovementKeys.add(key);
    return true;
  }).reverse();

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
    obsequios: numberRecord(v?.obsequios ?? v?.gifts),
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
  return Math.max(0, (sale?.surtido?.[productId] ?? 0) - (sale?.obsequios?.[productId] ?? 0));
}

// Total neto de piezas vendidas al cliente (todos los sabores): surtido total − devoluciones totales.
export function clientNetUnits(sale: ClientSale): number {
  if (!sale) return 0;
  const surt = Object.entries(sale.surtido ?? {}).reduce((a, [id, qty]) => a + Math.max(0, (qty ?? 0) - (sale.obsequios?.[id] ?? 0)), 0);
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
    const s = Math.max(0, (surtido[p.id] ?? 0) - (sale.obsequios?.[p.id] ?? 0));
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

/** Suma los cambios firmados del ledger para una cuenta específica. */
export function getCreditBalance(
  ledger: CreditMovement[],
  accountType: CreditAccountType,
  accountId: string,
): { pieces: number; amount: number } {
  return ledger.reduce(
    (balance, movement) => {
      if (movement.accountType !== accountType || movement.accountId !== accountId) return balance;
      if (movement.type === "factura") return balance;
      return {
        pieces: balance.pieces + movement.pieces,
        amount: balance.amount + movement.amount,
      };
    },
    { pieces: 0, amount: 0 },
  );
}

export function getSaleCreditCollection(ledger: CreditMovement[], saleRef: string): number {
  return ledger.reduce((total, movement) =>
    movement.accountType === "client" && movement.type === "cobro" && movement.saleRef === saleRef
      ? total - movement.amount
      : total, 0);
}

export function getRouteCashCreditSummary(
  target: ActiveRoute,
  clients: Client[],
  products: Product[],
  ledger: CreditMovement[],
  completedOnly = false,
  deletedClientCreditSnapshots: Record<string, DeletedClientCreditSnapshot> = {},
): { collected: number; creditPlaced: number } {
  const clientById = new Map(clients.map((client) => [client.id, client]));
  let collected = 0;
  let creditPlaced = 0;
  for (const [clientId, sale] of Object.entries(target.sales ?? {})) {
    if (completedOnly && !sale?.completed) continue;
    const amount = clientSaleAmount(sale, products);
    const client = clientById.get(clientId);
    const creditType = client?.creditType ?? deletedClientCreditSnapshots[clientId]?.creditType ?? "ninguno";
    const legacyCredit = client?.credit ?? deletedClientCreditSnapshots[clientId]?.credit;
    if (creditType === "A") {
      if (!sale?.completed) continue;
      creditPlaced += amount;
      collected += getSaleCreditCollection(ledger, `${target.routeId}:${target.date}:${clientId}`);
    } else if (creditType === "B") {
      if (sale?.completed) creditPlaced += amount;
    } else if (sale?.paymentType === "credit" || legacyCredit) {
      creditPlaced += amount;
    } else {
      collected += amount;
    }
  }
  return { collected, creditPlaced };
}

function branchKey(branchId: string | null): string {
  return branchId ?? "__adjustment__";
}

/** Saldo actual de la cadena desglosado por sucursal y ajustes sin sucursal. */
export function getChainBranchBalances(
  chainId: string,
  ledger: CreditMovement[],
  clients: Client[] = [],
  clientNameSnapshots: Record<string, string> = {},
): CreditBranchBalance[] {
  const balances = new Map<string, CreditBranchBalance>();
  const get = (branchId: string | null) => {
    const key = branchKey(branchId);
    let current = balances.get(key);
    if (!current) {
      current = {
        branchId,
        name: branchId ? clients.find((client) => client.id === branchId)?.name ?? clientNameSnapshots[branchId] ?? "Sucursal eliminada" : "Saldo inicial / ajustes",
        pieces: 0,
        amount: 0,
      };
      balances.set(key, current);
    }
    return current;
  };

  for (const movement of ledger) {
    if (movement.accountType !== "chain" || movement.accountId !== chainId) continue;
    if (movement.type === "venta" || movement.type === "ajuste") {
      const current = get(movement.branchId ?? null);
      current.pieces += movement.pieces;
      current.amount += movement.amount;
    }
    if (movement.type === "pago") {
      for (const allocation of movement.branchAllocations ?? []) {
        const current = get(allocation.branchId);
        current.pieces -= allocation.pieces;
        current.amount -= allocation.amount;
      }
    }
  }
  return Array.from(balances.values()).filter((balance) => balance.pieces !== 0 || balance.amount !== 0);
}

export function getCreditInvoiceBalance(invoice: CreditInvoice, ledger: CreditMovement[]): { pieces: number; amount: number } {
  const payments = ledger.filter((movement) => movement.type === "pago" && movement.invoiceId === invoice.id);
  return {
    pieces: Math.max(0, invoice.pieces + payments.reduce((sum, movement) => sum + movement.pieces, 0)),
    amount: Math.max(0, invoice.amount + payments.reduce((sum, movement) => sum + movement.amount, 0)),
  };
}

export function getInvoiceBranchBalances(invoice: CreditInvoice, ledger: CreditMovement[]): CreditBranchBalance[] {
  const balances = new Map(invoice.branchBreakdown.map((branch) => [branchKey(branch.branchId), { ...branch }]));
  for (const movement of ledger) {
    if (movement.type !== "pago" || movement.invoiceId !== invoice.id) continue;
    for (const allocation of movement.branchAllocations ?? []) {
      const key = branchKey(allocation.branchId);
      const balance = balances.get(key);
      if (!balance) continue;
      balance.pieces = Math.max(0, balance.pieces - allocation.pieces);
      balance.amount = Math.max(0, balance.amount - allocation.amount);
    }
  }
  return Array.from(balances.values()).filter((balance) => balance.pieces > 0 || balance.amount > 0);
}

function allocateInvoicePayment(
  total: number,
  branches: CreditBranchBalance[],
  field: "pieces" | "amount",
): Map<string, number> {
  const candidates = branches.filter((branch) => branch[field] > 0);
  const available = candidates.reduce((sum, branch) => sum + branch[field], 0);
  const allocations = new Map<string, number>();
  let remaining = total;
  candidates.forEach((branch, index) => {
    const raw = index === candidates.length - 1
      ? remaining
      : total * branch[field] / available;
    const value = field === "pieces" ? Math.round(raw) : Math.round(raw * 100) / 100;
    const assigned = Math.min(remaining, branch[field], value);
    allocations.set(branchKey(branch.branchId), assigned);
    remaining = field === "pieces" ? remaining - assigned : Math.round((remaining - assigned) * 100) / 100;
  });
  return allocations;
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

