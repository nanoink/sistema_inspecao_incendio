-- Finalizar um relatório não encerra nem reinicia o ciclo da inspeção.
-- Gravações posteriores (principal, QR, autoria e NC) continuam no mesmo ciclo.
-- A troca de ciclo é exclusiva da ação explícita start_new_report_cycle.
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

  RETURN QUERY SELECT ciclo.id, ciclo.empresa_id, ciclo.nome, ciclo.status,
    ciclo.data_abertura, ciclo.data_fechamento, ciclo.criado_por,
    ciclo.created_at, ciclo.updated_at
  FROM public.get_or_create_active_report_cycle(p_empresa_id) AS ciclo;
END;
$$;

REVOKE ALL ON FUNCTION public.get_or_create_editable_report_cycle(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_or_create_editable_report_cycle(UUID, TEXT) TO authenticated;
