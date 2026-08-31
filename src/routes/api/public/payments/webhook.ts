import { createFileRoute } from "@tanstack/react-router";

// Endpoint neutro de webhook de pagamentos.
// Cada plataforma valida a própria assinatura no adaptador correspondente
// antes de qualquer efeito no banco de dados.
export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawBody = await request.text();
        const headers: Record<string, string> = {};
        request.headers.forEach((value, key) => {
          headers[key.toLowerCase()] = value;
        });

        const { loadPaymentContext, getAdapter } = await import(
          "@/lib/payments/gateway.server"
        );
        const ctx = await loadPaymentContext();
        if (ctx.provider === "none" || !ctx.credential) {
          return new Response("Payments not configured", { status: 503 });
        }

        const valid = await getAdapter(ctx.provider).verifyWebhook(ctx, { rawBody, headers });
        if (!valid) return new Response("Invalid signature", { status: 401 });

        // A conciliação de cobranças será implementada junto ao adaptador real.
        return new Response("ok");
      },
    },
  },
});
