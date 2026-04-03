CREATE OR REPLACE FUNCTION public.is_system_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    auth.role() = 'authenticated'
    AND auth.uid() IS NOT NULL
    AND LOWER(COALESCE(auth.jwt() ->> 'email', '')) = 'firetetraedro@gmail.com';
$$;

CREATE OR REPLACE FUNCTION public.can_upload_empresa_art(p_empresa_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  IF auth.role() <> 'authenticated' OR auth.uid() IS NULL OR p_empresa_id IS NULL THEN
    RETURN FALSE;
  END IF;

  IF LOWER(COALESCE(auth.jwt() ->> 'email', '')) = 'firetetraedro@gmail.com' THEN
    RETURN TRUE;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.empresa_usuarios
    WHERE empresa_id = p_empresa_id
      AND user_id = auth.uid()
      AND COALESCE(is_responsavel_tecnico, false) = true
  );
END;
$$;

REVOKE ALL ON FUNCTION public.is_system_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_upload_empresa_art(UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.is_system_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_upload_empresa_art(UUID) TO authenticated;
