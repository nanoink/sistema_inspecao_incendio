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
