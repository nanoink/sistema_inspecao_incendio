ALTER TABLE public.empresa_usuarios
  ADD COLUMN IF NOT EXISTS pode_executar_checklists BOOLEAN NOT NULL DEFAULT true;

UPDATE public.empresa_usuarios
SET pode_executar_checklists = true
WHERE papel = 'gestor'
  AND pode_executar_checklists IS DISTINCT FROM true;

CREATE OR REPLACE FUNCTION public.can_execute_empresa_checklists(p_empresa_id UUID)
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

  IF NOT public.has_empresa_members(p_empresa_id) THEN
    RETURN TRUE;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.empresa_usuarios
    WHERE empresa_id = p_empresa_id
      AND user_id = auth.uid()
      AND (
        papel = 'gestor'
        OR COALESCE(pode_executar_checklists, true)
      )
  );
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
    empresa_usuarios.papel,
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
        updated_at = now()
    WHERE empresa_id = p_empresa_id
      AND papel = 'gestor'
      AND user_id <> v_target_profile.id;
  END IF;

  INSERT INTO public.empresa_usuarios (
    empresa_id,
    user_id,
    papel,
    pode_executar_checklists
  )
  VALUES (
    p_empresa_id,
    v_target_profile.id,
    v_role,
    true
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
    empresa_usuarios.papel,
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
  papel TEXT,
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
        updated_at = now()
    WHERE empresa_id = p_empresa_id
      AND papel = 'gestor'
      AND user_id <> p_user_id;
  END IF;

  UPDATE public.empresa_usuarios
  SET papel = v_role,
      pode_executar_checklists = CASE
        WHEN v_role = 'gestor' THEN true
        ELSE COALESCE(pode_executar_checklists, true)
      END,
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
  papel TEXT,
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
    RAISE EXCEPTION 'Somente o gestor pode alterar a permissao de checklist dos usuarios da empresa.';
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
      AND COALESCE(p_pode_executar_checklists, false) = false
  ) THEN
    RAISE EXCEPTION 'O gestor da empresa deve permanecer liberado para executar checklists.';
  END IF;

  UPDATE public.empresa_usuarios
  SET pode_executar_checklists = COALESCE(p_pode_executar_checklists, true),
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

DROP POLICY IF EXISTS "Authenticated company members can insert company checklist responses" ON public.empresa_checklist_respostas;
DROP POLICY IF EXISTS "Authenticated company members can update company checklist responses" ON public.empresa_checklist_respostas;
DROP POLICY IF EXISTS "Authenticated company members can delete company checklist responses" ON public.empresa_checklist_respostas;

CREATE POLICY "Authenticated company members can insert company checklist responses"
  ON public.empresa_checklist_respostas
  FOR INSERT
  TO authenticated
  WITH CHECK (public.can_execute_empresa_checklists(empresa_id));

CREATE POLICY "Authenticated company members can update company checklist responses"
  ON public.empresa_checklist_respostas
  FOR UPDATE
  TO authenticated
  USING (public.can_execute_empresa_checklists(empresa_id))
  WITH CHECK (public.can_execute_empresa_checklists(empresa_id));

CREATE POLICY "Authenticated company members can delete company checklist responses"
  ON public.empresa_checklist_respostas
  FOR DELETE
  TO authenticated
  USING (public.can_execute_empresa_checklists(empresa_id));

DROP POLICY IF EXISTS "Authenticated company members can insert checklist non conformities" ON public.empresa_checklist_nao_conformidades;
DROP POLICY IF EXISTS "Authenticated company members can update checklist non conformities" ON public.empresa_checklist_nao_conformidades;
DROP POLICY IF EXISTS "Authenticated company members can delete checklist non conformities" ON public.empresa_checklist_nao_conformidades;

CREATE POLICY "Authenticated company members can insert checklist non conformities"
  ON public.empresa_checklist_nao_conformidades
  FOR INSERT
  TO authenticated
  WITH CHECK (public.can_execute_empresa_checklists(empresa_id));

CREATE POLICY "Authenticated company members can update checklist non conformities"
  ON public.empresa_checklist_nao_conformidades
  FOR UPDATE
  TO authenticated
  USING (public.can_execute_empresa_checklists(empresa_id))
  WITH CHECK (public.can_execute_empresa_checklists(empresa_id));

CREATE POLICY "Authenticated company members can delete checklist non conformities"
  ON public.empresa_checklist_nao_conformidades
  FOR DELETE
  TO authenticated
  USING (public.can_execute_empresa_checklists(empresa_id));

CREATE OR REPLACE FUNCTION public.register_checklist_execution(
  p_empresa_id UUID,
  p_inspection_code TEXT,
  p_inspection_name TEXT,
  p_context_type TEXT,
  p_equipment_type TEXT DEFAULT NULL,
  p_equipment_record_id UUID DEFAULT NULL,
  p_source_label TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  empresa_id UUID,
  user_id UUID,
  inspection_code TEXT,
  inspection_name TEXT,
  context_type TEXT,
  equipment_type TEXT,
  equipment_record_id UUID,
  source_label TEXT,
  context_key TEXT,
  first_activity_at TIMESTAMP WITH TIME ZONE,
  last_activity_at TIMESTAMP WITH TIME ZONE,
  total_saves INTEGER,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_context_type TEXT := LOWER(BTRIM(COALESCE(p_context_type, '')));
  v_equipment_type TEXT := LOWER(BTRIM(COALESCE(p_equipment_type, '')));
  v_context_key TEXT;
BEGIN
  IF auth.role() <> 'authenticated' OR auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuario autenticado nao encontrado.';
  END IF;

  PERFORM public.ensure_empresa_membership_bootstrap(p_empresa_id);

  IF NOT public.can_access_empresa(p_empresa_id) THEN
    RAISE EXCEPTION 'Acesso negado para a empresa informada.';
  END IF;

  IF NOT public.can_execute_empresa_checklists(p_empresa_id) THEN
    RAISE EXCEPTION 'Seu usuario nao esta liberado para executar checklists desta empresa.';
  END IF;

  IF v_context_type NOT IN ('principal', 'equipamento') THEN
    RAISE EXCEPTION 'Tipo de contexto invalido. Use principal ou equipamento.';
  END IF;

  IF v_context_type = 'equipamento' AND (v_equipment_type = '' OR p_equipment_record_id IS NULL) THEN
    RAISE EXCEPTION 'Checklist de equipamento exige tipo e registro do equipamento.';
  END IF;

  IF v_context_type = 'principal' THEN
    v_equipment_type := NULL;
    p_equipment_record_id := NULL;
    v_context_key :=
      p_empresa_id::TEXT
      || ':'
      || auth.uid()::TEXT
      || ':'
      || COALESCE(NULLIF(BTRIM(p_inspection_code), ''), 'sem-codigo')
      || ':principal';
  ELSE
    v_context_key :=
      p_empresa_id::TEXT
      || ':'
      || auth.uid()::TEXT
      || ':'
      || COALESCE(NULLIF(BTRIM(p_inspection_code), ''), 'sem-codigo')
      || ':equipamento:'
      || COALESCE(v_equipment_type, 'sem-tipo')
      || ':'
      || p_equipment_record_id::TEXT;
  END IF;

  RETURN QUERY
  INSERT INTO public.empresa_checklist_execucoes (
    empresa_id,
    user_id,
    inspection_code,
    inspection_name,
    context_type,
    equipment_type,
    equipment_record_id,
    source_label,
    context_key
  )
  VALUES (
    p_empresa_id,
    auth.uid(),
    COALESCE(NULLIF(BTRIM(p_inspection_code), ''), 'Sem codigo'),
    COALESCE(NULLIF(BTRIM(p_inspection_name), ''), 'Checklist sem nome'),
    v_context_type,
    v_equipment_type,
    p_equipment_record_id,
    NULLIF(BTRIM(COALESCE(p_source_label, '')), ''),
    v_context_key
  )
  ON CONFLICT (context_key)
  DO UPDATE
    SET inspection_code = EXCLUDED.inspection_code,
        inspection_name = EXCLUDED.inspection_name,
        context_type = EXCLUDED.context_type,
        equipment_type = EXCLUDED.equipment_type,
        equipment_record_id = EXCLUDED.equipment_record_id,
        source_label = EXCLUDED.source_label,
        last_activity_at = now(),
        total_saves = public.empresa_checklist_execucoes.total_saves + 1,
        updated_at = now()
  RETURNING
    empresa_checklist_execucoes.id,
    empresa_checklist_execucoes.empresa_id,
    empresa_checklist_execucoes.user_id,
    empresa_checklist_execucoes.inspection_code,
    empresa_checklist_execucoes.inspection_name,
    empresa_checklist_execucoes.context_type,
    empresa_checklist_execucoes.equipment_type,
    empresa_checklist_execucoes.equipment_record_id,
    empresa_checklist_execucoes.source_label,
    empresa_checklist_execucoes.context_key,
    empresa_checklist_execucoes.first_activity_at,
    empresa_checklist_execucoes.last_activity_at,
    empresa_checklist_execucoes.total_saves,
    empresa_checklist_execucoes.created_at,
    empresa_checklist_execucoes.updated_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_equipment_qr_checklist(
  p_token UUID,
  p_checklist_snapshot JSONB
)
RETURNS TABLE (
  equipment_type TEXT,
  equipment_id UUID,
  empresa_id UUID,
  checklist_snapshot JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_equipment_type TEXT;
  v_equipment_id UUID;
  v_empresa_id UUID;
  v_inspection_code TEXT;
  v_snapshot JSONB := COALESCE(p_checklist_snapshot, '{}'::jsonb);
BEGIN
  SELECT 'extintor', item.id, item.empresa_id
  INTO v_equipment_type, v_equipment_id, v_empresa_id
  FROM public.empresa_extintores AS item
  WHERE item.public_token = p_token;

  IF NOT FOUND THEN
    SELECT 'hidrante', item.id, item.empresa_id
    INTO v_equipment_type, v_equipment_id, v_empresa_id
    FROM public.empresa_hidrantes AS item
    WHERE item.public_token = p_token;
  END IF;

  IF NOT FOUND THEN
    SELECT 'luminaria', item.id, item.empresa_id
    INTO v_equipment_type, v_equipment_id, v_empresa_id
    FROM public.empresa_luminarias AS item
    WHERE item.public_token = p_token;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Equipamento nao encontrado para o token informado.';
  END IF;

  PERFORM public.ensure_empresa_membership_bootstrap(v_empresa_id);

  IF NOT public.can_access_empresa(v_empresa_id) THEN
    RAISE EXCEPTION 'Acesso negado para a empresa informada.';
  END IF;

  IF NOT public.can_execute_empresa_checklists(v_empresa_id) THEN
    RAISE EXCEPTION 'Seu usuario nao esta liberado para executar checklists desta empresa.';
  END IF;

  IF v_equipment_type = 'extintor' THEN
    v_inspection_code := 'A.23';
    UPDATE public.empresa_extintores
    SET checklist_snapshot = v_snapshot
    WHERE id = v_equipment_id;
  ELSIF v_equipment_type = 'hidrante' THEN
    v_inspection_code := 'A.25';
    UPDATE public.empresa_hidrantes
    SET checklist_snapshot = v_snapshot
    WHERE id = v_equipment_id;
  ELSE
    v_inspection_code := 'A.19';
    UPDATE public.empresa_luminarias
    SET checklist_snapshot = v_snapshot
    WHERE id = v_equipment_id;
  END IF;

  DELETE FROM public.empresa_checklist_respostas AS resposta
  WHERE resposta.empresa_id = v_empresa_id
    AND resposta.checklist_item_id IN (
      SELECT item.id
      FROM public.checklist_itens_modelo AS item
      INNER JOIN public.checklist_grupos AS grupo
        ON grupo.id = item.grupo_id
      INNER JOIN public.checklist_modelos AS modelo
        ON modelo.id = grupo.modelo_id
      WHERE modelo.codigo = v_inspection_code
        AND item.avaliavel = true
    );

  IF v_equipment_type = 'extintor' THEN
    INSERT INTO public.empresa_checklist_respostas (empresa_id, checklist_item_id, status, observacoes)
    SELECT
      v_empresa_id,
      aggregated.checklist_item_id::UUID,
      aggregated.status,
      aggregated.observacoes
    FROM (
      SELECT
        item->>'checklist_item_id' AS checklist_item_id,
        CASE
          WHEN bool_or(item->>'status' = 'NC') THEN 'NC'
          WHEN count(*) > 0 AND bool_and(item->>'status' = 'NA') THEN 'NA'
          WHEN bool_or(item->>'status' = 'C') THEN 'C'
          ELSE NULL
        END AS status,
        CASE
          WHEN bool_or(item->>'status' = 'NC')
            THEN 'Nao conformidade identificada em ao menos um extintor.'
          ELSE NULL
        END AS observacoes
      FROM public.empresa_extintores AS equipamento
      CROSS JOIN LATERAL jsonb_array_elements(COALESCE(equipamento.checklist_snapshot->'items', '[]'::jsonb)) AS item
      WHERE equipamento.empresa_id = v_empresa_id
      GROUP BY item->>'checklist_item_id'
    ) AS aggregated
    WHERE aggregated.checklist_item_id IS NOT NULL
      AND aggregated.checklist_item_id <> ''
      AND aggregated.status IS NOT NULL
    ON CONFLICT ON CONSTRAINT empresa_checklist_respostas_empresa_id_checklist_item_id_key
    DO UPDATE
      SET status = EXCLUDED.status,
          observacoes = EXCLUDED.observacoes,
          updated_at = now();
  ELSIF v_equipment_type = 'hidrante' THEN
    INSERT INTO public.empresa_checklist_respostas (empresa_id, checklist_item_id, status, observacoes)
    SELECT
      v_empresa_id,
      aggregated.checklist_item_id::UUID,
      aggregated.status,
      aggregated.observacoes
    FROM (
      SELECT
        item->>'checklist_item_id' AS checklist_item_id,
        CASE
          WHEN bool_or(item->>'status' = 'NC') THEN 'NC'
          WHEN count(*) > 0 AND bool_and(item->>'status' = 'NA') THEN 'NA'
          WHEN bool_or(item->>'status' = 'C') THEN 'C'
          ELSE NULL
        END AS status,
        CASE
          WHEN bool_or(item->>'status' = 'NC')
            THEN 'Nao conformidade identificada em ao menos um hidrante.'
          ELSE NULL
        END AS observacoes
      FROM public.empresa_hidrantes AS equipamento
      CROSS JOIN LATERAL jsonb_array_elements(COALESCE(equipamento.checklist_snapshot->'items', '[]'::jsonb)) AS item
      WHERE equipamento.empresa_id = v_empresa_id
      GROUP BY item->>'checklist_item_id'
    ) AS aggregated
    WHERE aggregated.checklist_item_id IS NOT NULL
      AND aggregated.checklist_item_id <> ''
      AND aggregated.status IS NOT NULL
    ON CONFLICT ON CONSTRAINT empresa_checklist_respostas_empresa_id_checklist_item_id_key
    DO UPDATE
      SET status = EXCLUDED.status,
          observacoes = EXCLUDED.observacoes,
          updated_at = now();
  ELSE
    INSERT INTO public.empresa_checklist_respostas (empresa_id, checklist_item_id, status, observacoes)
    SELECT
      v_empresa_id,
      aggregated.checklist_item_id::UUID,
      aggregated.status,
      aggregated.observacoes
    FROM (
      SELECT
        item->>'checklist_item_id' AS checklist_item_id,
        CASE
          WHEN bool_or(item->>'status' = 'NC') THEN 'NC'
          WHEN count(*) > 0 AND bool_and(item->>'status' = 'NA') THEN 'NA'
          WHEN bool_or(item->>'status' = 'C') THEN 'C'
          ELSE NULL
        END AS status,
        CASE
          WHEN bool_or(item->>'status' = 'NC')
            THEN 'Nao conformidade identificada em ao menos uma luminaria.'
          ELSE NULL
        END AS observacoes
      FROM public.empresa_luminarias AS equipamento
      CROSS JOIN LATERAL jsonb_array_elements(COALESCE(equipamento.checklist_snapshot->'items', '[]'::jsonb)) AS item
      WHERE equipamento.empresa_id = v_empresa_id
      GROUP BY item->>'checklist_item_id'
    ) AS aggregated
    WHERE aggregated.checklist_item_id IS NOT NULL
      AND aggregated.checklist_item_id <> ''
      AND aggregated.status IS NOT NULL
    ON CONFLICT ON CONSTRAINT empresa_checklist_respostas_empresa_id_checklist_item_id_key
    DO UPDATE
      SET status = EXCLUDED.status,
          observacoes = EXCLUDED.observacoes,
          updated_at = now();
  END IF;

  RETURN QUERY
  SELECT v_equipment_type, v_equipment_id, v_empresa_id, v_snapshot;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_equipment_qr_non_conformity(
  p_token UUID,
  p_checklist_item_id UUID,
  p_descricao TEXT,
  p_imagem_data_url TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  context_key TEXT,
  empresa_id UUID,
  checklist_item_id UUID,
  equipment_type TEXT,
  equipment_record_id UUID,
  descricao TEXT,
  imagem_data_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_equipment_type TEXT;
  v_empresa_id UUID;
  v_equipment_record_id UUID;
  v_context_key TEXT;
BEGIN
  SELECT 'extintor', item.empresa_id, item.id
  INTO v_equipment_type, v_empresa_id, v_equipment_record_id
  FROM public.empresa_extintores AS item
  WHERE item.public_token = p_token;

  IF NOT FOUND THEN
    SELECT 'hidrante', item.empresa_id, item.id
    INTO v_equipment_type, v_empresa_id, v_equipment_record_id
    FROM public.empresa_hidrantes AS item
    WHERE item.public_token = p_token;
  END IF;

  IF NOT FOUND THEN
    SELECT 'luminaria', item.empresa_id, item.id
    INTO v_equipment_type, v_empresa_id, v_equipment_record_id
    FROM public.empresa_luminarias AS item
    WHERE item.public_token = p_token;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Equipamento nao encontrado para o token informado.';
  END IF;

  PERFORM public.ensure_empresa_membership_bootstrap(v_empresa_id);

  IF NOT public.can_access_empresa(v_empresa_id) THEN
    RAISE EXCEPTION 'Acesso negado para a empresa informada.';
  END IF;

  IF NOT public.can_execute_empresa_checklists(v_empresa_id) THEN
    RAISE EXCEPTION 'Seu usuario nao esta liberado para executar checklists desta empresa.';
  END IF;

  v_context_key :=
    v_empresa_id::TEXT
    || ':'
    || v_equipment_type
    || ':'
    || v_equipment_record_id::TEXT
    || ':'
    || p_checklist_item_id::TEXT;

  RETURN QUERY
  INSERT INTO public.empresa_checklist_nao_conformidades (
    context_key,
    empresa_id,
    checklist_item_id,
    equipment_type,
    equipment_record_id,
    descricao,
    imagem_data_url
  )
  VALUES (
    v_context_key,
    v_empresa_id,
    p_checklist_item_id,
    v_equipment_type,
    v_equipment_record_id,
    COALESCE(NULLIF(BTRIM(p_descricao), ''), ''),
    NULLIF(BTRIM(COALESCE(p_imagem_data_url, '')), '')
  )
  ON CONFLICT (context_key)
  DO UPDATE
    SET descricao = EXCLUDED.descricao,
        imagem_data_url = EXCLUDED.imagem_data_url,
        updated_at = now()
  RETURNING
    empresa_checklist_nao_conformidades.id,
    empresa_checklist_nao_conformidades.context_key,
    empresa_checklist_nao_conformidades.empresa_id,
    empresa_checklist_nao_conformidades.checklist_item_id,
    empresa_checklist_nao_conformidades.equipment_type,
    empresa_checklist_nao_conformidades.equipment_record_id,
    empresa_checklist_nao_conformidades.descricao,
    empresa_checklist_nao_conformidades.imagem_data_url,
    empresa_checklist_nao_conformidades.created_at,
    empresa_checklist_nao_conformidades.updated_at;
END;
$$;

REVOKE ALL ON FUNCTION public.list_empresa_usuarios(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.add_empresa_usuario_by_email(UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_empresa_usuario_role(UUID, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_empresa_usuario_checklist_permission(UUID, UUID, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.register_checklist_execution(UUID, TEXT, TEXT, TEXT, TEXT, UUID, TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.list_empresa_usuarios(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_empresa_usuario_by_email(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_empresa_usuario_role(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_empresa_usuario_checklist_permission(UUID, UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_checklist_execution(UUID, TEXT, TEXT, TEXT, TEXT, UUID, TEXT) TO authenticated;
