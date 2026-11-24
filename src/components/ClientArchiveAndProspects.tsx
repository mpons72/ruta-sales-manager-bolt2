import { useState } from "react";
import { actions, useStore, type Client, type Prospect, type ProspectResult, type Route as AppRoute } from "@/lib/store";
import { captureLocation } from "@/lib/geo";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Archive, History, Loader2, MapPin, Plus, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AdminPasswordPrompt } from "@/components/AdminPasswordPrompt";

export function ArchivedClientsTab() {
  const clients = useStore((s) => s.clients);
  const routes = useStore((s) => s.routes);
  const archived = clients.filter((client) => !!client.archivedAt).sort((a, b) => (b.archivedAt ?? "").localeCompare(a.archivedAt ?? ""));
  return (
    <Card className="p-5">
      <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold"><Archive className="h-5 w-5 text-primary" /> Clientes archivados</h2>
      <p className="mb-4 text-sm text-muted-foreground">Ya no aparecen en las rutas. Sus ventas, créditos e historial se conservan.</p>
      {archived.length === 0 ? <p className="rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground">No hay clientes archivados.</p> : (
        <div className="space-y-2">{archived.map((client) => <ArchivedClientRow key={client.id} client={client} routes={routes} />)}</div>
      )}
    </Card>
  );
}

function ArchivedClientRow({ client, routes }: { client: Client; routes: AppRoute[] }) {
  const [routeId, setRouteId] = useState(routes[0]?.id ?? "");
  const [deletePasswordOpen, setDeletePasswordOpen] = useState(false);
  return (
    <div className="grid gap-2 rounded-lg border bg-card p-3 sm:grid-cols-[1fr_12rem_auto_auto] sm:items-center">
      <div className="min-w-0"><p className="truncate font-semibold">{client.name}</p><p className="text-xs text-muted-foreground">Archivado el {new Date(client.archivedAt!).toLocaleDateString("es-MX")}{client.address ? ` · ${client.address}` : ""}</p></div>
      <Select value={routeId} onValueChange={setRouteId}><SelectTrigger><SelectValue placeholder="Elegir ruta" /></SelectTrigger><SelectContent>{routes.map((route) => <SelectItem key={route.id} value={route.id}>{route.name}</SelectItem>)}</SelectContent></Select>
      <Button disabled={!routeId} onClick={() => {
        if (!confirm(`¿Reactivar a “${client.name}” en la ruta seleccionada? Se conservará su historial.`)) return;
        actions.restoreClient(client.id, routeId);
        toast.success("Cliente reactivado y agregado a la ruta");
      }}><RotateCcw className="mr-2 h-4 w-4" /> Reactivar</Button>
      <Button variant="destructive" onClick={() => setDeletePasswordOpen(true)}><Trash2 className="mr-2 h-4 w-4" /> Eliminar</Button>
      <AdminPasswordPrompt
        open={deletePasswordOpen}
        title="Eliminar cliente archivado"
        description={`Esta eliminación es permanente para “${client.name}”. Sus ventas anteriores conservarán el nombre en los historiales.`}
        onConfirm={() => {
          actions.permanentlyDeleteArchivedClient(client.id);
          toast.success("Cliente eliminado permanentemente; sus historiales se conservaron");
        }}
        onClose={() => setDeletePasswordOpen(false)}
      />
    </div>
  );
}

export function ProspectsTab() {
  const prospects = useStore((s) => s.prospects);
  const routes = useStore((s) => s.routes);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [result, setResult] = useState<ProspectResult>("no-quiso");
  const [note, setNote] = useState("");
  const [capturing, setCapturing] = useState(false);
  const capture = async () => {
    setCapturing(true);
    try {
      const location = await captureLocation();
      setAddress(location.address);
      setCoords({ lat: location.lat, lng: location.lng });
      toast.success("Ubicación del prospecto guardada");
    } catch (error) { toast.error((error as Error).message); }
    finally { setCapturing(false); }
  };
  const registerVisit = () => {
    if (!name.trim()) { toast.error("Escribe el nombre del prospecto"); return; }
    actions.addProspect({ name, address, ...(coords ?? {}), result, note });
    setName(""); setAddress(""); setCoords(null); setResult("no-quiso"); setNote("");
    toast.success("Visita de prospección guardada");
  };
  const sorted = prospects.slice().sort((a, b) => (b.visits.at(-1)?.date ?? b.createdAt).localeCompare(a.visits.at(-1)?.date ?? a.createdAt));
  return (
    <Card className="p-5">
      <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold"><History className="h-5 w-5 text-primary" /> Registro de prospección</h2>
      <p className="mb-4 text-sm text-muted-foreground">Guarda lugares visitados aunque todavía no sean clientes. No aparecerán en la ruta del día.</p>
      <div className="grid gap-2 md:grid-cols-[1fr_1.4fr_auto]">
        <Input placeholder="Nombre del negocio o persona" value={name} onChange={(event) => setName(event.target.value)} />
        <Input placeholder="Dirección o referencia" value={address} onChange={(event) => { setAddress(event.target.value); setCoords(null); }} />
        <Button type="button" variant="outline" onClick={capture} disabled={capturing}>{capturing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MapPin className="mr-2 h-4 w-4" />} Guardar GPS</Button>
      </div>
      <div className="mt-2 grid gap-2 md:grid-cols-[12rem_1fr_auto]">
        <Select value={result} onValueChange={(value) => setResult(value as ProspectResult)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="no-quiso">No quiso</SelectItem><SelectItem value="volver-despues">Volver después</SelectItem><SelectItem value="interesado">Interesado</SelectItem></SelectContent></Select>
        <Input placeholder="Nota opcional: motivo, persona que atendió…" value={note} onChange={(event) => setNote(event.target.value)} />
        <Button onClick={registerVisit}><Plus className="mr-2 h-4 w-4" /> Registrar visita</Button>
      </div>
      {coords && <p className="mt-2 text-xs text-muted-foreground">GPS guardado: {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}</p>}
      <div className="mt-5 space-y-2">{sorted.length === 0 ? <p className="rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground">Todavía no hay prospectos registrados.</p> : sorted.map((prospect) => <ProspectRow key={prospect.id} prospect={prospect} routes={routes} />)}</div>
    </Card>
  );
}

function ProspectRow({ prospect, routes }: { prospect: Prospect; routes: AppRoute[] }) {
  const [routeId, setRouteId] = useState(routes[0]?.id ?? "");
  const [result, setResult] = useState<ProspectResult>("no-quiso");
  const [note, setNote] = useState("");
  const label = (value: ProspectResult) => value === "no-quiso" ? "No quiso" : value === "volver-despues" ? "Volver después" : "Interesado";
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-semibold">{prospect.name}{prospect.convertedClientId ? <span className="ml-2 text-xs text-emerald-600">Convertido a cliente</span> : null}</p><p className="text-xs text-muted-foreground">{prospect.address || "Sin dirección"} · {prospect.lat != null ? "Ubicación GPS guardada" : "Sin GPS"}</p></div><span className="rounded-full bg-amber-500/10 px-2 py-1 text-xs font-medium">{prospect.visits.length} {prospect.visits.length === 1 ? "visita" : "visitas"}</span></div>
      <div className="mt-2 space-y-1 text-xs text-muted-foreground">{prospect.visits.map((visit) => <p key={visit.id}>{new Date(visit.date).toLocaleDateString("es-MX")} · <strong>{label(visit.result)}</strong>{visit.note ? ` · ${visit.note}` : ""}</p>)}</div>
      {!prospect.convertedClientId && <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1.2fr_10rem_auto_auto]">
        <Select value={result} onValueChange={(value) => setResult(value as ProspectResult)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="no-quiso">No quiso</SelectItem><SelectItem value="volver-despues">Volver después</SelectItem><SelectItem value="interesado">Interesado</SelectItem></SelectContent></Select>
        <Input placeholder="Nota de esta visita" value={note} onChange={(event) => setNote(event.target.value)} />
        <Select value={routeId} onValueChange={setRouteId}><SelectTrigger><SelectValue placeholder="Ruta" /></SelectTrigger><SelectContent>{routes.map((route) => <SelectItem key={route.id} value={route.id}>{route.name}</SelectItem>)}</SelectContent></Select>
        <Button variant="outline" onClick={() => { actions.addProspectVisit(prospect.id, result, note); setNote(""); toast.success("Nueva visita guardada"); }}>Registrar visita</Button>
        <Button disabled={!routeId} onClick={() => { actions.convertProspectToClient(prospect.id, routeId); toast.success("Prospecto convertido en cliente; se conserva el antecedente"); }}>Convertir en cliente</Button>
      </div>}
      {prospect.visits.at(-1)?.result === "no-quiso" && <p className="mt-2 text-xs font-medium text-amber-700 dark:text-amber-300">Antecedente: en la última visita no quiso el producto.</p>}
    </div>
  );
}
