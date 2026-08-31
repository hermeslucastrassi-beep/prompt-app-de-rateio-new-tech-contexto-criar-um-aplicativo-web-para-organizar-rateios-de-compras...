import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, PlugZap, ShieldCheck, Trash2 } from "lucide-react";

import { adminGetPaymentSettings, adminSavePaymentSettings, adminTestPaymentConnection } from "@/lib/rateio.functions";
import { PAYMENT_PROVIDERS, providerMeta } from "@/lib/payments/providers";
import type { PaymentSettingsView } from "@/lib/payments/providers";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

const STATUS_LABEL: Record<PaymentSettingsView["integrationStatus"], string> = {
  not_configured: "Não configurada",
  configured: "Configurada",
  error: "Com erro",
};

export function PaymentSettingsPanel() {
  const fetchSettings = useServerFn(adminGetPaymentSettings);
  const save = useServerFn(adminSavePaymentSettings);
  const test = useServerFn(adminTestPaymentConnection);
  const queryClient = useQueryClient();

  const { data, isPending } = useQuery({
    queryKey: ["payment-settings"],
    queryFn: () => fetchSettings(),
  });

  const [provider, setProvider] = useState("none");
  const [environment, setEnvironment] = useState("sandbox");
  const [accountId, setAccountId] = useState("");
  const [credential, setCredential] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");

  useEffect(() => {
    if (!data) return;
    setProvider(data.activeProvider);
    setEnvironment(data.environment);
    setAccountId(data.publicAccountId);
  }, [data]);

  const setSettings = (next: PaymentSettingsView) =>
    queryClient.setQueryData(["payment-settings"], next);

  const saveMutation = useMutation({
    mutationFn: (clear?: boolean) =>
      save({
        data: {
          provider,
          environment,
          publicAccountId: accountId,
          ...(clear ? { clearCredential: true } : {}),
          ...(!clear && credential ? { credential } : {}),
          ...(!clear && webhookSecret ? { webhookSecret } : {}),
        },
      }),
    onSuccess: (next) => {
      setSettings(next);
      setCredential("");
      setWebhookSecret("");
      toast.success("Configuração de pagamentos salva.");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const testMutation = useMutation({
    mutationFn: () => test({ data: undefined }),
    onSuccess: (result) => {
      setSettings(result.settings);
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isPending || !data) {
    return (
      <Card className="shadow-panel">
        <CardContent className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Carregando pagamentos…
        </CardContent>
      </Card>
    );
  }

  const meta = providerMeta(provider);
  const isManual = provider === "none";

  return (
    <Card className="shadow-panel">
      <CardHeader className="gap-2 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Pagamentos</h2>
          <Badge
            className={
              data.integrationStatus === "configured"
                ? "bg-success text-success-foreground"
                : data.integrationStatus === "error"
                  ? "bg-destructive text-destructive-foreground"
                  : "bg-warning text-warning-foreground"
            }
          >
            {STATUS_LABEL[data.integrationStatus]}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          O proprietário do aplicativo conecta aqui a própria plataforma de pagamentos. As
          credenciais são criptografadas no servidor e nunca são exibidas de volta.
        </p>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            saveMutation.mutate(undefined);
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="pay-provider">Plataforma de pagamentos</Label>
            <select
              id="pay-provider"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
            >
              {PAYMENT_PROVIDERS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">{meta.description}</p>
          </div>

          {!isManual && (
            <>
              <div className="space-y-2">
                <Label htmlFor="pay-env">Ambiente</Label>
                <select
                  id="pay-env"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={environment}
                  onChange={(e) => setEnvironment(e.target.value)}
                >
                  <option value="sandbox">Teste (sandbox)</option>
                  <option value="live">Produção</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="pay-account">{meta.accountIdLabel}</Label>
                <Input
                  id="pay-account"
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  placeholder="Identificador público da conta"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="pay-cred">{meta.credentialLabel}</Label>
                <Input
                  id="pay-cred"
                  type="password"
                  autoComplete="off"
                  value={credential}
                  onChange={(e) => setCredential(e.target.value)}
                  placeholder={data.credentialMask}
                />
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <ShieldCheck className="size-3.5 text-primary" />
                  {data.credentialMask}
                  {meta.credentialHint ? ` · ${meta.credentialHint}` : ""}
                </p>
              </div>

              {meta.supportsWebhook && (
                <div className="space-y-2">
                  <Label htmlFor="pay-webhook">Segredo do webhook (opcional)</Label>
                  <Input
                    id="pay-webhook"
                    type="password"
                    autoComplete="off"
                    value={webhookSecret}
                    onChange={(e) => setWebhookSecret(e.target.value)}
                    placeholder={data.webhookConfigured ? "configurado" : "não configurado"}
                  />
                  <p className="text-xs text-muted-foreground">
                    URL para configurar na plataforma:{" "}
                    <code className="rounded bg-muted px-1">/api/public/payments/webhook</code>
                  </p>
                </div>
              )}
            </>
          )}

          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="size-4 animate-spin" />} Salvar
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={testMutation.isPending}
              onClick={() => testMutation.mutate()}
            >
              {testMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <PlugZap className="size-4" />
              )}{" "}
              Testar conexão
            </Button>
            {data.integrationStatus !== "not_configured" && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => saveMutation.mutate(true)}
                disabled={saveMutation.isPending}
              >
                <Trash2 className="size-4" /> Remover credenciais
              </Button>
            )}
          </div>

          <Separator />

          <dl className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
            <div>
              <dt className="font-medium text-foreground">Credencial salva em</dt>
              <dd>
                {data.credentialConfiguredAt
                  ? new Date(data.credentialConfiguredAt).toLocaleString("pt-BR")
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">Última configuração</dt>
              <dd>{data.configuredAt ? new Date(data.configuredAt).toLocaleString("pt-BR") : "—"}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="font-medium text-foreground">Último teste</dt>
              <dd>
                {data.lastTestedAt
                  ? `${new Date(data.lastTestedAt).toLocaleString("pt-BR")} — ${data.lastTestMessage}`
                  : "nenhum teste executado"}
              </dd>
            </div>
          </dl>
        </form>
      </CardContent>
    </Card>
  );
}
