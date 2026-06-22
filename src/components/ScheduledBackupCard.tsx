import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { backupFilename } from "@/lib/backup";
import BackupScheduler from "@/lib/BackupSchedulerPlugin";
import { actions } from "@/lib/store";
import { toast } from "sonner";
import { CalendarClock, FolderCheck, FolderPlus, Bell, Play, ShieldAlert, Cloud, ChevronRight } from "lucide-react";
import { 
  requestNotificationPermission, 
  requestStoragePermission, 
  checkAllPermissions,
  scheduleBackupNotification 
} from "@/lib/permissions";
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';

type Frequency = "daily" | "weekly";
type Schedule = {
  enabled: boolean;
  frequency: Frequency;
  dayOfWeek: number; // 0 (dom) – 6 (sáb), aplica para weekly
  time: string; // "HH:MM"
  lastRunAt: string | null;
  cloudBackup: boolean;
  cloudProvider: "none" | "google-drive" | "dropbox" | "onedrive";
};

const KEY = "backup-schedule-v2";
const DAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

const defaults: Schedule = {
  enabled: false,
  frequency: "daily",
  dayOfWeek: 1,
  time: "20:00",
  lastRunAt: null,
  cloudBackup: false,
  cloudProvider: "none",
};

function loadCfg(): Schedule {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    // Migración de v1 a v2
    if (!parsed.cloudBackup) {
      parsed.cloudBackup = false;
      parsed.cloudProvider = "none";
    }
    return { ...defaults, ...parsed };
  } catch {
    return defaults;
  }
}
function saveCfg(c: Schedule) {
  localStorage.setItem(KEY, JSON.stringify(c));
}

// IndexedDB mínimo para guardar el FileSystemDirectoryHandle
const IDB_NAME = "backup-fs";
const IDB_STORE = "handles";
function openIdb(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(IDB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(IDB_STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function idbGet<T = unknown>(key: string): Promise<T | undefined> {
  const db = await openIdb();
  return new Promise((res, rej) => {
    const tx = db.transaction(IDB_STORE, "readonly");
    const r = tx.objectStore(IDB_STORE).get(key);
    r.onsuccess = () => res(r.result as T | undefined);
    r.onerror = () => rej(r.error);
  });
}
async function idbSet(key: string, val: unknown): Promise<void> {
  const db = await openIdb();
  return new Promise((res, rej) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put(val, key);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}

type DirHandle = FileSystemDirectoryHandle & {
  queryPermission?: (o: { mode: "read" | "readwrite" }) => Promise<PermissionState>;
  requestPermission?: (o: { mode: "read" | "readwrite" }) => Promise<PermissionState>;
};

async function ensureRwPermission(h: DirHandle): Promise<boolean> {
  if (!h.queryPermission) return true;
  const q = await h.queryPermission({ mode: "readwrite" });
  if (q === "granted") return true;
  if (!h.requestPermission) return false;
  const r = await h.requestPermission({ mode: "readwrite" });
  return r === "granted";
}

function nextRunDate(cfg: Schedule, from = new Date()): Date {
  const [hh, mm] = cfg.time.split(":").map((n) => parseInt(n, 10) || 0);
  const d = new Date(from);
  d.setSeconds(0, 0);
  d.setHours(hh, mm, 0, 0);
  if (cfg.frequency === "daily") {
    if (d <= from) d.setDate(d.getDate() + 1);
    return d;
  }
  // weekly
  const diff = (cfg.dayOfWeek - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + diff);
  if (d <= from) d.setDate(d.getDate() + 7);
  return d;
}

function isDue(cfg: Schedule, now = new Date()): boolean {
  if (!cfg.enabled) return false;
  const [hh, mm] = cfg.time.split(":").map((n) => parseInt(n, 10) || 0);
  const target = new Date(now);
  target.setHours(hh, mm, 0, 0);
  if (cfg.frequency === "weekly" && now.getDay() !== cfg.dayOfWeek) return false;
  if (now < target) return false;
  if (!cfg.lastRunAt) return true;
  const last = new Date(cfg.lastRunAt);
  const sameDay =
    last.getFullYear() === now.getFullYear() &&
    last.getMonth() === now.getMonth() &&
    last.getDate() === now.getDate();
  return !sameDay;
}

async function performBackup(silent = false): Promise<boolean> {
  const json = actions.exportData();
  const filename = backupFilename();

  if (Capacitor.isNativePlatform()) {
    try {
      await BackupScheduler.runBackupNow({ data: json });
      if (!silent) toast.success(`Respaldo guardado en Documentos: ${filename}`);
      return true;
    } catch (error) {
      console.error("Error en backup nativo:", error);
      if (!silent) toast.error("Error al guardar respaldo: " + (error as Error).message);
      return false;
    }
  }

  try {
    const handle = (await idbGet<DirHandle>("dir")) ?? null;
    if (handle) {
      const ok = await ensureRwPermission(handle);
      if (ok) {
        const file = await handle.getFileHandle(filename, { create: true });
        const w = await file.createWritable();
        await w.write(new Blob([json], { type: "application/json" }));
        await w.close();
        if (!silent) toast.success(`Respaldo guardado: ${filename}`);
        return true;
      }
    }
  } catch (e) {
    console.warn("FSA backup falló, usando descarga", e);
  }

  try {
    const dataUrl = "data:application/json;charset=utf-8," + encodeURIComponent(json);
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    if (!silent) toast.success(`Respaldo generado: ${filename}`);
    return true;
  } catch (e) {
    if (!silent) toast.error("No se pudo generar respaldo");
    return false;
  }
}

export function ScheduledBackupCard() {
  const [cfg, setCfg] = useState<Schedule>(() => (typeof window === "undefined" ? defaults : loadCfg()));
  const [hasDir, setHasDir] = useState(false);
  const [permissions, setPermissions] = useState({ notifications: false, storage: false });
  const [requestingPerms, setRequestingPerms] = useState(false);
  const cfgRef = useRef(cfg);
  cfgRef.current = cfg;

  useEffect(() => {
    // Cargar permisos al inicio
    checkAllPermissions().then(setPermissions);
    
    // Cargar estado de carpeta en web
    if (!Capacitor.isNativePlatform()) {
      idbGet<DirHandle>("dir").then((h) => setHasDir(!!h)).catch(() => {});
    } else {
      // En nativo, asumimos que tenemos acceso al directorio de documentos
      setHasDir(true);
    }
  }, []);

  const update = (patch: Partial<Schedule>) => {
    const next = { ...cfgRef.current, ...patch };
    cfgRef.current = next;
    setCfg(next);
    saveCfg(next);
  };

  useEffect(() => {
    if (!cfg.enabled) return;

    const scheduleNativeBackup = async () => {
      if (!Capacitor.isNativePlatform()) return;
      const json = actions.exportData();
      const intervalHours = cfg.frequency === "daily" ? 24 : 168;
      try {
        await BackupScheduler.scheduleBackup({ data: json, intervalHours });
      } catch (e) {
        console.error("Error scheduling native backup:", e);
      }
    };

    scheduleNativeBackup();

    const tick = async () => {
      const c = cfgRef.current;
      if (!c.enabled) return;
      if (isDue(c)) {
        const ok = await performBackup(true);
        const now = new Date().toISOString();
        update({ lastRunAt: now });
        if (ok && permissions.notifications) {
          await scheduleBackupNotification(
            "Respaldo automático realizado",
            `Archivo: ${backupFilename()}`
          );
        }
      }
    };

    tick();
    const id = window.setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [cfg.enabled, cfg.frequency, permissions.notifications]);

  const supportsPicker =
    typeof window !== "undefined" && "showDirectoryPicker" in window;

  const pickFolder = async () => {
    const w = window as Window & {
      showDirectoryPicker?: (opts?: { mode?: "read" | "readwrite" }) => Promise<DirHandle>;
    };
    if (!w.showDirectoryPicker) {
      window.alert(
        "El selector de carpetas depende del sistema del navegador/WebView. Esta versión de la app no expone ese permiso a la página, aunque el dispositivo tenga permisos root. Se usará la descarga normal del sistema con el nombre correcto del respaldo.",
      );
      return;
    }
    try {
      const h = await w.showDirectoryPicker({ mode: "readwrite" });
      const ok = await ensureRwPermission(h);
      if (!ok) {
        toast.error("Permisos denegados para esa carpeta");
        return;
      }
      await idbSet("dir", h);
      setHasDir(true);
      toast.success("Carpeta de respaldos guardada");
    } catch (e) {
      if ((e as Error).name !== "AbortError") toast.error((e as Error).message);
    }
  };

  const clearFolder = async () => {
    await idbSet("dir", null);
    setHasDir(false);
    toast.success("Se quitó la carpeta. Los respaldos se descargarán normalmente.");
  };

  const requestPermissions = async () => {
    setRequestingPerms(true);
    try {
      const [notif, storage] = await Promise.all([
        requestNotificationPermission(),
        requestStoragePermission(),
      ]);
      setPermissions({ notifications: notif, storage });
      
      if (notif && storage) {
        toast.success("Permisos concedidos correctamente");
      } else if (notif) {
        toast.warning("Permiso de notificaciones concedido. El almacenamiento debería funcionar automáticamente.");
      } else if (storage) {
        toast.warning("Permiso de almacenamiento concedido. Habilita las notificaciones para alertas de respaldo.");
      } else {
        toast.error("No se pudieron conceder los permisos. Verifica la configuración de Android.");
      }
    } catch (error) {
      console.error("Error solicitando permisos:", error);
      toast.error("Error solicitando permisos. Intenta habilitarlos manualmente en Ajustes > Apps > SalsaRuta > Permisos");
    } finally {
      setRequestingPerms(false);
    }
  };

  const testBackup = async () => {
    const ok = await performBackup(false);
    if (ok) {
      update({ lastRunAt: new Date().toISOString() });
    }
  };

  const nextRun = cfg.enabled ? nextRunDate(cfg) : null;
  const isNative = Capacitor.isNativePlatform();

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <CalendarClock className="h-5 w-5" />
        </div>
        <div>
          <div className="font-semibold">Respaldo automático</div>
          <div className="text-xs text-muted-foreground">
            Copia de seguridad programada con notificaciones
          </div>
        </div>
      </div>

      {/* Estado de permisos */}
      <div className="rounded-lg border bg-muted/50 p-3">
        <div className="flex items-center gap-2 mb-2">
          <ShieldAlert className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Permisos requeridos</span>
        </div>
        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span>Notificaciones:</span>
            <span className={permissions.notifications ? "text-green-600 font-semibold" : "text-red-600"}>
              {permissions.notifications ? "✓ Concedido" : "✗ Denegado"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Almacenamiento:</span>
            <span className={permissions.storage ? "text-green-600 font-semibold" : "text-red-600"}>
              {permissions.storage ? "✓ Concedido" : "✗ Denegado"}
            </span>
          </div>
        </div>
        {!permissions.notifications || !permissions.storage ? (
          <Button
            size="sm"
            variant="outline"
            className="mt-2 w-full"
            onClick={requestPermissions}
            disabled={requestingPerms}
          >
            {requestingPerms ? "Solicitando..." : "Solicitar permisos"}
          </Button>
        ) : (
          <div className="mt-2 text-xs text-green-600 font-medium">
            ✓ Todos los permisos concedidos
          </div>
        )}
      </div>

      {/* Carpeta de destino */}
      {isNative ? (
        <div className="rounded-lg border bg-muted/50 p-3">
          <div className="flex items-center gap-2 mb-2">
            <FolderCheck className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">Ubicación de respaldo</span>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Los respaldos se guardarán automáticamente en la carpeta <strong>Documentos</strong> de tu dispositivo Android.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border bg-muted/50 p-3">
          <div className="flex items-center gap-2 mb-2">
            <FolderCheck className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">Carpeta de respaldo</span>
          </div>
          {hasDir ? (
            <div className="flex items-center justify-between">
              <span className="text-sm">Carpeta configurada</span>
              <Button size="sm" variant="ghost" onClick={clearFolder}>
                Cambiar
              </Button>
            </div>
          ) : supportsPicker ? (
            <Button size="sm" variant="outline" className="w-full" onClick={pickFolder}>
              <FolderPlus className="mr-2 h-4 w-4" /> Seleccionar carpeta
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground mb-3">
              Los respaldos se descargarán en la carpeta de descargas predeterminada
            </p>
          )}
        </div>
      )}

      {/* Configuración de horario */}
      <div className="space-y-3">
        <div>
          <Label className="text-xs">Frecuencia</Label>
          <Select value={cfg.frequency} onValueChange={(v: Frequency) => update({ frequency: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Diaria</SelectItem>
              <SelectItem value="weekly">Semanal</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {cfg.frequency === "weekly" && (
          <div>
            <Label className="text-xs">Día de la semana</Label>
            <Select value={cfg.dayOfWeek.toString()} onValueChange={(v) => update({ dayOfWeek: parseInt(v, 10) })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DAYS.map((d, i) => (
                  <SelectItem key={i} value={i.toString()}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div>
          <Label className="text-xs">Hora</Label>
          <Input type="time" value={cfg.time} onChange={(e) => update({ time: e.target.value })} />
        </div>
      </div>

      {/* Integración con nube */}
      <div className="rounded-lg border bg-muted/50 p-3">
        <div className="flex items-center gap-2 mb-3">
          <Cloud className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Respaldo en la nube</span>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Integración con aplicaciones de nube instaladas en tu dispositivo
        </p>
        
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {[
            { id: "google-drive", name: "Google Drive", icon: "☁️" },
            { id: "dropbox", name: "Dropbox", icon: "📦" },
            { id: "onedrive", name: "OneDrive", icon: "🔵" }
          ].map((provider) => (
            <button
              key={provider.id}
              onClick={() => {
                if (cfg.cloudProvider === provider.id) {
                  update({ cloudProvider: "none" as any });
                } else {
                  update({ cloudProvider: provider.id as any });
                  toast.info(`Integración con ${provider.name} en desarrollo. Próximamente podrás conectar directamente con la app instalada.`);
                }
              }}
              disabled={cfg.cloudProvider !== provider.id && cfg.cloudProvider !== "none"}
              className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left ${
                cfg.cloudProvider === provider.id 
                  ? "bg-primary/10 border-primary" 
                  : "bg-background hover:bg-muted/50 border-muted"
              } ${cfg.cloudProvider !== "none" && cfg.cloudProvider !== provider.id ? "opacity-50" : ""}`}
            >
              <span className="text-xl">{provider.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{provider.name}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {cfg.cloudProvider === provider.id ? "Seleccionado" : "En desarrollo"}
                </div>
              </div>
              {cfg.cloudProvider === provider.id ? (
                <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              )}
            </button>
          ))}
        </div>
        
        {cfg.cloudProvider !== "none" && (
          <Button
            size="sm"
            variant="outline"
            className="w-full mt-2"
            onClick={() => update({ cloudProvider: "none" as any })}
          >
            Desactivar respaldo en nube
          </Button>
        )}
      </div>

      {/* Próximo respaldo */}
      {nextRun && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            <span className="text-sm">
              Próximo respaldo: <strong>{nextRun.toLocaleString("es-MX")}</strong>
            </span>
          </div>
        </div>
      )}

      {/* Acciones */}
      <div className="flex gap-2">
        <Button
          variant={cfg.enabled ? "destructive" : "default"}
          className="flex-1"
          onClick={() => {
            if (!cfg.enabled && (!permissions.notifications || !permissions.storage)) {
              toast.error("Primero concede los permisos necesarios");
              return;
            }
            update({ enabled: !cfg.enabled });
            if (cfg.enabled) {
              BackupScheduler.cancelBackup().catch(console.error);
            }
          }}
        >
          {cfg.enabled ? "Deshabilitar" : "Habilitar"} respaldo automático
        </Button>
        <Button variant="outline" onClick={testBackup}>
          <Play className="mr-2 h-4 w-4" /> Probar
        </Button>
      </div>

      {cfg.lastRunAt && (
        <p className="text-xs text-center text-muted-foreground">
          Último respaldo: {new Date(cfg.lastRunAt).toLocaleString("es-MX")}
        </p>
      )}
    </Card>
  );
}
