ALTER TABLE public.payment_settings
  ADD COLUMN IF NOT EXISTS credential_ciphertext text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS credential_last4 text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS credential_configured_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS webhook_secret_ciphertext text NOT NULL DEFAULT '';