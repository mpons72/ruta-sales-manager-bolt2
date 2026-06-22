import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Navigation, Smartphone } from "lucide-react";
import {
  useNavProvider,
  setNavProvider,
  useAskEachTime,
  setAskEachTime,
} from "@/lib/nav-provider";

export function NavProviderCard() {
  const provider = useNavProvider();
  const askEachTime = useAskEachTime();

  return (
    <Card className="p-5">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <Navigation className="h-5 w-5" />
        </div>
        <div>
          <div className="font-semibold">Aplicación de navegación</div>
          <div className="text-xs text-muted-foreground">
            Elige con qué app se abren los mapas y los recorridos.
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button
          variant={provider === "google" ? "default" : "outline"}
          onClick={() => setNavProvider("google")}
        >
          <Navigation className="mr-2 h-4 w-4" /> Google Maps
        </Button>
        <Button
          variant={provider === "sygic" ? "default" : "outline"}
          onClick={() => setNavProvider("sygic")}
        >
          <Smartphone className="mr-2 h-4 w-4" /> Sygic GPS
        </Button>
      </div>

      <div className="mt-4 flex items-start justify-between gap-4 rounded-md border border-border/40 bg-muted/30 p-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold">Preguntar cada vez</div>
          <div className="text-xs text-muted-foreground">
            Al presionar “Mapa”, abre el selector del teléfono para escoger entre
            las apps instaladas (Google Maps, Waze, Sygic, OsmAnd, etc.). Si está
            apagado, se usa siempre la app seleccionada arriba.
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={askEachTime}
          onClick={() => setAskEachTime(!askEachTime)}
          className={`relative mt-1 inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${
            askEachTime ? "bg-primary" : "bg-muted"
          }`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
              askEachTime ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      {provider === "google" && (
        <div className="mt-3 rounded-md border border-border/40 bg-muted/40 p-3 text-xs text-muted-foreground">
          Google Maps limita cada ruta a 10 paradas (origen + 8 intermedias + destino).
          Cuando la ruta del día tenga más, se generan varios botones de tramo de 10 paradas
          para no perder ningún cliente.
        </div>
      )}

      {provider === "sygic" && (
        <div className="mt-3 rounded-md border border-warning/30 bg-warning/10 p-3 text-xs text-muted-foreground">
          Sygic GPS Navigation & Maps debe estar instalado. La app móvil de Sygic sólo acepta
          una parada a la vez por enlace, así que el botón abre Sygic directamente en la
          <strong> próxima parada pendiente</strong>. Al terminar esa visita, vuelve a tocarlo
          para abrir la siguiente. Los botones de cada cliente también usan Sygic.
        </div>
      )}
    </Card>
  );
}
