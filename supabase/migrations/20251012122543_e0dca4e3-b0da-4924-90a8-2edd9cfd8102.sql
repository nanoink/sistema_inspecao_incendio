-- Fix search_path security issue for update_updated_at_column function
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Recreate trigger after function update
CREATE TRIGGER update_empresa_updated_at
  BEFORE UPDATE ON public.empresa
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();