import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Copy, CreditCard, Loader2, Trash2 } from "lucide-react";

import { createCartSignups, getPublicData, startCheckout } from "@/lib/rateio.functions";
import { brl, perVial, whatsappHref } from "@/lib/format";
import { useCart } from "@/lib/cart";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/carrinho")({
  head: () => ({
    meta: [
      { title: "Carrinho — Rateio New Tech" },
      {
        name: "description",
        content:
          "Revise os viais escolhidos em todos os produtos e finalize a inscrição do rateio New Tech em um único pagamento.",
      },
      { property: "og:title", content: "Carrinho — Rateio New Tech" },
      {
        property: "og:description",
        content: "Finalize todas as suas reservas de viais de uma só vez.",
      },
    ],
  }),
  component: CartPage,
});

const PROFILE_KEY = "newtech.profile";
type Profile = { name: string; email: string; phone: string };

function CartPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fetcher = useServerFn(getPublicData);
  const { data, isPending } = useQuery({ queryKey: ["public-data"], queryFn: () => fetcher() });
  const { items, setQuantity, removeItem, clear } = useCart();
  const [profile, setProfile] = useState<Profile>({ name: "", email: "", phone: "" });
  const [pin, setPin] = useState("");
  const submit = useServerFn(createCartSignups);
  const checkoutFn = useServerFn(startCheckout);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PROFILE_KEY);
      if (raw) setProfile(JSON.parse(raw) as Profile);
    } catch {
      /* ignore */
    }
  }, []);

  const lines = items.map((item) => {
    const product = data?.products.find((p) => p.id === item.productId);
    const unitPrice = product ? perVial(product.total_value, product.units_per_batch) : 0;
    return {
      ...item,
      name: product?.name ?? item.name,
      unitPrice,
      subtotal: unitPrice * item.quantity,
      missing: Boolean(data) && !product,
    };
  });
  const total = lines.reduce((s, l) => s + l.subtotal, 0);

  const mutation = useMutation({
    mutationFn: () =>
      submit({
        data: {
          items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
          name: profile.name,
          email: profile.email,
          phone: profile.phone,
          pin,
        },
      }),
    onSuccess: async (result) => {
      const { signupIds, ...publicData } = result;
      queryClient.setQueryData(["public-data"], publicData);
      localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
      clear();
      setPin("");

      if (publicData.payment?.configured && signupIds.length > 0) {
        try {
          toast.success("Inscrições registradas! Abrindo pagamento…");
          const checkout = await checkout_fn({
            data: {
              signupIds,
              name: profile.name,
              email: profile.email,
              phone: profile.phone,
            },
          });
          window.location.href = checkout.checkoutUrl;
          return;
        } catch (err) {
          toast.error(
            `Inscrições salvas, mas o link de pagamento falhou: ${(err as Error).message}. Use o Pix manual.`,
          );
          navigate({ to: "/rateio" });
          return;
        }
      }

      toast.success("Inscrições registradas! Faça o pagamento total e envie o comprovante.");
      navigate({ to: "/rateio" });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const settings = data?.settings;

  const copyPix = async () => {
    if (!settings?.pix_key) return;
    try {
      await navigator.clipboard.writeText(settings.pix_key);
      toast.success("Chave Pix copiada!");
    } catch {
      toast.error("Não foi possível copiar a chave.");
    }
  };

  return (
    <main className="min-h-screen bg-background">
      <header className="bg-hero border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-5 py-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">
              Grupo New Tech
            </p>
            <h1 className="mt-2 text-2xl font-bold sm:text-3xl">Seu carrinho</h1>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/rateio">
              <ArrowLeft className="size-4" /> Produtos
            </Link>
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-3xl space-y-6 px-5 py-8">
        {isPending && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Carregando...
          </div>
        )}

        {items.length === 0 ? (
          <Card>
            <CardContent className="space-y-4 py-10 text-center">
              <p className="text-sm text-muted-foreground">Seu carrinho está vazio.</p>
              <Button asChild>
                <Link to="/rateio">Ver produtos</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="shadow-panel">
              <CardHeader className="pb-2">
                <h2 className="text-lg font-semibold">Itens</h2>
              </CardHeader>
              <CardContent className="space-y-3">
                {lines.map((line) => (
                  <div
                    key={line.productId}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{line.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {line.missing
                          ? "Produto não está mais disponível"
                          : `${brl(line.unitPrice)} por vial`}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Input
                        type="number"
                        min={1}
                        max={50}
                        className="w-20"
                        aria-label={`Quantidade de viais de ${line.name}`}
                        value={line.quantity}
                        onChange={(e) => setQuantity(line.productId, Number(e.target.value))}
                      />
                      <span className="w-24 text-right text-sm text-primary">
                        {brl(line.subtotal)}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Remover ${line.name}`}
                        onClick={() => removeItem(line.productId)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between border-t border-border pt-3">
                  <span className="text-sm text-muted-foreground">Total a pagar</span>
                  <span className="font-display text-2xl text-primary">{brl(total)}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-panel">
              <CardHeader className="pb-2">
                <h2 className="text-lg font-semibold">Seus dados</h2>
                <p className="text-sm text-muted-foreground">
                  Nome, telefone e quantidade ficam visíveis nas listas. O e-mail é usado apenas para
                  contato interno.
                </p>
              </CardHeader>
              <CardContent>
                <form
                  className="space-y-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const email = profile.email.trim().toLowerCase();
                    if (profile.name.trim().length < 2) {
                      toast.error("Informe seu nome completo.");
                      return;
                    }
                    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
                      toast.error("E-mail inválido.");
                      return;
                    }
                    if (profile.phone.replace(/[^\d+]/g, "").length < 10) {
                      toast.error("Telefone inválido (inclua o DDD).");
                      return;
                    }
                    if (!/^\d{4}$/.test(pin)) {
                      toast.error("O PIN deve ter exatamente 4 dígitos.");
                      return;
                    }
                    mutation.mutate();
                  }}
                >
                  <div className="space-y-2">
                    <Label htmlFor="cart-name">Nome</Label>
                    <Input
                      id="cart-name"
                      value={profile.name}
                      maxLength={80}
                      onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cart-email">E-mail (não aparece na lista)</Label>
                    <Input
                      id="cart-email"
                      type="email"
                      value={profile.email}
                      maxLength={255}
                      onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cart-phone">WhatsApp com DDD</Label>
                    <Input
                      id="cart-phone"
                      inputMode="tel"
                      value={profile.phone}
                      maxLength={20}
                      onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cart-pin">Seu PIN (4 dígitos)</Label>
                    <Input
                      id="cart-pin"
                      inputMode="numeric"
                      pattern="\d{4}"
                      maxLength={4}
                      value={pin}
                      onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      Guarde o PIN: ele permite excluir suas próprias inscrições.
                      {settings ? ` Prazo de pagamento: ${settings.payment_days} dias.` : ""}
                    </p>
                  </div>
                  <Button type="submit" className="w-full" disabled={mutation.isPending}>
                    {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
                    Finalizar inscrição — {brl(total)}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {settings && (settings.pix_key || settings.card_link || settings.whatsapp) && (
              <Card className="shadow-panel">
                <CardHeader className="pb-2">
                  <h2 className="text-lg font-semibold">Pagamento</h2>
                  <p className="text-sm text-muted-foreground">
                    Pague o total de {brl(total)} de uma vez e envie o comprovante pelo WhatsApp do
                    administrador.
                  </p>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  {settings.pix_key && (
                    <Button variant="secondary" onClick={copyPix}>
                      <Copy className="size-4" /> Copiar chave Pix
                    </Button>
                  )}
                  {settings.card_link && (
                    <Button asChild variant="secondary">
                      <a href={settings.card_link} target="_blank" rel="noreferrer">
                        <CreditCard className="size-4" /> Pagar com cartão
                      </a>
                    </Button>
                  )}
                  {settings.whatsapp && (
                    <Button asChild>
                      <a
                        href={whatsappHref(
                          settings.whatsapp,
                          `Olá! Segue o comprovante do rateio New Tech (total ${brl(total)}).`,
                        )}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Enviar comprovante
                      </a>
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </main>
  );
}
