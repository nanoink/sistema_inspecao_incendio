ALTER TABLE public.empresa_relatorios
ADD COLUMN IF NOT EXISTS relatorio_ciclo_id UUID;

INSERT INTO public.empresa_relatorio_ciclos (
  empresa_id,
  nome,
  status,
  criado_por
)
SELECT DISTINCT
  report.empresa_id,
  'Ciclo inicial',
  'ativo',
  NULL::UUID
FROM public.empresa_relatorios AS report
WHERE NOT EXISTS (
  SELECT 1
  FROM public.empresa_relatorio_ciclos AS ciclo
  WHERE ciclo.empresa_id = report.empresa_id
);

WITH explicit_cycle AS (
  SELECT
    report.id,
    CASE
      WHEN jsonb_typeof(report.dados_adicionais) = 'object'
        AND COALESCE(report.dados_adicionais->>'report_cycle_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        THEN (report.dados_adicionais->>'report_cycle_id')::UUID
      ELSE NULL
    END AS relatorio_ciclo_id
  FROM public.empresa_relatorios AS report
),
active_cycle AS (
  SELECT DISTINCT ON (ciclo.empresa_id)
    ciclo.empresa_id,
    ciclo.id AS relatorio_ciclo_id
  FROM public.empresa_relatorio_ciclos AS ciclo
  WHERE ciclo.status = 'ativo'
  ORDER BY
    ciclo.empresa_id,
    ciclo.data_abertura DESC,
    ciclo.created_at DESC
)
UPDATE public.empresa_relatorios AS report
SET
  relatorio_ciclo_id = COALESCE(explicit_cycle.relatorio_ciclo_id, active_cycle.relatorio_ciclo_id),
  dados_adicionais = jsonb_strip_nulls(
    COALESCE(report.dados_adicionais, '{}'::JSONB)
    || jsonb_build_object(
      'report_cycle_id',
      COALESCE(explicit_cycle.relatorio_ciclo_id, active_cycle.relatorio_ciclo_id)
    )
  )
FROM explicit_cycle
LEFT JOIN active_cycle
  ON active_cycle.empresa_id = (
    SELECT base_report.empresa_id
    FROM public.empresa_relatorios AS base_report
    WHERE base_report.id = explicit_cycle.id
  )
WHERE report.id = explicit_cycle.id
  AND (
    report.relatorio_ciclo_id IS NULL
    OR (
      jsonb_typeof(report.dados_adicionais) = 'object'
      AND COALESCE(report.dados_adicionais->>'report_cycle_id', '') = ''
    )
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_empresa_relatorio_ciclos_empresa_id_id
  ON public.empresa_relatorio_ciclos (empresa_id, id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'empresa_relatorios_empresa_id_relatorio_ciclo_id_fkey'
  ) THEN
    ALTER TABLE public.empresa_relatorios
      ADD CONSTRAINT empresa_relatorios_empresa_id_relatorio_ciclo_id_fkey
      FOREIGN KEY (empresa_id, relatorio_ciclo_id)
      REFERENCES public.empresa_relatorio_ciclos(empresa_id, id)
      ON DELETE CASCADE;
  END IF;
END;
$$;

ALTER TABLE public.empresa_relatorios
ALTER COLUMN relatorio_ciclo_id SET NOT NULL;

ALTER TABLE public.empresa_relatorios
DROP CONSTRAINT IF EXISTS empresa_relatorios_empresa_id_key;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'empresa_relatorios_empresa_id_relatorio_ciclo_id_key'
  ) THEN
    ALTER TABLE public.empresa_relatorios
      ADD CONSTRAINT empresa_relatorios_empresa_id_relatorio_ciclo_id_key
      UNIQUE (empresa_id, relatorio_ciclo_id);
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_empresa_relatorios_empresa_ciclo
  ON public.empresa_relatorios (empresa_id, relatorio_ciclo_id);

CREATE OR REPLACE FUNCTION public.get_or_create_active_empresa_report(p_empresa_id UUID)
RETURNS SETOF public.empresa_relatorios
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_relatorio_ciclo_id UUID;
  v_report public.empresa_relatorios%ROWTYPE;
BEGIN
  IF auth.role() <> 'authenticated' OR auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuario autenticado nao encontrado.';
  END IF;

  PERFORM public.ensure_empresa_membership_bootstrap(p_empresa_id);

  IF NOT public.can_access_empresa(p_empresa_id) THEN
    RAISE EXCEPTION 'Acesso negado para a empresa informada.';
  END IF;

  SELECT ciclo.id
  INTO v_relatorio_ciclo_id
  FROM public.get_or_create_active_report_cycle(p_empresa_id) AS ciclo
  LIMIT 1;

  IF v_relatorio_ciclo_id IS NULL THEN
    RAISE EXCEPTION 'Nao foi possivel resolver o ciclo ativo do relatorio.';
  END IF;

  SELECT report.*
  INTO v_report
  FROM public.empresa_relatorios AS report
  WHERE report.empresa_id = p_empresa_id
    AND report.relatorio_ciclo_id = v_relatorio_ciclo_id
  ORDER BY report.updated_at DESC, report.created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    INSERT INTO public.empresa_relatorios (
      empresa_id,
      relatorio_ciclo_id,
      titulo,
      status,
      checklist_snapshot,
      dados_adicionais
    )
    VALUES (
      p_empresa_id,
      v_relatorio_ciclo_id,
      'Relatorio de Inspecao',
      'rascunho',
      '{}'::JSONB,
      jsonb_build_object('report_cycle_id', v_relatorio_ciclo_id)
    )
    ON CONFLICT ON CONSTRAINT empresa_relatorios_empresa_id_relatorio_ciclo_id_key
    DO NOTHING;

    SELECT report.*
    INTO v_report
    FROM public.empresa_relatorios AS report
    WHERE report.empresa_id = p_empresa_id
      AND report.relatorio_ciclo_id = v_relatorio_ciclo_id
    ORDER BY report.updated_at DESC, report.created_at DESC
    LIMIT 1;
  END IF;

  IF v_report.id IS NOT NULL THEN
    UPDATE public.empresa_relatorios
    SET dados_adicionais = jsonb_strip_nulls(
          COALESCE(v_report.dados_adicionais, '{}'::JSONB)
          || jsonb_build_object('report_cycle_id', v_relatorio_ciclo_id)
        )
    WHERE id = v_report.id;

    SELECT report.*
    INTO v_report
    FROM public.empresa_relatorios AS report
    WHERE report.id = v_report.id;
  END IF;

  RETURN QUERY
  SELECT report.*
  FROM public.empresa_relatorios AS report
  WHERE report.id = v_report.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_or_create_editable_report_cycle(
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
  v_report public.empresa_relatorios%ROWTYPE;
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

  SELECT ciclo.*
  INTO v_cycle
  FROM public.get_or_create_active_report_cycle(p_empresa_id) AS ciclo
  LIMIT 1;

  SELECT report.*
  INTO v_report
  FROM public.get_or_create_active_empresa_report(p_empresa_id) AS report
  LIMIT 1;

  IF v_report.status = 'finalizado' THEN
    UPDATE public.empresa_relatorio_ciclos
    SET
      status = 'fechado',
      data_fechamento = COALESCE(data_fechamento, now()),
      updated_at = now()
    WHERE id = v_cycle.id;

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

    INSERT INTO public.empresa_relatorios (
      empresa_id,
      relatorio_ciclo_id,
      titulo,
      status,
      checklist_snapshot,
      dados_adicionais
    )
    VALUES (
      p_empresa_id,
      v_cycle.id,
      'Relatorio de Inspecao',
      'rascunho',
      '{}'::JSONB,
      jsonb_build_object('report_cycle_id', v_cycle.id)
    )
    ON CONFLICT ON CONSTRAINT empresa_relatorios_empresa_id_relatorio_ciclo_id_key
    DO NOTHING;
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

  UPDATE public.empresa_relatorio_ciclos AS ciclo
  SET status = 'fechado',
      data_fechamento = COALESCE(ciclo.data_fechamento, now()),
      updated_at = now()
  WHERE ciclo.empresa_id = p_empresa_id
    AND ciclo.status = 'ativo';

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

  INSERT INTO public.empresa_relatorios (
    empresa_id,
    relatorio_ciclo_id,
    titulo,
    status,
    checklist_snapshot,
    dados_adicionais
  )
  VALUES (
    p_empresa_id,
    v_cycle.id,
    'Relatorio de Inspecao',
    'rascunho',
    '{}'::JSONB,
    jsonb_build_object('report_cycle_id', v_cycle.id)
  )
  ON CONFLICT ON CONSTRAINT empresa_relatorios_empresa_id_relatorio_ciclo_id_key
  DO NOTHING;

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
  FROM public.get_or_create_editable_report_cycle(p_empresa_id) AS ciclo
  LIMIT 1;

  IF v_relatorio_ciclo_id IS NULL THEN
    RAISE EXCEPTION 'Nao foi possivel resolver o ciclo editavel do relatorio.';
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
  ON CONFLICT ON CONSTRAINT empresa_checklist_execucoes_context_key_key
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
    public.empresa_checklist_execucoes.id,
    public.empresa_checklist_execucoes.empresa_id,
    public.empresa_checklist_execucoes.user_id,
    public.empresa_checklist_execucoes.inspection_code,
    public.empresa_checklist_execucoes.inspection_name,
    public.empresa_checklist_execucoes.context_type,
    public.empresa_checklist_execucoes.equipment_type,
    public.empresa_checklist_execucoes.equipment_record_id,
    public.empresa_checklist_execucoes.source_label,
    public.empresa_checklist_execucoes.context_key,
    public.empresa_checklist_execucoes.total_saves,
    public.empresa_checklist_execucoes.first_activity_at,
    public.empresa_checklist_execucoes.last_activity_at,
    public.empresa_checklist_execucoes.created_at,
    public.empresa_checklist_execucoes.updated_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_equipment_qr_non_conformities(
  p_token UUID
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
  v_relatorio_ciclo_id UUID;
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

  SELECT ciclo.id
  INTO v_relatorio_ciclo_id
  FROM public.get_or_create_active_report_cycle(v_empresa_id) AS ciclo
  LIMIT 1;

  RETURN QUERY
  SELECT
    record.id,
    record.context_key,
    record.empresa_id,
    record.checklist_item_id,
    record.equipment_type,
    record.equipment_record_id,
    record.descricao,
    record.imagem_data_url,
    record.created_at,
    record.updated_at
  FROM public.empresa_checklist_nao_conformidades AS record
  WHERE record.empresa_id = v_empresa_id
    AND record.equipment_type = v_equipment_type
    AND record.equipment_record_id = v_equipment_record_id
    AND (
      record.relatorio_ciclo_id = v_relatorio_ciclo_id
      OR (
        v_relatorio_ciclo_id IS NULL
        AND record.relatorio_ciclo_id IS NULL
      )
    )
  ORDER BY record.updated_at DESC;
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
  v_relatorio_ciclo_id UUID;
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

  SELECT ciclo.id
  INTO v_relatorio_ciclo_id
  FROM public.get_or_create_editable_report_cycle(v_empresa_id) AS ciclo
  LIMIT 1;

  v_context_key := public.build_checklist_non_conformity_context_key(
    v_empresa_id,
    v_relatorio_ciclo_id,
    p_checklist_item_id,
    v_equipment_type,
    v_equipment_record_id
  );

  RETURN QUERY
  INSERT INTO public.empresa_checklist_nao_conformidades (
    context_key,
    empresa_id,
    relatorio_ciclo_id,
    checklist_item_id,
    equipment_type,
    equipment_record_id,
    descricao,
    imagem_data_url
  )
  VALUES (
    v_context_key,
    v_empresa_id,
    v_relatorio_ciclo_id,
    p_checklist_item_id,
    v_equipment_type,
    v_equipment_record_id,
    COALESCE(NULLIF(BTRIM(p_descricao), ''), ''),
    NULLIF(BTRIM(COALESCE(p_imagem_data_url, '')), '')
  )
  ON CONFLICT (context_key)
  DO UPDATE
    SET relatorio_ciclo_id = EXCLUDED.relatorio_ciclo_id,
        descricao = EXCLUDED.descricao,
        imagem_data_url = EXCLUDED.imagem_data_url,
        updated_at = now()
  RETURNING
    public.empresa_checklist_nao_conformidades.id,
    public.empresa_checklist_nao_conformidades.context_key,
    public.empresa_checklist_nao_conformidades.empresa_id,
    public.empresa_checklist_nao_conformidades.checklist_item_id,
    public.empresa_checklist_nao_conformidades.equipment_type,
    public.empresa_checklist_nao_conformidades.equipment_record_id,
    public.empresa_checklist_nao_conformidades.descricao,
    public.empresa_checklist_nao_conformidades.imagem_data_url,
    public.empresa_checklist_nao_conformidades.created_at,
    public.empresa_checklist_nao_conformidades.updated_at;
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
  v_inspection_name TEXT;
  v_equipment_title TEXT;
  v_equipment_number TEXT;
  v_localizacao TEXT;
  v_source_label TEXT;
  v_relatorio_ciclo_id UUID;
  v_snapshot JSONB := COALESCE(p_checklist_snapshot, '{}'::jsonb);
BEGIN
  IF auth.role() <> 'authenticated' OR auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuario autenticado nao encontrado.';
  END IF;

  SELECT
    'extintor',
    extintor.id,
    extintor.empresa_id,
    extintor.numero,
    extintor.localizacao
  INTO
    v_equipment_type,
    v_equipment_id,
    v_empresa_id,
    v_equipment_number,
    v_localizacao
  FROM public.empresa_extintores AS extintor
  WHERE extintor.public_token = p_token;

  IF FOUND THEN
    v_inspection_code := 'A.23';
    v_inspection_name := 'Checklist de extintor';
    v_equipment_title := 'Extintor';
  ELSE
    SELECT
      'hidrante',
      hidrante.id,
      hidrante.empresa_id,
      hidrante.numero,
      hidrante.localizacao
    INTO
      v_equipment_type,
      v_equipment_id,
      v_empresa_id,
      v_equipment_number,
      v_localizacao
    FROM public.empresa_hidrantes AS hidrante
    WHERE hidrante.public_token = p_token;

    IF FOUND THEN
      v_inspection_code := 'A.25';
      v_inspection_name := 'Checklist de hidrante';
      v_equipment_title := 'Hidrante';
    ELSE
      SELECT
        'luminaria',
        luminaria.id,
        luminaria.empresa_id,
        luminaria.numero,
        luminaria.localizacao
      INTO
        v_equipment_type,
        v_equipment_id,
        v_empresa_id,
        v_equipment_number,
        v_localizacao
      FROM public.empresa_luminarias AS luminaria
      WHERE luminaria.public_token = p_token;

      IF FOUND THEN
        v_inspection_code := 'A.19';
        v_inspection_name := 'Checklist de luminaria';
        v_equipment_title := 'Luminaria';
      ELSE
        RAISE EXCEPTION 'Equipamento nao encontrado para o token informado.';
      END IF;
    END IF;
  END IF;

  PERFORM public.ensure_empresa_membership_bootstrap(v_empresa_id);

  IF NOT public.can_access_empresa(v_empresa_id) THEN
    RAISE EXCEPTION 'Acesso negado para a empresa informada.';
  END IF;

  IF NOT public.can_execute_empresa_checklists(v_empresa_id) THEN
    RAISE EXCEPTION 'Seu usuario nao esta liberado para executar checklists desta empresa.';
  END IF;

  SELECT ciclo.id
  INTO v_relatorio_ciclo_id
  FROM public.get_or_create_editable_report_cycle(v_empresa_id) AS ciclo
  LIMIT 1;

  IF v_relatorio_ciclo_id IS NULL THEN
    RAISE EXCEPTION 'Nao foi possivel resolver o ciclo editavel do relatorio.';
  END IF;

  IF v_equipment_type = 'extintor' THEN
    UPDATE public.empresa_extintores
    SET checklist_snapshot = v_snapshot
    WHERE id = v_equipment_id;
  ELSIF v_equipment_type = 'hidrante' THEN
    UPDATE public.empresa_hidrantes
    SET checklist_snapshot = v_snapshot
    WHERE id = v_equipment_id;
  ELSE
    UPDATE public.empresa_luminarias
    SET checklist_snapshot = v_snapshot
    WHERE id = v_equipment_id;
  END IF;

  DELETE FROM public.empresa_checklist_respostas AS resposta
  WHERE resposta.empresa_id = v_empresa_id
    AND resposta.relatorio_ciclo_id = v_relatorio_ciclo_id
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
    INSERT INTO public.empresa_checklist_respostas (
      empresa_id,
      relatorio_ciclo_id,
      checklist_item_id,
      status,
      observacoes
    )
    SELECT
      v_empresa_id,
      v_relatorio_ciclo_id,
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
      CROSS JOIN LATERAL jsonb_array_elements(
        COALESCE(equipamento.checklist_snapshot->'items', '[]'::jsonb)
      ) AS item
      WHERE equipamento.empresa_id = v_empresa_id
      GROUP BY item->>'checklist_item_id'
    ) AS aggregated
    WHERE aggregated.checklist_item_id IS NOT NULL
      AND aggregated.checklist_item_id <> ''
      AND aggregated.status IS NOT NULL
    ON CONFLICT ON CONSTRAINT empresa_checklist_respostas_empresa_id_relatorio_ciclo_id_checklist_item_id_key
    DO UPDATE
      SET status = EXCLUDED.status,
          observacoes = EXCLUDED.observacoes,
          updated_at = now();
  ELSIF v_equipment_type = 'hidrante' THEN
    INSERT INTO public.empresa_checklist_respostas (
      empresa_id,
      relatorio_ciclo_id,
      checklist_item_id,
      status,
      observacoes
    )
    SELECT
      v_empresa_id,
      v_relatorio_ciclo_id,
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
      CROSS JOIN LATERAL jsonb_array_elements(
        COALESCE(equipamento.checklist_snapshot->'items', '[]'::jsonb)
      ) AS item
      WHERE equipamento.empresa_id = v_empresa_id
      GROUP BY item->>'checklist_item_id'
    ) AS aggregated
    WHERE aggregated.checklist_item_id IS NOT NULL
      AND aggregated.checklist_item_id <> ''
      AND aggregated.status IS NOT NULL
    ON CONFLICT ON CONSTRAINT empresa_checklist_respostas_empresa_id_relatorio_ciclo_id_checklist_item_id_key
    DO UPDATE
      SET status = EXCLUDED.status,
          observacoes = EXCLUDED.observacoes,
          updated_at = now();
  ELSE
    INSERT INTO public.empresa_checklist_respostas (
      empresa_id,
      relatorio_ciclo_id,
      checklist_item_id,
      status,
      observacoes
    )
    SELECT
      v_empresa_id,
      v_relatorio_ciclo_id,
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
      CROSS JOIN LATERAL jsonb_array_elements(
        COALESCE(equipamento.checklist_snapshot->'items', '[]'::jsonb)
      ) AS item
      WHERE equipamento.empresa_id = v_empresa_id
      GROUP BY item->>'checklist_item_id'
    ) AS aggregated
    WHERE aggregated.checklist_item_id IS NOT NULL
      AND aggregated.checklist_item_id <> ''
      AND aggregated.status IS NOT NULL
    ON CONFLICT ON CONSTRAINT empresa_checklist_respostas_empresa_id_relatorio_ciclo_id_checklist_item_id_key
    DO UPDATE
      SET status = EXCLUDED.status,
          observacoes = EXCLUDED.observacoes,
          updated_at = now();
  END IF;

  v_source_label := CONCAT_WS(
    ' | ',
    NULLIF(BTRIM(CONCAT(v_equipment_title, ' ', COALESCE(v_equipment_number, ''))), ''),
    NULLIF(BTRIM(COALESCE(v_localizacao, '')), '')
  );

  PERFORM 1
  FROM public.register_checklist_execution(
    v_empresa_id,
    v_inspection_code,
    v_inspection_name,
    'equipamento',
    v_equipment_type,
    v_equipment_id,
    NULLIF(BTRIM(COALESCE(v_source_label, '')), '')
  );

  RETURN QUERY
  SELECT
    v_equipment_type,
    v_equipment_id,
    v_empresa_id,
    v_snapshot;
END;
$$;

REVOKE ALL ON FUNCTION public.get_or_create_active_empresa_report(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_or_create_editable_report_cycle(UUID, TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_or_create_active_empresa_report(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_create_editable_report_cycle(UUID, TEXT) TO authenticated;
