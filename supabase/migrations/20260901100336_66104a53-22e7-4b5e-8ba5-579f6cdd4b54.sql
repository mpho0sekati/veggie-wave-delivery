-- ============ ENUMS ============
CREATE TYPE public.wave_status AS ENUM ('created','accepted','declined','expired');
CREATE TYPE public.order_status AS ENUM ('created','accepted','preparing','ready','delivering','delivered','completed');
CREATE TYPE public.payment_status AS ENUM ('pending','successful','failed');
CREATE TYPE public.settlement_status AS ENUM ('pending','settled');

-- ============ WAVES ============
CREATE TABLE public.waves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trader_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  wish text NOT NULL DEFAULT '',
  note text NOT NULL DEFAULT '',
  lat double precision,
  lng double precision,
  status public.wave_status NOT NULL DEFAULT 'created',
  expires_at timestamptz NOT NULL DEFAULT now() + interval '2 minutes',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX waves_open_idx ON public.waves (status, expires_at);
CREATE INDEX waves_buyer_idx ON public.waves (buyer_id, created_at DESC);

GRANT SELECT ON public.waves TO authenticated;
GRANT ALL ON public.waves TO service_role;
ALTER TABLE public.waves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Buyers read their own waves" ON public.waves
  FOR SELECT TO authenticated USING (auth.uid() = buyer_id);
CREATE POLICY "Traders read open waves" ON public.waves
  FOR SELECT TO authenticated
  USING (status = 'created' AND expires_at > now() AND auth.uid() <> buyer_id);
CREATE POLICY "Assigned trader reads the wave" ON public.waves
  FOR SELECT TO authenticated USING (auth.uid() = trader_id);

CREATE TRIGGER waves_touch BEFORE UPDATE ON public.waves
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ ORDERS (wave_orders) ============
CREATE TABLE public.wave_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wave_id uuid NOT NULL UNIQUE REFERENCES public.waves(id) ON DELETE CASCADE,
  buyer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trader_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'ZAR',
  status public.order_status NOT NULL DEFAULT 'created',
  note text NOT NULL DEFAULT '',
  rating integer,
  rating_comment text,
  delivered_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX wave_orders_buyer_idx ON public.wave_orders (buyer_id, created_at DESC);
CREATE INDEX wave_orders_trader_idx ON public.wave_orders (trader_id, created_at DESC);

GRANT SELECT ON public.wave_orders TO authenticated;
GRANT ALL ON public.wave_orders TO service_role;
ALTER TABLE public.wave_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Buyer and trader read their orders" ON public.wave_orders
  FOR SELECT TO authenticated USING (auth.uid() = buyer_id OR auth.uid() = trader_id);

CREATE TRIGGER wave_orders_touch BEFORE UPDATE ON public.wave_orders
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ PAYMENTS ============
CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.wave_orders(id) ON DELETE CASCADE,
  buyer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'mtn-momo',
  reference text NOT NULL UNIQUE,
  external_id text UNIQUE,
  amount numeric(12,2) NOT NULL,
  currency text NOT NULL DEFAULT 'ZAR',
  status public.payment_status NOT NULL DEFAULT 'pending',
  provider_status text,
  payer_msisdn text,
  failure_reason text,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX payments_order_idx ON public.payments (order_id, created_at DESC);
-- At most one live (pending/successful) payment per order: idempotency backstop.
CREATE UNIQUE INDEX payments_one_live_per_order ON public.payments (order_id)
  WHERE status <> 'failed';

GRANT SELECT ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Buyer reads own payments" ON public.payments
  FOR SELECT TO authenticated USING (auth.uid() = buyer_id);
CREATE POLICY "Trader reads payments for their orders" ON public.payments
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.wave_orders o WHERE o.id = payments.order_id AND o.trader_id = auth.uid()));

CREATE TRIGGER payments_touch BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ SETTLEMENTS ============
CREATE TABLE public.settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE REFERENCES public.wave_orders(id) ON DELETE CASCADE,
  payment_id uuid NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  trader_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  gross numeric(12,2) NOT NULL,
  commission numeric(12,2) NOT NULL DEFAULT 0,
  net numeric(12,2) NOT NULL,
  status public.settlement_status NOT NULL DEFAULT 'pending',
  settled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX settlements_trader_idx ON public.settlements (trader_id, created_at DESC);

GRANT SELECT ON public.settlements TO authenticated;
GRANT ALL ON public.settlements TO service_role;
ALTER TABLE public.settlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trader reads own settlements" ON public.settlements
  FOR SELECT TO authenticated USING (auth.uid() = trader_id);

CREATE TRIGGER settlements_touch BEFORE UPDATE ON public.settlements
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ TRUSTED ROUTINES (service_role only) ============

-- Expire stale waves.
CREATE OR REPLACE FUNCTION public.expire_waves()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _n integer;
BEGIN
  UPDATE public.waves SET status = 'expired'
  WHERE status = 'created' AND expires_at <= now();
  GET DIAGNOSTICS _n = ROW_COUNT;
  RETURN _n;
END; $$;

-- Create a wave for a buyer. Items are trusted only as ids + quantities.
CREATE OR REPLACE FUNCTION public.create_wave(
  _buyer uuid, _items jsonb, _wish text, _note text,
  _lat double precision, _lng double precision
) RETURNS public.waves LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _wave public.waves;
BEGIN
  PERFORM public.expire_waves();
  -- One open wave per buyer.
  UPDATE public.waves SET status = 'expired'
  WHERE buyer_id = _buyer AND status = 'created';

  INSERT INTO public.waves (buyer_id, items, wish, note, lat, lng)
  VALUES (_buyer, COALESCE(_items, '[]'::jsonb), COALESCE(_wish,''), COALESCE(_note,''), _lat, _lng)
  RETURNING * INTO _wave;
  RETURN _wave;
END; $$;

-- Server-side price for a trader's basket. Never trust client amounts.
CREATE OR REPLACE FUNCTION public.price_basket(_trader uuid, _items jsonb)
RETURNS numeric LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _total numeric := 0; _line jsonb; _price numeric; _qty integer;
BEGIN
  FOR _line IN SELECT * FROM jsonb_array_elements(COALESCE(_items, '[]'::jsonb)) LOOP
    _qty := GREATEST(COALESCE((_line->>'qty')::integer, 0), 0);
    IF _qty = 0 THEN CONTINUE; END IF;
    SELECT s.price INTO _price FROM public.stock s
      WHERE s.trader_id = _trader AND s.item_id = _line->>'id' AND s.available LIMIT 1;
    IF _price IS NULL THEN
      SELECT c.price INTO _price FROM public.catalog_items c WHERE c.id = _line->>'id';
    END IF;
    _total := _total + COALESCE(_price, 0) * _qty;
  END LOOP;
  RETURN ROUND(_total, 2);
END; $$;

-- Trader accepts a wave: claims it and opens the order with a server-priced amount.
CREATE OR REPLACE FUNCTION public.accept_wave(_wave_id uuid, _trader uuid)
RETURNS public.wave_orders LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _wave public.waves; _order public.wave_orders;
BEGIN
  SELECT * INTO _wave FROM public.waves WHERE id = _wave_id FOR UPDATE;
  IF _wave.id IS NULL THEN RAISE EXCEPTION 'wave-not-found'; END IF;
  IF _wave.buyer_id = _trader THEN RAISE EXCEPTION 'cannot-accept-own-wave'; END IF;

  SELECT * INTO _order FROM public.wave_orders WHERE wave_id = _wave_id;
  IF _order.id IS NOT NULL THEN
    IF _order.trader_id = _trader THEN RETURN _order; END IF;
    RAISE EXCEPTION 'wave-already-accepted';
  END IF;

  IF _wave.status <> 'created' THEN RAISE EXCEPTION 'wave-not-open'; END IF;
  IF _wave.expires_at <= now() THEN
    UPDATE public.waves SET status = 'expired' WHERE id = _wave_id;
    RAISE EXCEPTION 'wave-expired';
  END IF;

  UPDATE public.waves SET status = 'accepted', trader_id = _trader WHERE id = _wave_id;

  INSERT INTO public.wave_orders (wave_id, buyer_id, trader_id, items, amount, note, status)
  VALUES (_wave_id, _wave.buyer_id, _trader, _wave.items,
          public.price_basket(_trader, _wave.items), _wave.note, 'accepted')
  RETURNING * INTO _order;
  RETURN _order;
END; $$;

CREATE OR REPLACE FUNCTION public.decline_wave(_wave_id uuid, _trader uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.waves SET status = 'declined'
  WHERE id = _wave_id AND status = 'created' AND buyer_id <> _trader;
END; $$;

-- Trader moves the order forward. Only legal transitions are allowed.
CREATE OR REPLACE FUNCTION public.advance_order(_order_id uuid, _actor uuid, _next public.order_status)
RETURNS public.wave_orders LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _order public.wave_orders; _paid boolean;
BEGIN
  SELECT * INTO _order FROM public.wave_orders WHERE id = _order_id FOR UPDATE;
  IF _order.id IS NULL THEN RAISE EXCEPTION 'order-not-found'; END IF;
  IF _order.status = _next THEN RETURN _order; END IF;

  IF _next IN ('preparing','ready','delivering','delivered') THEN
    IF _actor <> _order.trader_id THEN RAISE EXCEPTION 'not-your-order'; END IF;
  ELSIF _next = 'completed' THEN
    IF _actor <> _order.buyer_id THEN RAISE EXCEPTION 'only-buyer-completes'; END IF;
  ELSE
    RAISE EXCEPTION 'bad-transition';
  END IF;

  -- Preparation only starts once money is in.
  IF _next IN ('preparing','ready','delivering','delivered') THEN
    SELECT EXISTS (SELECT 1 FROM public.payments p
                   WHERE p.order_id = _order_id AND p.status = 'successful') INTO _paid;
    IF NOT _paid THEN RAISE EXCEPTION 'payment-required'; END IF;
  END IF;

  IF _next = 'completed' AND _order.status <> 'delivered' THEN
    RAISE EXCEPTION 'not-delivered';
  END IF;

  UPDATE public.wave_orders
     SET status = _next,
         delivered_at = CASE WHEN _next = 'delivered' THEN now() ELSE delivered_at END,
         completed_at = CASE WHEN _next = 'completed' THEN now() ELSE completed_at END
   WHERE id = _order_id
   RETURNING * INTO _order;
  RETURN _order;
END; $$;

CREATE OR REPLACE FUNCTION public.rate_order(_order_id uuid, _buyer uuid, _rating integer, _comment text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _rating < 1 OR _rating > 5 THEN RAISE EXCEPTION 'bad-rating'; END IF;
  UPDATE public.wave_orders SET rating = _rating, rating_comment = COALESCE(_comment,'')
   WHERE id = _order_id AND buyer_id = _buyer AND status IN ('delivered','completed');
END; $$;

-- Start a payment. Idempotent: an existing pending/successful payment is returned as-is.
CREATE OR REPLACE FUNCTION public.start_payment(
  _order_id uuid, _buyer uuid, _reference text, _external_id text, _msisdn text
) RETURNS public.payments LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _order public.wave_orders; _payment public.payments;
BEGIN
  SELECT * INTO _order FROM public.wave_orders WHERE id = _order_id FOR UPDATE;
  IF _order.id IS NULL THEN RAISE EXCEPTION 'order-not-found'; END IF;
  IF _order.buyer_id <> _buyer THEN RAISE EXCEPTION 'not-your-order'; END IF;

  SELECT * INTO _payment FROM public.payments
   WHERE order_id = _order_id AND status <> 'failed' LIMIT 1;
  IF _payment.id IS NOT NULL THEN RETURN _payment; END IF;

  INSERT INTO public.payments (order_id, buyer_id, reference, external_id, amount, currency, payer_msisdn, status)
  VALUES (_order_id, _buyer, _reference, _external_id, _order.amount, _order.currency, _msisdn, 'pending')
  RETURNING * INTO _payment;
  RETURN _payment;
END; $$;

-- Record a verified provider outcome. Idempotent and the only path to 'successful'.
CREATE OR REPLACE FUNCTION public.finalize_payment(
  _reference text, _status public.payment_status, _provider_status text, _failure text
) RETURNS public.payments LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _payment public.payments; _order public.wave_orders; _commission numeric;
BEGIN
  SELECT * INTO _payment FROM public.payments WHERE reference = _reference FOR UPDATE;
  IF _payment.id IS NULL THEN RAISE EXCEPTION 'payment-not-found'; END IF;
  IF _payment.status <> 'pending' THEN RETURN _payment; END IF;
  IF _status = 'pending' THEN
    UPDATE public.payments SET provider_status = _provider_status WHERE id = _payment.id
      RETURNING * INTO _payment;
    RETURN _payment;
  END IF;

  UPDATE public.payments
     SET status = _status, provider_status = _provider_status,
         failure_reason = _failure,
         verified_at = now()
   WHERE id = _payment.id
   RETURNING * INTO _payment;

  IF _status = 'successful' THEN
    SELECT * INTO _order FROM public.wave_orders WHERE id = _payment.order_id FOR UPDATE;
    _commission := ROUND(_payment.amount * 0.05, 2);
    INSERT INTO public.settlements (order_id, payment_id, trader_id, gross, commission, net, status)
    VALUES (_order.id, _payment.id, _order.trader_id, _payment.amount, _commission,
            _payment.amount - _commission, 'pending')
    ON CONFLICT (order_id) DO NOTHING;

    UPDATE public.wave_orders SET status = 'preparing'
     WHERE id = _order.id AND status IN ('created','accepted');
  END IF;

  RETURN _payment;
END; $$;

CREATE OR REPLACE FUNCTION public.mark_settled(_settlement_id uuid)
RETURNS public.settlements LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _settlement public.settlements;
BEGIN
  UPDATE public.settlements SET status = 'settled', settled_at = now()
   WHERE id = _settlement_id AND status = 'pending'
   RETURNING * INTO _settlement;
  IF _settlement.id IS NULL THEN
    SELECT * INTO _settlement FROM public.settlements WHERE id = _settlement_id;
  END IF;
  RETURN _settlement;
END; $$;

-- These routines are privileged: only trusted server code may call them.
REVOKE EXECUTE ON FUNCTION public.expire_waves() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_wave(uuid, jsonb, text, text, double precision, double precision) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.price_basket(uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.accept_wave(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.decline_wave(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.advance_order(uuid, uuid, public.order_status) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rate_order(uuid, uuid, integer, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.start_payment(uuid, uuid, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.finalize_payment(text, public.payment_status, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mark_settled(uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.expire_waves() TO service_role;
GRANT EXECUTE ON FUNCTION public.create_wave(uuid, jsonb, text, text, double precision, double precision) TO service_role;
GRANT EXECUTE ON FUNCTION public.price_basket(uuid, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.accept_wave(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.decline_wave(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.advance_order(uuid, uuid, public.order_status) TO service_role;
GRANT EXECUTE ON FUNCTION public.rate_order(uuid, uuid, integer, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.start_payment(uuid, uuid, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.finalize_payment(text, public.payment_status, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_settled(uuid) TO service_role;