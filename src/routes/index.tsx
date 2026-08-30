import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, CreditCard, Loader2, Lock, Plus, ShieldCheck, Trash2 } from "lucide-react";

import { createSignup, deleteOwnSignup, getPublicData } from "@/lib/rateio.functions";
import { allocateBatches, brl, perVial, prettyPhone, whatsappHref } from "@/lib/format";
import { VialTray } from "@/components/rateio/VialTray";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "New Tech — Rateio de Compras em Grupo" },
      {
        name: "description",
        content:
          "Participe dos rateios do grupo New Tech: escolha quantos viais quer, acompanhe o lote e o status do seu pagamento.",
      },
      { property: "og:title", content: "New Tech — Rateio de Compras em Grupo" },
      {
        property: "og:description",
        content: "Lotes de 10 viais, inscrições abertas e status de pagamento em tempo real.",
      },
    ],
  }),
  component: PublicPage,
});

const PROFILE_KEY = "newtech.profile";

type Profile = { name: string; email: string; phone: string };

function usePublicData() {
  const fetcher = useServerFn(getPublicData);
  return useQuery({ queryKey: ["public-data"], queryFn: () => fetcher() });
}

function PublicPage() {
  const { data, isPending, error } = usePublicData();

  return (
    <main className="min-h-screen bg-background">
      <header className="bg-hero border-b border-border">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 px-5 py-10">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">
                Grupo New Tech
              </p>
              <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Rateio de compras</h1>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link to="/admin">
                <Lock className="size-4" /> Admin
              </Link>
            </Button>
          </div>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Os produtos são comprados em lotes fechados de viais. Escolha quantos viais você quer,
            faça o pagamento e envie o comprovante — o administrador confirma sua vaga.
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-6 px-5 py-8">
        {isPending && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Carregando produtos...
          </div>
        )}
        {error && (
          <p className="text-sm text-destructive">Não foi possível carregar os produtos.</p>
        )}

        {data && <PaymentInfo settings={data.settings} />}

        {data?.products.length === 0 && (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Nenhum produto cadastrado ainda. Volte em breve.
            </CardContent>
          </Card>
        )}

        {data?.products.map((product) => (
          <ProductCard key={product.id} product={product} settings={data.settings} />
        ))}
      </div>
    </main>
  );
}

type Settings = { pix_key: string; card_link: string; whatsapp: string; payment_days: number };

function PaymentInfo({ settings }: { settings: Settings }) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(settings.pix_key);
      toast.success("Chave Pix copiada!");
    } catch {
      toast.error("Não foi possível copiar a chave.");
    }
  };

  if (!settings.pix_key && !settings.card_link && !settings.whatsapp) return null;

  return (
    <Card className="shadow-panel">
      <CardHeader className="pb-3">
        <h2 className="text-lg font-semibold">Como pagar</h2>
        <p className="text-sm text-muted-foreground">
          Prazo de pagamento: {settings.payment_days} dias após a inscrição. Envie o comprovante pelo
          WhatsApp do administrador.
        </p>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {settings.pix_key && (
          <Button variant="secondary" onClick={copy}>
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
              href={whatsappHref(settings.whatsapp, "Olá! Segue o comprovante do rateio New Tech.")}
              target="_blank"
              rel="noreferrer"
            >
              Enviar comprovante
            </a>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

type PublicProduct = {
  id: string;
  name: string;
  total_value: number;
  units_per_batch: number;
  closed_batches: number;
  reserved: number;
  signups: {
    id: string;
    name: string;
    phone: string;
    quantity: number;
    status: string;
    created_at: string;
  }[];
};

function ProductCard({ product, settings }: { product: PublicProduct; settings: Settings }) {
  const units = product.units_per_batch;
  const unitPrice = perVial(product.total_value, units);
  const allocated = allocateBatches(product.signups, units);
  const currentBatch = product.closed_batches;
  const inCurrent = allocated.filter((a) => a.batchIndex === currentBatch);
  const queued = allocated.filter((a) => a.batchIndex > currentBatch);
  const confirmed = inCurrent
    .filter((a) => a.row.status === "confirmed")
    .reduce((s, a) => s + a.row.quantity, 0);
  const pending = inCurrent
    .filter((a) => a.row.status !== "confirmed")
    .reduce((s, a) => s + a.row.quantity, 0);
  const free = Math.max(0, units - confirmed - pending);

  return (
    <Card className="shadow-panel">
      <CardHeader className="gap-4 pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">{product.name}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Lote de {units} viais · {brl(product.total_value)}
            </p>
          </div>
          <div className="text-right">
            <p className="font-display text-2xl text-primary">{brl(unitPrice)}</p>
            <p className="text-xs text-muted-foreground">por vial</p>
          </div>
        </div>

        <div className="space-y-2 rounded-xl border border-border bg-secondary/40 p-4">
          <VialTray units={units} confirmed={confirmed} pending={pending} />
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>{confirmed} confirmados</span>
            <span>{pending} aguardando</span>
            <span>{free} disponíveis</span>
            <span>Lotes fechados: {product.closed_batches}</span>
            {queued.length > 0 && <span>{queued.length} na fila do próximo lote</span>}
          </div>
        </div>

        <SignupDialog product={product} unitPrice={unitPrice} settings={settings} />
      </CardHeader>

      <CardContent className="space-y-2">
        {product.signups.length === 0 ? (
          <p className="text-sm text-muted-foreground">Ninguém inscrito ainda. Seja o primeiro!</p>
        ) : (
          allocated.map(({ row, batchIndex }) => (
            <div
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{row.name}</p>
                <p className="text-xs text-muted-foreground">
                  {prettyPhone(row.phone)} · {row.quantity} vial(is) ·{" "}
                  {batchIndex === currentBatch ? "lote atual" : `fila (lote ${batchIndex + 1})`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  className={
                    row.status === "confirmed"
                      ? "bg-success text-success-foreground"
                      : "bg-warning text-warning-foreground"
                  }
                >
                  {row.status === "confirmed" ? "Confirmado" : "Aguardando pagamento"}
                </Badge>
                <DeleteDialog signupId={row.id} name={row.name} />
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function AddToCart({
  product,
  unitPrice,
  settings,
}: {
  product: PublicProduct;
  unitPrice: number;
  settings: Settings;
}) {
  const [quantity, setQuantity] = useState(1);
  const { addItem } = useCart();

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-2">
        <Label htmlFor={`qty-${product.id}`}>Viais</Label>
        <Input
          id={`qty-${product.id}`}
          type="number"
          min={1}
          max={50}
          className="w-24"
          value={quantity}
          onChange={(e) => setQuantity(Number(e.target.value))}
        />
      </div>
      <Button
        className="flex-1 sm:flex-none"
        onClick={() => {
          addItem({ productId: product.id, name: product.name, quantity });
          toast.success(`${quantity} vial(is) de ${product.name} no carrinho.`);
        }}
      >
        <ShoppingCart className="size-4" /> Adicionar ao carrinho
      </Button>
      <p className="w-full text-sm text-muted-foreground sm:w-auto">
        Subtotal: <span className="text-primary">{brl(unitPrice * quantity)}</span> · prazo de{" "}
        {settings.payment_days} dias
      </p>
    </div>
  );
}

function DeleteDialog({ signupId, name }: { signupId: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState("");
  const queryClient = useQueryClient();
  const remove = useServerFn(deleteOwnSignup);

  const mutation = useMutation({
    mutationFn: () => remove({ data: { signupId, pin } }),
    onSuccess: (data) => {
      queryClient.setQueryData(["public-data"], data);
      setPin("");
      setOpen(false);
      toast.success("Inscrição excluída.");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Excluir inscrição de ${name}`}>
          <Trash2 className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Excluir inscrição</DialogTitle>
          <DialogDescription>
            Digite o PIN criado por {name} para excluir esta inscrição.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor={`pin-${signupId}`}>PIN</Label>
            <Input
              id={`pin-${signupId}`}
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              required
            />
          </div>
          <DialogFooter>
            <Button type="submit" variant="destructive" disabled={mutation.isPending}>
              {mutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ShieldCheck className="size-4" />
              )}
              Excluir
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
