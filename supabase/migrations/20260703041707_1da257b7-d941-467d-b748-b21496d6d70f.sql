ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS emails text[] NOT NULL DEFAULT '{}';

UPDATE public.clients
SET emails = ARRAY[email]
WHERE email IS NOT NULL AND btrim(email) <> '' AND (emails IS NULL OR array_length(emails, 1) IS NULL);