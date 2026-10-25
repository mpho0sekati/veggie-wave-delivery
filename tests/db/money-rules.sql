-- Money-rule checks against the live database. Everything runs inside one block
-- that always ends by raising, so every test row is rolled back.
-- Success ends with: MONEY-RULES PASSED. Any other message is a failure.
DO $$
DECLARE
  o public.wave_orders; p1 public.payments; p2 public.payments;
  before_bal numeric; after_bal numeric; dup_blocked boolean := false;
  other uuid := gen_random_uuid(); seen int;
BEGIN
  SELECT * INTO o FROM public.wave_orders w
   WHERE w.trader_id IS NOT NULL AND w.amount > 0
     AND NOT EXISTS (SELECT 1 FROM public.payments x WHERE x.order_id = w.id)
     AND NOT EXISTS (SELECT 1 FROM public.settlements s WHERE s.order_id = w.id)
   LIMIT 1;
  IF o.id IS NULL THEN RAISE EXCEPTION 'SETUP: no unpaid order to test with'; END IF;

  -- 1. Starting a payment twice for one order returns the same payment.
  p1 := public.start_payment(o.id, o.buyer_id, gen_random_uuid()::text, 'test-a-' || o.id, '27700000000');
  p2 := public.start_payment(o.id, o.buyer_id, gen_random_uuid()::text, 'test-b-' || o.id, '27700000000');
  IF p1.id <> p2.id THEN RAISE EXCEPTION 'FAIL: second payment created'; END IF;
  IF p1.amount <> o.amount THEN RAISE EXCEPTION 'FAIL: payment amount differs from order'; END IF;

  -- 2. A settlement saves exactly 5% once; a second settlement for the order is refused.
  SELECT coalesce(max(balance), 0) INTO before_bal FROM public.savings_pots WHERE user_id = o.trader_id;
  INSERT INTO public.settlements(order_id, payment_id, trader_id, gross, net) VALUES (o.id, p1.id, o.trader_id, 100, 100);
  BEGIN
    INSERT INTO public.settlements(order_id, payment_id, trader_id, gross, net) VALUES (o.id, p1.id, o.trader_id, 100, 100);
  EXCEPTION WHEN unique_violation THEN dup_blocked := true;
  END;
  IF NOT dup_blocked THEN RAISE EXCEPTION 'FAIL: duplicate settlement allowed'; END IF;
  SELECT balance INTO after_bal FROM public.savings_pots WHERE user_id = o.trader_id;
  IF after_bal - before_bal <> 5 THEN RAISE EXCEPTION 'FAIL: savings grew by % not 5', after_bal - before_bal; END IF;

  -- 3. Another signed-in user cannot see this order, its payment or settlement.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', other, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT (SELECT count(*) FROM public.wave_orders WHERE id = o.id)
       + (SELECT count(*) FROM public.payments WHERE order_id = o.id)
       + (SELECT count(*) FROM public.settlements WHERE order_id = o.id) INTO seen;
  IF seen <> 0 THEN RAISE EXCEPTION 'FAIL: stranger saw % rows', seen; END IF;

  -- 4. The buyer can see their own order and payment.
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', o.buyer_id, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT (SELECT count(*) FROM public.wave_orders WHERE id = o.id)
       + (SELECT count(*) FROM public.payments WHERE order_id = o.id) INTO seen;
  IF seen <> 2 THEN RAISE EXCEPTION 'FAIL: buyer saw % of 2 rows', seen; END IF;

  RAISE EXCEPTION 'MONEY-RULES PASSED';
END $$;
