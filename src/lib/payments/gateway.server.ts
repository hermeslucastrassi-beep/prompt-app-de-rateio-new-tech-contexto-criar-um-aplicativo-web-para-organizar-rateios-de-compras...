// Camada de integração de pagamentos: interface única + adaptadores por plataforma.
// Nenhuma credencial é gravada em claro: tudo passa por criptografia AES-256-GCM.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

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
    input: { amount: number; description: string; reference: string },
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
  infinitepay: makeStubAdapter("infinitepay", "InfinitePay"),
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
