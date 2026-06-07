CREATE OR REPLACE FUNCTION public.list_gestor_empresa_vinculos()
RETURNS TABLE (
  user_id UUID,
  nome TEXT,
  email TEXT,
  cpf TEXT,
  cargo TEXT,
  crea TEXT,
  total_empresas INTEGER,
  empresas JSONB,
  updated_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_system_admin() THEN
    RAISE EXCEPTION 'Somente o administrador geral pode listar os gestores.';
  END IF;

  RETURN QUERY
  WITH gestor_vinculos AS (
    SELECT
      empresa_usuarios.user_id,
      empresa_usuarios.empresa_id,
      empresa_usuarios.updated_at
    FROM public.empresa_usuarios
    WHERE empresa_usuarios.papel = 'gestor'
  )
  SELECT
    profiles.id AS user_id,
    COALESCE(NULLIF(BTRIM(profiles.nome), ''), profiles.email, 'Usuario sem nome') AS nome,
    profiles.email,
    NULLIF(BTRIM(profiles.cpf), '') AS cpf,
    NULLIF(BTRIM(profiles.cargo), '') AS cargo,
    NULLIF(BTRIM(profiles.crea), '') AS crea,
    COUNT(empresa.id)::INTEGER AS total_empresas,
    COALESCE(
      JSONB_AGG(
        JSONB_BUILD_OBJECT(
          'empresa_id', empresa.id,
          'razao_social', empresa.razao_social,
          'nome_fantasia', empresa.nome_fantasia,
          'cnpj', empresa.cnpj,
          'cidade', empresa.cidade,
          'estado', empresa.estado,
          'updated_at', gestor_vinculos.updated_at
        )
        ORDER BY empresa.razao_social
      ) FILTER (WHERE empresa.id IS NOT NULL),
      '[]'::JSONB
    ) AS empresas,
    MAX(gestor_vinculos.updated_at) AS updated_at
  FROM gestor_vinculos
  INNER JOIN public.profiles
    ON profiles.id = gestor_vinculos.user_id
  INNER JOIN public.empresa
    ON empresa.id = gestor_vinculos.empresa_id
  WHERE LOWER(BTRIM(COALESCE(profiles.email, ''))) <> 'firetetraedro@gmail.com'
  GROUP BY
    profiles.id,
    profiles.nome,
    profiles.email,
    profiles.cpf,
    profiles.cargo,
    profiles.crea
  ORDER BY
    COALESCE(NULLIF(BTRIM(profiles.nome), ''), profiles.email, 'Usuario sem nome');
END;
$$;

CREATE OR REPLACE FUNCTION public.set_gestor_empresas(
  p_user_id UUID,
  p_empresa_ids UUID[] DEFAULT ARRAY[]::UUID[]
)
RETURNS TABLE (
  user_id UUID,
  nome TEXT,
  email TEXT,
  cpf TEXT,
  cargo TEXT,
  crea TEXT,
  total_empresas INTEGER,
  empresas JSONB,
  updated_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_ids UUID[] := ARRAY[]::UUID[];
  v_requested_count INTEGER := 0;
  v_existing_count INTEGER := 0;
BEGIN
  IF NOT public.is_system_admin() THEN
    RAISE EXCEPTION 'Somente o administrador geral pode alterar empresas de gestores.';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario nao informado.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = p_user_id
      AND LOWER(BTRIM(COALESCE(email, ''))) <> 'firetetraedro@gmail.com'
  ) THEN
    RAISE EXCEPTION 'Gestor nao encontrado.';
  END IF;

  SELECT COALESCE(ARRAY_AGG(DISTINCT requested.empresa_id), ARRAY[]::UUID[])
  INTO v_company_ids
  FROM UNNEST(COALESCE(p_empresa_ids, ARRAY[]::UUID[])) AS requested(empresa_id)
  WHERE requested.empresa_id IS NOT NULL;

  v_requested_count := COALESCE(CARDINALITY(v_company_ids), 0);

  IF v_requested_count > 0 THEN
    SELECT COUNT(*)::INTEGER
    INTO v_existing_count
    FROM public.empresa
    WHERE id = ANY(v_company_ids);

    IF v_existing_count <> v_requested_count THEN
      RAISE EXCEPTION 'Uma ou mais empresas informadas nao foram encontradas.';
    END IF;

    UPDATE public.empresa_usuarios
    SET papel = 'membro',
        is_responsavel_tecnico = false,
        updated_at = now()
    WHERE empresa_id = ANY(v_company_ids)
      AND papel = 'gestor'
      AND user_id <> p_user_id;

    INSERT INTO public.empresa_usuarios (
      empresa_id,
      user_id,
      papel,
      pode_executar_checklists,
      is_responsavel_tecnico
    )
    SELECT
      selected_empresa_id,
      p_user_id,
      'gestor',
      true,
      false
    FROM UNNEST(v_company_ids) AS selected(selected_empresa_id)
    ON CONFLICT (empresa_id, user_id)
    DO UPDATE
      SET papel = 'gestor',
          pode_executar_checklists = true,
          updated_at = now();
  END IF;

  DELETE FROM public.empresa_usuarios
  WHERE user_id = p_user_id
    AND papel = 'gestor'
    AND (
      v_requested_count = 0
      OR NOT (empresa_id = ANY(v_company_ids))
    );

  RETURN QUERY
  SELECT *
  FROM public.list_gestor_empresa_vinculos() AS gestor
  WHERE gestor.user_id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.list_gestor_empresa_vinculos() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_gestor_empresas(UUID, UUID[]) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.list_gestor_empresa_vinculos() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_gestor_empresas(UUID, UUID[]) TO authenticated;
