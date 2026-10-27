-- Database-only fixtures. Does not contact SMTP or IMAP. Always rolls back.
BEGIN;
DO $$
DECLARE
  v_list UUID;
  v_campaign UUID;
  v_delivery UUID;
  v_worker UUID := gen_random_uuid();
  v_archive_worker UUID := gen_random_uuid();
  v_prepared RECORD;
  v_claimed RECORD;
  v_count INTEGER;
BEGIN
  INSERT INTO public.email_recipient_lists(name) VALUES('IMAP queue test '||gen_random_uuid()) RETURNING id INTO v_list;
  INSERT INTO public.email_campaigns(name,subject,html_body,recipient_list_id,status)
    VALUES('No actual mail','Fixture','<p>Fixture</p>',v_list,'blocked') RETURNING id INTO v_campaign;
  INSERT INTO public.email_campaign_deliveries(campaign_id,recipient_email,email_normalized,unsubscribe_token,status,locked_by,locked_at)
    VALUES(v_campaign,'fixture@example.invalid','fixture@example.invalid',gen_random_uuid(),'processing',v_worker,now()) RETURNING id INTO v_delivery;
  SELECT * INTO v_prepared FROM public.prepare_uol_sent_copy(v_delivery,v_worker,'fixture@example.invalid','Message-ID: <fixture@example.invalid>');
  ASSERT v_prepared.message_id='fixture@example.invalid', 'MIME not persisted before SMTP';
  SELECT * INTO v_prepared FROM public.prepare_uol_sent_copy(v_delivery,v_worker,'changed@example.invalid','changed content');
  ASSERT v_prepared.message_id='fixture@example.invalid', 'Retry changed stable Message-ID';
  ASSERT v_prepared.mime_message='Message-ID: <fixture@example.invalid>', 'Retry changed exact MIME';

  SELECT count(*) INTO v_count FROM public.claim_uol_sent_copies(v_archive_worker);
  ASSERT v_count=0, 'Unaccepted SMTP delivery was archived';
  UPDATE public.email_campaign_deliveries SET status='uncertain' WHERE id=v_delivery;
  SELECT count(*) INTO v_count FROM public.claim_uol_sent_copies(v_archive_worker);
  ASSERT v_count=0, 'Uncertain SMTP delivery was archived';
  UPDATE public.email_campaign_deliveries SET status='failed' WHERE id=v_delivery;
  SELECT count(*) INTO v_count FROM public.claim_uol_sent_copies(v_archive_worker);
  ASSERT v_count=0, 'Failed SMTP delivery was archived';
  UPDATE public.email_campaign_deliveries SET status='sent',provider_message_id='different-id',sent_at=now() WHERE id=v_delivery;
  SELECT count(*) INTO v_count FROM public.claim_uol_sent_copies(v_archive_worker);
  ASSERT v_count=0, 'Mismatched Message-ID was archived';
  UPDATE public.email_campaign_deliveries SET provider_message_id='fixture@example.invalid' WHERE id=v_delivery;
  SELECT * INTO v_claimed FROM public.claim_uol_sent_copies(v_archive_worker);
  ASSERT v_claimed.delivery_id=v_delivery, 'Accepted SMTP copy was not claimed';
  ASSERT NOT public.finish_uol_sent_copy(v_delivery,gen_random_uuid(),TRUE,'Itens Enviados','19',NULL), 'Wrong worker finished a copy';
  ASSERT public.finish_uol_sent_copy(v_delivery,v_archive_worker,FALSE,NULL,NULL,'temporary IMAP failure'), 'Retry state not saved';
  ASSERT (SELECT status='sent' AND uol_archive_status='error' FROM public.email_campaign_deliveries WHERE id=v_delivery), 'IMAP failure changed SMTP result';
  UPDATE public.email_uol_sent_copies SET next_attempt_at=now()-interval '1 minute' WHERE delivery_id=v_delivery;
  SELECT * INTO v_claimed FROM public.claim_uol_sent_copies(v_archive_worker);
  ASSERT v_claimed.message_id='fixture@example.invalid', 'Retry lost original Message-ID';
  ASSERT public.finish_uol_sent_copy(v_delivery,v_archive_worker,TRUE,'Itens Enviados','19',NULL), 'Archive success not recorded';
  ASSERT (SELECT status='sent' AND uol_archive_status='saved' AND uol_archive_folder='Itens Enviados' FROM public.email_campaign_deliveries WHERE id=v_delivery), 'Saved copy not visible in metadata';
  ASSERT (SELECT mime_message IS NULL AND status='saved' FROM public.email_uol_sent_copies WHERE delivery_id=v_delivery), 'Saved MIME body retained unnecessarily';
  SELECT count(*) INTO v_count FROM public.claim_uol_sent_copies(v_archive_worker);
  ASSERT v_count=0, 'Completed copy claimed again';
  ASSERT NOT has_table_privilege('authenticated','public.email_uol_sent_copies','SELECT'), 'Private MIME exposed';
  ASSERT NOT has_function_privilege('anon','public.claim_uol_sent_copies(uuid,integer)','EXECUTE'), 'Anonymous archive claim allowed';
  ASSERT NOT has_function_privilege('authenticated','public.prepare_uol_sent_copy(uuid,uuid,text,text)','EXECUTE'), 'Archive preparation exposed';
END;
$$;
ROLLBACK;
SELECT 'UOL outbox, SMTP gating, exact MIME, retries, isolation and privacy passed without mail' AS result;
