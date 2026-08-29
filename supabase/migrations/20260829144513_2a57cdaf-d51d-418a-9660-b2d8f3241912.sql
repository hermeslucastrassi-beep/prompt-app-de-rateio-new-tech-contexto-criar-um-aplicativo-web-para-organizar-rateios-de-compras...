CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  total_value numeric NOT NULL DEFAULT 0,
  units_per_batch integer NOT NULL DEFAULT 10,
  closed_batches integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.signups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'pending',
  pin_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.settings (
  id integer PRIMARY KEY DEFAULT 1,
  pix_key text NOT NULL DEFAULT '',
  card_link text NOT NULL DEFAULT '',
  whatsapp text NOT NULL DEFAULT '',
  payment_days integer NOT NULL DEFAULT 5,
  admin_password_hash text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT settings_singleton CHECK (id = 1)
);

GRANT ALL ON public.products TO service_role;
GRANT ALL ON public.signups TO service_role;
GRANT ALL ON public.settings TO service_role;

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

CREATE INDEX signups_product_created_idx ON public.signups (product_id, created_at);

INSERT INTO public.settings (id, admin_password_hash, payment_days)
VALUES (1, 'newtech-salt-1:4f302732fb7dbe0a3fdf3f61cba9abba8f548dff76c134128504a23cce7ce279', 5);