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
