-- Add 'refunded' to orders status enum
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check 
  CHECK (status IN ('waving','accepted','on-the-way','delivered','paid','cancelled','refunded','failed'));

-- Create refund_order server function (mirrors pay_order logic)
CREATE OR REPLACE FUNCTION public.refund_order(_order_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE 
  _order public.orders;
  _refund_amount numeric;
BEGIN
  IF auth.uid() IS NULL THEN RETURN 'not-signed-in'; END IF;
  
  SELECT * INTO _order FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF _order.id IS NULL THEN RETURN 'no-order'; END IF;
  
  -- Only the buyer can refund their own order
  IF _order.buyer_id <> auth.uid() THEN RETURN 'not-authorized'; END IF;
  
  -- Can only refund orders that are paid
  IF _order.status <> 'paid' THEN RETURN 'invalid-status'; END IF;
  
  -- Only refund if paid with Wave Pay (cash orders can't be refunded digitally)
  IF _order.paid_with <> 'wave-pay' THEN RETURN 'not-wave-pay'; END IF;
  
  -- Get the refund amount (full order total)
  _refund_amount := _order.total;
  
  -- Start transaction: refund wallet and reverse trader earnings
  UPDATE public.wallets 
    SET balance = balance + _refund_amount 
    WHERE user_id = _order.buyer_id;
  
  UPDATE public.profiles 
    SET earnings = GREATEST(0, earnings - _refund_amount) 
    WHERE id = _order.trader_id;
  
  UPDATE public.orders 
    SET status = 'refunded' 
    WHERE id = _order_id;
  
  RETURN 'ok';
END; $$;
REVOKE ALL ON FUNCTION public.refund_order(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.refund_order(uuid) TO authenticated;

-- Ensure Realtime is listening to refunded orders
ALTER PUBLICATION supabase_realtime SET (publish = 'insert, update, delete');
