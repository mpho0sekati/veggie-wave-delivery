CREATE TYPE public.app_role AS ENUM ('buyer', 'trader');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  role public.app_role NOT NULL DEFAULT 'buyer',
  avatar text,
  online boolean NOT NULL DEFAULT false,
  lat double precision,
  lng double precision,
  rating numeric(2,1) NOT NULL DEFAULT 5.0,
  earnings numeric(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles are visible to signed-in users" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users insert their own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users update their own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE TABLE public.wallets (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance numeric(10,2) NOT NULL DEFAULT 500,
  pin text NOT NULL DEFAULT '1234',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.wallets TO authenticated;
GRANT ALL ON public.wallets TO service_role;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see their own wallet" ON public.wallets FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users create their own wallet" ON public.wallets FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update their own wallet" ON public.wallets FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.catalog_items (
  id text PRIMARY KEY,
  name text NOT NULL,
  unit text NOT NULL DEFAULT 'each',
  price numeric(10,2) NOT NULL DEFAULT 20,
  icon_key text NOT NULL DEFAULT 'sprout',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.catalog_items TO authenticated;
GRANT ALL ON public.catalog_items TO service_role;
ALTER TABLE public.catalog_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Catalog visible to signed-in users" ON public.catalog_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Signed-in users add catalog items" ON public.catalog_items FOR INSERT TO authenticated WITH CHECK (true);

CREATE TABLE public.stock (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trader_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id text NOT NULL,
  price numeric(10,2) NOT NULL DEFAULT 20,
  quantity integer NOT NULL DEFAULT 1,
  available boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (trader_id, item_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock TO authenticated;
GRANT ALL ON public.stock TO service_role;
ALTER TABLE public.stock ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Stock visible to signed-in users" ON public.stock FOR SELECT TO authenticated USING (true);
CREATE POLICY "Traders manage their own stock" ON public.stock FOR ALL TO authenticated USING (auth.uid() = trader_id) WITH CHECK (auth.uid() = trader_id);

CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trader_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'waving' CHECK (status IN ('waving','accepted','on-the-way','delivered','paid','cancelled')),
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  wish text NOT NULL DEFAULT '',
  note text NOT NULL DEFAULT '',
  total numeric(10,2) NOT NULL DEFAULT 0,
  paid_with text,
  buyer_lat double precision,
  buyer_lng double precision,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Buyers, assigned traders and open waves are visible" ON public.orders FOR SELECT TO authenticated
  USING (auth.uid() = buyer_id OR auth.uid() = trader_id OR (trader_id IS NULL AND status = 'waving'));
CREATE POLICY "Buyers create their own waves" ON public.orders FOR INSERT TO authenticated WITH CHECK (auth.uid() = buyer_id);
CREATE POLICY "Buyer or trader updates the order" ON public.orders FOR UPDATE TO authenticated
  USING (auth.uid() = buyer_id OR auth.uid() = trader_id OR (trader_id IS NULL AND status = 'waving'))
  WITH CHECK (auth.uid() = buyer_id OR auth.uid() = trader_id);

CREATE TABLE public.demand (
  key text PRIMARY KEY,
  item_id text,
  label text NOT NULL,
  requests integer NOT NULL DEFAULT 0,
  unfilled integer NOT NULL DEFAULT 0,
  last_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.demand TO authenticated;
GRANT ALL ON public.demand TO service_role;
ALTER TABLE public.demand ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Demand visible to signed-in users" ON public.demand FOR SELECT TO authenticated USING (true);
CREATE POLICY "Signed-in users log demand" ON public.demand FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Signed-in users bump demand" ON public.demand FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER orders_touch BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.log_demand(_item_id text, _label text, _stocked boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _key text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  _key := COALESCE(_item_id, 'wish:' || lower(trim(_label)));
  INSERT INTO public.demand (key, item_id, label, requests, unfilled, last_at)
  VALUES (_key, _item_id, lower(trim(_label)), 1, CASE WHEN _stocked THEN 0 ELSE 1 END, now())
  ON CONFLICT (key) DO UPDATE
    SET requests = public.demand.requests + 1,
        unfilled = public.demand.unfilled + CASE WHEN _stocked THEN 0 ELSE 1 END,
        last_at = now();
END; $$;
REVOKE ALL ON FUNCTION public.log_demand(text, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_demand(text, text, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.pay_order(_order_id uuid, _pin text, _method text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _order public.orders; _balance numeric;
BEGIN
  IF auth.uid() IS NULL THEN RETURN 'not-signed-in'; END IF;
  SELECT * INTO _order FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF _order.id IS NULL OR _order.buyer_id <> auth.uid() THEN RETURN 'no-order'; END IF;
  IF _order.status = 'paid' THEN RETURN 'ok'; END IF;
  IF _order.status <> 'delivered' THEN RETURN 'not-delivered'; END IF;

  IF _method = 'wave-pay' THEN
    SELECT balance INTO _balance FROM public.wallets WHERE user_id = auth.uid() FOR UPDATE;
    IF _balance IS NULL THEN RETURN 'no-wallet'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.wallets WHERE user_id = auth.uid() AND pin = _pin) THEN RETURN 'wrong-pin'; END IF;
    IF _balance < _order.total THEN RETURN 'insufficient'; END IF;
    UPDATE public.wallets SET balance = balance - _order.total WHERE user_id = auth.uid();
  ELSIF _method <> 'cash' THEN
    RETURN 'bad-method';
  END IF;

  UPDATE public.profiles SET earnings = earnings + _order.total WHERE id = _order.trader_id;
  UPDATE public.orders SET status = 'paid', paid_with = _method WHERE id = _order_id;
  RETURN 'ok';
END; $$;
REVOKE ALL ON FUNCTION public.pay_order(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pay_order(uuid, text, text) TO authenticated;

ALTER TABLE public.profiles REPLICA IDENTITY FULL;
ALTER TABLE public.stock REPLICA IDENTITY FULL;
ALTER TABLE public.orders REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.stock;
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;