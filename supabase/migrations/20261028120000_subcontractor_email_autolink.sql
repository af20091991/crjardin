-- Renseigne automatiquement l'e-mail d'un sous-traitant (SST) à partir de l'adresse
-- utilisée par le nouvel utilisateur qui porte son prénom.
-- Règle prudente : on ne remplit que si UN SEUL sous-traitant sans e-mail correspond
-- au premier mot du nom affiché (insensible à la casse et aux accents).

CREATE OR REPLACE FUNCTION public.pp_norm_first_word(_t text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT split_part(
    lower(translate(btrim(coalesce(_t, '')), 'éèêëàâäîïôöùûüçÉÈÊËÀÂÄÎÏÔÖÙÛÜÇ', 'eeeeaaaiioouuucEEEEAAAIIOOUUUC')),
    ' ', 1);
$$;

CREATE OR REPLACE FUNCTION public.pp_link_subcontractor_email(_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_name text;
  v_key text;
  v_ids uuid[];
BEGIN
  SELECT u.email, p.display_name INTO v_email, v_name
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  WHERE u.id = _user_id;

  IF v_email IS NULL OR btrim(v_email) = '' THEN RETURN 0; END IF;
  v_key := public.pp_norm_first_word(v_name);
  IF v_key = '' OR v_key LIKE '%@%' THEN RETURN 0; END IF;

  SELECT array_agg(s.id) INTO v_ids
  FROM public.subcontractors s
  WHERE (s.email IS NULL OR btrim(s.email) = '')
    AND public.pp_norm_first_word(s.name) = v_key;

  IF v_ids IS NULL OR array_length(v_ids, 1) <> 1 THEN RETURN 0; END IF;

  UPDATE public.subcontractors SET email = lower(btrim(v_email)), updated_at = now()
  WHERE id = v_ids[1];
  RETURN 1;
END;
$$;

REVOKE ALL ON FUNCTION public.pp_link_subcontractor_email(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pp_link_subcontractor_email(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.pp_profiles_link_subcontractor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.pp_link_subcontractor_email(NEW.id);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Ne jamais bloquer une inscription à cause de cette automatisation.
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_link_subcontractor ON public.profiles;
CREATE TRIGGER trg_profiles_link_subcontractor
AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.pp_profiles_link_subcontractor();

-- Rattrapage des comptes existants
SELECT public.pp_link_subcontractor_email(id) FROM auth.users;
