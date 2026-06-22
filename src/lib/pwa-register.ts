export function registerPWA() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  const url = new URL(window.location.href);
  const hostname = url.hostname;

  const isDevOrPreview =
    !import.meta.env.PROD ||
    url.searchParams.has("sw=off") ||
    window.self !== window.top ||
    hostname.startsWith("id-preview--") ||
    hostname.startsWith("preview--") ||
    hostname === "lovableproject.com" ||
    hostname.endsWith(".lovableproject.com") ||
    hostname === "lovableproject-dev.com" ||
    hostname.endsWith(".lovableproject-dev.com") ||
    hostname === "beta.lovable.dev" ||
    hostname.endsWith(".beta.lovable.dev");

  if (isDevOrPreview) {
    navigator.serviceWorker.getRegistrations().then((regs) => {
      for (const reg of regs) {
        const scriptURL =
          reg.active?.scriptURL ??
          reg.waiting?.scriptURL ??
          reg.installing?.scriptURL;
        if (scriptURL && scriptURL.endsWith("/sw.js")) {
          reg.unregister();
        }
      }
    });
    return;
  }

  navigator.serviceWorker
    .register("/sw.js", { scope: "/" })
    .catch((err) => {
      console.error("PWA registration failed:", err);
    });
}
