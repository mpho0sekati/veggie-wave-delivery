-- Public discovery: anyone, even signed out, can see online traders and their stock on the map.
GRANT SELECT ON public.profiles TO anon;
CREATE POLICY "Anyone can discover online traders" ON public.profiles FOR SELECT TO anon USING (online AND role = 'trader');
GRANT SELECT ON public.stock TO anon;
CREATE POLICY "Anyone can see online trader stock" ON public.stock FOR SELECT TO anon USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = stock.trader_id AND p.online AND p.role = 'trader'));

-- Cash fallback: an unanswered MoMo request must not trap an order forever.
-- A pending request older than 3 minutes is marked superseded so the buyer can switch to cash;
-- a successful payment still blocks the switch.
CREATE OR REPLACE FUNCTION public.choose_cash(_order_id uuid, _buyer uuid) RETURNS public.wave_orders LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE o wave_orders;
BEGIN
  SELECT * INTO o FROM wave_orders WHERE id=_order_id FOR UPDATE;
  IF o.id IS NULL OR o.buyer_id<>_buyer OR o.cancelled_at IS NOT NULL THEN RAISE EXCEPTION 'not-your-order'; END IF;
  IF EXISTS(SELECT 1 FROM payments WHERE order_id=o.id AND status='successful') THEN RAISE EXCEPTION 'momo-payment-in-progress'; END IF;
  UPDATE payments SET status='failed', failure_reason='superseded-by-cash', verified_at=now()
    WHERE order_id=o.id AND status='pending' AND created_at < now() - interval '3 minutes';
  IF EXISTS(SELECT 1 FROM payments WHERE order_id=o.id AND status='pending') THEN RAISE EXCEPTION 'momo-payment-in-progress'; END IF;
  UPDATE wave_orders SET payment_method='cash' WHERE id=o.id RETURNING * INTO o;
  RETURN o;
END $$;
REVOKE EXECUTE ON FUNCTION public.choose_cash(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.choose_cash(uuid,uuid) TO service_role;