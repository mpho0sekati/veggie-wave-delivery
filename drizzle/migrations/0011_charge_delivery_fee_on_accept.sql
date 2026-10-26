-- The buyer's estimate includes the delivery fee (base R10 + R5/km, minimum R10),
-- but accept_wave never charged it. Add the same formula at accept time so the
-- checkout amount matches what the buyer was shown and the trader earns the delivery.
CREATE OR REPLACE FUNCTION public.accept_wave(_wave_id uuid,_trader uuid) RETURNS public.wave_orders LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE w waves; o wave_orders; line jsonb; s stock; t profiles; total numeric:=0; qty integer; km numeric; fee numeric:=0;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM user_roles WHERE user_id=_trader AND role='trader') THEN RAISE EXCEPTION 'trader-profile-required'; END IF;
  SELECT * INTO t FROM profiles WHERE id=_trader AND online AND lat IS NOT NULL AND lng IS NOT NULL;
  IF t.id IS NULL THEN RAISE EXCEPTION 'trader-offline'; END IF;
  SELECT * INTO w FROM waves WHERE id=_wave_id FOR UPDATE;
  IF w.id IS NULL OR w.buyer_id=_trader THEN RAISE EXCEPTION 'invalid-wave'; END IF;
  SELECT * INTO o FROM wave_orders WHERE wave_id=w.id;
  IF o.id IS NOT NULL THEN IF o.trader_id=_trader AND o.cancelled_at IS NULL THEN RETURN o; END IF; RAISE EXCEPTION 'wave-already-accepted'; END IF;
  IF w.status<>'created' OR w.expires_at<=now() THEN RAISE EXCEPTION 'wave-expired'; END IF;
  IF jsonb_array_length(w.items)=0 THEN RAISE EXCEPTION 'itemized-order-required'; END IF;
  FOR line IN SELECT * FROM jsonb_array_elements(w.items) LOOP
    qty:=(line->>'qty')::integer;
    SELECT * INTO s FROM stock WHERE trader_id=_trader AND item_id=line->>'id' AND available ORDER BY id LIMIT 1 FOR UPDATE;
    IF s.id IS NULL OR qty<1 OR s.quantity<qty THEN RAISE EXCEPTION 'insufficient-stock'; END IF;
    total:=total+s.price*qty;
    UPDATE stock SET quantity=quantity-qty WHERE id=s.id;
  END LOOP;
  -- Delivery fee matches the buyer's estimate: base R10 + R5/km, minimum R10.
  IF w.lat IS NOT NULL AND w.lng IS NOT NULL THEN
    km := 2 * 6371 * asin(sqrt(power(sin(radians(w.lat - t.lat) / 2), 2) + cos(radians(t.lat)) * cos(radians(w.lat)) * power(sin(radians(w.lng - t.lng) / 2), 2)));
    fee := greatest(10, round(10 + km * 5));
  END IF;
  total := total + fee;
  UPDATE waves SET status='accepted',trader_id=_trader WHERE id=w.id;
  INSERT INTO wave_orders(wave_id,buyer_id,trader_id,items,amount,note,status) VALUES(w.id,w.buyer_id,_trader,w.items,round(total,2),w.note,'accepted') RETURNING * INTO o;
  RETURN o;
END $$;
REVOKE EXECUTE ON FUNCTION public.accept_wave(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_wave(uuid,uuid) TO service_role;