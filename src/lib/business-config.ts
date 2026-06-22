import { useEffect, useState } from "react";

export type BusinessConfig = {
  title: string;
  subtitle: string;
  headerText: string;
  footerText: string;
  logoDataUrl: string;
  paperWidth: "58mm" | "80mm";
  fontSize: number;
  fontFamily: string;
  marginTop: number;
  marginBottom: number;
  marginLeft: number;
  marginRight: number;
};

const KEY = "business-config-v1";

export const defaultBusinessConfig: BusinessConfig = {
  title: "Mi Negocio",
  subtitle: "",
  headerText: "",
  footerText: "¡Gracias por su compra!",
  logoDataUrl: "",
  paperWidth: "58mm",
  fontSize: 10,
  fontFamily: "'Courier New', monospace",
  marginTop: 0,
  marginBottom: 0,
  marginLeft: 0,
  marginRight: 0,
};

export function getBusinessConfig(): BusinessConfig {
  if (typeof window === "undefined") return defaultBusinessConfig;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultBusinessConfig;
    return { ...defaultBusinessConfig, ...JSON.parse(raw) };
  } catch {
    return defaultBusinessConfig;
  }
}

export function setBusinessConfig(cfg: BusinessConfig) {
  localStorage.setItem(KEY, JSON.stringify(cfg));
  window.dispatchEvent(new Event("business-config-change"));
}

export function useBusinessConfig(): BusinessConfig {
  const [cfg, setCfg] = useState<BusinessConfig>(() => getBusinessConfig());
  useEffect(() => {
    const h = () => setCfg(getBusinessConfig());
    window.addEventListener("business-config-change", h);
    window.addEventListener("storage", h);
    return () => {
      window.removeEventListener("business-config-change", h);
      window.removeEventListener("storage", h);
    };
  }, []);
  return cfg;
}
