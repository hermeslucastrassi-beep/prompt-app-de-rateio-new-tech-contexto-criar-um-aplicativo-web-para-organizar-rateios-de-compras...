import { allocateBatches, brl, perVial, prettyPhone } from "./format";

type Signup = {
  id: string;
  name: string;
  email?: string;
  phone: string;
  quantity: number;
  status: string;
  created_at: string;
};

type Product = {
  id: string;
  name: string;
  total_value: number;
  units_per_batch: number;
  closed_batches: number;
  signups: Signup[];
};

type Settings = { pix_key: string; card_link: string; whatsapp: string; payment_days: number };

const escape = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function productSection(product: Product) {
  const units = product.units_per_batch;
  const unitPrice = perVial(product.total_value, units);
  const allocated = allocateBatches(product.signups, units);
  const reserved = product.signups.reduce((s, r) => s + r.quantity, 0);

  const rows = allocated
    .map(
      ({ row, batchIndex }) => `
        <tr>
          <td>${escape(row.name)}</td>
          <td>${escape(row.email ?? "")}</td>
          <td>${escape(prettyPhone(row.phone))}</td>
          <td class="num">${row.quantity}</td>
          <td class="num">${brl(unitPrice * row.quantity)}</td>
          <td>Lote ${batchIndex + 1}</td>
          <td>${row.status === "confirmed" ? "Confirmado" : "Aguardando pagamento"}</td>
        </tr>`,
    )
    .join("");

  return `
    <section>
      <h2>${escape(product.name)}</h2>
      <p class="meta">
        Lote de ${units} viais · Total do lote ${brl(product.total_value)} ·
        Valor por vial ${brl(unitPrice)} · Lotes fechados: ${product.closed_batches} ·
        Viais reservados: ${reserved}
      </p>
      ${
        rows
          ? `<table>
              <thead>
                <tr><th>Nome</th><th>E-mail</th><th>Telefone</th><th>Viais</th><th>Valor</th><th>Lote</th><th>Status</th></tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>`
          : `<p class="meta">Nenhum inscrito neste produto.</p>`
      }
    </section>`;
}

export function exportRateioPdf(products: Product[], settings: Settings) {
  const now = new Date().toLocaleString("pt-BR");
  const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>Rateio Nova era peptídeos — ${escape(now)}</title>
<style>
  @page { size: A4; margin: 16mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #14181f; margin: 0; font-size: 12px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  header { border-bottom: 2px solid #14181f; padding-bottom: 10px; margin-bottom: 18px; }
  header p { margin: 2px 0; color: #55606f; font-size: 11px; }
  section { margin-bottom: 22px; page-break-inside: avoid; }
  h2 { font-size: 15px; margin: 0 0 4px; }
  .meta { color: #55606f; margin: 0 0 8px; font-size: 11px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #d6dbe3; padding: 5px 7px; text-align: left; }
  th { background: #f1f4f8; font-size: 11px; }
  td.num, th.num { text-align: right; }
  footer { margin-top: 12px; color: #55606f; font-size: 10px; }
</style>
</head>
<body>
  <header>
    <h1>Rateio de compras — Nova era peptídeos</h1>
    <p>Gerado em ${escape(now)}</p>
    <p>Prazo de pagamento: ${settings.payment_days} dias${
      settings.pix_key ? ` · Chave Pix: ${escape(settings.pix_key)}` : ""
    }${settings.whatsapp ? ` · WhatsApp: ${escape(prettyPhone(settings.whatsapp))}` : ""}</p>
  </header>
  ${
    products.length
      ? products.map(productSection).join("")
      : `<p class="meta">Nenhum produto cadastrado.</p>`
  }
  <footer>Documento gerado automaticamente pelo aplicativo Nova era peptídeos.</footer>
  <script>window.onload = function () { window.focus(); window.print(); };</script>
</body>
</html>`;

  const win = window.open("", "_blank", "width=900,height=1000");
  if (!win) throw new Error("Permita pop-ups para gerar o PDF.");
  win.document.open();
  win.document.write(html);
  win.document.close();
}
