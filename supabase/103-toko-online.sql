-- Run this in the Supabase dashboard > SQL editor
-- Toko (shop) for every branch + online payment (DOKU QRIS / VA).
--   * The shop tables (griya_products / griya_sales / …, migration 068) were never
--     Griya-specific — they are scoped by branch_id. The fisioterapi shop (/toko)
--     reuses them; Griya and fisio sales are told apart by branch.
--   * An online sale is created as status 'pending_payment' (stock already
--     reserved by griya_create_sale) and linked from payment_links.toko_sale_id.
--     When DOKU confirms payment it becomes 'completed' with its TOKO income
--     transaction; when the link expires / is cancelled it is voided and restocked.

-- ── griya_sales: online methods + pending status ─────────────────────────────
ALTER TABLE public.griya_sales DROP CONSTRAINT IF EXISTS griya_sales_payment_method_check;
ALTER TABLE public.griya_sales ADD CONSTRAINT griya_sales_payment_method_check
  CHECK (payment_method IN ('TUNAI', 'TRANSFER BCA', 'EDC BCA', 'TRANSFER BANK KALBAR', 'DOKU QRIS', 'DOKU VA'));

ALTER TABLE public.griya_sales DROP CONSTRAINT IF EXISTS griya_sales_status_check;
ALTER TABLE public.griya_sales ADD CONSTRAINT griya_sales_status_check
  CHECK (status IN ('completed', 'void', 'pending_payment'));

-- ── payment_links → toko sale ────────────────────────────────────────────────
ALTER TABLE public.payment_links
  ADD COLUMN IF NOT EXISTS toko_sale_id uuid REFERENCES public.griya_sales(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS payment_links_toko_sale_idx ON public.payment_links (toko_sale_id) WHERE toko_sale_id IS NOT NULL;

-- ── griya_create_sale: optional header status ────────────────────────────────
CREATE OR REPLACE FUNCTION public.griya_create_sale(p jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_branch    uuid := (p->>'branch_id')::uuid;
  v_sale      uuid;
  v_subtotal  numeric(12,0) := 0;
  v_discount  numeric(12,0) := COALESCE((p->>'discount')::numeric, 0);
  v_item      jsonb;
  v_prod      public.griya_products%ROWTYPE;
  v_qty       int;
  v_line      numeric(12,0);
BEGIN
  -- validate + accumulate
  FOR v_item IN SELECT * FROM jsonb_array_elements(p->'items')
  LOOP
    v_qty := (v_item->>'qty')::int;
    SELECT * INTO v_prod FROM public.griya_products
      WHERE id = (v_item->>'product_id')::uuid FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Produk tidak ditemukan'; END IF;
    IF v_prod.branch_id <> v_branch THEN RAISE EXCEPTION 'Produk bukan milik cabang ini'; END IF;
    IF v_qty <= 0 THEN RAISE EXCEPTION 'Jumlah harus lebih dari 0'; END IF;
    IF v_prod.stock < v_qty THEN
      RAISE EXCEPTION 'Stok % tidak cukup (tersedia %, diminta %)', v_prod.name, v_prod.stock, v_qty;
    END IF;
    v_subtotal := v_subtotal + v_prod.price * v_qty;
  END LOOP;

  INSERT INTO public.griya_sales (
    branch_id, patient_id, sold_by, sale_date, subtotal, discount, total,
    amount_paid, payment_method, payment_status, notes, status
  ) VALUES (
    v_branch,
    NULLIF(p->>'patient_id', '')::uuid,
    NULLIF(p->>'sold_by', '')::uuid,
    COALESCE((p->>'sale_date')::date, CURRENT_DATE),
    v_subtotal,
    v_discount,
    GREATEST(v_subtotal - v_discount, 0),
    COALESCE((p->>'amount_paid')::numeric, GREATEST(v_subtotal - v_discount, 0)),
    NULLIF(p->>'payment_method', ''),
    COALESCE(NULLIF(p->>'payment_status', ''), 'LUNAS'),
    NULLIF(p->>'notes', ''),
    COALESCE(NULLIF(p->>'status', ''), 'completed')
  ) RETURNING id INTO v_sale;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p->'items')
  LOOP
    v_qty := (v_item->>'qty')::int;
    SELECT * INTO v_prod FROM public.griya_products WHERE id = (v_item->>'product_id')::uuid;
    v_line := v_prod.price * v_qty;

    INSERT INTO public.griya_sale_items (sale_id, product_id, product_name, qty, unit_price, subtotal)
    VALUES (v_sale, v_prod.id, v_prod.name, v_qty, v_prod.price, v_line);

    UPDATE public.griya_products SET stock = stock - v_qty WHERE id = v_prod.id;

    INSERT INTO public.griya_stock_movements (product_id, branch_id, delta, reason, sale_id, created_by)
    VALUES (v_prod.id, v_branch, -v_qty, 'sale', v_sale, NULLIF(p->>'sold_by', '')::uuid);
  END LOOP;

  RETURN v_sale;
END $$;

-- ── Atomic restock / re-deduct of a sale's items ─────────────────────────────
-- p_direction = +1 returns the items to stock (void / cancelled online sale),
-- -1 takes them out again (an online payment that arrived after auto-void).
CREATE OR REPLACE FUNCTION public.toko_move_sale_stock(p_sale uuid, p_direction int, p_reason text, p_user uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_branch uuid;
  v_item   record;
BEGIN
  IF p_direction NOT IN (1, -1) THEN RAISE EXCEPTION 'p_direction must be 1 or -1'; END IF;
  SELECT branch_id INTO v_branch FROM public.griya_sales WHERE id = p_sale;
  IF NOT FOUND THEN RAISE EXCEPTION 'Penjualan tidak ditemukan'; END IF;

  FOR v_item IN
    SELECT product_id, qty FROM public.griya_sale_items WHERE sale_id = p_sale AND product_id IS NOT NULL
  LOOP
    UPDATE public.griya_products SET stock = stock + p_direction * v_item.qty WHERE id = v_item.product_id;
    INSERT INTO public.griya_stock_movements (product_id, branch_id, delta, reason, sale_id, created_by)
    VALUES (v_item.product_id, v_branch, p_direction * v_item.qty, p_reason, p_sale, p_user);
  END LOOP;
END $$;
