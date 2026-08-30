CREATE TABLE public.payment_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  active_provider TEXT NOT NULL DEFAULT 'none',
  environment TEXT NOT NULL DEFAULT 'sandbox',
  integration_status TEXT NOT NULL DEFAULT 'not_configured',
  public_account_id TEXT NOT NULL DEFAULT '',
  last_test_message TEXT NOT NULL DEFAULT '',
  last_tested_at TIMESTAMP WITH TIME ZONE,
  configured_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT payment_settings_singleton CHECK (id = 1),
  CONSTRAINT payment_settings_provider CHECK (active_provider IN ('none','sandbox','mercadopago','asaas','infinitepay')),
  CONSTRAINT payment_settings_environment CHECK (environment IN ('sandbox','production')),
  CONSTRAINT payment_settings_status CHECK (integration_status IN ('not_configured','configured','error'))
);

GRANT ALL ON public.payment_settings TO service_role;

ALTER TABLE public.payment_settings ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_payment_settings_updated_at
BEFORE UPDATE ON public.payment_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.payment_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;