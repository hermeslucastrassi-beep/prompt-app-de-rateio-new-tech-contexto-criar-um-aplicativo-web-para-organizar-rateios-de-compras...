CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  total_value numeric NOT NULL DEFAULT 0,
  units_per_batch integer NOT NULL DEFAULT 10,
  closed_batches integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.signups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'pending',
  pin_hash text NOT NULL,
  reference text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.settings (
  id integer PRIMARY KEY DEFAULT 1,
  pix_key text NOT NULL DEFAULT '',
  card_link text NOT NULL DEFAULT '',
  whatsapp text NOT NULL DEFAULT '',
  payment_days integer NOT NULL DEFAULT 5,
  admin_password_hash text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT settings_singleton CHECK (id = 1)
);

CREATE TABLE IF NOT EXISTS public.payment_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  active_provider TEXT NOT NULL DEFAULT 'none',
  environment TEXT NOT NULL DEFAULT 'sandbox',
  integration_status TEXT NOT NULL DEFAULT 'not_configured',
  public_account_id TEXT NOT NULL DEFAULT '',
  last_test_message TEXT NOT NULL DEFAULT '',
  last_tested_at TIMESTAMPTZ,
  configured_at TIMESTAMPTZ,
  credential_ciphertext text NOT NULL DEFAULT '',
  credential_last4 text NOT NULL DEFAULT '',
  credential_configured_at TIMESTAMPTZ,
  webhook_secret_ciphertext text NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT payment_settings_singleton CHECK (id = 1),
  CONSTRAINT payment_settings_provider CHECK (active_provider IN ('none','sandbox','mercadopago','asaas','infinitepay','custom')),
  CONSTRAINT payment_settings_environment CHECK (environment IN ('sandbox','production')),
  CONSTRAINT payment_settings_status CHECK (integration_status IN ('not_configured','configured','error'))
);

CREATE TABLE IF NOT EXISTS public.store_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  stock INTEGER NOT NULL DEFAULT 0,
  image_url TEXT NOT NULL DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.products TO service_role;
GRANT ALL ON public.signups TO service_role;
GRANT ALL ON public.settings TO service_role;
GRANT ALL ON public.payment_settings TO service_role;
GRANT ALL ON public.store_products TO service_role;

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_products ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS signups_product_created_idx ON public.signups (product_id, created_at);
CREATE INDEX IF NOT EXISTS signups_reference_idx ON public.signups (reference);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_payment_settings_updated_at ON public.payment_settings;
CREATE TRIGGER update_payment_settings_updated_at
BEFORE UPDATE ON public.payment_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.settings (id, admin_password_hash, payment_days)
VALUES (1, 'newtech-salt-1:4f302732fb7dbe0a3fdf3f61cba9abba8f548dff76c134128504a23cce7ce279', 5)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.payment_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;