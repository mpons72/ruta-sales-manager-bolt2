import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, MapPin, ShieldCheck, AlertTriangle, ExternalLink } from "lucide-react";
import { geocode, mapsUrl, type GeocodeMatch } from "@/lib/geo";
import { toast } from "sonner";

export type VerifiedAddress = {
  address: string;
  lat: number;
  lng: number;
  placeId: string;
};

const PRECISION: Record<string, { label: string; tone: string }> = {
  ROOFTOP: { label: "Exacta (techo)", tone: "bg-success/15 text-success border-success/40" },
  RANGE_INTERPOLATED: { label: "Interpolada", tone: "bg-warning/15 text-warning border-warning/40" },
  GEOMETRIC_CENTER: { label: "Centro geométrico", tone: "bg-warning/15 text-warning border-warning/40" },
  APPROXIMATE: { label: "Aproximada", tone: "bg-destructive/15 text-destructive border-destructive/40" },
};

export function VerifyAddressDialog({
  open,
  onClose,
  initialAddress,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  initialAddress: string;
  onConfirm: (v: VerifiedAddress) => void;
}) {
  const [query, setQuery] = useState(initialAddress);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<GeocodeMatch[]>([]);
  const [selected, setSelected] = useState<number>(0);

  useEffect(() => {
    if (open) {
      setQuery(initialAddress);
      setResults([]);
      setSelected(0);
    }
  }, [open, initialAddress]);

  const search = async () => {
    const q = query.trim();
    if (!q) {
      toast.error("Escribe una dirección");
      return;
    }
    setLoading(true);
    try {
      const r = await geocode({ address: q });
      setResults(r);
      setSelected(0);
      if (r.length === 0) toast.error("Google no encontró esta dirección");
      else if (r[0].partialMatch) toast.warning("Coincidencia parcial — revisa los resultados");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Verificar dirección con Google
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Dirección a buscar</Label>
            <div className="mt-1 flex gap-2">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Calle, número, colonia, ciudad…"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    search();
                  }
                }}
              />
              <Button onClick={search} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buscar"}
              </Button>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Mientras más completa (calle + número + colonia + ciudad), más exacta la ubicación.
            </p>
          </div>

          {results.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Coincidencias ({results.length})
              </div>
              <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                {results.map((r, i) => {
                  const precision = PRECISION[r.locationType] ?? PRECISION.APPROXIMATE;
                  const checked = selected === i;
                  return (
                    <button
                      key={r.placeId}
                      type="button"
                      onClick={() => setSelected(i)}
                      className={`w-full rounded-lg border p-3 text-left transition ${
                        checked
                          ? "border-primary bg-primary/10"
                          : "border-border/40 bg-card hover:border-primary/40"
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium">{r.formattedAddress}</div>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px]">
                            <Badge variant="outline" className={precision.tone}>
                              {precision.label}
                            </Badge>
                            {r.partialMatch && (
                              <Badge variant="outline" className="border-warning/40 bg-warning/10 text-warning">
                                <AlertTriangle className="mr-1 h-3 w-3" /> Coincidencia parcial
                              </Badge>
                            )}
                            <span className="tabular-nums text-muted-foreground">
                              {r.lat.toFixed(6)}, {r.lng.toFixed(6)}
                            </span>
                            <a
                              href={mapsUrl(r.lat, r.lng, r.formattedAddress, r.placeId)}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-0.5 text-primary hover:underline"
                            >
                              <ExternalLink className="h-3 w-3" /> Previsualizar
                            </a>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={results.length === 0}
            onClick={() => {
              const r = results[selected];
              if (!r) return;
              onConfirm({
                address: r.formattedAddress,
                lat: r.lat,
                lng: r.lng,
                placeId: r.placeId,
              });
              onClose();
            }}
          >
            Usar esta ubicación
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
