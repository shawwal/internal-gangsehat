-- Order ID system: global monthly-reset order sequence + order_id columns.

CREATE TABLE IF NOT EXISTS public.order_sequences (
  year     integer NOT NULL,
  month    integer NOT NULL CHECK (month BETWEEN 1 AND 12),
  last_seq integer NOT NULL DEFAULT 0,
  CONSTRAINT order_sequences_pkey PRIMARY KEY (year, month)
);
ALTER TABLE public.order_sequences ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.next_order_seq(p_year integer, p_month integer)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO order_sequences (year, month, last_seq)
  VALUES (p_year, p_month, 1)
  ON CONFLICT (year, month)
  DO UPDATE SET last_seq = order_sequences.last_seq + 1
  RETURNING last_seq;
$$;
GRANT EXECUTE ON FUNCTION public.next_order_seq(integer, integer) TO authenticated;

ALTER TABLE public.patient_visits   ADD COLUMN IF NOT EXISTS order_id text UNIQUE;
ALTER TABLE public.patient_packages ADD COLUMN IF NOT EXISTS order_id text UNIQUE;
ALTER TABLE public.patient_packages ADD COLUMN IF NOT EXISTS category text
  CHECK (category IN ('PAKET KLINIK', 'PAKET VISIT'));
ALTER TABLE public.patient_packages ADD COLUMN IF NOT EXISTS purchased_at date NOT NULL DEFAULT CURRENT_DATE;

-- Not unique: DP + Pelunasan installments for one order share the same order_id.
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS order_id text;
