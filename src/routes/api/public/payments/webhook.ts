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

        const { loadPaymentContext, getAdapter, confirmSignupsByReference } = await import(
          "@/lib/payments/gateway.server"
        );
        const ctx = await loadPaymentContext();
        if (ctx.provider === "none") {
          return new Response("Payments not configured", { status: 503 });
        }

        const valid = await getAdapter(ctx.provider).verifyWebhook(ctx, { rawBody, headers });
        if (!valid) return new Response("Invalid signature", { status: 401 });

        let payload: {
          order_nsu?: string;
          invoice_slug?: string;
          paid?: boolean;
          paid_amount?: number;
        };
        try {
          payload = JSON.parse(rawBody);
        } catch {
          return new Response("Invalid payload", { status: 400 });
        }

        const reference = (payload.order_nsu ?? "").trim();
        const paid = payload.paid === true || Number(payload.paid_amount ?? 0) > 0;
        if (!reference) return new Response("Missing order reference", { status: 400 });
        if (!paid) return new Response("ok (not paid)");

        await confirmSignupsByReference(reference);
        return new Response("ok");
      },
    },
  },
});
