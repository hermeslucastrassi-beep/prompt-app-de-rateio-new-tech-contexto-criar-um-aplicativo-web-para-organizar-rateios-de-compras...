import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, Copy, CreditCard, Loader2, MessageCircle } from "lucide-react";

import { getStoreProducts } from "@/lib/store.functions";
import { brl, whatsappHref } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/loja")({
  head: () => ({
    meta: [
      { title: "Loja a Pronta Entrega — New Tech" },
      {
        name: "description",
        content:
          "Produtos New Tech disponíveis a pronta entrega: veja preço, estoque e feche o pedido direto pelo WhatsApp.",
      },
      { property: "og:title", content: "Loja a Pronta Entrega — New Tech" },
      {
        property: "og:description",
        content: "Estoque imediato, sem esperar o fechamento de lote. Preços e disponibilidade atualizados.",
      },
    ],
  }),
  component: StorePage,
});

function StorePage() {
  const fetcher = useServerFn(getStoreProducts);
  const { data, isPending, error } = useQuery({
    queryKey: ["store-products"],
    queryFn: () => fetcher(),
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
        <div className="mx-auto flex max-w-5xl flex-col gap-4 px-5 py-10">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">
                Grupo New Tech
              </p>
              <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Loja a pronta entrega</h1>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link to="/">
                <ArrowLeft className="size-4" /> Início
              </Link>
            </Button>
          </div>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Produtos em estoque com envio imediato. Escolha o item, pague via Pix ou cartão e envie o
            comprovante pelo WhatsApp para combinar a entrega.
          </p>
          <div className="flex flex-wrap gap-2">
            {settings?.pix_key && (
              <Button variant="secondary" size="sm" onClick={copyPix}>
                <Copy className="size-4" /> Copiar chave Pix
              </Button>
            )}
            {settings?.card_link && (
              <Button asChild variant="secondary" size="sm">
                <a href={settings.card_link} target="_blank" rel="noreferrer">
                  <CreditCard className="size-4" /> Pagar com cartão
                </a>
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-5 px-5 py-8">
        {isPending && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Carregando produtos...
          </div>
        )}
        {error && <p className="text-sm text-destructive">Não foi possível carregar a loja.</p>}

        {data?.products.length === 0 && (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Nenhum produto a pronta entrega no momento. Volte em breve ou participe de um{" "}
              <Link to="/rateio" className="text-primary underline">
                rateio
              </Link>
              .
            </CardContent>
          </Card>
        )}

        <div className="grid gap-5 sm:grid-cols-2">
          {data?.products.map((product) => {
            const soldOut = product.stock <= 0;
            return (
              <Card key={product.id} className="shadow-panel flex flex-col overflow-hidden">
                {product.image_url && (
                  <img
                    src={product.image_url}
                    alt={product.name}
                    loading="lazy"
                    className="h-44 w-full border-b border-border object-cover"
                  />
                )}
                <CardHeader className="gap-2 pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-lg font-semibold">{product.name}</h2>
                    <Badge
                      className={
                        soldOut
                          ? "bg-warning text-warning-foreground"
                          : "bg-success text-success-foreground"
                      }
                    >
                      {soldOut ? "Esgotado" : `${product.stock} em estoque`}
                    </Badge>
                  </div>
                  <p className="font-display text-2xl text-primary">{brl(product.price)}</p>
                </CardHeader>
                <CardContent className="mt-auto space-y-3">
                  {product.description && (
                    <p className="text-sm text-muted-foreground">{product.description}</p>
                  )}
                  {settings?.whatsapp ? (
                    <Button asChild className="w-full" disabled={soldOut}>
                      <a
                        href={whatsappHref(
                          settings.whatsapp,
                          `Olá! Quero comprar a pronta entrega: ${product.name} (${brl(product.price)}).`,
                        )}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <MessageCircle className="size-4" /> Pedir pelo WhatsApp
                      </a>
                    </Button>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      O administrador ainda não cadastrou um WhatsApp de contato.
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </main>
  );
}
