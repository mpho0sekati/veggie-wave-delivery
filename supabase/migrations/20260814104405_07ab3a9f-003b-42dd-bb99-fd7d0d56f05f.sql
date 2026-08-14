CREATE OR REPLACE FUNCTION public.guard_order_claim()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Only the buyer may change the contents/value of the order.
  IF auth.uid() IS DISTINCT FROM OLD.buyer_id THEN
    IF NEW.buyer_id IS DISTINCT FROM OLD.buyer_id
       OR NEW.items::text IS DISTINCT FROM OLD.items::text
       OR NEW.total IS DISTINCT FROM OLD.total
       OR NEW.wish IS DISTINCT FROM OLD.wish
       OR NEW.note IS DISTINCT FROM OLD.note
       OR NEW.buyer_lat IS DISTINCT FROM OLD.buyer_lat
       OR NEW.buyer_lng IS DISTINCT FROM OLD.buyer_lng
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Only the buyer can change order contents';
    END IF;
  END IF;

  -- A trader may never reassign an order away from themselves to someone else.
  IF OLD.trader_id IS NOT NULL
     AND NEW.trader_id IS DISTINCT FROM OLD.trader_id
     AND auth.uid() IS DISTINCT FROM OLD.buyer_id THEN
    RAISE EXCEPTION 'Order is already claimed';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_guard_claim ON public.orders;
CREATE TRIGGER orders_guard_claim
BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.guard_order_claim();