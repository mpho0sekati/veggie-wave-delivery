CREATE INDEX IF NOT EXISTS profiles_online_lat_lng_idx ON public.profiles (lat, lng) WHERE online = true;
CREATE INDEX IF NOT EXISTS stock_trader_available_idx ON public.stock (trader_id) WHERE available = true;
CREATE INDEX IF NOT EXISTS demand_last_at_idx ON public.demand (last_at DESC);