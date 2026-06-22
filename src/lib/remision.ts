import { priceFor, type ClientSale, type Product, type Client } from "@/lib/store";
import { getBusinessConfig } from "@/lib/business-config";

export type RemisionData = {
  client: Pick<Client, "name" | "address">;
  sale: ClientSale;
  products: Product[];
  date: string; // ISO
  folio?: string;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function computeTotals(data: RemisionData) {
  const lines: { name: string; qty: number; price: number; total: number; antes: number }[] = [];
  let totalPzas = 0;
  let totalDev = 0;
  let subtotal = 0;
  
  if (!data.products || data.products.length === 0) {
    return { lines, totalPzas, totalDev, subtotal, descDev: 0, total: 0 };
  }
  
  for (const p of data.products) {
    const surt = data.sale.surtido?.[p.id] ?? 0;
    const dev = data.sale.devolucion?.[p.id] ?? 0;
    const antes = data.sale.existenciaAnterior?.[p.id] ?? 0;
    const price = priceFor(data.sale, p);
    if (surt > 0) {
      lines.push({ name: p.name, qty: surt, price, total: surt * price, antes });
      totalPzas += surt;
      subtotal += surt * price;
    }
    totalDev += dev;
  }
  const precioProm = totalPzas > 0 ? subtotal / totalPzas : 0;
  const descDev = totalDev * precioProm;
  const total = subtotal - descDev;
  return { lines, totalPzas, totalDev, subtotal, descDev, total };
}

const style = (cfg: any) => `
  <style>
    .receipt { 
      font-family: ${cfg.fontFamily}; 
      font-size: ${cfg.fontSize}px; 
      color: #000; 
      margin: ${cfg.marginTop}px ${cfg.marginRight}px ${cfg.marginBottom}px ${cfg.marginLeft}px; 
      padding: 0;
      white-space: pre;
      line-height: 1.0;
      width: ${cfg.paperWidth};
      overflow: hidden;
      word-wrap: break-word;
      word-break: break-all;
    }
    .center { text-align: center; }
    .bold { font-weight: bold; }
    .row { white-space: nowrap; }
    .logo-img { max-width: 120px; max-height: 40px; display: block; margin: 0 auto; }
    img { display: block; }
  </style>
`;

/**
 * Construye el cuerpo de la nota con formato específico usando divisors "─"
 */
export function buildReceiptInnerHtml(data: RemisionData): string {
  if (!data || !data.products || !data.sale) {
    return `<div class="receipt center bold">Error: Datos del recibo incompletos</div>`;
  }

  const cfg = getBusinessConfig();
  const { lines, totalPzas, subtotal, total } = computeTotals(data);
  const date = new Date(data.date);
  const folio = data.folio ?? date.getTime().toString(36).toUpperCase().slice(-6);
  const paymentLabel = data.sale.paymentType === "credit" ? "CRÉDITO" : "CONTADO";

  const formatDate = (d: Date) => {
    const day = d.getDate();
    const month = d.getMonth() + 1;
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const divider = cfg.paperWidth === "58mm" 
    ? '────────────────────────────────────────'
    : '────────────────────────────────────────────────────────';

  let productsText = '';
  for (const l of lines) {
    const nameLen = cfg.paperWidth === "58mm" ? 22 : 32;
    const name = l.name.length > nameLen ? l.name.slice(0, nameLen) : l.name;
    const qtyStr = l.qty.toString().padStart(4);
    const priceStr = `$${l.price.toFixed(2)}`.padStart(8);
    const totalStr = `$${l.total.toFixed(2)}`.padStart(9);
    productsText += escapeHtml(name.padEnd(nameLen)) + escapeHtml(qtyStr) + escapeHtml(priceStr) + escapeHtml(totalStr) + '\n';
  }

  let headerLines = '';
  if (cfg.title) {
    headerLines += `<div class="center bold">${escapeHtml(cfg.title)}</div>\n`;
  }
  if (cfg.subtitle) {
    headerLines += `<div class="center">${escapeHtml(cfg.subtitle)}</div>\n`;
  }

  let logoHtml = '';
  if (cfg.logoDataUrl) {
    logoHtml = `<img src="${cfg.logoDataUrl}" class="logo-img" alt="Logo" />\n`;
  }

  const bodyLines = [
    divider,
    logoHtml + headerLines + `<div class="center bold">NOTA DE REMISIÓN</div>`,
    divider,
    `Folio: ${escapeHtml(folio)}`,
    `Fecha: ${formatDate(date)}`,
    `Cliente: ${escapeHtml(data.client?.name || "N/A")}`,
    data.client?.address ? `Dirección: ${escapeHtml(data.client.address)}` : '',
    `Pago: ${paymentLabel}`,
    divider,
    cfg.paperWidth === "58mm"
      ? `Producto${' '.repeat(14)}Cant${' '.repeat(3)}P.U.${' '.repeat(5)}Imp.`
      : `Producto${' '.repeat(24)}Cant${' '.repeat(3)}P.U.${' '.repeat(5)}Imp.`,
    divider,
    productsText.trimEnd(),
    divider,
    `Piezas surtidas: ${totalPzas}`,
    `Subtotal:${' '.repeat(cfg.paperWidth === "58mm" ? 26 : 38)}$${subtotal.toFixed(2)}`,
    divider,
    `<div class="bold">TOTAL${' '.repeat(cfg.paperWidth === "58mm" ? 26 : 38)}$${total.toFixed(2)}</div>`,
    divider,
    `<div class="center">${escapeHtml(cfg.footerText || '¡Gracias por su compra!')}</div>`,
    divider,
  ];

  return `${style(cfg)}<div class="receipt">${bodyLines.filter(l => l !== '').join('\n')}</div>`;
}
