CREATE OR REPLACE FUNCTION public.pilot_clean_designation(p text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE s text;
BEGIN
  s := lower(coalesce(p, ''));
  s := translate(s, 'àâäãéèêëîïìôöòûüùçñ', 'aaaaeeeeiiiooouuucn');
  s := regexp_replace(s, '\(.*?\)', ' ', 'g');
  s := regexp_replace(s, '[^a-z0-9]+', ' ', 'g');
  s := regexp_replace(s, '(^| )(ree|sap|ceev|ap|asap|ev|ce)( |$)', ' ', 'g');
  s := regexp_replace(s, '(^| )(ree|sap|ceev|ap|asap|ev|ce)( |$)', ' ', 'g');
  s := regexp_replace(s, '^ *(acompte|solde|facture|devis|remise|reste|complement|paiement|conseil) ', ' ', 'g');
  s := regexp_replace(s, '^ *(acompte|solde|facture|devis|remise|reste|complement|paiement|conseil) ', ' ', 'g');
  s := regexp_replace(s, '(^| )[0-9]+( |$)', ' ', 'g');
  s := regexp_replace(s, '(^| )[0-9]+( |$)', ' ', 'g');
  s := btrim(regexp_replace(s, ' +', ' ', 'g'));
  RETURN s;
END;
$$;