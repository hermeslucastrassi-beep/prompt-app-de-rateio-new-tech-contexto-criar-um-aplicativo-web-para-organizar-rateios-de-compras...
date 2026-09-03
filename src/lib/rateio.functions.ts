import { createServerFn } from "@tanstack/react-start";

export const getPublicData = createServerFn({ method: "GET" }).handler(async () => {
  const { loadPublicData } = await import("./rateio.server");
  return loadPublicData();
});

export const createSignup = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      productId: string;
      name: string;
      email: string;
      phone: string;
      quantity: number;
      pin: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    const { db, hashSecret, loadPublicData } = await import("./rateio.server");
    const name = data.name.trim().slice(0, 80);
    const email = data.email.trim().toLowerCase().slice(0, 255);
    const phone = data.phone.replace(/[^\d+]/g, "").slice(0, 20);
    const quantity = Math.max(1, Math.min(50, Math.floor(Number(data.quantity) || 1)));
    const pin = data.pin.trim();

    if (name.length < 2) throw new Error("Informe seu nome completo.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("E-mail inválido.");
    if (phone.length < 10) throw new Error("Telefone inválido (inclua o DDD).");
    if (!/^\d{4}$/.test(pin)) throw new Error("O PIN deve ter exatamente 4 dígitos.");

    const { data: product, error: pe } = await db
      .from("products")
      .select("id")
      .eq("id", data.productId)
      .maybeSingle();
    if (pe) throw new Error(pe.message);
    if (!product) throw new Error("Produto não encontrado.");

    const { error } = await db.from("signups").insert({
      product_id: data.productId,
      name,
      email,
      phone,
      quantity,
      pin_hash: hashSecret(pin),
    });
    if (error) throw new Error(error.message);
    return loadPublicData();
  });

export const createCartSignups = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      items: { productId: string; quantity: number }[];
      name: string;
      email: string;
      phone: string;
      pin: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    const { db, hashSecret, loadPublicData } = await import("./rateio.server");
    const name = data.name.trim().slice(0, 80);
    const email = data.email.trim().toLowerCase().slice(0, 255);
    const phone = data.phone.replace(/[^\d+]/g, "").slice(0, 20);
    const pin = data.pin.trim();

    if (name.length < 2) throw new Error("Informe seu nome completo.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("E-mail inválido.");
    if (phone.length < 10) throw new Error("Telefone inválido (inclua o DDD).");
    if (!/^\d{4}$/.test(pin)) throw new Error("O PIN deve ter exatamente 4 dígitos.");
    if (!Array.isArray(data.items) || data.items.length === 0)
      throw new Error("Seu carrinho está vazio.");

    const items = data.items.map((i) => ({
      productId: String(i.productId),
      quantity: Math.max(1, Math.min(50, Math.floor(Number(i.quantity) || 1))),
    }));

    const { data: products, error: pe } = await db
      .from("products")
      .select("id")
      .in(
        "id",
        items.map((i) => i.productId),
      );
    if (pe) throw new Error(pe.message);
    const valid = new Set((products ?? []).map((p) => p.id));
    const rows = items.filter((i) => valid.has(i.productId));
    if (rows.length === 0) throw new Error("Nenhum produto válido no carrinho.");

    const pinHash = hashSecret(pin);
    const { data: inserted, error } = await db
      .from("signups")
      .insert(
        rows.map((i) => ({
          product_id: i.productId,
          name,
          email,
          phone,
          quantity: i.quantity,
          pin_hash: pinHash,
        })),
      )
      .select("id");
    if (error) throw new Error(error.message);
    return { ...(await loadPublicData()), signupIds: (inserted ?? []).map((r) => r.id) };
  });

export const deleteOwnSignup = createServerFn({ method: "POST" })
  .inputValidator((data: { signupId: string; pin: string }) => data)
  .handler(async ({ data }) => {
    const { db, verifySecret, loadPublicData } = await import("./rateio.server");
    const { data: row, error } = await db
      .from("signups")
      .select("id,pin_hash")
      .eq("id", data.signupId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Inscrição não encontrada.");
    if (!verifySecret(data.pin.trim(), row.pin_hash)) throw new Error("PIN incorreto.");
    const { error: de } = await db.from("signups").delete().eq("id", row.id);
    if (de) throw new Error(de.message);
    return loadPublicData();
  });

export const adminLogin = createServerFn({ method: "POST" })
  .inputValidator((data: { password: string }) => data)
  .handler(async ({ data }) => {
    const { db, verifySecret, getAdminSession } = await import("./rateio.server");
    const { data: row, error } = await db
      .from("settings")
      .select("admin_password_hash")
      .eq("id", 1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row?.admin_password_hash || !verifySecret(data.password, row.admin_password_hash)) {
      return { ok: false as const };
    }
    const session = await getAdminSession();
    await session.update({ admin: true });
    return { ok: true as const };
  });

export const adminLogout = createServerFn({ method: "POST" }).handler(async () => {
  const { getAdminSession } = await import("./rateio.server");
  const session = await getAdminSession();
  await session.clear();
  return { ok: true as const };
});

export const adminGetData = createServerFn({ method: "GET" }).handler(async () => {
  const { getAdminSession, loadAdminData } = await import("./rateio.server");
  const session = await getAdminSession();
  if (!session.data.admin) return { authed: false as const };
  return { authed: true as const, ...(await loadAdminData()) };
});

export const adminCreateProduct = createServerFn({ method: "POST" })
  .inputValidator((data: { name: string; totalValue: number; unitsPerBatch: number }) => data)
  .handler(async ({ data }) => {
    const { db, requireAdmin, loadAdminData } = await import("./rateio.server");
    await requireAdmin();
    const name = data.name.trim().slice(0, 120);
    const totalValue = Number(data.totalValue);
    const units = Math.max(1, Math.min(500, Math.floor(Number(data.unitsPerBatch) || 10)));
    if (name.length < 2) throw new Error("Informe o nome do produto.");
    if (!Number.isFinite(totalValue) || totalValue <= 0) throw new Error("Valor total inválido.");
    const { error } = await db
      .from("products")
      .insert({ name, total_value: totalValue, units_per_batch: units });
    if (error) throw new Error(error.message);
    return loadAdminData();
  });

export const adminDeleteProduct = createServerFn({ method: "POST" })
  .inputValidator((data: { productId: string }) => data)
  .handler(async ({ data }) => {
    const { db, requireAdmin, loadAdminData } = await import("./rateio.server");
    await requireAdmin();
    const { error } = await db.from("products").delete().eq("id", data.productId);
    if (error) throw new Error(error.message);
    return loadAdminData();
  });

export const adminSetStatus = createServerFn({ method: "POST" })
  .inputValidator((data: { signupId: string; status: "pending" | "confirmed" }) => data)
  .handler(async ({ data }) => {
    const { db, requireAdmin, loadAdminData } = await import("./rateio.server");
    await requireAdmin();
    const { error } = await db
      .from("signups")
      .update({ status: data.status === "confirmed" ? "confirmed" : "pending" })
      .eq("id", data.signupId);
    if (error) throw new Error(error.message);
    return loadAdminData();
  });

export const adminDeleteSignup = createServerFn({ method: "POST" })
  .inputValidator((data: { signupId: string }) => data)
  .handler(async ({ data }) => {
    const { db, requireAdmin, loadAdminData } = await import("./rateio.server");
    await requireAdmin();
    const { error } = await db.from("signups").delete().eq("id", data.signupId);
    if (error) throw new Error(error.message);
    return loadAdminData();
  });

export const adminCloseBatch = createServerFn({ method: "POST" })
  .inputValidator((data: { productId: string }) => data)
  .handler(async ({ data }) => {
    const { db, requireAdmin, loadAdminData } = await import("./rateio.server");
    await requireAdmin();
    const { data: product, error } = await db
      .from("products")
      .select("id,closed_batches")
      .eq("id", data.productId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!product) throw new Error("Produto não encontrado.");
    const { error: ue } = await db
      .from("products")
      .update({ closed_batches: product.closed_batches + 1 })
      .eq("id", product.id);
    if (ue) throw new Error(ue.message);
    return loadAdminData();
  });

export const adminSaveSettings = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      pixKey: string;
      cardLink: string;
      whatsapp: string;
      paymentDays: number;
      newPassword?: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    const { db, requireAdmin, hashSecret, loadAdminData } = await import("./rateio.server");
    await requireAdmin();
    const patch: {
      pix_key: string;
      card_link: string;
      whatsapp: string;
      payment_days: number;
      updated_at: string;
      admin_password_hash?: string;
    } = {
      pix_key: data.pixKey.trim().slice(0, 255),
      card_link: data.cardLink.trim().slice(0, 500),
      whatsapp: data.whatsapp.replace(/[^\d+]/g, "").slice(0, 20),
      payment_days: Math.max(1, Math.min(90, Math.floor(Number(data.paymentDays) || 5))),
      updated_at: new Date().toISOString(),
    };
    const newPassword = data.newPassword?.trim();
    if (newPassword) {
      if (newPassword.length < 6) throw new Error("A nova senha deve ter ao menos 6 caracteres.");
      patch.admin_password_hash = hashSecret(newPassword);
    }
    const { error } = await db.from("settings").update(patch).eq("id", 1);
    if (error) throw new Error(error.message);
    return loadAdminData();
  });

/* ---------- Pagamentos: configuração do proprietário ---------- */

export const adminGetPaymentSettings = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAdmin } = await import("./rateio.server");
  await requireAdmin();
  const { loadPaymentSettingsView } = await import("./payments/gateway.server");
  return loadPaymentSettingsView();
});

export const adminSavePaymentSettings = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      provider: string;
      environment: string;
      publicAccountId: string;
      credential?: string;
      webhookSecret?: string;
      clearCredential?: boolean;
    }) => data,
  )
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./rateio.server");
    await requireAdmin();
    const { PAYMENT_PROVIDERS } = await import("./payments/providers");
    const { savePaymentSettings } = await import("./payments/gateway.server");
    const provider = PAYMENT_PROVIDERS.find((p) => p.id === data.provider)?.id;
    if (!provider) throw new Error("Plataforma de pagamento inválida.");
    const environment = data.environment === "live" ? "live" : "sandbox";
    return savePaymentSettings({
      provider,
      environment,
      publicAccountId: data.publicAccountId ?? "",
      ...(data.credential ? { credential: data.credential } : {}),
      ...(data.webhookSecret ? { webhookSecret: data.webhookSecret } : {}),
      ...(data.clearCredential ? { clearCredential: true } : {}),
    });
  });

export const adminTestPaymentConnection = createServerFn({ method: "POST" }).handler(async () => {
  const { requireAdmin } = await import("./rateio.server");
  await requireAdmin();
  const { testPaymentConnection } = await import("./payments/gateway.server");
  return testPaymentConnection();
});
