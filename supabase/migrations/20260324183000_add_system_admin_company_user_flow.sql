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

CREATE OR REPLACE FUNCTION public.can_access_empresa(p_empresa_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  IF auth.role() <> 'authenticated' OR auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;

  IF public.is_system_admin() THEN
    RETURN TRUE;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.empresa_usuarios
    WHERE empresa_id = p_empresa_id
      AND user_id = auth.uid()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.can_manage_empresa_members(p_empresa_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  IF auth.role() <> 'authenticated' OR auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;

  IF public.is_system_admin() THEN
    RETURN TRUE;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.empresa_usuarios
    WHERE empresa_id = p_empresa_id
      AND user_id = auth.uid()
      AND papel = 'gestor'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_empresa_membership_bootstrap(p_empresa_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_empresa_created_add_gestor()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS handle_empresa_created_add_gestor ON public.empresa;

DELETE FROM public.empresa_usuarios AS empresa_usuarios
USING public.profiles AS profiles
WHERE profiles.id = empresa_usuarios.user_id
  AND LOWER(BTRIM(COALESCE(profiles.email, ''))) = 'firetetraedro@gmail.com';

INSERT INTO public.empresa_usuarios (empresa_id, user_id, papel)
SELECT
  empresa.id,
  profiles.id,
  'gestor'
FROM public.empresa AS empresa
INNER JOIN public.profiles AS profiles
  ON LOWER(BTRIM(COALESCE(profiles.email, ''))) = LOWER(BTRIM(COALESCE(empresa.email, '')))
WHERE LOWER(BTRIM(COALESCE(profiles.email, ''))) <> 'firetetraedro@gmail.com'
  AND NOT EXISTS (
    SELECT 1
    FROM public.empresa_usuarios AS empresa_usuarios
    WHERE empresa_usuarios.empresa_id = empresa.id
  )
ON CONFLICT (empresa_id, user_id)
DO NOTHING;

DROP POLICY IF EXISTS "Authenticated users can insert companies" ON public.empresa;
DROP POLICY IF EXISTS "Only system admin can insert companies" ON public.empresa;

CREATE POLICY "Only system admin can insert companies"
  ON public.empresa
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_system_admin());

DROP POLICY IF EXISTS "Authenticated company members can delete companies" ON public.empresa;
DROP POLICY IF EXISTS "Only system admin can delete companies" ON public.empresa;

CREATE POLICY "Only system admin can delete companies"
  ON public.empresa
  FOR DELETE
  TO authenticated
  USING (public.is_system_admin());
