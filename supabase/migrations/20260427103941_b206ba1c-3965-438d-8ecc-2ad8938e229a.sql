-- Trust tier for sellers
DO $$ BEGIN
  CREATE TYPE public.trust_tier AS ENUM ('none','verified','trusted','vip');
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS trust_tier public.trust_tier NOT NULL DEFAULT 'none';

-- Backfill: any seller previously marked verified gets 'verified'
UPDATE public.profiles SET trust_tier = 'verified'
  WHERE is_seller_verified = true AND trust_tier = 'none';