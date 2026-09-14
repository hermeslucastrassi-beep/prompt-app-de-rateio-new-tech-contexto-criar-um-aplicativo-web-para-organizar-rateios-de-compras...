import { createFileRoute, Link } from "@tanstack/react-router";
import { Lock, Store, Users } from "lucide-react";

import landingImage from "../assets/nova-era-landing.png.asset.json";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Nova era peptídeos — Rateio e Loja a Pronta Entrega" },
      {
        name: "description",
        content:
          "Escolha participar de um rateio em grupo, comprar na loja a pronta entrega ou acessar a área do administrador do grupo Nova era peptídeos.",
      },
      { property: "og:title", content: "Nova era peptídeos — Rateio e Loja a Pronta Entrega" },
      {
        property: "og:description",
        content: "Participe do rateio, compre a pronta entrega ou administre o grupo Nova era peptídeos.",
      },
    ],
  }),
  component: HomePage,
});

const options = [
  {
    to: "/rateio" as const,
    icon: Users,
    title: "Participar do rateio",
    description: "Entre nas listas de compra em grupo e reserve seus viais em lotes fechados.",
  },
  {
    to: "/loja" as const,
    icon: Store,
    title: "Loja — a pronta entrega",
    description: "Produtos disponíveis para envio imediato, sem esperar o fechamento do lote.",
  },
  {
    to: "/admin" as const,
    icon: Lock,
    title: "Administrador",
    description: "Área restrita para gerenciar produtos, inscritos, estoque e pagamentos.",
  },
];

function HomePage() {
  return (
    <main className="bg-hero min-h-screen">
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-8 px-5 py-14">
        <div className="text-center">
          <img
            src={landingImage.url}
            alt="Laboratório Nova era peptídeos"
            className="mx-auto mb-6 h-auto max-h-72 w-full max-w-md rounded-2xl object-cover shadow-panel"
          />
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary">
            Grupo Nova era peptídeos
          </p>
          <h1 className="mt-3 text-3xl font-bold sm:text-4xl">Como você quer comprar hoje?</h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">
            Escolha uma das opções abaixo para continuar.
          </p>
        </div>

        <nav className="grid gap-4">
          {options.map(({ to, icon: Icon, title, description }) => (
            <Link
              key={to}
              to={to}
              className="shadow-panel group flex items-center gap-4 rounded-2xl border border-border bg-card px-5 py-5 transition-colors hover:border-primary hover:bg-secondary/50"
            >
              <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                <Icon className="size-6" />
              </span>
              <span className="min-w-0">
                <span className="block text-lg font-semibold">{title}</span>
                <span className="mt-0.5 block text-sm text-muted-foreground">{description}</span>
              </span>
            </Link>
          ))}
        </nav>
      </div>
    </main>
  );
}
