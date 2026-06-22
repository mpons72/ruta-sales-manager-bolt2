// Genera/parses archivos GPX con waypoints + ruta a partir de los clientes.
// Compatible con Sygic, OsmAnd, Locus, etc.
// Incluye nombre y orden de visita en <name> y dirección/ID en <cmt>/<desc>.
import type { Client } from "./store";

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function buildGpx(
  clients: Pick<Client, "id" | "name" | "address" | "lat" | "lng" | "visitOrder">[],
  routeName = "Ruta del día",
): string {
  const stops = clients.filter((c) => c.lat != null && c.lng != null);
  const now = new Date().toISOString();
  const wpts = stops
    .map(
      (c, i) =>
        `  <wpt lat="${c.lat}" lon="${c.lng}">\n` +
        `    <name>${escapeXml(`${i + 1}. ${c.name}`)}</name>\n` +
        (c.address ? `    <desc>${escapeXml(c.address)}</desc>\n` : "") +
        `    <cmt>order=${i + 1};id=${escapeXml(c.id ?? "")};name=${escapeXml(c.name)}</cmt>\n` +
        `    <sym>Flag, Blue</sym>\n` +
        `  </wpt>`,
    )
    .join("\n");
  const rtepts = stops
    .map(
      (c, i) =>
        `    <rtept lat="${c.lat}" lon="${c.lng}"><name>${escapeXml(`${i + 1}. ${c.name}`)}</name></rtept>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="RutaVenta" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${escapeXml(routeName)}</name>
    <time>${now}</time>
  </metadata>
${wpts}
  <rte>
    <name>${escapeXml(routeName)}</name>
${rtepts}
  </rte>
</gpx>
`;
}

export function downloadGpx(filename: string, gpx: string) {
  const blob = new Blob([gpx], { type: "application/gpx+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".gpx") ? filename : `${filename}.gpx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export type GpxStop = {
  id?: string;
  name: string;
  address?: string;
  lat: number;
  lng: number;
  visitOrder?: number;
};

// Parsea un archivo GPX y devuelve la lista de paradas (wpt y/o rtept).
export function parseGpx(xml: string): GpxStop[] {
  const stops: GpxStop[] = [];
  if (typeof DOMParser === "undefined") return stops;
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.querySelector("parsererror")) return stops;

  const collect = (selector: string) => {
    doc.querySelectorAll(selector).forEach((el) => {
      const lat = Number(el.getAttribute("lat"));
      const lng = Number(el.getAttribute("lon"));
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      const rawName = el.querySelector("name")?.textContent?.trim() ?? "";
      const desc = el.querySelector("desc")?.textContent?.trim() || undefined;
      const cmt = el.querySelector("cmt")?.textContent?.trim() ?? "";
      // Quitar prefijo "12. " del nombre exportado
      const m = rawName.match(/^\s*(\d+)\s*[\.\-)]\s*(.+)$/);
      const visitOrder = m ? Number(m[1]) : undefined;
      const cleanName = (m ? m[2] : rawName).trim();
      // Recuperar id/name desde el <cmt> generado por nuestro export
      let id: string | undefined;
      let fullName = cleanName;
      cmt.split(";").forEach((kv) => {
        const [k, ...rest] = kv.split("=");
        const v = rest.join("=").trim();
        if (k?.trim() === "id" && v) id = v;
        if (k?.trim() === "name" && v) fullName = v;
      });
      if (!fullName) return;
      stops.push({ id, name: fullName, address: desc, lat, lng, visitOrder });
    });
  };

  collect("wpt");
  if (stops.length === 0) collect("rtept");
  // Deduplicar por id+name+coords
  const seen = new Set<string>();
  return stops.filter((s) => {
    const key = `${s.id ?? ""}|${s.name.toLowerCase()}|${s.lat.toFixed(5)}|${s.lng.toFixed(5)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function normalizeClientName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
