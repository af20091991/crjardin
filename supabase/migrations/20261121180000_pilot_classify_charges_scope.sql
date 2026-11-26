-- Empêche un utilisateur non admin de classer les charges d'un autre compte.
-- Idempotent : CREATE OR REPLACE + REVOKE répétable.

CREATE OR REPLACE FUNCTION public.pilot_classify_charges(_user_id uuid DEFAULT NULL::uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  touched integer := 0;
  target uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'non authentifié';
  END IF;

  IF public.has_role(auth.uid(), 'admin'::app_role) THEN
    target := _user_id;
  ELSE
    target := auth.uid();
  END IF;

  UPDATE public.pilot_ca_entries e
  SET charge_class = m.charge_class,
      charge_category = m.label
  FROM (
    SELECT DISTINCT ON (e2.id) e2.id, c.label, c.charge_class
    FROM public.pilot_ca_entries e2
    JOIN public.pilot_charge_categories c
      ON c.user_id = e2.user_id
     AND c.is_active
     AND EXISTS (
       SELECT 1 FROM unnest(c.keywords) k
       WHERE lower(unaccent_lite(coalesce(e2.designation, ''))) LIKE '%' || lower(unaccent_lite(k)) || '%'
     )
    WHERE e2.kind = 'charge'
      AND (target IS NULL OR e2.user_id = target)
    ORDER BY e2.id, c.position
  ) m
  WHERE e.id = m.id
    AND (e.charge_class IS DISTINCT FROM m.charge_class OR e.charge_category IS DISTINCT FROM m.label);
  GET DIAGNOSTICS touched = ROW_COUNT;

  UPDATE public.pilot_ca_entries
  SET charge_class = 'a_classer', charge_category = 'À classer'
  WHERE kind = 'charge'
    AND charge_class IS NULL
    AND (target IS NULL OR user_id = target);

  RETURN touched;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.pilot_classify_charges(uuid) FROM PUBLIC, anon;
