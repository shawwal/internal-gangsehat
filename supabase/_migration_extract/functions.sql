CREATE OR REPLACE FUNCTION public.generate_trx_code()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  seq int;
BEGIN
  SELECT COALESCE(MAX(
    (regexp_match(kode_transaksi, 'TRX/\d{4}/\d{2}/(\d+)'))[1]::int
  ), 0) + 1
  INTO seq
  FROM internal_order_meta
  WHERE kode_transaksi LIKE 'TRX/' || EXTRACT(YEAR FROM now()) || '/' ||
        LPAD(EXTRACT(MONTH FROM now())::text, 2, '0') || '/%';

  NEW.kode_transaksi := 'TRX/' ||
    EXTRACT(YEAR FROM now()) || '/' ||
    LPAD(EXTRACT(MONTH FROM now())::text, 2, '0') || '/' ||
    LPAD(seq::text, 4, '0');
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.get_my_branch()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  SELECT branch_id FROM public.internal_profiles WHERE id = auth.uid();
$function$
;
CREATE OR REPLACE FUNCTION public.get_my_internal_role()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  SELECT role::text FROM public.internal_profiles WHERE id = auth.uid();
$function$
;
CREATE OR REPLACE FUNCTION public.handle_new_internal_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.internal_profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      split_part(COALESCE(NEW.email, 'user@x'), '@', 1)
    ),
    'staff'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.next_order_seq(p_year integer, p_month integer)
 RETURNS integer
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  INSERT INTO order_sequences (year, month, last_seq)
  VALUES (p_year, p_month, 1)
  ON CONFLICT (year, month)
  DO UPDATE SET last_seq = order_sequences.last_seq + 1
  RETURNING last_seq;
$function$
;
CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$function$
;
CREATE OR REPLACE FUNCTION public.update_therapist_ratings()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  UPDATE therapists
  SET
    average_rating = (
      SELECT AVG(rating) FROM therapist_ratings WHERE therapist_id = NEW.therapist_id
    ),
    total_reviews = (
      SELECT COUNT(*) FROM therapist_ratings WHERE therapist_id = NEW.therapist_id
    ),
    updated_at = NOW()
  WHERE id = NEW.therapist_id;
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;
