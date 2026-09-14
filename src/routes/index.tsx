import { createFileRoute, Link } from "@tanstack/react-router";
import { Lock, Users } from "lucide-react";

import landingImage from "../assets/nova-era-landing.png.asset.json";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Nova era peptídeos — Rateio em grupo" },
      {
        name: "description",
        content:
          "Escolha participar de um rateio em grupo ou acessar a área do administrador do grupo Nova era peptídeos.",
      },
      { property: "og:title", content: "Nova era peptídeos — Rateio em grupo" },
      {
        property: "og:description",
        content: "Participe do rateio ou administre as listas do grupo Nova era peptídeos.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
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
    to: "/admin" as const,
    icon: Lock,
    title: "Administrador",
    description: "Área restrita para gerenciar produtos, inscritos e pagamentos.",
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
          <h1 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-6xl">
            Grupo Nova era peptídeos
          </h1>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary">
            Rateio em grupo
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
