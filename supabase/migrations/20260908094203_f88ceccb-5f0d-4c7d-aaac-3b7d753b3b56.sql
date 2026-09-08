CREATE TABLE public.courier_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.wave_orders(id) ON DELETE CASCADE,
  trader_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  heading double precision,
  speed double precision,
  accuracy double precision,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.courier_positions TO authenticated;
GRANT ALL ON public.courier_positions TO service_role;
ALTER TABLE public.courier_positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Buyer and trader read positions for their order"
ON public.courier_positions FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.wave_orders o
  WHERE o.id = courier_positions.order_id
    AND (o.buyer_id = auth.uid() OR o.trader_id = auth.uid())
));

CREATE POLICY "Trader shares own position on active order"
ON public.courier_positions FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = trader_id
  AND EXISTS (
    SELECT 1 FROM public.wave_orders o
    WHERE o.id = courier_positions.order_id
      AND o.trader_id = auth.uid()
      AND o.status IN ('accepted','preparing','ready','delivering')
  )
);

CREATE INDEX courier_positions_order_recorded_idx
  ON public.courier_positions (order_id, recorded_at DESC);

CREATE TABLE public.delivery_traces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE REFERENCES public.wave_orders(id) ON DELETE CASCADE,
  trader_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  points jsonb NOT NULL DEFAULT '[]'::jsonb,
  distance_m double precision NOT NULL DEFAULT 0,
  duration_s double precision NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.delivery_traces TO authenticated;
GRANT ALL ON public.delivery_traces TO service_role;
ALTER TABLE public.delivery_traces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Buyer and trader read their delivery trace"
ON public.delivery_traces FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.wave_orders o
  WHERE o.id = delivery_traces.order_id
    AND (o.buyer_id = auth.uid() OR o.trader_id = auth.uid())
));

CREATE TRIGGER delivery_traces_touch
BEFORE UPDATE ON public.delivery_traces
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.learned_paths (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  start_cell text NOT NULL,
  end_cell text NOT NULL,
  points jsonb NOT NULL DEFAULT '[]'::jsonb,
  distance_m double precision NOT NULL DEFAULT 0,
  duration_s double precision NOT NULL DEFAULT 0,
  uses integer NOT NULL DEFAULT 1,
  last_used_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (start_cell, end_cell)
);

GRANT SELECT ON public.learned_paths TO authenticated;
GRANT ALL ON public.learned_paths TO service_role;
ALTER TABLE public.learned_paths ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Learned shortcuts visible to signed-in users"
ON public.learned_paths FOR SELECT TO authenticated USING (true);

CREATE TRIGGER learned_paths_touch
BEFORE UPDATE ON public.learned_paths
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.record_delivery_trace(
  _order_id uuid,
  _trader uuid,
  _points jsonb,
  _distance_m double precision,
  _duration_s double precision,
  _start_cell text,
  _end_cell text,
  _baseline_distance_m double precision
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _existing public.learned_paths;
BEGIN
  IF _order_id IS NULL OR _trader IS NULL THEN RAISE EXCEPTION 'bad-input'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.wave_orders o
                 WHERE o.id = _order_id AND o.trader_id = _trader) THEN
    RAISE EXCEPTION 'not-your-order';
  END IF;

  INSERT INTO public.delivery_traces (order_id, trader_id, points, distance_m, duration_s)
  VALUES (_order_id, _trader, COALESCE(_points, '[]'::jsonb), COALESCE(_distance_m, 0), COALESCE(_duration_s, 0))
  ON CONFLICT (order_id) DO UPDATE
    SET points = EXCLUDED.points,
        distance_m = EXCLUDED.distance_m,
        duration_s = EXCLUDED.duration_s;

  IF _start_cell IS NULL OR _end_cell IS NULL OR jsonb_array_length(COALESCE(_points,'[]'::jsonb)) < 3 THEN
    RETURN;
  END IF;

  -- Only learn paths that beat the routed baseline by at least 8%.
  IF _baseline_distance_m IS NOT NULL AND _baseline_distance_m > 0
     AND _distance_m > _baseline_distance_m * 0.92 THEN
    RETURN;
  END IF;

  SELECT * INTO _existing FROM public.learned_paths
   WHERE start_cell = _start_cell AND end_cell = _end_cell FOR UPDATE;

  IF _existing.id IS NULL THEN
    INSERT INTO public.learned_paths (start_cell, end_cell, points, distance_m, duration_s)
    VALUES (_start_cell, _end_cell, _points, COALESCE(_distance_m,0), COALESCE(_duration_s,0));
  ELSE
    UPDATE public.learned_paths
       SET uses = uses + 1,
           last_used_at = now(),
           points = CASE WHEN _distance_m < distance_m THEN _points ELSE points END,
           distance_m = LEAST(distance_m, COALESCE(_distance_m, distance_m)),
           duration_s = CASE WHEN _distance_m < distance_m THEN COALESCE(_duration_s, duration_s) ELSE duration_s END
     WHERE id = _existing.id;
  END IF;
END; $$;

REVOKE ALL ON FUNCTION public.record_delivery_trace(uuid, uuid, jsonb, double precision, double precision, text, text, double precision) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_delivery_trace(uuid, uuid, jsonb, double precision, double precision, text, text, double precision) TO service_role;

ALTER PUBLICATION supabase_realtime ADD TABLE public.courier_positions;