import { createServerFn } from "@tanstack/react-start";

export type StoreProduct = {
  id: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  image_url: string;
  active: boolean;
  created_at: string;
};

async function loadStore(onlyActive: boolean): Promise<StoreProduct[]> {
  const { db } = await import("./rateio.server");
  let query = db.from("store_products").select("*").order("created_at", { ascending: false });
  if (onlyActive) query = query.eq("active", true);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description ?? "",
    price: Number(p.price),
    stock: p.stock,
    image_url: p.image_url ?? "",
    active: p.active,
    created_at: p.created_at,
  }));
}

export const getStoreProducts = createServerFn({ method: "GET" }).handler(async () => {
  const [products, { loadSettings }] = await Promise.all([
    loadStore(true),
    import("./rateio.server"),
  ]);
  const settings = await loadSettings();
  return { products, settings };
});

export const adminGetStoreProducts = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAdmin } = await import("./rateio.server");
  await requireAdmin();
  return loadStore(false);
});

export const adminCreateStoreProduct = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      name: string;
      description: string;
      price: number;
      stock: number;
      imageUrl: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    const { db, requireAdmin } = await import("./rateio.server");
    await requireAdmin();
    const name = (data.name ?? "").trim();
    if (name.length < 2) throw new Error("Informe o nome do produto.");
    const price = Number(data.price);
    if (!Number.isFinite(price) || price <= 0) throw new Error("Informe um preço válido.");
    const stock = Math.max(0, Math.floor(Number(data.stock) || 0));
    const { error } = await db.from("store_products").insert({
      name,
      description: (data.description ?? "").trim(),
      price,
      stock,
      image_url: (data.imageUrl ?? "").trim(),
      active: true,
    });
    if (error) throw new Error(error.message);
    return loadStore(false);
  });

export const adminUpdateStoreProduct = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string; stock?: number; active?: boolean }) => data)
  .handler(async ({ data }) => {
    const { db, requireAdmin } = await import("./rateio.server");
    await requireAdmin();
    const patch: { stock?: number; active?: boolean } = {};
    if (typeof data.stock === "number") patch.stock = Math.max(0, Math.floor(data.stock));
    if (typeof data.active === "boolean") patch.active = data.active;
    if (Object.keys(patch).length === 0) return loadStore(false);
    const { error } = await db.from("store_products").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return loadStore(false);
  });

export const adminDeleteStoreProduct = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const { db, requireAdmin } = await import("./rateio.server");
    await requireAdmin();
    const { error } = await db.from("store_products").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return loadStore(false);
  });
