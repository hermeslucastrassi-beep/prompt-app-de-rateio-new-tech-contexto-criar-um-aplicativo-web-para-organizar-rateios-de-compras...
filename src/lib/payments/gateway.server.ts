// Camada de integração de pagamentos: interface única + adaptadores por plataforma.
// Nenhuma credencial é gravada em claro: tudo passa por criptografia AES-256-GCM.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { getRequestUrl } from "@tanstack/react-start/server";

import { db } from "../rateio.server";
import type {
  PaymentEnvironment,
  PaymentProviderId,
  PaymentSettingsView,
} from "./providers";

function encryptionKey() {
  const secret = process.env["SESSION_SECRET"];
  if (!secret) throw new Error("Configuração de segurança ausente no servidor.");
  return createHash("sha256").update(`payments:${secret}`).digest();
}

export function encryptSecret(plain: string): string {
  if (!plain) return "";
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv.toString("base64"), cipher.getAuthTag().toString("base64"), enc.toString("base64")].join(
    ".",
  );
}

export function decryptSecret(payload: string): string {
  if (!payload) return "";
  const [iv, tag, data] = payload.split(".");
  if (!iv || !tag || !data) return "";
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString(
    "utf8",
  );
}

export function maskCredential(last4: string) {
  return last4 ? `configurada • ••••${last4}` : "não configurada";
}

/** Contrato que qualquer plataforma de pagamento deve implementar. */
export type PaymentAdapter = {
  id: PaymentProviderId;
  /** Valida a credencial junto à plataforma (sem mover dinheiro). */
  testConnection(ctx: PaymentContext): Promise<{ ok: boolean; message: string }>;
  /** Cria uma cobrança para um conjunto de inscrições. Implementar na integração real. */
  createCharge(
    ctx: PaymentContext,
    input: { amount: number; description: string; reference: string; customer?: PaymentCustomer },
  ): Promise<{ id: string; checkoutUrl?: string; pixCode?: string }>;
  /** Verifica assinatura de webhook antes de confiar no payload. */
  verifyWebhook(
    ctx: PaymentContext,
    input: { rawBody: string; headers: Record<string, string> },
  ): Promise<boolean>;
};

export type PaymentContext = {
  provider: PaymentProviderId;
  environment: PaymentEnvironment;
  credential: string;
  webhookSecret: string;
  publicAccountId: string;
};

export type PaymentCustomer = {
  name?: string;
  email?: string;
  phone?: string;
};

function notImplemented(name: string): never {
  throw new Error(
    `A integração com ${name} ainda não foi implementada. Configure as credenciais e implemente o adaptador correspondente.`,
  );
}

function makeStubAdapter(id: PaymentProviderId, label: string): PaymentAdapter {
  return {
    id,
    async testConnection(ctx) {
      if (!ctx.credential) return { ok: false, message: "Credencial não configurada." };
      return {
        ok: true,
        message: `Credencial de ${label} armazenada com segurança (${ctx.environment === "live" ? "produção" : "teste"}). A validação online será feita quando o adaptador for implementado.`,
      };
    },
    async createCharge() {
      notImplemented(label);
    },
    async verifyWebhook() {
      return false;
    },
  };
}

function infinitePayBaseUrl(environment: PaymentEnvironment) {
  return environment === "live"
    ? "https://api.checkout.infinitepay.io"
    : "https://api.infinitepay.io/invoices/public/checkout";
}

function infinitePayRequest(ctx: PaymentContext, path: string, body: unknown) {
  const base = infinitePayBaseUrl(ctx.environment);
  const url = `${base}${path}`;
  return fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(body),
  });
}

function toCents(reais: number) {
  return Math.round(Math.max(0, reais) * 100);
}

function fromCents(cents: number) {
  return cents / 100;
}

function buildWebhookUrl(): string {
  const configured = process.env["PUBLIC_URL"];
  if (configured) return `${configured.replace(/\/$/, "")}/api/public/payments/webhook`;
  try {
    const url = getRequestUrl();
    if (url) {
      const u = new URL(url);
      u.pathname = "/api/public/payments/webhook";
      u.search = "";
      return u.toString();
    }
  } catch {
    /* ignore */
  }
  return "";
}

const infinitePayAdapter: PaymentAdapter = {
  id: "infinitepay",
  async testConnection(ctx) {
    const handle = ctx.publicAccountId.trim();
    if (!handle) return { ok: false, message: "InfiniteTag handle não configurado." };

    const res = await infinitePayRequest(ctx, "/links", {
      handle,
      items: [{ quantity: 1, price: 100, description: "Teste de conexão New Tech" }],
      order_nsu: `test-${Date.now()}`,
      redirect_url: buildWebhookUrl().replace("/webhook", ""),
    });

    if (!res.ok) {
      let message = `Erro ${res.status} ao chamar a InfinitePay.`;
      try {
        const body = (await res.json()) as { message?: string; error?: string };
        if (body.message) message = body.message;
        else if (body.error) message = body.error;
      } catch {
        /* ignore */
      }
      return { ok: false, message };
    }

    const body = (await res.json()) as { checkout_url?: string; link?: string; message?: string };
    if (!body.checkout_url && !body.link) {
      return { ok: false, message: body.message ?? "Resposta inesperada da InfinitePay." };
    }
    return { ok: true, message: `Conexão OK. Handle: ${handle} (${ctx.environment}).` };
  },
  async createCharge(ctx, input) {
    const handle = ctx.publicAccountId.trim();
    if (!handle) throw new Error("InfiniteTag handle não configurado.");

    const amountCents = toCents(input.amount);
    const res = await infinitePayRequest(ctx, "/links", {
      handle,
      items: [
        {
          quantity: 1,
          price: amountCents,
          description: input.description.slice(0, 200),
        },
      ],
      order_nsu: input.reference.slice(0, 100),
      redirect_url: buildWebhookUrl().replace("/webhook", "/return"),
      webhook_url: buildWebhookUrl(),
      ...(input.customer?.name || input.customer?.email || input.customer?.phone
        ? {
            customer: {
              name: input.customer.name?.slice(0, 120),
              email: input.customer.email?.slice(0, 120),
              phone_number: input.customer.phone?.slice(0, 20),
            },
          }
        : {}),
    });

    if (!res.ok) {
      let message = `Erro ${res.status} ao criar link de pagamento.`;
      try {
        const body = (await res.json()) as { message?: string; error?: string };
        if (body.message) message = body.message;
        else if (body.error) message = body.error;
      } catch {
        /* ignore */
      }
      throw new Error(message);
    }

    const body = (await res.json()) as { checkout_url?: string; link?: string; slug?: string };
    const checkoutUrl = body.checkout_url || body.link;
    if (!checkoutUrl) throw new Error("InfinitePay não retornou link de checkout.");
    return { id: body.slug ?? input.reference, checkoutUrl };
  },
  async verifyWebhook(ctx, input) {
    if (!ctx.webhookSecret) {
      // Sem segredo configurado, aceitamos o webhook por confiança de origem.
      // Em produção, recomenda-se configurar o segredo.
      return true;
    }
    const headerSecret = input.headers["x-webhook-secret"] ?? input.headers["x-infinitepay-signature"];
    return headerSecret === ctx.webhookSecret;
  },
};

const ADAPTERS: Record<PaymentProviderId, PaymentAdapter> = {
  none: {
    id: "none",
    async testConnection() {
      return { ok: true, message: "Modo manual: pagamentos confirmados pelo administrador." };
    },
    async createCharge() {
      notImplemented("modo manual");
    },
    async verifyWebhook() {
      return false;
    },
  },
  mercadopago: makeStubAdapter("mercadopago", "Mercado Pago"),
  infinitepay: infinitePayAdapter,
  asaas: makeStubAdapter("asaas", "Asaas"),
  custom: makeStubAdapter("custom", "plataforma genérica"),
};

export function getAdapter(id: PaymentProviderId): PaymentAdapter {
  return ADAPTERS[id] ?? ADAPTERS.none;
}

const DEFAULT_ROW = {
  active_provider: "none",
  environment: "sandbox",
  integration_status: "not_configured",
  public_account_id: "",
  credential_ciphertext: "",
  credential_last4: "",
  credential_configured_at: null as string | null,
  webhook_secret_ciphertext: "",
  last_test_message: "",
  last_tested_at: null as string | null,
  configured_at: null as string | null,
};

async function loadRow() {
  const { data, error } = await db.from("payment_settings").select("*").eq("id", 1).maybeSingle();
  if (error) throw new Error(error.message);
  return { ...DEFAULT_ROW, ...(data ?? {}) };
}

export async function loadPaymentSettingsView(): Promise<PaymentSettingsView> {
  const row = await loadRow();
  return {
    activeProvider: row.active_provider as PaymentProviderId,
    environment: row.environment as PaymentEnvironment,
    integrationStatus: row.integration_status as PaymentSettingsView["integrationStatus"],
    publicAccountId: row.public_account_id,
    credentialMask: maskCredential(row.credential_last4),
    credentialConfiguredAt: row.credential_configured_at,
    webhookConfigured: Boolean(row.webhook_secret_ciphertext),
    lastTestMessage: row.last_test_message,
    lastTestedAt: row.last_tested_at,
    configuredAt: row.configured_at,
  };
}

export async function loadPaymentContext(): Promise<PaymentContext> {
  const row = await loadRow();
  return {
    provider: row.active_provider as PaymentProviderId,
    environment: row.environment as PaymentEnvironment,
    credential: decryptSecret(row.credential_ciphertext),
    webhookSecret: decryptSecret(row.webhook_secret_ciphertext),
    publicAccountId: row.public_account_id,
  };
}

export async function loadPaymentPublicInfo() {
  const row = await loadRow();
  return {
    provider: row.active_provider as PaymentProviderId,
    environment: row.environment as PaymentEnvironment,
    status: row.integration_status as PaymentSettingsView["integrationStatus"],
    configured: row.active_provider !== "none" && row.integration_status === "configured",
  };
}

export async function savePaymentSettings(input: {
  provider: PaymentProviderId;
  environment: PaymentEnvironment;
  publicAccountId: string;
  credential?: string;
  webhookSecret?: string;
  clearCredential?: boolean;
}) {
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    active_provider: input.provider,
    environment: input.environment,
    public_account_id: input.publicAccountId.trim().slice(0, 200),
    configured_at: now,
    updated_at: now,
  };

  if (input.clearCredential) {
    patch["credential_ciphertext"] = "";
    patch["credential_last4"] = "";
    patch["credential_configured_at"] = null;
    patch["webhook_secret_ciphertext"] = "";
    patch["integration_status"] = "not_configured";
    patch["last_test_message"] = "";
    patch["last_tested_at"] = null;
  } else {
    const credential = input.credential?.trim();
    if (credential) {
      if (credential.length < 8) throw new Error("Credencial muito curta.");
      patch["credential_ciphertext"] = encryptSecret(credential);
      patch["credential_last4"] = credential.slice(-4);
      patch["credential_configured_at"] = now;
      patch["integration_status"] = "configured";
    }
    const webhookSecret = input.webhookSecret?.trim();
    if (webhookSecret) patch["webhook_secret_ciphertext"] = encryptSecret(webhookSecret);
    if (input.provider === "none") patch["integration_status"] = "not_configured";
  }

  const { error } = await db.from("payment_settings").upsert({ id: 1, ...patch });
  if (error) throw new Error(error.message);
  return loadPaymentSettingsView();
}

export async function testPaymentConnection() {
  const ctx = await loadPaymentContext();
  let result: { ok: boolean; message: string };
  try {
    result = await getAdapter(ctx.provider).testConnection(ctx);
  } catch (err) {
    result = { ok: false, message: (err as Error).message };
  }
  const { error } = await db
    .from("payment_settings")
    .upsert({
      id: 1,
      last_test_message: result.message.slice(0, 400),
      last_tested_at: new Date().toISOString(),
      integration_status: result.ok
        ? ctx.provider === "none"
          ? "not_configured"
          : "configured"
        : "error",
      updated_at: new Date().toISOString(),
    });
  if (error) throw new Error(error.message);
  return { ...result, settings: await loadPaymentSettingsView() };
}

export async function createCheckoutCharge(input: {
  signupIds: string[];
  customer?: PaymentCustomer;
}) {
  const ctx = await loadPaymentContext();
  if (ctx.provider === "none" || !ctx.publicAccountId) {
    throw new Error("Nenhuma plataforma de pagamento configurada.");
  }

  const { data: rows, error } = await db
    .from("signups")
    .select("id,name,email,phone,quantity,product_id,products(name,total_value,units_per_batch)")
    .in("id", input.signupIds);
  if (error) throw new Error(error.message);
  if (!rows || rows.length === 0) throw new Error("Inscrições não encontradas.");

  const reference = `nt-${Date.now()}-${randomBytes(4).toString("hex")}`;
  const amount = rows.reduce((sum, r) => {
    const product = Array.isArray(r.products) ? r.products[0] : (r.products as { total_value: number; units_per_batch: number } | null);
    if (!product) throw new Error("Produto não encontrado para uma das inscrições.");
    return sum + (Number(product.total_value) / product.units_per_batch) * r.quantity;
  }, 0);

  const { id, checkoutUrl } = await getAdapter(ctx.provider).createCharge(ctx, {
    amount,
    description: `Rateio New Tech — ${rows.length} inscrição(ões)`,
    reference,
    customer: input.customer,
  });

  const { error: ue } = await db.from("signups").update({ reference }).in("id", input.signupIds);
  if (ue) throw new Error(ue.message);

  return { id, checkoutUrl, reference, amount };
}

export async function confirmSignupsByReference(reference: string) {
  const { error } = await db
    .from("signups")
    .update({ status: "confirmed" })
    .eq("reference", reference)
    .neq("status", "confirmed");
  if (error) throw new Error(error.message);
  return { ok: true };
}
