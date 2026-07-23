
CREATE TABLE public.pilot_ca_match_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id uuid NOT NULL REFERENCES public.pilot_ca_entries(id) ON DELETE CASCADE,
  previous_client_id uuid NULL REFERENCES public.clients(id) ON DELETE SET NULL,
  new_client_id uuid NULL REFERENCES public.clients(id) ON DELETE SET NULL,
  method text NOT NULL CHECK (method IN ('manual','suggestion','refused','reverted','new_client','bulk')),
  score numeric NULL,
  decided_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note text NULL,
  decided_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX pilot_ca_match_log_entry_idx ON public.pilot_ca_match_log(entry_id, decided_at DESC);
CREATE INDEX pilot_ca_match_log_decided_by_idx ON public.pilot_ca_match_log(decided_by, decided_at DESC);

GRANT SELECT, INSERT ON public.pilot_ca_match_log TO authenticated;
GRANT ALL ON public.pilot_ca_match_log TO service_role;

ALTER TABLE public.pilot_ca_match_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own match log"
  ON public.pilot_ca_match_log FOR SELECT
  TO authenticated
  USING (decided_by = auth.uid());

CREATE POLICY "Users insert own match log"
  ON public.pilot_ca_match_log FOR INSERT
  TO authenticated
  WITH CHECK (decided_by = auth.uid());

CREATE OR REPLACE FUNCTION public.link_ca_entry_to_client(
  _entry_id uuid,
  _client_id uuid,
  _method text,
  _score numeric DEFAULT NULL,
  _note text DEFAULT NULL
) RETURNS public.pilot_ca_entries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _entry public.pilot_ca_entries;
  _prev_client uuid;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF _method NOT IN ('manual','suggestion','refused','reverted','new_client','bulk') THEN
    RAISE EXCEPTION 'Invalid method: %', _method;
  END IF;

  SELECT * INTO _entry FROM public.pilot_ca_entries WHERE id = _entry_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'CA entry not found';
  END IF;
  IF _entry.user_id <> _uid THEN
    RAISE EXCEPTION 'Forbidden: entry does not belong to caller';
  END IF;

  IF _client_id IS NOT NULL THEN
    PERFORM 1 FROM public.clients WHERE id = _client_id AND user_id = _uid;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Forbidden: target client not found for caller';
    END IF;
  END IF;

  _prev_client := _entry.client_id;

  -- Only mutate client_id when method is not a pure 'refused' decision.
  IF _method <> 'refused' THEN
    UPDATE public.pilot_ca_entries
       SET client_id = _client_id,
           updated_at = now()
     WHERE id = _entry_id
     RETURNING * INTO _entry;
  END IF;

  INSERT INTO public.pilot_ca_match_log(
    entry_id, previous_client_id, new_client_id, method, score, decided_by, note
  ) VALUES (
    _entry_id, _prev_client,
    CASE WHEN _method = 'refused' THEN NULL ELSE _client_id END,
    _method, _score, _uid, _note
  );

  RETURN _entry;
END;
$$;

REVOKE ALL ON FUNCTION public.link_ca_entry_to_client(uuid, uuid, text, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.link_ca_entry_to_client(uuid, uuid, text, numeric, text) TO authenticated;
