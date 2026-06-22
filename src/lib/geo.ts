export type GeoResult = { lat: number; lng: number; address: string };

export type GeocodeMatch = {
  formattedAddress: string;
  lat: number;
  lng: number;
  placeId: string;
  locationType: string;
  partialMatch: boolean;
};

export function getCurrentPosition(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("El dispositivo no soporta geolocalización"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => {
        let msg = "No se pudo obtener la ubicación";
        if (err.code === 1) msg = "Permiso de ubicación denegado. Ve a Ajustes > Apps > SalsaRuta > Permisos > Ubicación";
        if (err.code === 2) msg = "Ubicación no disponible. Activa el GPS del dispositivo";
        if (err.code === 3) msg = "Tiempo de espera agotado. Intenta de nuevo";
        reject(new Error(msg));
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
    );
  });
}

// Geocodificación directa contra Nominatim (OpenStreetMap) - sin API key needed
export async function geocode(input: {
  address?: string;
  lat?: number;
  lng?: number;
}): Promise<GeocodeMatch[]> {
  try {
    if (input.address) {
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(input.address)}&limit=5&accept-language=es&countrycodes=mx`;
      const r = await fetch(url, { headers: { Accept: "application/json" } });
      if (!r.ok) return [];
      const data = await r.json() as any[];
      return data.map((item: any) => ({
        formattedAddress: item.display_name ?? "",
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
        placeId: item.place_id?.toString() ?? "",
        locationType: "APPROXIMATE",
        partialMatch: false,
      }));
    }
    if (typeof input.lat === "number" && typeof input.lng === "number") {
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${input.lat}&lon=${input.lng}&accept-language=es`;
      const r = await fetch(url, { headers: { Accept: "application/json" } });
      if (!r.ok) return [];
      const data = await r.json() as any;
      return [{
        formattedAddress: data.display_name ?? "",
        lat: input.lat,
        lng: input.lng,
        placeId: data.place_id?.toString() ?? "",
        locationType: "APPROXIMATE",
        partialMatch: false,
      }];
    }
    return [];
  } catch {
    return [];
  }
}

export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const matches = await geocode({ lat, lng });
    if (matches[0]?.formattedAddress) return matches[0].formattedAddress;
  } catch {
    // ignoramos: fallback a Nominatim para no dejar al usuario sin texto
  }
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=es`;
    const r = await fetch(url, { headers: { Accept: "application/json" } });
    if (!r.ok) throw new Error("reverse failed");
    const data = (await r.json()) as { display_name?: string };
    return data.display_name ?? `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  } catch {
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  }
}

export async function captureLocation(): Promise<GeoResult> {
  const { lat, lng } = await getCurrentPosition();
  const address = await reverseGeocode(lat, lng);
  return { lat, lng, address };
}

// URL de Google Maps que abre EXACTAMENTE el lugar correcto.
// Prioridad: placeId (lugar único en Google) > coordenadas verificadas + dirección.
// Si solo hay dirección de texto, se usa búsqueda por query. NUNCA usamos sólo
// coordenadas porque pueden ser imprecisas (capturadas en otro punto).
export function mapsUrl(
  lat?: number | null,
  lng?: number | null,
  address?: string | null,
  placeId?: string | null,
): string {
  const addr = address?.trim();
  if (placeId) {
    const q = addr ? encodeURIComponent(addr) : "place";
    return `https://www.google.com/maps/search/?api=1&query=${q}&query_place_id=${encodeURIComponent(placeId)}`;
  }
  if (addr) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addr)}&travelmode=driving&dir_action=navigate`;
  }
  if (typeof lat === "number" && typeof lng === "number") {
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving&dir_action=navigate`;
  }
  return "https://www.google.com/maps";
}

// URI estándar Android/geo que dispara el selector de apps del sistema
// (Google Maps, Waze, Sygic, OsmAnd, etc.). Si hay dirección de texto la
// usamos como query (más exacto que coordenadas brutas).
export function geoChooserUrl(
  lat?: number | null,
  lng?: number | null,
  address?: string | null,
): string {
  const addr = address?.trim();
  const hasCoords = typeof lat === "number" && typeof lng === "number";
  if (addr) {
    const base = hasCoords ? `geo:${lat},${lng}` : "geo:0,0";
    return `${base}?q=${encodeURIComponent(addr)}`;
  }
  if (hasCoords) return `geo:${lat},${lng}?q=${lat},${lng}`;
  return "geo:0,0";
}

export function openMapChooser(
  lat?: number | null,
  lng?: number | null,
  address?: string | null,
  placeId?: string | null,
) {
  if (typeof window === "undefined") return;
  const url = geoChooserUrl(lat, lng, address);
  try {
    window.location.href = url;
  } catch {
    window.open(mapsUrl(lat, lng, address, placeId), "_blank");
  }
}
