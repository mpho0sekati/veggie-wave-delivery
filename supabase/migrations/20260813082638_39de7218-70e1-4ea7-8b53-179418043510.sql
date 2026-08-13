DROP VIEW IF EXISTS public.trader_directory;

-- private earnings, owner-only
CREATE TABLE IF NOT EXISTS public.trader_earnings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  earnings numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.trader_earnings TO authenticated;
GRANT ALL ON public.trader_earnings TO service_role;
ALTER TABLE public.trader_earnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Traders read their own earnings"
ON public.trader_earnings FOR SELECT TO authenticated
USING (auth.uid() = user_id);

INSERT INTO public.trader_earnings (user_id, earnings)
SELECT id, earnings FROM public.profiles
ON CONFLICT (user_id) DO NOTHING;

ALTER TABLE public.profiles DROP COLUMN earnings;

CREATE POLICY "Online traders are discoverable"
ON public.profiles FOR SELECT TO authenticated
USING (online = true AND role = 'trader'::public.app_role);

CREATE OR REPLACE FUNCTION public.pay_order(_order_id uuid, _pin text, _method text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _order public.orders; _balance numeric; _hash text;
BEGIN
  IF auth.uid() IS NULL THEN RETURN 'not-signed-in'; END IF;
  SELECT * INTO _order FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF _order.id IS NULL OR _order.buyer_id <> auth.uid() THEN RETURN 'no-order'; END IF;
  IF _order.status = 'paid' THEN RETURN 'ok'; END IF;
  IF _order.status <> 'delivered' THEN RETURN 'not-delivered'; END IF;

  IF _method = 'wave-pay' THEN
    SELECT balance, pin_hash INTO _balance, _hash FROM public.wallets WHERE user_id = auth.uid() FOR UPDATE;
    IF _balance IS NULL THEN RETURN 'no-wallet'; END IF;
    IF _hash IS NULL OR extensions.crypt(_pin, _hash) <> _hash THEN RETURN 'wrong-pin'; END IF;
    IF _balance < _order.total THEN RETURN 'insufficient'; END IF;
    UPDATE public.wallets SET balance = balance - _order.total WHERE user_id = auth.uid();
  ELSIF _method <> 'cash' THEN
    RETURN 'bad-method';
  END IF;

  INSERT INTO public.trader_earnings (user_id, earnings)
  VALUES (_order.trader_id, _order.total)
  ON CONFLICT (user_id) DO UPDATE SET earnings = public.trader_earnings.earnings + _order.total, updated_at = now();

  UPDATE public.orders SET status = 'paid', paid_with = _method WHERE id = _order_id;
  RETURN 'ok';
END; $function$;

REVOKE ALL ON FUNCTION public.pay_order(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pay_order(uuid, text, text) TO service_role;