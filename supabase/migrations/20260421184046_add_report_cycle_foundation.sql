CREATE TABLE IF NOT EXISTS public.empresa_relatorio_ciclos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresa(id) ON DELETE CASCADE,
  nome TEXT NOT NULL DEFAULT 'Ciclo ativo',
  status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'fechado', 'cancelado')),
  data_abertura TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  data_fechamento TIMESTAMP WITH TIME ZONE,
  criado_por UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_empresa_relatorio_ciclos_empresa_status
  ON public.empresa_relatorio_ciclos (empresa_id, status, data_abertura DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_empresa_relatorio_ciclos_ativo_unico
  ON public.empresa_relatorio_ciclos (empresa_id)
  WHERE status = 'ativo';

ALTER TABLE public.empresa_relatorio_ciclos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated company members can view report cycles" ON public.empresa_relatorio_ciclos;
CREATE POLICY "Authenticated company members can view report cycles"
  ON public.empresa_relatorio_ciclos
  FOR SELECT
  TO authenticated
  USING (public.can_access_empresa(empresa_id));

DROP POLICY IF EXISTS "Authenticated gestores can insert report cycles" ON public.empresa_relatorio_ciclos;
CREATE POLICY "Authenticated gestores can insert report cycles"
  ON public.empresa_relatorio_ciclos
  FOR INSERT
  TO authenticated
  WITH CHECK (public.can_manage_empresa_members(empresa_id));

DROP POLICY IF EXISTS "Authenticated gestores can update report cycles" ON public.empresa_relatorio_ciclos;
CREATE POLICY "Authenticated gestores can update report cycles"
  ON public.empresa_relatorio_ciclos
  FOR UPDATE
  TO authenticated
  USING (public.can_manage_empresa_members(empresa_id));

DROP POLICY IF EXISTS "Authenticated gestores can delete report cycles" ON public.empresa_relatorio_ciclos;
CREATE POLICY "Authenticated gestores can delete report cycles"
  ON public.empresa_relatorio_ciclos
  FOR DELETE
  TO authenticated
  USING (public.can_manage_empresa_members(empresa_id));

DROP TRIGGER IF EXISTS update_empresa_relatorio_ciclos_updated_at ON public.empresa_relatorio_ciclos;
CREATE TRIGGER update_empresa_relatorio_ciclos_updated_at
BEFORE UPDATE ON public.empresa_relatorio_ciclos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.empresa_checklist_execucoes
  ADD COLUMN IF NOT EXISTS relatorio_ciclo_id UUID REFERENCES public.empresa_relatorio_ciclos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_empresa_checklist_execucoes_relatorio_ciclo
  ON public.empresa_checklist_execucoes (relatorio_ciclo_id);

CREATE INDEX IF NOT EXISTS idx_empresa_checklist_execucoes_empresa_ciclo_usuario
  ON public.empresa_checklist_execucoes (empresa_id, relatorio_ciclo_id, user_id);

CREATE OR REPLACE FUNCTION public.build_checklist_execution_context_key(
  p_empresa_id UUID,
  p_relatorio_ciclo_id UUID,
  p_user_id UUID,
  p_inspection_code TEXT,
  p_context_type TEXT,
  p_equipment_type TEXT DEFAULT NULL,
  p_equipment_record_id UUID DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_context_type TEXT := LOWER(BTRIM(COALESCE(p_context_type, '')));
  v_equipment_type TEXT := LOWER(BTRIM(COALESCE(p_equipment_type, '')));
BEGIN
  IF p_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Empresa nao informada.';
  END IF;

  IF p_relatorio_ciclo_id IS NULL THEN
    RAISE EXCEPTION 'Ciclo de relatorio nao informado.';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario nao informado.';
  END IF;

  IF v_context_type NOT IN ('principal', 'equipamento') THEN
    RAISE EXCEPTION 'Tipo de contexto invalido. Use principal ou equipamento.';
  END IF;

  IF v_context_type = 'equipamento' AND (v_equipment_type = '' OR p_equipment_record_id IS NULL) THEN
    RAISE EXCEPTION 'Checklist de equipamento exige tipo e registro do equipamento.';
  END IF;

  IF v_context_type = 'principal' THEN
    RETURN
      p_empresa_id::TEXT
      || ':'
      || p_relatorio_ciclo_id::TEXT
      || ':'
      || p_user_id::TEXT
      || ':'
      || COALESCE(NULLIF(BTRIM(p_inspection_code), ''), 'sem-codigo')
      || ':principal';
  END IF;

  RETURN
    p_empresa_id::TEXT
    || ':'
    || p_relatorio_ciclo_id::TEXT
    || ':'
    || p_user_id::TEXT
    || ':'
    || COALESCE(NULLIF(BTRIM(p_inspection_code), ''), 'sem-codigo')
    || ':equipamento:'
    || COALESCE(v_equipment_type, 'sem-tipo')
    || ':'
    || p_equipment_record_id::TEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_or_create_active_report_cycle(p_empresa_id UUID)
RETURNS TABLE (
  id UUID,
  empresa_id UUID,
  nome TEXT,
  status TEXT,
  data_abertura TIMESTAMP WITH TIME ZONE,
  data_fechamento TIMESTAMP WITH TIME ZONE,
  criado_por UUID,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cycle public.empresa_relatorio_ciclos%ROWTYPE;
BEGIN
  IF auth.role() <> 'authenticated' OR auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuario autenticado nao encontrado.';
  END IF;

  PERFORM public.ensure_empresa_membership_bootstrap(p_empresa_id);

  IF NOT public.can_access_empresa(p_empresa_id) THEN
    RAISE EXCEPTION 'Acesso negado para a empresa informada.';
  END IF;

  SELECT *
  INTO v_cycle
  FROM public.empresa_relatorio_ciclos
  WHERE empresa_relatorio_ciclos.empresa_id = p_empresa_id
    AND empresa_relatorio_ciclos.status = 'ativo'
  ORDER BY empresa_relatorio_ciclos.data_abertura DESC, empresa_relatorio_ciclos.created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    INSERT INTO public.empresa_relatorio_ciclos (
      empresa_id,
      nome,
      status,
      criado_por
    )
    VALUES (
      p_empresa_id,
      'Ciclo ativo',
      'ativo',
      auth.uid()
    )
    RETURNING *
    INTO v_cycle;
  END IF;

  RETURN QUERY
  SELECT
    v_cycle.id,
    v_cycle.empresa_id,
    v_cycle.nome,
    v_cycle.status,
    v_cycle.data_abertura,
    v_cycle.data_fechamento,
    v_cycle.criado_por,
    v_cycle.created_at,
    v_cycle.updated_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.start_new_report_cycle(
  p_empresa_id UUID,
  p_nome TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  empresa_id UUID,
  nome TEXT,
  status TEXT,
  data_abertura TIMESTAMP WITH TIME ZONE,
  data_fechamento TIMESTAMP WITH TIME ZONE,
  criado_por UUID,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cycle public.empresa_relatorio_ciclos%ROWTYPE;
BEGIN
  IF auth.role() <> 'authenticated' OR auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuario autenticado nao encontrado.';
  END IF;

  PERFORM public.ensure_empresa_membership_bootstrap(p_empresa_id);

  IF NOT public.can_manage_empresa_members(p_empresa_id) THEN
    RAISE EXCEPTION 'Acesso negado para iniciar um novo ciclo de relatorio.';
  END IF;

  UPDATE public.empresa_relatorio_ciclos
  SET status = 'fechado',
      data_fechamento = COALESCE(data_fechamento, now()),
      updated_at = now()
  WHERE empresa_id = p_empresa_id
    AND status = 'ativo';

  INSERT INTO public.empresa_relatorio_ciclos (
    empresa_id,
    nome,
    status,
    criado_por
  )
  VALUES (
    p_empresa_id,
    COALESCE(NULLIF(BTRIM(p_nome), ''), 'Novo ciclo'),
    'ativo',
    auth.uid()
  )
  RETURNING *
  INTO v_cycle;

  RETURN QUERY
  SELECT
    v_cycle.id,
    v_cycle.empresa_id,
    v_cycle.nome,
    v_cycle.status,
    v_cycle.data_abertura,
    v_cycle.data_fechamento,
    v_cycle.criado_por,
    v_cycle.created_at,
    v_cycle.updated_at;
END;
$$;

INSERT INTO public.empresa_relatorio_ciclos (
  empresa_id,
  nome,
  status,
  criado_por
)
SELECT
  empresa.id,
  'Ciclo migrado',
  'ativo',
  (
    SELECT empresa_usuarios.user_id
    FROM public.empresa_usuarios
    WHERE empresa_usuarios.empresa_id = empresa.id
    ORDER BY
      CASE WHEN empresa_usuarios.papel = 'gestor' THEN 0 ELSE 1 END,
      empresa_usuarios.created_at ASC,
      empresa_usuarios.id ASC
    LIMIT 1
  )
FROM public.empresa AS empresa
WHERE NOT EXISTS (
  SELECT 1
  FROM public.empresa_relatorio_ciclos AS ciclos
  WHERE ciclos.empresa_id = empresa.id
    AND ciclos.status = 'ativo'
);

WITH ciclo_ativo AS (
  SELECT DISTINCT ON (empresa_relatorio_ciclos.empresa_id)
    empresa_relatorio_ciclos.empresa_id,
    empresa_relatorio_ciclos.id AS relatorio_ciclo_id
  FROM public.empresa_relatorio_ciclos
  WHERE empresa_relatorio_ciclos.status = 'ativo'
  ORDER BY
    empresa_relatorio_ciclos.empresa_id,
    empresa_relatorio_ciclos.data_abertura DESC,
    empresa_relatorio_ciclos.created_at DESC
)
UPDATE public.empresa_checklist_execucoes AS execucoes
SET relatorio_ciclo_id = ciclo_ativo.relatorio_ciclo_id
FROM ciclo_ativo
WHERE execucoes.empresa_id = ciclo_ativo.empresa_id
  AND execucoes.relatorio_ciclo_id IS NULL;

UPDATE public.empresa_checklist_execucoes
SET context_key = public.build_checklist_execution_context_key(
      empresa_id,
      relatorio_ciclo_id,
      user_id,
      inspection_code,
      context_type,
      equipment_type,
      equipment_record_id
    ),
    updated_at = now()
WHERE relatorio_ciclo_id IS NOT NULL
  AND context_key IS DISTINCT FROM public.build_checklist_execution_context_key(
    empresa_id,
    relatorio_ciclo_id,
    user_id,
    inspection_code,
    context_type,
    equipment_type,
    equipment_record_id
  );

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
  total_saves INTEGER,
  first_activity_at TIMESTAMP WITH TIME ZONE,
  last_activity_at TIMESTAMP WITH TIME ZONE,
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
  v_relatorio_ciclo_id UUID;
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

  SELECT ciclo.id
  INTO v_relatorio_ciclo_id
  FROM public.get_or_create_active_report_cycle(p_empresa_id) AS ciclo
  LIMIT 1;

  IF v_relatorio_ciclo_id IS NULL THEN
    RAISE EXCEPTION 'Nao foi possivel resolver o ciclo ativo do relatorio.';
  END IF;

  IF v_context_type = 'principal' THEN
    v_equipment_type := NULL;
    p_equipment_record_id := NULL;
  END IF;

  v_context_key := public.build_checklist_execution_context_key(
    p_empresa_id,
    v_relatorio_ciclo_id,
    auth.uid(),
    p_inspection_code,
    v_context_type,
    v_equipment_type,
    p_equipment_record_id
  );

  RETURN QUERY
  INSERT INTO public.empresa_checklist_execucoes (
    empresa_id,
    relatorio_ciclo_id,
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
    v_relatorio_ciclo_id,
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
    SET relatorio_ciclo_id = EXCLUDED.relatorio_ciclo_id,
        inspection_code = EXCLUDED.inspection_code,
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
    empresa_checklist_execucoes.total_saves,
    empresa_checklist_execucoes.first_activity_at,
    empresa_checklist_execucoes.last_activity_at,
    empresa_checklist_execucoes.created_at,
    empresa_checklist_execucoes.updated_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_empresa_relatorio_assinaturas(p_empresa_id UUID)
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
DECLARE
  v_relatorio_ciclo_id UUID;
BEGIN
  PERFORM public.ensure_empresa_membership_bootstrap(p_empresa_id);

  IF NOT public.can_access_empresa(p_empresa_id) THEN
    RAISE EXCEPTION 'Acesso negado para a empresa informada.';
  END IF;

  SELECT ciclo.id
  INTO v_relatorio_ciclo_id
  FROM public.get_or_create_active_report_cycle(p_empresa_id) AS ciclo
  LIMIT 1;

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
      AND (
        empresa_checklist_execucoes.relatorio_ciclo_id = v_relatorio_ciclo_id
        OR (
          v_relatorio_ciclo_id IS NULL
          AND empresa_checklist_execucoes.relatorio_ciclo_id IS NULL
        )
      )
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

REVOKE ALL ON FUNCTION public.build_checklist_execution_context_key(UUID, UUID, UUID, TEXT, TEXT, TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_or_create_active_report_cycle(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.start_new_report_cycle(UUID, TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.build_checklist_execution_context_key(UUID, UUID, UUID, TEXT, TEXT, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_create_active_report_cycle(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_new_report_cycle(UUID, TEXT) TO authenticated;
