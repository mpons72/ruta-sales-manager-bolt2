import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  getBusinessConfig,
  setBusinessConfig,
  type BusinessConfig,
} from "@/lib/business-config";
import { ReceiptDialog } from "@/components/ReceiptDialog";
import { NoteSettingsDialog } from "@/components/NoteSettingsDialog";
import type { RemisionData } from "@/lib/remision";
import { Image as ImageIcon, Save, Trash2, Printer, Receipt, Settings } from "lucide-react";
import { toast } from "sonner";

export function BusinessInfoCard() {
  const [cfg, setCfg] = useState<BusinessConfig>(() => getBusinessConfig());
  const [dirty, setDirty] = useState(false);
  const [receiptData, setReceiptData] = useState<RemisionData | null>(null);
  const [noteSettingsOpen, setNoteSettingsOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setCfg(getBusinessConfig());
  }, []);

  const update = <K extends keyof BusinessConfig>(k: K, v: BusinessConfig[K]) => {
    setCfg((c) => ({ ...c, [k]: v }));
    setDirty(true);
  };

  const onLogoFile = (file: File) => {
    if (file.size > 600 * 1024) {
      toast.error("Logo demasiado grande (máx 600 KB). Usa una imagen más pequeña.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      update("logoDataUrl", String(reader.result ?? ""));
      toast.success("Logo cargado");
    };
    reader.onerror = () => toast.error("No se pudo leer el archivo");
    reader.readAsDataURL(file);
  };

  const save = () => {
    setBusinessConfig(cfg);
    setDirty(false);
    toast.success("Datos del negocio guardados");
  };

  const previewRemision = () => {
    setBusinessConfig(cfg);
    setReceiptData({
      client: { name: "Cliente de Prueba", address: "Calle Ejemplo 123" },
      sale: {
        completed: true,
        paymentType: "cash",
        existenciaAnterior: {},
        existenciaActual: {},
        surtido: { p1: 5, p2: 3 },
        devolucion: { p1: 1 },
      },
      products: [
        { id: "p1", name: "Producto Demo A", price: 12 },
        { id: "p2", name: "Producto Demo B", price: 15 },
      ],
      date: new Date().toISOString(),
      folio: "DEMO01",
    });
  };

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <Receipt className="h-5 w-5" />
        </div>
        <div>
          <div className="font-semibold">Notas de remisión</div>
          <div className="text-xs text-muted-foreground">
            Logo, encabezados y leyendas que aparecen en cada nota impresa.
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-[120px_1fr]">
        <div className="flex flex-col items-center gap-2">
          <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-lg border bg-muted/40">
            {cfg.logoDataUrl ? (
              <img src={cfg.logoDataUrl} alt="logo" className="max-h-full max-w-full" />
            ) : (
              <ImageIcon className="h-8 w-8 text-muted-foreground" />
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onLogoFile(f);
              e.target.value = "";
            }}
          />
          <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
            <ImageIcon className="mr-1.5 h-3.5 w-3.5" /> Subir logo
          </Button>
          {cfg.logoDataUrl && (
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive"
              onClick={() => update("logoDataUrl", "")}
            >
              <Trash2 className="mr-1 h-3.5 w-3.5" /> Quitar
            </Button>
          )}
        </div>

        <div className="space-y-2">
          <div>
            <Label className="text-xs">Título del negocio</Label>
            <Input
              value={cfg.title}
              onChange={(e) => update("title", e.target.value)}
              placeholder="Ej. Salsas El Picosón"
            />
          </div>
          <div>
            <Label className="text-xs">Subtítulo / dirección / teléfono</Label>
            <Input
              value={cfg.subtitle}
              onChange={(e) => update("subtitle", e.target.value)}
              placeholder="Ej. Tel. 555-123-4567"
            />
          </div>
        </div>
      </div>

      <div>
        <Label className="text-xs">Leyenda al inicio de la nota</Label>
        <Textarea
          rows={2}
          value={cfg.headerText}
          onChange={(e) => update("headerText", e.target.value)}
          placeholder="Ej. RFC XAXX010101000 · Régimen Simplificado"
        />
      </div>

      <div>
        <Label className="text-xs">Leyenda al final de la nota</Label>
        <Textarea
          rows={2}
          value={cfg.footerText}
          onChange={(e) => update("footerText", e.target.value)}
          placeholder="Ej. Gracias por su compra. Esta nota no es comprobante fiscal."
        />
      </div>

      <div>
        <Label className="text-xs">Ancho del papel (impresora térmica)</Label>
        <div className="mt-1 flex gap-2">
          {(["58mm", "80mm"] as const).map((w) => (
            <Button
              key={w}
              type="button"
              size="sm"
              variant={cfg.paperWidth === w ? "default" : "outline"}
              onClick={() => update("paperWidth", w)}
            >
              {w}
            </Button>
          ))}
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          La nota se abre en una ventana lista para imprimir; selecciona tu impresora térmica
          portátil (Bluetooth/USB) en el diálogo de impresión del sistema.
        </p>
      </div>

      <div>
        <Label className="text-xs">Formato de impresión</Label>
        <Button
          variant="outline"
          className="mt-1 w-full"
          onClick={() => setNoteSettingsOpen(true)}
        >
          <Settings className="mr-2 h-4 w-4" /> Ajustes de nota (márgenes, fuente)
        </Button>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Ajusta márgenes, tamaño y tipo de fuente con previsualización en tiempo real.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={save} disabled={!dirty}>
          <Save className="mr-2 h-4 w-4" /> Guardar
        </Button>
        <Button variant="outline" onClick={previewRemision}>
          <Printer className="mr-2 h-4 w-4" /> Vista previa de nota
        </Button>
      </div>

      <ReceiptDialog 
        open={receiptData !== null}
        onOpenChange={(open) => !open && setReceiptData(null)}
        data={receiptData || undefined}
      />

      <NoteSettingsDialog
        open={noteSettingsOpen}
        onOpenChange={setNoteSettingsOpen}
      />
    </Card>
  );
}
