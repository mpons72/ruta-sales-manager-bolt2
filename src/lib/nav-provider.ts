import { useEffect, useState } from "react";

export type NavProvider = "google" | "sygic";

const STORAGE_KEY = "nav-provider";
const SYGIC_ANDROID_PACKAGE = "com.sygic.aura";

// Google Maps acepta 1 origen + 1 destino + ~8 waypoints intermedios (≈10 paradas en total).
export const GOOGLE_MAX_PER_SEGMENT = 10;

export function getNavProvider(): NavProvider {
  if (typeof window === "undefined") return "google";
  const v = localStorage.getItem(STORAGE_KEY);
  return v === "sygic" ? "sygic" : "google";
}

export function setNavProvider(p: NavProvider) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, p);
  window.dispatchEvent(new CustomEvent("nav-provider-change"));
}

export function useNavProvider(): NavProvider {
  const [p, setP] = useState<NavProvider>(() => getNavProvider());
  useEffect(() => {
    const sync = () => setP(getNavProvider());
    window.addEventListener("nav-provider-change", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("nav-provider-change", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return p;
}

const ASK_KEY = "nav-ask-each-time";

export function getAskEachTime(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(ASK_KEY) === "1";
}

export function setAskEachTime(v: boolean) {
  if (typeof window === "undefined") return;
  localStorage.setItem(ASK_KEY, v ? "1" : "0");
  window.dispatchEvent(new CustomEvent("nav-provider-change"));
}

export function useAskEachTime(): boolean {
  const [v, setV] = useState<boolean>(() => getAskEachTime());
  useEffect(() => {
    const sync = () => setV(getAskEachTime());
    window.addEventListener("nav-provider-change", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("nav-provider-change", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return v;
}

// Sygic Free admite con seguridad un único deep link estable:
//   com.sygic.aura://coordinate|<lon>|<lat>|drive
// El esquema `routeimport` no se respeta en muchas versiones (la app abre
// sin cargar el itinerario), así que en el flujo de ruta se manda una
// parada a la vez (la próxima pendiente).
export function sygicDriveUrl(lat: number, lng: number): string {
  return `com.sygic.aura://coordinate|${lng}|${lat}|drive`;
}

// Lanza Sygic vía Android Intent (más confiable que window.location en WebView).
export function sygicAndroidIntentUrl(customUrl: string): string {
  if (!customUrl.startsWith("com.sygic.aura://")) return customUrl;
  const body = customUrl.slice("com.sygic.aura://".length);
  const fallback = encodeURIComponent(`market://details?id=${SYGIC_ANDROID_PACKAGE}`);
  return `intent://${body}#Intent;scheme=com.sygic.aura;package=${SYGIC_ANDROID_PACKAGE};S.browser_fallback_url=${fallback};end`;
}

// Dispara el deep link de Sygic de forma confiable dentro de WebViews.
export function openSygic(lat: number, lng: number) {
  if (typeof window === "undefined") return;
  const sygicUrl = sygicDriveUrl(lat, lng);
  // window.location directo funciona en WebView de Capacitor
  try {
    window.location.href = sygicUrl;
    return;
  } catch (_) {
    // continúa con fallback
  }
  // Fallback para navegadores normales
  const intentUrl = sygicAndroidIntentUrl(sygicUrl);
  const a = document.createElement("a");
  a.href = intentUrl;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
