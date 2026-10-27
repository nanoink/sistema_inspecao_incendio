-- A worker may stop after SMTP accepted a message but before its DB checkpoint.
-- Never requeue those records automatically: doing so can send duplicates.
ALTER TABLE public.email_campaign_deliveries
  DROP CONSTRAINT email_campaign_deliveries_status_check;
ALTER TABLE public.email_campaign_deliveries
  ADD CONSTRAINT email_campaign_deliveries_status_check
  CHECK (status IN ('queued', 'processing', 'sent', 'failed', 'skipped', 'uncertain'));

ALTER TABLE public.email_campaigns ADD COLUMN uncertain_count INTEGER NOT NULL DEFAULT 0
  CHECK (uncertain_count >= 0);

CREATE OR REPLACE FUNCTION public.refresh_email_campaign_counters(p_campaign_id UUID)
RETURNS public.email_campaigns
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_campaign public.email_campaigns;
  v_total INTEGER;
  v_sent INTEGER;
  v_failed INTEGER;
  v_skipped INTEGER;
  v_uncertain INTEGER;
  v_open INTEGER;
BEGIN
  SELECT count(*)::INTEGER,
    count(*) FILTER (WHERE status = 'sent')::INTEGER,
    count(*) FILTER (WHERE status = 'failed')::INTEGER,
    count(*) FILTER (WHERE status = 'skipped')::INTEGER,
    count(*) FILTER (WHERE status = 'uncertain')::INTEGER,
    count(*) FILTER (WHERE status IN ('queued', 'processing', 'uncertain'))::INTEGER
  INTO v_total, v_sent, v_failed, v_skipped, v_uncertain, v_open
  FROM public.email_campaign_deliveries WHERE campaign_id = p_campaign_id;

  UPDATE public.email_campaigns SET
    total_recipients = v_total, sent_count = v_sent, failed_count = v_failed,
    skipped_count = v_skipped, uncertain_count = v_uncertain,
    status = CASE
      WHEN status IN ('cancelled', 'draft') THEN status
      WHEN v_uncertain > 0 THEN 'blocked'
      WHEN status IN ('paused', 'blocked') THEN status
      WHEN v_open = 0 THEN 'completed' ELSE status END,
    last_error = CASE WHEN v_uncertain > 0 THEN
      v_uncertain::TEXT || ' envio(s) sem confirmacao apos interrupcao. Confira no provedor antes de qualquer reenvio.'
      ELSE last_error END,
    completed_at = CASE WHEN v_uncertain > 0 THEN NULL
      WHEN status NOT IN ('cancelled', 'paused', 'blocked', 'draft') AND v_open = 0
      THEN COALESCE(completed_at, now()) ELSE completed_at END,
    next_batch_at = CASE WHEN v_uncertain > 0 OR
      (status NOT IN ('cancelled', 'paused', 'blocked', 'draft') AND v_open = 0)
      THEN NULL ELSE next_batch_at END
  WHERE id = p_campaign_id RETURNING * INTO v_campaign;
  RETURN v_campaign;
END;
$$;

CREATE OR REPLACE FUNCTION public.recover_interrupted_email_deliveries()
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_campaign_id UUID;
  v_count INTEGER := 0;
  v_rows INTEGER;
BEGIN
  -- Longer than the hosted worker's maximum lifetime. Do not touch live workers.
  FOR v_campaign_id IN
    SELECT DISTINCT campaign_id FROM public.email_campaign_deliveries
    WHERE status = 'processing' AND locked_at < now() - INTERVAL '15 minutes'
  LOOP
    UPDATE public.email_campaign_deliveries SET
      status = 'uncertain', locked_by = NULL, locked_at = NULL,
      last_error = 'Execucao interrompida sem resultado confirmado. Nao reenviar automaticamente.'
    WHERE campaign_id = v_campaign_id AND status = 'processing'
      AND locked_at < now() - INTERVAL '15 minutes';
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v_count := v_count + v_rows;
    PERFORM public.refresh_email_campaign_counters(v_campaign_id);
  END LOOP;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_email_campaign_batch(
  p_worker_id UUID, p_campaign_id UUID, p_results JSONB
)
RETURNS public.email_campaigns
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF jsonb_typeof(p_results) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Resultados do lote invalidos.';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_results) result
    WHERE COALESCE(result->>'status', '') NOT IN ('sent', 'failed', 'uncertain')) THEN
    RAISE EXCEPTION 'Status de entrega invalido.';
  END IF;
  WITH results AS (
    SELECT result.delivery_id, result.status,
      NULLIF(result.provider_message_id, '') AS provider_message_id,
      NULLIF(result.error_message, '') AS error_message
    FROM jsonb_to_recordset(p_results) AS result(
      delivery_id UUID, status TEXT, provider_message_id TEXT, error_message TEXT
    )
  )
  UPDATE public.email_campaign_deliveries AS delivery SET
    status = results.status, provider_message_id = results.provider_message_id,
    last_error = results.error_message,
    sent_at = CASE WHEN results.status = 'sent' THEN now() ELSE NULL END,
    locked_at = NULL, locked_by = NULL
  FROM results WHERE delivery.id = results.delivery_id
    AND delivery.campaign_id = p_campaign_id
    AND delivery.status = 'processing' AND delivery.locked_by = p_worker_id;
  RETURN public.refresh_email_campaign_counters(p_campaign_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.halt_email_campaign_batch(
  p_worker_id UUID, p_campaign_id UUID, p_unstarted_ids UUID[],
  p_error TEXT DEFAULT NULL, p_block BOOLEAN DEFAULT FALSE
)
RETURNS public.email_campaigns
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Caller passes ONLY messages for which SMTP has never been attempted.
  UPDATE public.email_campaign_deliveries SET status = 'queued', locked_by = NULL,
    locked_at = NULL, attempt_count = GREATEST(0, attempt_count - 1)
  WHERE campaign_id = p_campaign_id AND locked_by = p_worker_id
    AND status = 'processing' AND id = ANY(p_unstarted_ids);
  IF p_block THEN
    UPDATE public.email_campaigns SET status = 'blocked', next_batch_at = NULL,
      last_error = left(COALESCE(p_error, 'Processamento interrompido para verificacao.'), 2000)
    WHERE id = p_campaign_id AND status NOT IN ('cancelled', 'draft');
  END IF;
  RETURN public.refresh_email_campaign_counters(p_campaign_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.resume_email_campaign(p_campaign_id UUID)
RETURNS public.email_campaigns
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_campaign public.email_campaigns;
BEGIN
  IF NOT public.is_system_admin() THEN
    RAISE EXCEPTION 'Somente o administrador geral pode retomar campanhas.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.email_campaign_deliveries
    WHERE campaign_id = p_campaign_id AND status = 'uncertain') THEN
    RAISE EXCEPTION 'Existem envios sem confirmacao. Confira os resultados no provedor antes de retomar.';
  END IF;
  UPDATE public.email_campaigns SET status = 'scheduled', next_batch_at = now(), last_error = NULL
  WHERE id = p_campaign_id AND status IN ('paused', 'blocked') RETURNING * INTO v_campaign;
  IF v_campaign.id IS NULL THEN
    RAISE EXCEPTION 'A campanha nao pode ser retomada no status atual.';
  END IF;
  RETURN v_campaign;
END;
$$;

REVOKE ALL ON FUNCTION public.recover_interrupted_email_deliveries() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.halt_email_campaign_batch(UUID, UUID, UUID[], TEXT, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recover_interrupted_email_deliveries() TO service_role;
GRANT EXECUTE ON FUNCTION public.halt_email_campaign_batch(UUID, UUID, UUID[], TEXT, BOOLEAN) TO service_role;

-- Repair stuck metadata without submitting any messages or modifying sent rows.
SELECT public.recover_interrupted_email_deliveries();
