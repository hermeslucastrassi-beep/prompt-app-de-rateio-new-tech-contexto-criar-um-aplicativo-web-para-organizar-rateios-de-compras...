// Registro de plataformas de pagamento suportadas pela arquitetura.
// Nenhuma credencial real vive aqui: apenas metadados de configuração.

export type PaymentProviderId = "none" | "mercadopago" | "infinitepay" | "asaas" | "custom";

export type PaymentEnvironment = "sandbox" | "live";

export type PaymentProviderMeta = {
  id: PaymentProviderId;
  label: string;
  description: string;
  credentialLabel: string;
  credentialHint: string;
  accountIdLabel: string;
  docsUrl?: string;
  supportsWebhook: boolean;
};

export const PAYMENT_PROVIDERS: PaymentProviderMeta[] = [
  {
    id: "none",
    label: "Nenhuma (somente Pix manual)",
    description:
      "Os participantes pagam via Pix/cartão informados nas configurações e o administrador confirma manualmente.",
    credentialLabel: "—",
    credentialHint: "",
    accountIdLabel: "—",
    supportsWebhook: false,
  },
  {
    id: "mercadopago",
    label: "Mercado Pago",
    description: "Checkout Pro e Pix via API do Mercado Pago.",
    credentialLabel: "Access Token",
    credentialHint: "Painel do Mercado Pago → Suas integrações → Credenciais.",
    accountIdLabel: "User ID / Public Key",
    docsUrl: "https://www.mercadopago.com.br/developers",
    supportsWebhook: true,
  },
  {
    id: "infinitepay",
    label: "InfinitePay",
    description: "Links de pagamento e Pix via API da InfinitePay.",
    credentialLabel: "API Key",
    credentialHint: "Painel InfinitePay → Desenvolvedores → Chaves de API.",
    accountIdLabel: "Handle da conta",
    docsUrl: "https://developers.infinitepay.io",
    supportsWebhook: true,
  },
  {
    id: "asaas",
    label: "Asaas",
    description: "Cobranças Pix, boleto e cartão via API do Asaas.",
    credentialLabel: "API Key",
    credentialHint: "Painel Asaas → Integrações → Chave de API.",
    accountIdLabel: "Identificador da conta",
    docsUrl: "https://docs.asaas.com",
    supportsWebhook: true,
  },
  {
    id: "custom",
    label: "Outra plataforma (genérica)",
    description: "Integração genérica por API key, para adaptar a qualquer gateway.",
    credentialLabel: "API Key / Token",
    credentialHint: "Consulte a documentação da plataforma escolhida.",
    accountIdLabel: "Identificador público",
    supportsWebhook: true,
  },
];

export function providerMeta(id: string): PaymentProviderMeta {
  return PAYMENT_PROVIDERS.find((p) => p.id === id) ?? PAYMENT_PROVIDERS[0]!;
}

export type PaymentSettingsView = {
  activeProvider: PaymentProviderId;
  environment: PaymentEnvironment;
  integrationStatus: "not_configured" | "configured" | "error";
  publicAccountId: string;
  credentialMask: string;
  credentialConfiguredAt: string | null;
  webhookConfigured: boolean;
  lastTestMessage: string;
  lastTestedAt: string | null;
  configuredAt: string | null;
};
