ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cpf TEXT,
  ADD COLUMN IF NOT EXISTS cargo TEXT;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, nome, cpf, cargo)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'nome', ''),
    NULLIF(BTRIM(COALESCE(new.raw_user_meta_data->>'cpf', '')), ''),
    NULLIF(BTRIM(COALESCE(new.raw_user_meta_data->>'cargo', '')), '')
  );
  RETURN new;
END;
$$;

DROP FUNCTION IF EXISTS public.list_empresa_usuarios(UUID);
CREATE FUNCTION public.list_empresa_usuarios(p_empresa_id UUID)
RETURNS TABLE (
  user_id UUID,
  nome TEXT,
  email TEXT,
  cpf TEXT,
  cargo TEXT,
  papel TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.ensure_empresa_membership_bootstrap(p_empresa_id);

  IF NOT public.can_access_empresa(p_empresa_id) THEN
    RAISE EXCEPTION 'Acesso negado para a empresa informada.';
  END IF;

  RETURN QUERY
  SELECT
    profiles.id AS user_id,
    COALESCE(NULLIF(BTRIM(profiles.nome), ''), profiles.email, 'Usuario sem nome') AS nome,
    profiles.email,
    NULLIF(BTRIM(profiles.cpf), '') AS cpf,
    NULLIF(BTRIM(profiles.cargo), '') AS cargo,
    empresa_usuarios.papel,
    empresa_usuarios.created_at,
    empresa_usuarios.updated_at
  FROM public.empresa_usuarios
  INNER JOIN public.profiles
    ON profiles.id = empresa_usuarios.user_id
  WHERE empresa_usuarios.empresa_id = p_empresa_id
  ORDER BY
    CASE WHEN empresa_usuarios.papel = 'gestor' THEN 0 ELSE 1 END,
    COALESCE(NULLIF(BTRIM(profiles.nome), ''), profiles.email, 'Usuario sem nome');
END;
$$;

DROP FUNCTION IF EXISTS public.add_empresa_usuario_by_email(UUID, TEXT, TEXT);
CREATE FUNCTION public.add_empresa_usuario_by_email(
  p_empresa_id UUID,
  p_email TEXT,
  p_papel TEXT DEFAULT 'membro'
)
RETURNS TABLE (
  user_id UUID,
  nome TEXT,
  email TEXT,
  cpf TEXT,
  cargo TEXT,
  papel TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target_profile public.profiles%ROWTYPE;
  v_normalized_email TEXT := LOWER(BTRIM(COALESCE(p_email, '')));
  v_role TEXT := LOWER(BTRIM(COALESCE(p_papel, 'membro')));
BEGIN
  PERFORM public.ensure_empresa_membership_bootstrap(p_empresa_id);

  IF NOT public.can_manage_empresa_members(p_empresa_id) THEN
    RAISE EXCEPTION 'Somente o gestor pode alterar os usuarios da empresa.';
  END IF;

  IF v_normalized_email = '' THEN
    RAISE EXCEPTION 'Informe um e-mail valido para vincular o usuario.';
  END IF;

  IF v_role NOT IN ('gestor', 'membro') THEN
    RAISE EXCEPTION 'Papel invalido. Use gestor ou membro.';
  END IF;

  SELECT *
  INTO v_target_profile
  FROM public.profiles
  WHERE LOWER(BTRIM(COALESCE(email, ''))) = v_normalized_email
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nenhum usuario cadastrado foi encontrado com o e-mail informado.';
  END IF;

  IF v_role = 'gestor' THEN
    UPDATE public.empresa_usuarios
    SET papel = 'membro',
        updated_at = now()
    WHERE empresa_id = p_empresa_id
      AND papel = 'gestor'
      AND user_id <> v_target_profile.id;
  END IF;

  INSERT INTO public.empresa_usuarios (
    empresa_id,
    user_id,
    papel
  )
  VALUES (
    p_empresa_id,
    v_target_profile.id,
    v_role
  )
  ON CONFLICT (empresa_id, user_id)
  DO UPDATE
    SET papel = EXCLUDED.papel,
        updated_at = now();

  RETURN QUERY
  SELECT
    profiles.id AS user_id,
    COALESCE(NULLIF(BTRIM(profiles.nome), ''), profiles.email, 'Usuario sem nome') AS nome,
    profiles.email,
    NULLIF(BTRIM(profiles.cpf), '') AS cpf,
    NULLIF(BTRIM(profiles.cargo), '') AS cargo,
    empresa_usuarios.papel,
    empresa_usuarios.created_at,
    empresa_usuarios.updated_at
  FROM public.empresa_usuarios
  INNER JOIN public.profiles
    ON profiles.id = empresa_usuarios.user_id
  WHERE empresa_usuarios.empresa_id = p_empresa_id
    AND empresa_usuarios.user_id = v_target_profile.id;
END;
$$;

DROP FUNCTION IF EXISTS public.set_empresa_usuario_role(UUID, UUID, TEXT);
CREATE FUNCTION public.set_empresa_usuario_role(
  p_empresa_id UUID,
  p_user_id UUID,
  p_papel TEXT
)
RETURNS TABLE (
  user_id UUID,
  nome TEXT,
  email TEXT,
  cpf TEXT,
  cargo TEXT,
  papel TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT := LOWER(BTRIM(COALESCE(p_papel, 'membro')));
BEGIN
  PERFORM public.ensure_empresa_membership_bootstrap(p_empresa_id);

  IF NOT public.can_manage_empresa_members(p_empresa_id) THEN
    RAISE EXCEPTION 'Somente o gestor pode alterar os usuarios da empresa.';
  END IF;

  IF v_role NOT IN ('gestor', 'membro') THEN
    RAISE EXCEPTION 'Papel invalido. Use gestor ou membro.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.empresa_usuarios
    WHERE empresa_id = p_empresa_id
      AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Usuario nao vinculado a esta empresa.';
  END IF;

  IF v_role = 'membro' AND EXISTS (
    SELECT 1
    FROM public.empresa_usuarios
    WHERE empresa_id = p_empresa_id
      AND user_id = p_user_id
      AND papel = 'gestor'
  ) THEN
    RAISE EXCEPTION 'Nao e permitido remover o papel de gestor sem promover outro usuario antes.';
  END IF;

  IF v_role = 'gestor' THEN
    UPDATE public.empresa_usuarios
    SET papel = 'membro',
        updated_at = now()
    WHERE empresa_id = p_empresa_id
      AND papel = 'gestor'
      AND user_id <> p_user_id;
  END IF;

  UPDATE public.empresa_usuarios
  SET papel = v_role,
      updated_at = now()
  WHERE empresa_id = p_empresa_id
    AND user_id = p_user_id;

  RETURN QUERY
  SELECT
    profiles.id AS user_id,
    COALESCE(NULLIF(BTRIM(profiles.nome), ''), profiles.email, 'Usuario sem nome') AS nome,
    profiles.email,
    NULLIF(BTRIM(profiles.cpf), '') AS cpf,
    NULLIF(BTRIM(profiles.cargo), '') AS cargo,
    empresa_usuarios.papel,
    empresa_usuarios.created_at,
    empresa_usuarios.updated_at
  FROM public.empresa_usuarios
  INNER JOIN public.profiles
    ON profiles.id = empresa_usuarios.user_id
  WHERE empresa_usuarios.empresa_id = p_empresa_id
    AND empresa_usuarios.user_id = p_user_id;
END;
$$;

DROP FUNCTION IF EXISTS public.get_empresa_relatorio_assinaturas(UUID);
CREATE FUNCTION public.get_empresa_relatorio_assinaturas(p_empresa_id UUID)
RETURNS TABLE (
  user_id UUID,
  nome TEXT,
  email TEXT,
  cpf TEXT,
  cargo TEXT,
  papel TEXT,
  is_gestor BOOLEAN,
  assinatura_nome TEXT,
  executed_checklists JSONB,
  first_activity_at TIMESTAMP WITH TIME ZONE,
  last_activity_at TIMESTAMP WITH TIME ZONE,
  total_checklists INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.ensure_empresa_membership_bootstrap(p_empresa_id);

  IF NOT public.can_access_empresa(p_empresa_id) THEN
    RAISE EXCEPTION 'Acesso negado para a empresa informada.';
  END IF;

  RETURN QUERY
  WITH empresa_base AS (
    SELECT id, responsavel
    FROM public.empresa
    WHERE id = p_empresa_id
  ),
  membros AS (
    SELECT
      empresa_usuarios.user_id,
      COALESCE(NULLIF(BTRIM(profiles.nome), ''), profiles.email, 'Usuario sem nome') AS nome,
      profiles.email,
      NULLIF(BTRIM(profiles.cpf), '') AS cpf,
      NULLIF(BTRIM(profiles.cargo), '') AS cargo,
      empresa_usuarios.papel
    FROM public.empresa_usuarios
    INNER JOIN public.profiles
      ON profiles.id = empresa_usuarios.user_id
    WHERE empresa_usuarios.empresa_id = p_empresa_id
  ),
  execucoes AS (
    SELECT
      empresa_checklist_execucoes.user_id,
      jsonb_agg(
        jsonb_build_object(
          'inspection_code', empresa_checklist_execucoes.inspection_code,
          'inspection_name', empresa_checklist_execucoes.inspection_name,
          'context_type', empresa_checklist_execucoes.context_type,
          'equipment_type', empresa_checklist_execucoes.equipment_type,
          'equipment_record_id', empresa_checklist_execucoes.equipment_record_id,
          'source_label', empresa_checklist_execucoes.source_label,
          'first_activity_at', empresa_checklist_execucoes.first_activity_at,
          'last_activity_at', empresa_checklist_execucoes.last_activity_at,
          'total_saves', empresa_checklist_execucoes.total_saves
        )
        ORDER BY
          empresa_checklist_execucoes.inspection_code,
          empresa_checklist_execucoes.context_type,
          COALESCE(empresa_checklist_execucoes.source_label, '')
      ) AS executed_checklists,
      MIN(empresa_checklist_execucoes.first_activity_at) AS first_activity_at,
      MAX(empresa_checklist_execucoes.last_activity_at) AS last_activity_at,
      COUNT(*)::INTEGER AS total_checklists
    FROM public.empresa_checklist_execucoes
    WHERE empresa_checklist_execucoes.empresa_id = p_empresa_id
    GROUP BY empresa_checklist_execucoes.user_id
  )
  SELECT
    membros.user_id,
    membros.nome,
    membros.email,
    membros.cpf,
    membros.cargo,
    membros.papel,
    (membros.papel = 'gestor') AS is_gestor,
    CASE
      WHEN membros.papel = 'gestor'
        THEN COALESCE(NULLIF(BTRIM(empresa_base.responsavel), ''), membros.nome)
      ELSE membros.nome
    END AS assinatura_nome,
    COALESCE(execucoes.executed_checklists, '[]'::JSONB) AS executed_checklists,
    execucoes.first_activity_at,
    execucoes.last_activity_at,
    COALESCE(execucoes.total_checklists, 0) AS total_checklists
  FROM membros
  CROSS JOIN empresa_base
  LEFT JOIN execucoes
    ON execucoes.user_id = membros.user_id
  WHERE membros.papel = 'gestor'
     OR execucoes.user_id IS NOT NULL
  ORDER BY
    CASE WHEN membros.papel = 'gestor' THEN 0 ELSE 1 END,
    membros.nome;
END;
$$;

REVOKE ALL ON FUNCTION public.list_empresa_usuarios(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.add_empresa_usuario_by_email(UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_empresa_usuario_role(UUID, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_empresa_relatorio_assinaturas(UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.list_empresa_usuarios(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_empresa_usuario_by_email(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_empresa_usuario_role(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_empresa_relatorio_assinaturas(UUID) TO authenticated;
