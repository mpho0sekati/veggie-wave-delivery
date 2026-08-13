-- 1) profiles: restrict full-row reads
DROP POLICY IF EXISTS "Profiles are visible to signed-in users" ON public.profiles;

CREATE POLICY "Users read their own profile"
ON public.profiles FOR SELECT TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Trading counterparties read each other"
ON public.profiles FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.orders o
  WHERE (o.buyer_id = auth.uid() AND o.trader_id = public.profiles.id)
     OR (o.trader_id = auth.uid() AND o.buyer_id = public.profiles.id)
));

CREATE OR REPLACE VIEW public.trader_directory
WITH (security_invoker = false) AS
SELECT p.id, p.name, p.avatar, p.online, p.lat, p.lng, p.rating
FROM public.profiles p
WHERE p.role = 'trader'::public.app_role AND p.online = true;

REVOKE ALL ON public.trader_directory FROM anon;
GRANT SELECT ON public.trader_directory TO authenticated;
GRANT ALL ON public.trader_directory TO service_role;

-- 2) orders: split update rules, no hijacking
DROP POLICY IF EXISTS "Buyer or trader updates the order" ON public.orders;

CREATE POLICY "Buyer updates own order"
ON public.orders FOR UPDATE TO authenticated
USING (auth.uid() = buyer_id)
WITH CHECK (auth.uid() = buyer_id);

CREATE POLICY "Assigned trader updates the order"
ON public.orders FOR UPDATE TO authenticated
USING (auth.uid() = trader_id)
WITH CHECK (auth.uid() = trader_id);

CREATE POLICY "Trader claims an open wave"
ON public.orders FOR UPDATE TO authenticated
USING (trader_id IS NULL AND status = 'waving' AND auth.uid() <> buyer_id)
WITH CHECK (auth.uid() = trader_id);

-- 3) wallets: hashed pin, no predictable default
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

ALTER TABLE public.wallets ALTER COLUMN pin DROP DEFAULT;
ALTER TABLE public.wallets RENAME COLUMN pin TO pin_hash;
UPDATE public.wallets
SET pin_hash = extensions.crypt(pin_hash, extensions.gen_salt('bf'))
WHERE pin_hash NOT LIKE '$2%';

CREATE OR REPLACE FUNCTION public.hash_wallet_pin()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.pin_hash IS NULL OR length(NEW.pin_hash) < 4 THEN
    RAISE EXCEPTION 'PIN must be at least 4 characters';
  END IF;
  IF NEW.pin_hash NOT LIKE '$2%' THEN
    NEW.pin_hash := extensions.crypt(NEW.pin_hash, extensions.gen_salt('bf'));
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS wallets_hash_pin ON public.wallets;
CREATE TRIGGER wallets_hash_pin
BEFORE INSERT OR UPDATE OF pin_hash ON public.wallets
FOR EACH ROW EXECUTE FUNCTION public.hash_wallet_pin();

-- 4) pay_order uses hashed pin; internal routines not callable by app users
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

  UPDATE public.profiles SET earnings = earnings + _order.total WHERE id = _order.trader_id;
  UPDATE public.orders SET status = 'paid', paid_with = _method WHERE id = _order_id;
  RETURN 'ok';
END; $function$;

REVOKE ALL ON FUNCTION public.pay_order(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pay_order(uuid, text, text) TO service_role;

REVOKE ALL ON FUNCTION public.log_demand(text, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.log_demand(text, text, boolean) TO service_role;