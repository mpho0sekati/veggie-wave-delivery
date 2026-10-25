CREATE TABLE public.funnel_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  event text NOT NULL CHECK (char_length(event) BETWEEN 1 AND 60),
  detail text CHECK (detail IS NULL OR char_length(detail) <= 120),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.funnel_events TO authenticated;
GRANT ALL ON public.funnel_events TO service_role;
ALTER TABLE public.funnel_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users log own events" ON public.funnel_events FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users read own events" ON public.funnel_events FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE INDEX funnel_events_event_time ON public.funnel_events (event, created_at DESC);