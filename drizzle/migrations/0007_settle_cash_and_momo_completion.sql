CREATE OR REPLACE FUNCTION public.guard_new_momo_payment() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF NEW.provider = 'cash' THEN RETURN NEW; END IF;
  IF NOT EXISTS(SELECT 1 FROM wave_orders WHERE id=NEW.order_id AND cancelled_at IS NULL AND payment_method='mtn-momo' AND status<>'completed') THEN RAISE EXCEPTION 'order-not-payable'; END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.confirm_cash(_order_id uuid, _buyer uuid) RETURNS public.wave_orders LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE o wave_orders; p payments;
BEGIN
  SELECT * INTO o FROM wave_orders WHERE id=_order_id FOR UPDATE;
  IF o.id IS NULL OR o.buyer_id<>_buyer OR o.cancelled_at IS NOT NULL THEN RAISE EXCEPTION 'not-your-order'; END IF;
  IF o.payment_method<>'cash' OR o.status NOT IN ('delivered','completed') THEN RAISE EXCEPTION 'cash-requires-delivery'; END IF;
  SELECT * INTO p FROM payments WHERE order_id=o.id AND provider='cash' LIMIT 1;
  IF p.id IS NULL THEN
    INSERT INTO payments(order_id,buyer_id,provider,reference,amount,currency,status,provider_status,verified_at)
    VALUES (o.id,o.buyer_id,'cash','cash-'||o.id,o.amount,o.currency,'successful','BUYER_CONFIRMED',now())
    RETURNING * INTO p;
  END IF;
  INSERT INTO settlements(order_id,payment_id,trader_id,gross,commission,net,status,settled_at)
  VALUES (o.id,p.id,o.trader_id,o.amount,0,o.amount,'settled',now())
  ON CONFLICT (order_id) DO NOTHING;
  UPDATE wave_orders SET status='completed',completed_at=coalesce(completed_at,now()) WHERE id=o.id RETURNING * INTO o;
  RETURN o;
END $$;
REVOKE EXECUTE ON FUNCTION public.confirm_cash(uuid,uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.finalize_payment(_reference text, _status payment_status, _provider_status text, _failure text) RETURNS public.payments LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _payment public.payments; _order public.wave_orders; _commission numeric;
BEGIN
  SELECT * INTO _payment FROM public.payments WHERE reference = _reference FOR UPDATE;
  IF _payment.id IS NULL THEN RAISE EXCEPTION 'payment-not-found'; END IF;
  IF _payment.status <> 'pending' THEN RETURN _payment; END IF;
  IF _status = 'pending' THEN
    UPDATE public.payments SET provider_status = _provider_status WHERE id = _payment.id RETURNING * INTO _payment;
    RETURN _payment;
  END IF;
  UPDATE public.payments SET status=_status, provider_status=_provider_status, failure_reason=_failure, verified_at=now()
   WHERE id=_payment.id RETURNING * INTO _payment;
  IF _status = 'successful' THEN
    SELECT * INTO _order FROM public.wave_orders WHERE id=_payment.order_id FOR UPDATE;
    _commission := ROUND(_payment.amount * 0.05, 2);
    INSERT INTO public.settlements (order_id,payment_id,trader_id,gross,commission,net,status)
    VALUES (_order.id,_payment.id,_order.trader_id,_payment.amount,_commission,_payment.amount-_commission,'pending')
    ON CONFLICT (order_id) DO NOTHING;
    UPDATE public.wave_orders SET status='preparing' WHERE id=_order.id AND status IN ('created','accepted');
    UPDATE public.wave_orders SET status='completed', completed_at=coalesce(completed_at,now()) WHERE id=_order.id AND status='delivered';
  END IF;
  RETURN _payment;
END $$;
REVOKE EXECUTE ON FUNCTION public.finalize_payment(text,payment_status,text,text) FROM PUBLIC, anon, authenticated;