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

function buildStyle(cfg: ReturnType<typeof getBusinessConfig>): string {
  return `
  <style>
    .receipt {
      font-family: ${cfg.fontFamily};
      font-size: ${cfg.fontSize}px;
      color: #000;
      box-sizing: border-box;
      width: 100%;
      padding-top: ${cfg.marginTop}px;
      padding-bottom: ${cfg.marginBottom}px;
      padding-left: ${cfg.marginLeft}px;
      padding-right: ${cfg.marginRight}px;
      line-height: 1.3;
    }
    .center { text-align: center; }
    .bold { font-weight: bold; }
    .divider { border-top: 1px dashed #000; margin: 4px 0; }
    .products-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    .products-table th, .products-table td {
      padding: 2px 2px;
      vertical-align: top;
      word-break: break-word;
      font-family: inherit;
      font-size: inherit;
    }
    .products-table th { border-bottom: 1px solid #000; font-weight: bold; text-align: left; }
    .col-name { width: 40%; text-align: left; }
    .col-qty { width: 18%; text-align: right; }
    .col-price { width: 21%; text-align: right; }
    .col-total { width: 21%; text-align: right; }
    .totals-row { display: flex; justify-content: space-between; }
    .logo-img { max-width: 150px; max-height: 50px; display: block; margin: 0 auto; }
    img { display: block; }
  </style>
`;
}

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

  let logoHtml = '';
  if (cfg.logoDataUrl) {
    logoHtml = `<img src="${cfg.logoDataUrl}" class="logo-img" alt="Logo" />`;
  }
  let headerLines = '';
  if (cfg.title) {
    headerLines += `<div class="center bold">${escapeHtml(cfg.title)}</div>`;
  }
  if (cfg.subtitle) {
    headerLines += `<div class="center">${escapeHtml(cfg.subtitle)}</div>`;
  }

  const productRows = lines.map(l => `
    <tr>
      <td class="col-name">${escapeHtml(l.name)}</td>
      <td class="col-qty">${l.qty}</td>
      <td class="col-price">$${l.price.toFixed(2)}</td>
      <td class="col-total">$${l.total.toFixed(2)}</td>
    </tr>
  `).join('');

  return `${buildStyle(cfg)}
<div class="receipt">
  ${logoHtml}
  ${headerLines}
  <div class="center bold">NOTA DE REMISIÓN</div>
  <div class="divider"></div>
  <div>Folio: ${escapeHtml(folio)}</div>
  <div>Fecha: ${formatDate(date)}</div>
  <div>Cliente: ${escapeHtml(data.client?.name || "N/A")}</div>
  ${data.client?.address ? `<div>Dirección: ${escapeHtml(data.client.address)}</div>` : ''}
  <div>Pago: ${paymentLabel}</div>
  <div class="divider"></div>
  <table class="products-table">
    <thead>
      <tr>
        <th class="col-name">Producto</th>
        <th class="col-qty">Cant</th>
        <th class="col-price">P.U.</th>
        <th class="col-total">Imp.</th>
      </tr>
    </thead>
    <tbody>
      ${productRows}
    </tbody>
  </table>
  <div class="divider"></div>
  <div>Piezas surtidas: ${totalPzas}</div>
  <div class="totals-row"><span>Subtotal:</span><span>$${subtotal.toFixed(2)}</span></div>
  <div class="divider"></div>
  <div class="totals-row bold"><span>TOTAL</span><span>$${total.toFixed(2)}</span></div>
  <div class="divider"></div>
  <div class="center">${escapeHtml(cfg.footerText || '¡Gracias por su compra!')}</div>
</div>`;
}
