-- This outbox archives messages by IMAP. It NEVER submits mail by SMTP.
ALTER TABLE public.email_campaign_deliveries
  ADD COLUMN uol_archive_status TEXT NOT NULL DEFAULT 'not_requested'
    CHECK (uol_archive_status IN ('not_requested', 'pending', 'saved', 'error')),
  ADD COLUMN uol_archive_folder TEXT,
  ADD COLUMN uol_archived_at TIMESTAMPTZ,
  ADD COLUMN uol_archive_error TEXT;

CREATE TABLE public.email_uol_sent_copies (
  delivery_id UUID PRIMARY KEY REFERENCES public.email_campaign_deliveries(id) ON DELETE CASCADE,
  message_id TEXT NOT NULL CHECK (message_id !~ E'[\r\n]'),
  mime_message TEXT CHECK (octet_length(mime_message) <= 1048576),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'saved', 'retry')),
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_by UUID,
  locked_at TIMESTAMPTZ,
  folder TEXT,
  imap_uid TEXT,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at TIMESTAMPTZ,
  CHECK (status = 'saved' OR mime_message IS NOT NULL)
);
CREATE INDEX email_uol_sent_copies_due_idx
  ON public.email_uol_sent_copies(next_attempt_at) WHERE status IN ('queued', 'retry');
ALTER TABLE public.email_uol_sent_copies ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.email_uol_sent_copies FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.email_uol_sent_copies TO service_role;

CREATE OR REPLACE FUNCTION public.prepare_uol_sent_copy(
  p_delivery_id UUID, p_worker_id UUID, p_message_id TEXT, p_mime_message TEXT
)
RETURNS TABLE(message_id TEXT, mime_message TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.email_campaign_deliveries
    WHERE id=p_delivery_id AND status='processing' AND locked_by=p_worker_id) THEN
    RAISE EXCEPTION 'Entrega nao reservada por este worker.';
  END IF;
  INSERT INTO public.email_uol_sent_copies(delivery_id,message_id,mime_message)
  VALUES(p_delivery_id,p_message_id,p_mime_message) ON CONFLICT(delivery_id) DO NOTHING;
  UPDATE public.email_campaign_deliveries SET uol_archive_status='pending'
  WHERE id=p_delivery_id AND uol_archive_status <> 'saved';
  RETURN QUERY SELECT copy.message_id,copy.mime_message
    FROM public.email_uol_sent_copies copy WHERE copy.delivery_id=p_delivery_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_uol_sent_copies(p_worker_id UUID, p_limit INTEGER DEFAULT 5)
RETURNS TABLE(delivery_id UUID, message_id TEXT, mime_message TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.email_uol_sent_copies SET status='retry',locked_by=NULL,locked_at=NULL
  WHERE status='processing' AND locked_at < now()-INTERVAL '15 minutes';
  RETURN QUERY WITH candidates AS (
    SELECT copy.delivery_id FROM public.email_uol_sent_copies copy
    JOIN public.email_campaign_deliveries delivery ON delivery.id=copy.delivery_id
    WHERE copy.status IN ('queued','retry') AND copy.next_attempt_at<=now()
      AND delivery.status='sent' AND delivery.provider_message_id=copy.message_id
    ORDER BY copy.next_attempt_at,copy.created_at
    FOR UPDATE OF copy SKIP LOCKED LIMIT GREATEST(1,LEAST(p_limit,5))
  ), claimed AS (
    UPDATE public.email_uol_sent_copies copy SET status='processing',locked_by=p_worker_id,
      locked_at=now(),attempts=attempts+1
    FROM candidates WHERE copy.delivery_id=candidates.delivery_id
    RETURNING copy.delivery_id,copy.message_id,copy.mime_message
  ) SELECT * FROM claimed;
END;
$$;

CREATE OR REPLACE FUNCTION public.finish_uol_sent_copy(
  p_delivery_id UUID, p_worker_id UUID, p_saved BOOLEAN,
  p_folder TEXT DEFAULT NULL, p_imap_uid TEXT DEFAULT NULL, p_error TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_found UUID;
BEGIN
  UPDATE public.email_uol_sent_copies SET
    status=CASE WHEN p_saved THEN 'saved' ELSE 'retry' END,
    mime_message=CASE WHEN p_saved THEN NULL ELSE mime_message END,
    archived_at=CASE WHEN p_saved THEN now() ELSE NULL END,
    folder=p_folder,imap_uid=p_imap_uid,last_error=left(p_error,1000),
    next_attempt_at=now()+make_interval(mins=>LEAST(60,power(2,LEAST(attempts,6))::INTEGER)),
    locked_by=NULL,locked_at=NULL
  WHERE delivery_id=p_delivery_id AND locked_by=p_worker_id AND status='processing'
  RETURNING delivery_id INTO v_found;
  IF v_found IS NULL THEN RETURN FALSE; END IF;
  UPDATE public.email_campaign_deliveries SET
    uol_archive_status=CASE WHEN p_saved THEN 'saved' ELSE 'error' END,
    uol_archive_folder=p_folder,uol_archived_at=CASE WHEN p_saved THEN now() ELSE NULL END,
    uol_archive_error=left(p_error,1000)
  WHERE id=p_delivery_id;
  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.prepare_uol_sent_copy(UUID,UUID,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.claim_uol_sent_copies(UUID,INTEGER) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.finish_uol_sent_copy(UUID,UUID,BOOLEAN,TEXT,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_uol_sent_copy(UUID,UUID,TEXT,TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_uol_sent_copies(UUID,INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_uol_sent_copy(UUID,UUID,BOOLEAN,TEXT,TEXT,TEXT) TO service_role;
