ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS crea TEXT;

ALTER TABLE public.empresa_usuarios
  ADD COLUMN IF NOT EXISTS pode_executar_checklists BOOLEAN NOT NULL DEFAULT true;

UPDATE public.empresa_usuarios
SET pode_executar_checklists = true
WHERE papel = 'gestor'
  AND pode_executar_checklists IS DISTINCT FROM true;

ALTER TABLE public.empresa_usuarios
  ADD COLUMN IF NOT EXISTS is_responsavel_tecnico BOOLEAN NOT NULL DEFAULT false;

WITH ranked_responsaveis AS (
  SELECT
    empresa_id,
    user_id,
    ROW_NUMBER() OVER (
      PARTITION BY empresa_id
      ORDER BY
        CASE WHEN papel = 'gestor' THEN 0 ELSE 1 END,
        updated_at DESC NULLS LAST,
        created_at DESC NULLS LAST
    ) AS position_rank
  FROM public.empresa_usuarios
  WHERE COALESCE(is_responsavel_tecnico, false) = true
)
UPDATE public.empresa_usuarios AS target
SET is_responsavel_tecnico = false,
    updated_at = now()
FROM ranked_responsaveis AS ranked
WHERE target.empresa_id = ranked.empresa_id
  AND target.user_id = ranked.user_id
  AND ranked.position_rank > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_empresa_usuarios_responsavel_tecnico_unico
  ON public.empresa_usuarios (empresa_id)
  WHERE is_responsavel_tecnico = true;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, nome, cpf, cargo, crea)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'nome', ''),
    NULLIF(BTRIM(COALESCE(new.raw_user_meta_data->>'cpf', '')), ''),
    NULLIF(BTRIM(COALESCE(new.raw_user_meta_data->>'cargo', '')), ''),
    NULLIF(BTRIM(COALESCE(new.raw_user_meta_data->>'crea', '')), '')
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
  crea TEXT,
  papel TEXT,
  is_responsavel_tecnico BOOLEAN,
  pode_executar_checklists BOOLEAN,
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
    NULLIF(BTRIM(profiles.crea), '') AS crea,
    empresa_usuarios.papel,
    COALESCE(empresa_usuarios.is_responsavel_tecnico, false) AS is_responsavel_tecnico,
    CASE
      WHEN empresa_usuarios.papel = 'gestor' THEN true
      ELSE COALESCE(empresa_usuarios.pode_executar_checklists, true)
    END AS pode_executar_checklists,
    empresa_usuarios.created_at,
    empresa_usuarios.updated_at
  FROM public.empresa_usuarios
  INNER JOIN public.profiles
    ON profiles.id = empresa_usuarios.user_id
  WHERE empresa_usuarios.empresa_id = p_empresa_id
  ORDER BY
    CASE WHEN empresa_usuarios.papel = 'gestor' THEN 0 ELSE 1 END,
    CASE WHEN COALESCE(empresa_usuarios.is_responsavel_tecnico, false) THEN 0 ELSE 1 END,
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
  crea TEXT,
  papel TEXT,
  is_responsavel_tecnico BOOLEAN,
  pode_executar_checklists BOOLEAN,
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
        is_responsavel_tecnico = false,
        updated_at = now()
    WHERE empresa_id = p_empresa_id
      AND papel = 'gestor'
      AND user_id <> v_target_profile.id;
  END IF;

  INSERT INTO public.empresa_usuarios (
    empresa_id,
    user_id,
    papel,
    pode_executar_checklists,
    is_responsavel_tecnico
  )
  VALUES (
    p_empresa_id,
    v_target_profile.id,
    v_role,
    true,
    false
  )
  ON CONFLICT (empresa_id, user_id)
  DO UPDATE
    SET papel = EXCLUDED.papel,
        pode_executar_checklists = CASE
          WHEN EXCLUDED.papel = 'gestor' THEN true
          ELSE COALESCE(public.empresa_usuarios.pode_executar_checklists, true)
        END,
        updated_at = now();

  RETURN QUERY
  SELECT
    profiles.id AS user_id,
    COALESCE(NULLIF(BTRIM(profiles.nome), ''), profiles.email, 'Usuario sem nome') AS nome,
    profiles.email,
    NULLIF(BTRIM(profiles.cpf), '') AS cpf,
    NULLIF(BTRIM(profiles.cargo), '') AS cargo,
    NULLIF(BTRIM(profiles.crea), '') AS crea,
    empresa_usuarios.papel,
    COALESCE(empresa_usuarios.is_responsavel_tecnico, false) AS is_responsavel_tecnico,
    CASE
      WHEN empresa_usuarios.papel = 'gestor' THEN true
      ELSE COALESCE(empresa_usuarios.pode_executar_checklists, true)
    END AS pode_executar_checklists,
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
  crea TEXT,
  papel TEXT,
  is_responsavel_tecnico BOOLEAN,
  pode_executar_checklists BOOLEAN,
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
        is_responsavel_tecnico = false,
        updated_at = now()
    WHERE empresa_id = p_empresa_id
      AND papel = 'gestor'
      AND user_id <> p_user_id;
  END IF;

  UPDATE public.empresa_usuarios
  SET papel = v_role,
      pode_executar_checklists = CASE WHEN v_role = 'gestor' THEN true ELSE pode_executar_checklists END,
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
    NULLIF(BTRIM(profiles.crea), '') AS crea,
    empresa_usuarios.papel,
    COALESCE(empresa_usuarios.is_responsavel_tecnico, false) AS is_responsavel_tecnico,
    CASE
      WHEN empresa_usuarios.papel = 'gestor' THEN true
      ELSE COALESCE(empresa_usuarios.pode_executar_checklists, true)
    END AS pode_executar_checklists,
    empresa_usuarios.created_at,
    empresa_usuarios.updated_at
  FROM public.empresa_usuarios
  INNER JOIN public.profiles
    ON profiles.id = empresa_usuarios.user_id
  WHERE empresa_usuarios.empresa_id = p_empresa_id
    AND empresa_usuarios.user_id = p_user_id;
END;
$$;

DROP FUNCTION IF EXISTS public.set_empresa_usuario_checklist_permission(UUID, UUID, BOOLEAN);
CREATE FUNCTION public.set_empresa_usuario_checklist_permission(
  p_empresa_id UUID,
  p_user_id UUID,
  p_pode_executar_checklists BOOLEAN
)
RETURNS TABLE (
  user_id UUID,
  nome TEXT,
  email TEXT,
  cpf TEXT,
  cargo TEXT,
  crea TEXT,
  papel TEXT,
  is_responsavel_tecnico BOOLEAN,
  pode_executar_checklists BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.ensure_empresa_membership_bootstrap(p_empresa_id);

  IF NOT public.can_manage_empresa_members(p_empresa_id) THEN
    RAISE EXCEPTION 'Somente o gestor pode alterar os usuarios da empresa.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.empresa_usuarios
    WHERE empresa_id = p_empresa_id
      AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Usuario nao vinculado a esta empresa.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.empresa_usuarios
    WHERE empresa_id = p_empresa_id
      AND user_id = p_user_id
      AND papel = 'gestor'
  ) THEN
    p_pode_executar_checklists := true;
  END IF;

  UPDATE public.empresa_usuarios
  SET pode_executar_checklists = p_pode_executar_checklists,
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
    NULLIF(BTRIM(profiles.crea), '') AS crea,
    empresa_usuarios.papel,
    COALESCE(empresa_usuarios.is_responsavel_tecnico, false) AS is_responsavel_tecnico,
    CASE
      WHEN empresa_usuarios.papel = 'gestor' THEN true
      ELSE COALESCE(empresa_usuarios.pode_executar_checklists, true)
    END AS pode_executar_checklists,
    empresa_usuarios.created_at,
    empresa_usuarios.updated_at
  FROM public.empresa_usuarios
  INNER JOIN public.profiles
    ON profiles.id = empresa_usuarios.user_id
  WHERE empresa_usuarios.empresa_id = p_empresa_id
    AND empresa_usuarios.user_id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_empresa_usuario_responsavel_tecnico(
  p_empresa_id UUID,
  p_user_id UUID,
  p_is_responsavel_tecnico BOOLEAN DEFAULT true
)
RETURNS TABLE (
  user_id UUID,
  nome TEXT,
  email TEXT,
  cpf TEXT,
  cargo TEXT,
  crea TEXT,
  papel TEXT,
  is_responsavel_tecnico BOOLEAN,
  pode_executar_checklists BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.ensure_empresa_membership_bootstrap(p_empresa_id);

  IF NOT public.can_manage_empresa_members(p_empresa_id) THEN
    RAISE EXCEPTION 'Somente o gestor pode alterar os usuarios da empresa.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.empresa_usuarios
    WHERE empresa_id = p_empresa_id
      AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Usuario nao vinculado a esta empresa.';
  END IF;

  IF p_is_responsavel_tecnico THEN
    UPDATE public.empresa_usuarios
    SET is_responsavel_tecnico = false,
        updated_at = now()
    WHERE empresa_id = p_empresa_id;
  END IF;

  UPDATE public.empresa_usuarios
  SET is_responsavel_tecnico = p_is_responsavel_tecnico,
      pode_executar_checklists = true,
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
    NULLIF(BTRIM(profiles.crea), '') AS crea,
    empresa_usuarios.papel,
    COALESCE(empresa_usuarios.is_responsavel_tecnico, false) AS is_responsavel_tecnico,
    CASE
      WHEN empresa_usuarios.papel = 'gestor' THEN true
      ELSE COALESCE(empresa_usuarios.pode_executar_checklists, true)
    END AS pode_executar_checklists,
    empresa_usuarios.created_at,
    empresa_usuarios.updated_at
  FROM public.empresa_usuarios
  INNER JOIN public.profiles
    ON profiles.id = empresa_usuarios.user_id
  WHERE empresa_usuarios.empresa_id = p_empresa_id
    AND empresa_usuarios.user_id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.list_empresa_usuarios(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.add_empresa_usuario_by_email(UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_empresa_usuario_role(UUID, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_empresa_usuario_checklist_permission(UUID, UUID, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_empresa_usuario_responsavel_tecnico(UUID, UUID, BOOLEAN) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.list_empresa_usuarios(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_empresa_usuario_by_email(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_empresa_usuario_role(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_empresa_usuario_checklist_permission(UUID, UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_empresa_usuario_responsavel_tecnico(UUID, UUID, BOOLEAN) TO authenticated;
