export const brl = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    Number.isFinite(value) ? value : 0,
  );

export const perVial = (totalValue: number, unitsPerBatch: number) =>
  unitsPerBatch > 0 ? totalValue / unitsPerBatch : 0;

export const whatsappHref = (phone: string, text?: string) => {
  const digits = phone.replace(/\D/g, "");
  const full = digits.length <= 11 ? `55${digits}` : digits;
  return `https://wa.me/${full}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
};

export const prettyPhone = (phone: string) => {
  const d = phone.replace(/\D/g, "").slice(-11);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return phone;
};

/** Splits ordered signups into batches of `units` vials. */
export function allocateBatches<T extends { quantity: number }>(rows: T[], units: number) {
  let cursor = 0;
  return rows.map((row) => {
    const batchIndex = Math.floor(cursor / Math.max(1, units));
    cursor += row.quantity;
    return { row, batchIndex };
  });
}
