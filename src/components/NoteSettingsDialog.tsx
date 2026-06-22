import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getBusinessConfig, setBusinessConfig, type BusinessConfig } from "@/lib/business-config";
import { buildReceiptInnerHtml, type RemisionData } from "@/lib/remision";
import { Save, Printer } from "lucide-react";
import { toast } from "sonner";

interface NoteSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const FONT_FAMILIES = [
  { value: "'Courier New', monospace", label: "Courier New" },
  { value: "'Times New Roman', serif", label: "Times New Roman" },
  { value: "Arial, sans-serif", label: "Arial" },
  { value: "Georgia, serif", label: "Georgia" },
  { value: "Verdana, sans-serif", label: "Verdana" },
  { value: "Tahoma, sans-serif", label: "Tahoma" },
  { value: "'Lucida Console', monospace", label: "Lucida Console" },
];

const FONT_SIZES = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 18, 20];

const MARGIN_VALUES = [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50];

export function NoteSettingsDialog({ open, onOpenChange }: NoteSettingsDialogProps) {
  const [config, setConfig] = useState<BusinessConfig>(() => getBusinessConfig());
  const [previewHtml, setPreviewHtml] = useState("");

  const updateConfig = <K extends keyof BusinessConfig>(key: K, value: BusinessConfig[K]) => {
    const newConfig = { ...config, [key]: value };
    setConfig(newConfig);
    setBusinessConfig(newConfig);
  };

  // Regenerar previsualización cuando cambie la configuración
  useEffect(() => {
    const previewData: RemisionData = {
      client: { name: "Cliente de Prueba", address: "Calle Ejemplo 123" },
      sale: {
        completed: true,
        paymentType: "cash",
        existenciaAnterior: {},
        existenciaActual: {},
        surtido: { p1: 5, p2: 3 },
        devolucion: { p1: 1 },
        notes: "",
      },
      products: [
        { id: "p1", name: "Producto Demo A", price: 12 },
        { id: "p2", name: "Producto Demo B", price: 15 },
      ],
      date: new Date().toISOString(),
      folio: "DEMO01",
    };
    setPreviewHtml(buildReceiptInnerHtml(previewData));
  }, [config]);

  const handleSave = () => {
    toast.success("Ajustes de nota guardados");
    onOpenChange(false);
  };

  // Recargar configuración cuando se abra el diálogo
  useEffect(() => {
    if (open) {
      setConfig(getBusinessConfig());
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ajustes de nota de remisión</DialogTitle>
        </DialogHeader>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Controles */}
          <div className="space-y-4">
            <div>
              <Label>Ancho del papel</Label>
              <Select
                value={config.paperWidth}
                onValueChange={(v: "58mm" | "80mm") => updateConfig("paperWidth", v)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="58mm">58 mm</SelectItem>
                  <SelectItem value="80mm">80 mm</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Tamaño de fuente (px)</Label>
              <Select
                value={config.fontSize.toString()}
                onValueChange={(v) => updateConfig("fontSize", parseInt(v, 10))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FONT_SIZES.map((size) => (
                    <SelectItem key={size} value={size.toString()}>
                      {size}px
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Tipo de fuente</Label>
              <Select
                value={config.fontFamily}
                onValueChange={(v) => updateConfig("fontFamily", v)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FONT_FAMILIES.map((font) => (
                    <SelectItem key={font.value} value={font.value}>
                      {font.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Margen superior (px)</Label>
              <Select
                value={config.marginTop.toString()}
                onValueChange={(v) => updateConfig("marginTop", parseInt(v, 10))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MARGIN_VALUES.map((margin) => (
                    <SelectItem key={margin} value={margin.toString()}>
                      {margin}px
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Margen inferior (px)</Label>
              <Select
                value={config.marginBottom.toString()}
                onValueChange={(v) => updateConfig("marginBottom", parseInt(v, 10))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MARGIN_VALUES.map((margin) => (
                    <SelectItem key={margin} value={margin.toString()}>
                      {margin}px
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Margen izquierdo (px)</Label>
              <Select
                value={config.marginLeft.toString()}
                onValueChange={(v) => updateConfig("marginLeft", parseInt(v, 10))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MARGIN_VALUES.map((margin) => (
                    <SelectItem key={margin} value={margin.toString()}>
                      {margin}px
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Margen derecho (px)</Label>
              <Select
                value={config.marginRight.toString()}
                onValueChange={(v) => updateConfig("marginRight", parseInt(v, 10))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MARGIN_VALUES.map((margin) => (
                    <SelectItem key={margin} value={margin.toString()}>
                      {margin}px
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Previsualización */}
          <div className="space-y-4">
            <Label>Previsualización (tamaño real: {config.paperWidth})</Label>
            <div className="flex items-center justify-center bg-gray-100 p-4 border rounded-lg">
              <div
                className="bg-white overflow-auto"
                style={{
                  width: config.paperWidth === "58mm" ? "58mm" : "80mm",
                  maxHeight: "500px",
                  boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
                  marginTop: `${config.marginTop}px`,
                  marginBottom: `${config.marginBottom}px`,
                  marginLeft: `${config.marginLeft}px`,
                  marginRight: `${config.marginRight}px`,
                }}
              >
                <div 
                  dangerouslySetInnerHTML={{ __html: previewHtml }} 
                  style={{
                    fontSize: `${config.fontSize}px`,
                    fontFamily: config.fontFamily,
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave}>
            <Save className="mr-2 h-4 w-4" /> Guardar ajustes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
