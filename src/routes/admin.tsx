import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Check, Loader2, LogOut, MessageCircle, PackageCheck, Trash2 } from "lucide-react";

import {
  adminCloseBatch,
  adminCreateProduct,
  adminDeleteProduct,
  adminDeleteSignup,
  adminGetData,
  adminLogin,
  adminLogout,
  adminSaveSettings,
  adminSetStatus,
} from "@/lib/rateio.functions";
import { allocateBatches, brl, perVial, prettyPhone, whatsappHref } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Administração — Rateio New Tech" },
      {
        name: "description",
        content:
          "Área do administrador do rateio New Tech: cadastro de produtos, confirmação de pagamentos e configurações.",
      },
      { property: "og:title", content: "Administração — Rateio New Tech" },
      {
        property: "og:description",
        content: "Gerencie produtos, inscritos, lotes e formas de pagamento do grupo New Tech.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

type AdminSignup = {
  id: string;
  name: string;
  email: string;
  phone: string;
  quantity: number;
  status: string;
  created_at: string;
};

type AdminProduct = {
  id: string;
  name: string;
  total_value: number;
  units_per_batch: number;
  closed_batches: number;
  signups: AdminSignup[];
};

type AdminSettings = {
  pix_key: string;
  card_link: string;
  whatsapp: string;
  payment_days: number;
};

type AdminPayload = { products: AdminProduct[]; settings: AdminSettings };

function AdminPage() {
  const fetchData = useServerFn(adminGetData);
  const { data, isPending } = useQuery({ queryKey: ["admin-data"], queryFn: () => fetchData() });
  const queryClient = useQueryClient();

  if (isPending) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-5 animate-spin text-primary" />
      </main>
    );
  }

  if (!data?.authed) return <LoginScreen />;

  const payload: AdminPayload = { products: data.products, settings: data.settings };
  const update = (next: AdminPayload) =>
    queryClient.setQueryData(["admin-data"], { authed: true, ...next });

  return (
    <main className="min-h-screen bg-background">
      <header className="bg-hero border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-5 py-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">
              New Tech
            </p>
            <h1 className="mt-1 text-2xl font-bold">Administração</h1>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/">
                <ArrowLeft className="size-4" /> Lista
              </Link>
            </Button>
            <LogoutButton />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-5 py-8">
        <Tabs defaultValue="resumo">
          <TabsList className="w-full">
            <TabsTrigger value="resumo" className="flex-1">
              Resumo geral
            </TabsTrigger>
            <TabsTrigger value="produtos" className="flex-1">
              Produtos
            </TabsTrigger>
            <TabsTrigger value="config" className="flex-1">
              Configurações
            </TabsTrigger>
          </TabsList>

          <TabsContent value="resumo" className="mt-6 space-y-5">
            {payload.products.length === 0 && (
              <p className="text-sm text-muted-foreground">Cadastre um produto para começar.</p>
            )}
            {payload.products.map((product) => (
              <SummaryCard
                key={product.id}
                product={product}
                settings={payload.settings}
                onUpdate={update}
              />
            ))}
          </TabsContent>

          <TabsContent value="produtos" className="mt-6 space-y-5">
            <ProductForm onUpdate={update} />
            <ProductList products={payload.products} onUpdate={update} />
          </TabsContent>

          <TabsContent value="config" className="mt-6">
            <SettingsForm settings={payload.settings} onUpdate={update} />
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}

function LoginScreen() {
  const login = useServerFn(adminLogin);
  const [password, setPassword] = useState("");
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => login({ data: { password } }),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error("Senha incorreta.");
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["admin-data"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <main className="flex min-h-screen items-center justify-center bg-hero px-5">
      <Card className="w-full max-w-sm shadow-panel">
        <CardHeader>
          <h1 className="text-xl font-semibold">Área do administrador</h1>
          <p className="text-sm text-muted-foreground">Informe a senha de administrador.</p>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              mutation.mutate();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="admin-password">Senha</Label>
              <Input
                id="admin-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="size-4 animate-spin" />} Entrar
            </Button>
          </form>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            <Link to="/" className="underline">
              Voltar para a lista pública
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}

function LogoutButton() {
  const logout = useServerFn(adminLogout);
  const queryClient = useQueryClient();
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={async () => {
        await logout({ data: undefined });
        queryClient.invalidateQueries({ queryKey: ["admin-data"] });
      }}
    >
      <LogOut className="size-4" /> Sair
    </Button>
  );
}

function SummaryCard({
  product,
  settings,
  onUpdate,
}: {
  product: AdminProduct;
  settings: AdminSettings;
  onUpdate: (p: AdminPayload) => void;
}) {
  const setStatus = useServerFn(adminSetStatus);
  const removeSignup = useServerFn(adminDeleteSignup);
  const closeBatch = useServerFn(adminCloseBatch);
  const unitPrice = perVial(product.total_value, product.units_per_batch);
  const allocated = allocateBatches(product.signups, product.units_per_batch);
  const currentBatch = product.closed_batches;
  const inCurrent = allocated
    .filter((a) => a.batchIndex === currentBatch)
    .reduce((s, a) => s + a.row.quantity, 0);
  const canClose = inCurrent >= product.units_per_batch;

  const run = async (fn: () => Promise<AdminPayload>, message: string) => {
    try {
      onUpdate(await fn());
      toast.success(message);
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <Card className="shadow-panel">
      <CardHeader className="gap-2 pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{product.name}</h2>
            <p className="text-sm text-muted-foreground">
              {brl(unitPrice)}/vial · lote de {product.units_per_batch} · {inCurrent}/
              {product.units_per_batch} reservados no lote atual · {product.closed_batches} fechados
            </p>
          </div>
          <Button
            size="sm"
            variant={canClose ? "default" : "outline"}
            onClick={() =>
              run(() => closeBatch({ data: { productId: product.id } }), "Lote fechado.")
            }
          >
            <PackageCheck className="size-4" /> Fechar lote
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {product.signups.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhum inscrito.</p>
        )}
        {allocated.map(({ row, batchIndex }) => (
          <div
            key={row.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium">
                {row.name}{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  · lote {batchIndex + 1}
                </span>
              </p>
              <p className="text-xs text-muted-foreground">
                {row.email} · {prettyPhone(row.phone)}
              </p>
              <p className="text-xs text-muted-foreground">
                {row.quantity} vial(is) · devido {brl(unitPrice * row.quantity)}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <Badge
                className={
                  row.status === "confirmed"
                    ? "bg-success text-success-foreground"
                    : "bg-warning text-warning-foreground"
                }
              >
                {row.status === "confirmed" ? "Confirmado" : "Aguardando"}
              </Badge>
              <Button
                size="icon"
                variant="ghost"
                aria-label="Alternar pagamento"
                onClick={() =>
                  run(
                    () =>
                      setStatus({
                        data: {
                          signupId: row.id,
                          status: row.status === "confirmed" ? "pending" : "confirmed",
                        },
                      }),
                    "Status atualizado.",
                  )
                }
              >
                <Check className="size-4" />
              </Button>
              <Button size="icon" variant="ghost" asChild aria-label="Abrir WhatsApp">
                <a
                  href={whatsappHref(
                    row.phone,
                    `Olá ${row.name}! Sobre o rateio de ${product.name}: ${row.quantity} vial(is), total ${brl(unitPrice * row.quantity)}. Prazo de ${settings.payment_days} dias.`,
                  )}
                  target="_blank"
                  rel="noreferrer"
                >
                  <MessageCircle className="size-4" />
                </a>
              </Button>
              <Button
                size="icon"
                variant="ghost"
                aria-label="Remover inscrito"
                onClick={() =>
                  run(
                    () => removeSignup({ data: { signupId: row.id } }),
                    "Participante removido.",
                  )
                }
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function ProductForm({ onUpdate }: { onUpdate: (p: AdminPayload) => void }) {
  const create = useServerFn(adminCreateProduct);
  const [name, setName] = useState("");
  const [totalValue, setTotalValue] = useState("");
  const [units, setUnits] = useState("10");

  const mutation = useMutation({
    mutationFn: () =>
      create({
        data: { name, totalValue: Number(totalValue), unitsPerBatch: Number(units) },
      }),
    onSuccess: (data) => {
      onUpdate(data);
      setName("");
      setTotalValue("");
      setUnits("10");
      toast.success("Produto cadastrado.");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const preview = perVial(Number(totalValue) || 0, Number(units) || 10);

  return (
    <Card className="shadow-panel">
      <CardHeader className="pb-3">
        <h2 className="text-lg font-semibold">Cadastrar produto</h2>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-4 sm:grid-cols-3"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          <div className="space-y-2 sm:col-span-3">
            <Label htmlFor="p-name">Nome do produto</Label>
            <Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="p-value">Valor total do lote (R$)</Label>
            <Input
              id="p-value"
              type="number"
              min={0}
              step="0.01"
              value={totalValue}
              onChange={(e) => setTotalValue(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="p-units">Unidades por lote</Label>
            <Input
              id="p-units"
              type="number"
              min={1}
              value={units}
              onChange={(e) => setUnits(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Valor por vial</Label>
            <p className="font-display text-xl text-primary">{brl(preview)}</p>
          </div>
          <div className="sm:col-span-3">
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="size-4 animate-spin" />} Cadastrar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function ProductList({
  products,
  onUpdate,
}: {
  products: AdminProduct[];
  onUpdate: (p: AdminPayload) => void;
}) {
  const remove = useServerFn(adminDeleteProduct);

  return (
    <Card className="shadow-panel">
      <CardHeader className="pb-3">
        <h2 className="text-lg font-semibold">Produtos cadastrados</h2>
      </CardHeader>
      <CardContent className="space-y-2">
        {products.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhum produto ainda.</p>
        )}
        {products.map((p) => (
          <div
            key={p.id}
            className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
          >
            <div>
              <p className="text-sm font-medium">{p.name}</p>
              <p className="text-xs text-muted-foreground">
                {brl(p.total_value)} · {p.units_per_batch} viais ·{" "}
                {brl(perVial(p.total_value, p.units_per_batch))}/vial · {p.signups.length} inscritos
              </p>
            </div>
            <Button
              size="icon"
              variant="ghost"
              aria-label={`Excluir ${p.name}`}
              onClick={async () => {
                try {
                  onUpdate(await remove({ data: { productId: p.id } }));
                  toast.success("Produto excluído.");
                } catch (err) {
                  toast.error((err as Error).message);
                }
              }}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function SettingsForm({
  settings,
  onUpdate,
}: {
  settings: AdminSettings;
  onUpdate: (p: AdminPayload) => void;
}) {
  const save = useServerFn(adminSaveSettings);
  const [form, setForm] = useState({
    pixKey: settings.pix_key,
    cardLink: settings.card_link,
    whatsapp: settings.whatsapp,
    paymentDays: String(settings.payment_days),
    newPassword: "",
  });

  useEffect(() => {
    setForm((f) => ({
      ...f,
      pixKey: settings.pix_key,
      cardLink: settings.card_link,
      whatsapp: settings.whatsapp,
      paymentDays: String(settings.payment_days),
    }));
  }, [settings]);

  const mutation = useMutation({
    mutationFn: () =>
      save({
        data: {
          pixKey: form.pixKey,
          cardLink: form.cardLink,
          whatsapp: form.whatsapp,
          paymentDays: Number(form.paymentDays),
          ...(form.newPassword ? { newPassword: form.newPassword } : {}),
        },
      }),
    onSuccess: (data) => {
      onUpdate(data);
      setForm((f) => ({ ...f, newPassword: "" }));
      toast.success("Configurações salvas.");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Card className="shadow-panel">
      <CardHeader className="pb-3">
        <h2 className="text-lg font-semibold">Configurações</h2>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="pix">Chave Pix</Label>
            <Input
              id="pix"
              value={form.pixKey}
              onChange={(e) => setForm({ ...form, pixKey: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="card">Link de pagamento por cartão (opcional)</Label>
            <Input
              id="card"
              type="url"
              placeholder="https://..."
              value={form.cardLink}
              onChange={(e) => setForm({ ...form, cardLink: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="wa">WhatsApp para comprovantes</Label>
            <Input
              id="wa"
              inputMode="tel"
              value={form.whatsapp}
              onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="days">Prazo de pagamento (dias)</Label>
            <Input
              id="days"
              type="number"
              min={1}
              max={90}
              value={form.paymentDays}
              onChange={(e) => setForm({ ...form, paymentDays: e.target.value })}
            />
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="newpass">Nova senha de administrador (opcional)</Label>
            <Input
              id="newpass"
              type="password"
              value={form.newPassword}
              onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
            />
          </div>

          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="size-4 animate-spin" />} Salvar
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
