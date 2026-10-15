CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS supabase_vault CASCADE;

CREATE TABLE public.email_recipient_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 2 AND 120),
  description TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX email_recipient_lists_name_unique
  ON public.email_recipient_lists (lower(btrim(name)));

CREATE TABLE public.email_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES public.email_recipient_lists(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  email_normalized TEXT GENERATED ALWAYS AS (lower(btrim(email))) STORED,
  name TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'unsubscribed', 'invalid')),
  consent_source TEXT NOT NULL DEFAULT 'importacao_administrativa',
  consent_at TIMESTAMPTZ,
  unsubscribed_at TIMESTAMPTZ,
  unsubscribe_token UUID NOT NULL DEFAULT gen_random_uuid(),
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT email_recipients_email_format_check
    CHECK (btrim(email) ~* '^[A-Z0-9.!#$%&''*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+$'),
  CONSTRAINT email_recipients_list_email_unique UNIQUE (list_id, email_normalized),
  CONSTRAINT email_recipients_unsubscribe_token_unique UNIQUE (unsubscribe_token)
);

CREATE INDEX email_recipients_list_status_idx
  ON public.email_recipients (list_id, status);

CREATE TABLE public.email_suppressions (
  email_normalized TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT 'unsubscribe',
  source TEXT NOT NULL DEFAULT 'recipient',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.email_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 2 AND 160),
  subject TEXT NOT NULL CHECK (char_length(btrim(subject)) BETWEEN 1 AND 200),
  preview_text TEXT,
  html_body TEXT NOT NULL CHECK (char_length(btrim(html_body)) > 0),
  sender_name TEXT NOT NULL DEFAULT 'Fire Tetraedro',
  reply_to TEXT,
  recipient_list_id UUID NOT NULL REFERENCES public.email_recipient_lists(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'scheduled', 'running', 'paused', 'completed', 'cancelled', 'blocked')),
  batch_size SMALLINT NOT NULL DEFAULT 10 CHECK (batch_size BETWEEN 1 AND 50),
  interval_minutes SMALLINT NOT NULL DEFAULT 10 CHECK (interval_minutes BETWEEN 1 AND 1440),
  scheduled_at TIMESTAMPTZ,
  next_batch_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  total_recipients INTEGER NOT NULL DEFAULT 0 CHECK (total_recipients >= 0),
  sent_count INTEGER NOT NULL DEFAULT 0 CHECK (sent_count >= 0),
  failed_count INTEGER NOT NULL DEFAULT 0 CHECK (failed_count >= 0),
  skipped_count INTEGER NOT NULL DEFAULT 0 CHECK (skipped_count >= 0),
  last_error TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX email_campaigns_dispatch_idx
  ON public.email_campaigns (next_batch_at, created_at)
  WHERE status IN ('scheduled', 'running');

CREATE TABLE public.email_campaign_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.email_campaigns(id) ON DELETE CASCADE,
  recipient_id UUID REFERENCES public.email_recipients(id) ON DELETE SET NULL,
  recipient_email TEXT NOT NULL,
  email_normalized TEXT NOT NULL,
  recipient_name TEXT,
  unsubscribe_token UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'processing', 'sent', 'failed', 'skipped')),
  attempt_count SMALLINT NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  next_attempt_at TIMESTAMPTZ,
  locked_at TIMESTAMPTZ,
  locked_by UUID,
  provider_message_id TEXT,
  last_error TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT email_campaign_deliveries_campaign_email_unique
    UNIQUE (campaign_id, email_normalized)
);

CREATE INDEX email_campaign_deliveries_queue_idx
  ON public.email_campaign_deliveries (campaign_id, status, next_attempt_at, created_at);

CREATE INDEX email_campaign_deliveries_email_idx
  ON public.email_campaign_deliveries (email_normalized);

CREATE OR REPLACE FUNCTION public.set_bulk_email_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_email_recipient_lists_updated_at
  BEFORE UPDATE ON public.email_recipient_lists
  FOR EACH ROW EXECUTE FUNCTION public.set_bulk_email_updated_at();

CREATE TRIGGER set_email_recipients_updated_at
  BEFORE UPDATE ON public.email_recipients
  FOR EACH ROW EXECUTE FUNCTION public.set_bulk_email_updated_at();

CREATE TRIGGER set_email_campaigns_updated_at
  BEFORE UPDATE ON public.email_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.set_bulk_email_updated_at();

CREATE TRIGGER set_email_campaign_deliveries_updated_at
  BEFORE UPDATE ON public.email_campaign_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.set_bulk_email_updated_at();

ALTER TABLE public.email_recipient_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_suppressions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_campaign_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "System admin manages recipient lists"
  ON public.email_recipient_lists
  FOR ALL
  TO authenticated
  USING ((SELECT public.is_system_admin()))
  WITH CHECK ((SELECT public.is_system_admin()));

CREATE POLICY "System admin manages recipients"
  ON public.email_recipients
  FOR ALL
  TO authenticated
  USING ((SELECT public.is_system_admin()))
  WITH CHECK ((SELECT public.is_system_admin()));

CREATE POLICY "System admin manages suppressions"
  ON public.email_suppressions
  FOR ALL
  TO authenticated
  USING ((SELECT public.is_system_admin()))
  WITH CHECK ((SELECT public.is_system_admin()));

CREATE POLICY "System admin manages campaigns"
  ON public.email_campaigns
  FOR ALL
  TO authenticated
  USING ((SELECT public.is_system_admin()))
  WITH CHECK ((SELECT public.is_system_admin()));

CREATE POLICY "System admin views campaign deliveries"
  ON public.email_campaign_deliveries
  FOR SELECT
  TO authenticated
  USING ((SELECT public.is_system_admin()));

REVOKE ALL ON public.email_recipient_lists FROM anon, authenticated;
REVOKE ALL ON public.email_recipients FROM anon, authenticated;
REVOKE ALL ON public.email_suppressions FROM anon, authenticated;
REVOKE ALL ON public.email_campaigns FROM anon, authenticated;
REVOKE ALL ON public.email_campaign_deliveries FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_recipient_lists TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_recipients TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_suppressions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_campaigns TO authenticated;
GRANT SELECT ON public.email_campaign_deliveries TO authenticated;

GRANT ALL ON public.email_recipient_lists TO service_role;
GRANT ALL ON public.email_recipients TO service_role;
GRANT ALL ON public.email_suppressions TO service_role;
GRANT ALL ON public.email_campaigns TO service_role;
GRANT ALL ON public.email_campaign_deliveries TO service_role;

CREATE OR REPLACE FUNCTION public.refresh_email_campaign_counters(p_campaign_id UUID)
RETURNS public.email_campaigns
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_campaign public.email_campaigns;
  v_total INTEGER;
  v_sent INTEGER;
  v_failed INTEGER;
  v_skipped INTEGER;
  v_open INTEGER;
BEGIN
  SELECT
    count(*)::INTEGER,
    count(*) FILTER (WHERE status = 'sent')::INTEGER,
    count(*) FILTER (WHERE status = 'failed')::INTEGER,
    count(*) FILTER (WHERE status = 'skipped')::INTEGER,
    count(*) FILTER (WHERE status IN ('queued', 'processing'))::INTEGER
  INTO v_total, v_sent, v_failed, v_skipped, v_open
  FROM public.email_campaign_deliveries
  WHERE campaign_id = p_campaign_id;

  UPDATE public.email_campaigns
  SET
    total_recipients = COALESCE(v_total, 0),
    sent_count = COALESCE(v_sent, 0),
    failed_count = COALESCE(v_failed, 0),
    skipped_count = COALESCE(v_skipped, 0),
    status = CASE
      WHEN status IN ('cancelled', 'paused', 'blocked', 'draft') THEN status
      WHEN COALESCE(v_open, 0) = 0 THEN 'completed'
      ELSE status
    END,
    completed_at = CASE
      WHEN status NOT IN ('cancelled', 'paused', 'blocked', 'draft')
        AND COALESCE(v_open, 0) = 0
      THEN COALESCE(completed_at, now())
      ELSE completed_at
    END,
    next_batch_at = CASE
      WHEN status NOT IN ('cancelled', 'paused', 'blocked', 'draft')
        AND COALESCE(v_open, 0) = 0
      THEN NULL
      ELSE next_batch_at
    END
  WHERE id = p_campaign_id
  RETURNING * INTO v_campaign;

  RETURN v_campaign;
END;
$$;

CREATE OR REPLACE FUNCTION public.schedule_email_campaign(
  p_campaign_id UUID,
  p_scheduled_at TIMESTAMPTZ DEFAULT now()
)
RETURNS public.email_campaigns
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_campaign public.email_campaigns;
  v_delivery_count INTEGER;
BEGIN
  IF NOT public.is_system_admin() THEN
    RAISE EXCEPTION 'Somente o administrador geral pode programar campanhas.';
  END IF;

  SELECT * INTO v_campaign
  FROM public.email_campaigns
  WHERE id = p_campaign_id
  FOR UPDATE;

  IF v_campaign.id IS NULL THEN
    RAISE EXCEPTION 'Campanha nao encontrada.';
  END IF;

  IF v_campaign.status IN ('running', 'completed', 'cancelled') THEN
    RAISE EXCEPTION 'A campanha nao pode ser programada no status atual.';
  END IF;

  SELECT count(*)::INTEGER INTO v_delivery_count
  FROM public.email_campaign_deliveries
  WHERE campaign_id = p_campaign_id;

  IF v_delivery_count = 0 THEN
    INSERT INTO public.email_campaign_deliveries (
      campaign_id,
      recipient_id,
      recipient_email,
      email_normalized,
      recipient_name,
      unsubscribe_token,
      status
    )
    SELECT
      v_campaign.id,
      recipient.id,
      recipient.email,
      recipient.email_normalized,
      NULLIF(btrim(recipient.name), ''),
      recipient.unsubscribe_token,
      'queued'
    FROM public.email_recipients AS recipient
    LEFT JOIN public.email_suppressions AS suppression
      ON suppression.email_normalized = recipient.email_normalized
    WHERE recipient.list_id = v_campaign.recipient_list_id
      AND recipient.status = 'active'
      AND suppression.email_normalized IS NULL
    ON CONFLICT (campaign_id, email_normalized) DO NOTHING;
  ELSE
    UPDATE public.email_campaign_deliveries
    SET
      status = 'queued',
      next_attempt_at = NULL,
      locked_at = NULL,
      locked_by = NULL,
      last_error = NULL
    WHERE campaign_id = p_campaign_id
      AND status = 'failed';
  END IF;

  SELECT count(*)::INTEGER INTO v_delivery_count
  FROM public.email_campaign_deliveries
  WHERE campaign_id = p_campaign_id
    AND status IN ('queued', 'processing');

  IF v_delivery_count = 0 THEN
    RAISE EXCEPTION 'A lista nao possui destinatarios ativos e liberados para envio.';
  END IF;

  UPDATE public.email_campaigns
  SET
    status = 'scheduled',
    scheduled_at = COALESCE(p_scheduled_at, now()),
    next_batch_at = GREATEST(COALESCE(p_scheduled_at, now()), now()),
    completed_at = NULL,
    last_error = NULL
  WHERE id = p_campaign_id;

  RETURN public.refresh_email_campaign_counters(p_campaign_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.pause_email_campaign(p_campaign_id UUID)
RETURNS public.email_campaigns
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_campaign public.email_campaigns;
BEGIN
  IF NOT public.is_system_admin() THEN
    RAISE EXCEPTION 'Somente o administrador geral pode pausar campanhas.';
  END IF;

  UPDATE public.email_campaigns
  SET status = 'paused', next_batch_at = NULL
  WHERE id = p_campaign_id
    AND status IN ('scheduled', 'running', 'blocked')
  RETURNING * INTO v_campaign;

  IF v_campaign.id IS NULL THEN
    RAISE EXCEPTION 'A campanha nao pode ser pausada no status atual.';
  END IF;

  RETURN v_campaign;
END;
$$;

CREATE OR REPLACE FUNCTION public.resume_email_campaign(p_campaign_id UUID)
RETURNS public.email_campaigns
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_campaign public.email_campaigns;
BEGIN
  IF NOT public.is_system_admin() THEN
    RAISE EXCEPTION 'Somente o administrador geral pode retomar campanhas.';
  END IF;

  UPDATE public.email_campaigns
  SET status = 'scheduled', next_batch_at = now(), last_error = NULL
  WHERE id = p_campaign_id
    AND status IN ('paused', 'blocked')
  RETURNING * INTO v_campaign;

  IF v_campaign.id IS NULL THEN
    RAISE EXCEPTION 'A campanha nao pode ser retomada no status atual.';
  END IF;

  RETURN v_campaign;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_email_campaign(p_campaign_id UUID)
RETURNS public.email_campaigns
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_campaign public.email_campaigns;
BEGIN
  IF NOT public.is_system_admin() THEN
    RAISE EXCEPTION 'Somente o administrador geral pode cancelar campanhas.';
  END IF;

  UPDATE public.email_campaign_deliveries
  SET
    status = 'skipped',
    last_error = 'Campanha cancelada pelo administrador.',
    locked_at = NULL,
    locked_by = NULL
  WHERE campaign_id = p_campaign_id
    AND status IN ('queued', 'processing');

  UPDATE public.email_campaigns
  SET status = 'cancelled', next_batch_at = NULL, completed_at = now()
  WHERE id = p_campaign_id
    AND status NOT IN ('completed', 'cancelled')
  RETURNING * INTO v_campaign;

  IF v_campaign.id IS NULL THEN
    RAISE EXCEPTION 'A campanha nao pode ser cancelada no status atual.';
  END IF;

  RETURN public.refresh_email_campaign_counters(p_campaign_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_due_email_campaign_batch(p_worker_id UUID)
RETURNS TABLE (
  delivery_id UUID,
  campaign_id UUID,
  recipient_email TEXT,
  recipient_name TEXT,
  unsubscribe_token UUID,
  subject TEXT,
  preview_text TEXT,
  html_body TEXT,
  sender_name TEXT,
  reply_to TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_campaign_id UUID;
  v_batch_size INTEGER;
  v_interval_minutes INTEGER;
BEGIN
  SELECT campaign.id, campaign.batch_size, campaign.interval_minutes
  INTO v_campaign_id, v_batch_size, v_interval_minutes
  FROM public.email_campaigns AS campaign
  WHERE campaign.status IN ('scheduled', 'running')
    AND campaign.next_batch_at IS NOT NULL
    AND campaign.next_batch_at <= now()
    AND EXISTS (
      SELECT 1
      FROM public.email_campaign_deliveries AS delivery
      WHERE delivery.campaign_id = campaign.id
        AND delivery.status = 'queued'
        AND (delivery.next_attempt_at IS NULL OR delivery.next_attempt_at <= now())
    )
  ORDER BY campaign.next_batch_at, campaign.created_at
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF v_campaign_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.email_campaigns
  SET
    status = 'running',
    started_at = COALESCE(started_at, now()),
    next_batch_at = now() + make_interval(mins => v_interval_minutes),
    last_error = NULL
  WHERE id = v_campaign_id;

  RETURN QUERY
  WITH candidates AS (
    SELECT delivery.id
    FROM public.email_campaign_deliveries AS delivery
    WHERE delivery.campaign_id = v_campaign_id
      AND delivery.status = 'queued'
      AND (delivery.next_attempt_at IS NULL OR delivery.next_attempt_at <= now())
    ORDER BY delivery.created_at, delivery.id
    FOR UPDATE SKIP LOCKED
    LIMIT v_batch_size
  ), claimed AS (
    UPDATE public.email_campaign_deliveries AS delivery
    SET
      status = 'processing',
      attempt_count = delivery.attempt_count + 1,
      locked_at = now(),
      locked_by = p_worker_id,
      last_error = NULL
    FROM candidates
    WHERE delivery.id = candidates.id
    RETURNING delivery.*
  )
  SELECT
    claimed.id,
    claimed.campaign_id,
    claimed.recipient_email,
    claimed.recipient_name,
    claimed.unsubscribe_token,
    campaign.subject,
    campaign.preview_text,
    campaign.html_body,
    campaign.sender_name,
    campaign.reply_to
  FROM claimed
  INNER JOIN public.email_campaigns AS campaign
    ON campaign.id = claimed.campaign_id
  ORDER BY claimed.created_at, claimed.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_email_campaign_batch(
  p_worker_id UUID,
  p_campaign_id UUID,
  p_results JSONB
)
RETURNS public.email_campaigns
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF jsonb_typeof(p_results) <> 'array' THEN
    RAISE EXCEPTION 'Resultados do lote invalidos.';
  END IF;

  WITH results AS (
    SELECT
      result.delivery_id,
      CASE WHEN result.status = 'sent' THEN 'sent' ELSE 'failed' END AS status,
      NULLIF(result.provider_message_id, '') AS provider_message_id,
      NULLIF(result.error_message, '') AS error_message
    FROM jsonb_to_recordset(p_results) AS result(
      delivery_id UUID,
      status TEXT,
      provider_message_id TEXT,
      error_message TEXT
    )
  )
  UPDATE public.email_campaign_deliveries AS delivery
  SET
    status = results.status,
    provider_message_id = results.provider_message_id,
    last_error = results.error_message,
    sent_at = CASE WHEN results.status = 'sent' THEN now() ELSE NULL END,
    locked_at = NULL,
    locked_by = NULL
  FROM results
  WHERE delivery.id = results.delivery_id
    AND delivery.campaign_id = p_campaign_id
    AND delivery.status = 'processing'
    AND delivery.locked_by = p_worker_id;

  RETURN public.refresh_email_campaign_counters(p_campaign_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.block_email_campaign_batch(
  p_worker_id UUID,
  p_campaign_id UUID,
  p_error TEXT
)
RETURNS public.email_campaigns
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_campaign public.email_campaigns;
BEGIN
  UPDATE public.email_campaign_deliveries
  SET
    status = 'queued',
    locked_at = NULL,
    locked_by = NULL,
    last_error = left(COALESCE(p_error, 'Transporte de email indisponivel.'), 2000)
  WHERE campaign_id = p_campaign_id
    AND status = 'processing'
    AND locked_by = p_worker_id;

  UPDATE public.email_campaigns
  SET
    status = 'blocked',
    next_batch_at = NULL,
    last_error = left(COALESCE(p_error, 'Transporte de email indisponivel.'), 2000)
  WHERE id = p_campaign_id
  RETURNING * INTO v_campaign;

  RETURN v_campaign;
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_bulk_email_worker_token(p_token TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, vault
AS $$
  SELECT COALESCE(
    length(COALESCE(p_token, '')) >= 32
    AND p_token = (
      SELECT decrypted_secret
      FROM vault.decrypted_secrets
      WHERE name = 'bulk_email_worker_token'
      LIMIT 1
    ),
    FALSE
  );
$$;

CREATE OR REPLACE FUNCTION public.configure_bulk_email_worker(p_project_url TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, cron, net
AS $$
DECLARE
  v_project_url TEXT := regexp_replace(btrim(p_project_url), '/+$', '');
  v_worker_token TEXT := encode(extensions.gen_random_bytes(32), 'hex');
  v_secret_id UUID;
  v_command TEXT;
  v_job_id BIGINT;
BEGIN
  IF v_project_url !~ '^https://[a-z0-9-]+\.supabase\.co$'
    AND v_project_url !~ '^http://(127\.0\.0\.1|localhost)(:[0-9]+)?$'
  THEN
    RAISE EXCEPTION 'URL do projeto Supabase invalida.';
  END IF;

  SELECT id INTO v_secret_id
  FROM vault.secrets
  WHERE name = 'bulk_email_project_url'
  LIMIT 1;

  IF v_secret_id IS NULL THEN
    PERFORM vault.create_secret(
      v_project_url,
      'bulk_email_project_url',
      'URL usada pelo cron de campanhas de email.'
    );
  ELSE
    PERFORM vault.update_secret(
      v_secret_id,
      v_project_url,
      'bulk_email_project_url',
      'URL usada pelo cron de campanhas de email.'
    );
  END IF;

  SELECT id INTO v_secret_id
  FROM vault.secrets
  WHERE name = 'bulk_email_worker_token'
  LIMIT 1;

  IF v_secret_id IS NULL THEN
    PERFORM vault.create_secret(
      v_worker_token,
      'bulk_email_worker_token',
      'Token interno do cron de campanhas de email.'
    );
  ELSE
    PERFORM vault.update_secret(
      v_secret_id,
      v_worker_token,
      'bulk_email_worker_token',
      'Token interno do cron de campanhas de email.'
    );
  END IF;

  v_command := $command$
    SELECT net.http_post(
      url := (
        SELECT decrypted_secret
        FROM vault.decrypted_secrets
        WHERE name = 'bulk_email_project_url'
        LIMIT 1
      ) || '/functions/v1/process-email-campaigns',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-email-worker-token', (
          SELECT decrypted_secret
          FROM vault.decrypted_secrets
          WHERE name = 'bulk_email_worker_token'
          LIMIT 1
        )
      ),
      body := jsonb_build_object('source', 'cron', 'requested_at', now()),
      timeout_milliseconds := 10000
    );
  $command$;

  SELECT cron.schedule(
    'bulk-email-dispatcher',
    '* * * * *',
    v_command
  ) INTO v_job_id;

  RETURN jsonb_build_object(
    'configured', TRUE,
    'job_id', v_job_id,
    'schedule', '* * * * *',
    'project_url', v_project_url
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.unsubscribe_email_recipient(p_token UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT;
  v_email_normalized TEXT;
  v_campaign_id UUID;
BEGIN
  SELECT email, email_normalized
  INTO v_email, v_email_normalized
  FROM public.email_recipients
  WHERE unsubscribe_token = p_token
  LIMIT 1;

  IF v_email_normalized IS NULL THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.email_suppressions (email_normalized, email, reason, source)
  VALUES (v_email_normalized, v_email, 'unsubscribe', 'public_link')
  ON CONFLICT (email_normalized) DO NOTHING;

  UPDATE public.email_recipients
  SET status = 'unsubscribed', unsubscribed_at = COALESCE(unsubscribed_at, now())
  WHERE email_normalized = v_email_normalized;

  FOR v_campaign_id IN
    UPDATE public.email_campaign_deliveries
    SET
      status = 'skipped',
      last_error = 'Destinatario solicitou descadastro.',
      locked_at = NULL,
      locked_by = NULL
    WHERE email_normalized = v_email_normalized
      AND status = 'queued'
    RETURNING campaign_id
  LOOP
    PERFORM public.refresh_email_campaign_counters(v_campaign_id);
  END LOOP;

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.set_bulk_email_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.refresh_email_campaign_counters(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.schedule_email_campaign(UUID, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pause_email_campaign(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.resume_email_campaign(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cancel_email_campaign(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_due_email_campaign_batch(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finalize_email_campaign_batch(UUID, UUID, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.block_email_campaign_batch(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.verify_bulk_email_worker_token(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.configure_bulk_email_worker(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.unsubscribe_email_recipient(UUID) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.schedule_email_campaign(UUID, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pause_email_campaign(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resume_email_campaign(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_email_campaign(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unsubscribe_email_recipient(UUID) TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.refresh_email_campaign_counters(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_due_email_campaign_batch(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.finalize_email_campaign_batch(UUID, UUID, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.block_email_campaign_batch(UUID, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.verify_bulk_email_worker_token(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.configure_bulk_email_worker(TEXT) TO service_role;

COMMENT ON TABLE public.email_recipient_lists IS
  'Listas administrativas de destinatarios para campanhas de email.';
COMMENT ON TABLE public.email_campaigns IS
  'Campanhas com conteudo HTML e cadencia de processamento em lotes.';
COMMENT ON TABLE public.email_campaign_deliveries IS
  'Snapshot e trilha individual de entrega de cada campanha.';
COMMENT ON FUNCTION public.configure_bulk_email_worker(TEXT) IS
  'Configura no Vault o token interno e agenda a Edge Function process-email-campaigns a cada minuto.';
