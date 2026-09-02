# Conectar InfinitePay automaticamente

## Contexto
A arquitetura de pagamentos já está pronta para o proprietário configurar sua própria plataforma. Hoje os adaptadores (`src/lib/payments/gateway.server.ts`) são stubs — só validam que a credencial foi salva, sem chamar a API real. O usuário escolheu **InfinitePay** em ambiente **sandbox** e já possui as credenciais.

## Objetivo
Implementar o adaptador real da InfinitePay para que o app possa:
1. Testar a conexão chamando a API de verdade.
2. Gerar links de checkout (Pix/cartão) para inscrições do rateio.
3. Receber e validar webhooks de confirmação de pagamento.

## Descoberta técnica
A InfinitePay publica uma API de checkout integrado documentada em `https://www.infinitepay.io/checkout-documentacao`. Segundo a especificação transcrita:
- O comerciante é identificado pelo **InfiniteTag handle** (sem o `$`), não por API key.
- Endpoint de produção: `https://api.checkout.infinitepay.io/links`.
- Sandbox/legado: `https://api.infinitepay.io/invoices/public/checkout/links`.
- Criação de link: `POST /links` com `{ handle, items[], order_nsu, redirect_url, webhook_url, customer? }`.
- Valores em centavos inteiros (R$ 10,00 = 1000).
- Webhook `paymentApproved` POSTa para `webhook_url` com `{ invoice_slug, order_nsu, transaction_nsu, paid, amount, capture_method }`.
- A API pública não exige autenticação por API key; o handle é a credencial. Portanto, para InfinitePay o campo "API Key" da interface se torna opcional, e o "Handle da conta" passa a ser obrigatório.

## Passos de implementação

### 1. Adaptador InfinitePay real
Em `src/lib/payments/gateway.server.ts`:
- Substituir o stub `infinitepay` por um adaptador concreto.
- `testConnection`: fazer um `POST` para `/links` com um payload mínimo de teste (por exemplo, um item de R$ 1,00) usando o handle configurado. Se a API retornar `checkout_url`, a conexão está ok.
- `createCharge`: receber `amount` (em reais), converter para centavos, montar payload com `handle`, `items`, `order_nsu` (usando o `reference`), `redirect_url` e `webhook_url`. Retornar `checkoutUrl`.
- `verifyWebhook`: validar que o payload veio da InfinitePay. Como a API não documenta assinatura HMAC, usar o segredo do webhook como token de confiança: comparar um header esperado (por exemplo, `x-infinitepay-signature` ou verificar `webhook_url` exclusivo). Se o segredo não estiver configurado, aceitar o webhook apenas se o `webhook_url` bater com o configurado. Documentar essa limitação.
- Adicionar URLs base por ambiente: sandbox e live.

### 2. Expor URL do webhook dinamicamente
- Adicionar função utilitária que retorne a URL pública do webhook (`https://<dominio>/api/public/payments/webhook`).
- Usar essa URL como `webhook_url` ao criar o link de checkout.

### 3. Ajustar interface administrativa
Em `src/components/rateio/PaymentSettingsPanel.tsx` e `src/lib/payments/providers.ts`:
- Para InfinitePay, deixar o campo "API Key / Token" opcional (ainda pode ser salvo, mas não é obrigatório).
- Tornar "Handle da conta" obrigatório.
- Ajustar labels/hints: "Handle da conta" = InfiniteTag sem o `$`.
- No teste de conexão, mostrar mensagem clara caso o handle esteja vazio.

### 4. Webhook de confirmação
Em `src/routes/api/public/payments/webhook.ts`:
- Após `verifyWebhook` retornar true, extrair `order_nsu` e/ou `invoice_slug`.
- Buscar inscrição(ões) correspondente(s) no banco pelo `reference` (armazenado como `order_nsu`).
- Atualizar status de `pending` para `confirmed` quando `paid === true`.
- Responder `200 OK` para a InfinitePay.

### 5. Integrar pagamento no fluxo do rateio
- No modal de inscrição/carrinho, quando o provedor ativo for InfinitePay e a conexão estiver ok, oferecer botão "Pagar agora" que chama `createCharge` e redireciona para o `checkoutUrl`.
- Manter fallback de Pix manual caso InfinitePay não esteja configurada.

### 6. Testes
- Configurar InfinitePay em sandbox com o handle do usuário.
- Executar "Testar conexão" e verificar resposta da API.
- Criar um link de checkout de teste (sem cobrar).
- Simular webhook (se possível) ou verificar estrutura do endpoint.

## Dados que o usuário precisa fornecer
1. **InfiniteTag / handle da conta** (obrigatório) — sem o `$`.
2. **Ambiente** — sandbox (já escolhido) ou live.
3. **Segredo do webhook** (opcional, mas recomendado) — qualquer string forte que você criar; deve ser a mesma configurada no app e usada para validar callbacks.

A "API Key" não é necessária para a InfinitePay Checkout API pública. Se você tiver uma API key de outro produto InfinitePay (conta digital, por exemplo), ela não será usada nesta integração de checkout.
