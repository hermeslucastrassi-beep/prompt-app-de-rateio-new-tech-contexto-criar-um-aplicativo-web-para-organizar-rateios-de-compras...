import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2, Plus, Trash2 } from "lucide-react";

import {
  adminCreateStoreProduct,
  adminDeleteStoreProduct,
  adminGetStoreProducts,
  adminUpdateStoreProduct,
  type StoreProduct,
} from "@/lib/store.functions";
import { brl } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const QUERY_KEY = ["admin-store"];

export function StoreAdminPanel() {
  const fetchList = useServerFn(adminGetStoreProducts);
  const { data, isPending } = useQuery({ queryKey: QUERY_KEY, queryFn: () => fetchList() });

  return (
    <div className="space-y-5">
      <StoreProductForm />
      <Card className="shadow-panel">
        <CardHeader className="pb-3">
          <h2 className="text-lg font-semibold">Produtos da loja</h2>
          <p className="text-sm text-muted-foreground">
            Itens visíveis na página “Loja — a pronta entrega”. Produtos inativos ficam ocultos ao
            público.
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          {isPending && <Loader2 className="size-4 animate-spin text-primary" />}
          {data?.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum produto cadastrado na loja.</p>
          )}
          {data?.map((product) => <StoreRow key={product.id} product={product} />)}
        </CardContent>
      </Card>
    </div>
  );
}

function StoreProductForm() {
  const create = useServerFn(adminCreateStoreProduct);
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("1");
  const [imageUrl, setImageUrl] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      create({
        data: {
          name,
          description,
          price: Number(price.replace(",", ".")),
          stock: Number(stock),
          imageUrl,
        },
      }),
    onSuccess: (list) => {
      queryClient.setQueryData(QUERY_KEY, list);
      setName("");
      setDescription("");
      setPrice("");
      setStock("1");
      setImageUrl("");
      toast.success("Produto adicionado à loja.");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Card className="shadow-panel">
      <CardHeader className="pb-3">
        <h2 className="text-lg font-semibold">Cadastrar produto a pronta entrega</h2>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="store-name">Nome do produto</Label>
            <Input id="store-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="store-price">Preço (R$)</Label>
            <Input
              id="store-price"
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="store-stock">Estoque</Label>
            <Input
              id="store-stock"
              type="number"
              min={0}
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="store-image">URL da imagem (opcional)</Label>
            <Input
              id="store-image"
              placeholder="https://..."
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="store-desc">Descrição (opcional)</Label>
            <Textarea
              id="store-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Plus className="size-4" />
              )}
              Adicionar à loja
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function StoreRow({ product }: { product: StoreProduct }) {
  const update = useServerFn(adminUpdateStoreProduct);
  const remove = useServerFn(adminDeleteStoreProduct);
  const queryClient = useQueryClient();
  const [stock, setStock] = useState(String(product.stock));

  const run = async (fn: () => Promise<StoreProduct[]>, message: string) => {
    try {
      queryClient.setQueryData(QUERY_KEY, await fn());
      toast.success(message);
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{product.name}</p>
        <p className="text-xs text-muted-foreground">
          {brl(product.price)} · {product.stock} em estoque
        </p>
      </div>
      <div className="flex items-center gap-1.5">
        <Badge
          className={
            product.active
              ? "bg-success text-success-foreground"
              : "bg-warning text-warning-foreground"
          }
        >
          {product.active ? "Ativo" : "Oculto"}
        </Badge>
        <Input
          className="w-20"
          type="number"
          min={0}
          value={stock}
          onChange={(e) => setStock(e.target.value)}
          onBlur={() => {
            const next = Number(stock);
            if (Number.isFinite(next) && next !== product.stock) {
              run(
                () => update({ data: { id: product.id, stock: next } }),
                "Estoque atualizado.",
              );
            }
          }}
          aria-label={`Estoque de ${product.name}`}
        />
        <Button
          variant="outline"
          size="icon"
          aria-label={product.active ? "Ocultar produto" : "Ativar produto"}
          onClick={() =>
            run(
              () => update({ data: { id: product.id, active: !product.active } }),
              product.active ? "Produto oculto." : "Produto ativado.",
            )
          }
        >
          {product.active ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Excluir ${product.name}`}
          onClick={() => run(() => remove({ data: { id: product.id } }), "Produto excluído.")}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
    </div>
  );
}
