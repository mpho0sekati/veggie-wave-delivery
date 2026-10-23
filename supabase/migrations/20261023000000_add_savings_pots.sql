-- Mdeko Finance: savings_pots table
-- Each user gets one savings jar that auto-grows via the 5% auto-save rule.

CREATE TABLE IF NOT EXISTS public.savings_pots (
  user_id       uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance       numeric     NOT NULL DEFAULT 0 CHECK (balance >= 0),
  target_amount numeric     NOT NULL DEFAULT 500 CHECK (target_amount > 0),
  name          text        NOT NULL DEFAULT 'My Savings Jar',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Row Level Security: each user can only see and touch their own row
ALTER TABLE public.savings_pots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "savings_pots: owner can select"
  ON public.savings_pots FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "savings_pots: owner can insert"
  ON public.savings_pots FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "savings_pots: owner can update"
  ON public.savings_pots FOR UPDATE
  USING (user_id = auth.uid());
