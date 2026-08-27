-- Migration: Griya Anak retail store — mini-POS (Milestone 3)
-- Run this in the Supabase SQL editor.
--
-- Griya Anak sells books and other items at the branch. No retail/inventory
-- concept exists anywhere in the app, so this is net-new:
--   griya_products         — the catalogue (price + stock, branch-scoped)
--   griya_sales            — one sale (header): totals, payment, patient link
--   griya_sale_items       — line items (snapshot name + unit price)
--   griya_stock_movements  — audit trail of every stock change
--
-- Each completed sale ALSO writes one income `transactions` row (category
-- 'TOKO') from app/actions/griyaToko.ts, so store revenue flows into the
-- existing finance reports / accounting / closing. transactions.category is
-- free text (no CHECK), so 'TOKO' needs no schema change — only the hardcoded
-- INCOME_CATEGORIES arrays in the app.
--
-- Atomicity: griya_create_sale() writes header + items + stock decrement +
-- movement rows in one transaction. SECURITY INVOKER — RLS still applies.

-- ── griya_products ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.griya_products (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id   uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  name        text NOT NULL,
  category    text NOT NULL DEFAULT 'LAINNYA',
  sku         text,
  price       numeric(12,0) NOT NULL DEFAULT 0,
  stock       int NOT NULL DEFAULT 0,
  is_active   boolean NOT NULL DEFAULT true,
  notes       text,
  created_by  uuid REFERENCES public.internal_profiles(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_griya_products_branch ON public.griya_products (branch_id, is_active);

DROP TRIGGER IF EXISTS griya_products_updated_at ON public.griya_products;
CREATE TRIGGER griya_products_updated_at BEFORE UPDATE ON public.griya_products
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── griya_sales ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.griya_sales (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id      uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  patient_id     uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  sold_by        uuid REFERENCES public.internal_profiles(id),
  sale_date      date NOT NULL DEFAULT CURRENT_DATE,
  subtotal       numeric(12,0) NOT NULL,
  discount       numeric(12,0) NOT NULL DEFAULT 0,
  total          numeric(12,0) NOT NULL,
  amount_paid    numeric(12,0) NOT NULL,
  payment_method text CHECK (payment_method IN ('TUNAI', 'TRANSFER BCA', 'EDC BCA', 'TRANSFER BANK KALBAR')),
  payment_status text NOT NULL DEFAULT 'LUNAS' CHECK (payment_status IN ('LUNAS', 'DP', 'PELUNASAN')),
  transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  status         text NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'void')),
  notes          text,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_griya_sales_branch_date ON public.griya_sales (branch_id, sale_date DESC);

-- ── griya_sale_items ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.griya_sale_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id      uuid NOT NULL REFERENCES public.griya_sales(id) ON DELETE CASCADE,
  product_id   uuid REFERENCES public.griya_products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  qty          int NOT NULL CHECK (qty > 0),
  unit_price   numeric(12,0) NOT NULL,
  subtotal     numeric(12,0) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_griya_sale_items_sale ON public.griya_sale_items (sale_id);

-- ── griya_stock_movements ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.griya_stock_movements (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  uuid NOT NULL REFERENCES public.griya_products(id) ON DELETE CASCADE,
  branch_id   uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  delta       int NOT NULL,
  reason      text NOT NULL CHECK (reason IN ('sale', 'restock', 'adjustment', 'void')),
  sale_id     uuid REFERENCES public.griya_sales(id) ON DELETE SET NULL,
  note        text,
  created_by  uuid REFERENCES public.internal_profiles(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_griya_stock_movements_product ON public.griya_stock_movements (product_id, created_at DESC);

-- ── RLS ───────────────────────────────────────────────────────────────────

ALTER TABLE public.griya_products        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.griya_sales           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.griya_sale_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.griya_stock_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "griya_products_director_all" ON public.griya_products FOR ALL
  USING (get_my_internal_role() = 'director') WITH CHECK (get_my_internal_role() = 'director');
CREATE POLICY "griya_products_branch_write" ON public.griya_products FOR ALL
  USING (get_my_internal_role() IN ('admin', 'manager') AND branch_id = get_my_branch())
  WITH CHECK (get_my_internal_role() IN ('admin', 'manager') AND branch_id = get_my_branch());
CREATE POLICY "griya_products_branch_read" ON public.griya_products FOR SELECT
  USING (branch_id = get_my_branch());

CREATE POLICY "griya_sales_director_all" ON public.griya_sales FOR ALL
  USING (get_my_internal_role() = 'director') WITH CHECK (get_my_internal_role() = 'director');
CREATE POLICY "griya_sales_branch_write" ON public.griya_sales FOR ALL
  USING (get_my_internal_role() IN ('admin', 'manager') AND branch_id = get_my_branch())
  WITH CHECK (get_my_internal_role() IN ('admin', 'manager') AND branch_id = get_my_branch());
CREATE POLICY "griya_sales_branch_read" ON public.griya_sales FOR SELECT
  USING (branch_id = get_my_branch());

CREATE POLICY "griya_sale_items_director_all" ON public.griya_sale_items FOR ALL
  USING (get_my_internal_role() = 'director') WITH CHECK (get_my_internal_role() = 'director');
CREATE POLICY "griya_sale_items_branch_all" ON public.griya_sale_items FOR ALL
  USING (sale_id IN (SELECT id FROM public.griya_sales WHERE branch_id = get_my_branch()))
  WITH CHECK (sale_id IN (SELECT id FROM public.griya_sales WHERE branch_id = get_my_branch()));

CREATE POLICY "griya_stock_movements_director_all" ON public.griya_stock_movements FOR ALL
  USING (get_my_internal_role() = 'director') WITH CHECK (get_my_internal_role() = 'director');
CREATE POLICY "griya_stock_movements_branch_write" ON public.griya_stock_movements FOR ALL
  USING (get_my_internal_role() IN ('admin', 'manager') AND branch_id = get_my_branch())
  WITH CHECK (get_my_internal_role() IN ('admin', 'manager') AND branch_id = get_my_branch());
CREATE POLICY "griya_stock_movements_branch_read" ON public.griya_stock_movements FOR SELECT
  USING (branch_id = get_my_branch());

-- ── Atomic sale ──────────────────────────────────────────────────────────
-- p = {
--   branch_id, patient_id (nullable), sold_by, sale_date,
--   discount, payment_method, payment_status, amount_paid,
--   items: [{ product_id, qty }, ...]
-- }
-- Returns the new sale id. Raises on insufficient stock.

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
    amount_paid, payment_method, payment_status, notes
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
    NULLIF(p->>'notes', '')
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
