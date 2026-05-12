CREATE OR REPLACE FUNCTION public.can_access_empresa(p_empresa_id UUID)
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
  IF auth.role() <> 'authenticated' OR auth.uid() IS NULL OR p_empresa_id IS NULL THEN
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

INSERT INTO public.empresa_usuarios (
  empresa_id,
  user_id,
  papel,
  pode_executar_checklists,
  is_responsavel_tecnico
)
SELECT
  empresa.id,
  profiles.id,
  'gestor',
  true,
  false
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

ALTER TABLE public.empresa ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view companies" ON public.empresa;
DROP POLICY IF EXISTS "Authenticated users can view companies" ON public.empresa;
DROP POLICY IF EXISTS "Authenticated company members can view companies" ON public.empresa;

CREATE POLICY "Authenticated company members can view companies"
  ON public.empresa
  FOR SELECT
  TO authenticated
  USING ((SELECT public.can_access_empresa(id)));

DROP POLICY IF EXISTS "Authenticated users can insert companies" ON public.empresa;
DROP POLICY IF EXISTS "Only system admin can insert companies" ON public.empresa;

CREATE POLICY "Only system admin can insert companies"
  ON public.empresa
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT public.is_system_admin()));

DROP POLICY IF EXISTS "Authenticated users can update companies" ON public.empresa;
DROP POLICY IF EXISTS "Authenticated company members can update companies" ON public.empresa;

CREATE POLICY "Authenticated company members can update companies"
  ON public.empresa
  FOR UPDATE
  TO authenticated
  USING ((SELECT public.can_access_empresa(id)))
  WITH CHECK ((SELECT public.can_access_empresa(id)));

DROP POLICY IF EXISTS "Authenticated users can delete companies" ON public.empresa;
DROP POLICY IF EXISTS "Authenticated company members can delete companies" ON public.empresa;
DROP POLICY IF EXISTS "Only system admin can delete companies" ON public.empresa;

CREATE POLICY "Only system admin can delete companies"
  ON public.empresa
  FOR DELETE
  TO authenticated
  USING ((SELECT public.is_system_admin()));

REVOKE ALL ON FUNCTION public.can_access_empresa(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_manage_empresa_members(UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.can_access_empresa(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_empresa_members(UUID) TO authenticated;
