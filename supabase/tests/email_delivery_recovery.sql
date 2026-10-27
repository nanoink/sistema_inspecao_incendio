-- Only fictional addresses. No worker or SMTP invocation. Always rolls back.
BEGIN;
SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000001","email":"firetetraedro@gmail.com"}', true);
DO $$
DECLARE
  v_list UUID;
  v_campaign UUID;
  v_worker UUID := gen_random_uuid();
  v_delivery UUID;
  v_row public.email_campaigns;
BEGIN
  INSERT INTO public.email_recipient_lists(name) VALUES ('Recovery test ' || gen_random_uuid()) RETURNING id INTO v_list;
  INSERT INTO public.email_campaigns(name,subject,html_body,recipient_list_id,status)
    VALUES ('Test only','No sending','<p>Test</p>',v_list,'running') RETURNING id INTO v_campaign;
  INSERT INTO public.email_campaign_deliveries(campaign_id,recipient_email,email_normalized,unsubscribe_token,status,locked_by,locked_at,attempt_count)
    SELECT v_campaign, n || '@example.invalid', n || '@example.invalid',gen_random_uuid(),'processing',v_worker,
      CASE WHEN n='stale' THEN now()-interval '1 hour' ELSE now() END, 1
    FROM unnest(ARRAY['stale','live','unstarted']) n;

  PERFORM public.recover_interrupted_email_deliveries();
  ASSERT (SELECT status='uncertain' FROM public.email_campaign_deliveries WHERE campaign_id=v_campaign AND recipient_email='stale@example.invalid'), 'Stale outcome must be uncertain, never queued.';
  ASSERT (SELECT count(*)=2 FROM public.email_campaign_deliveries WHERE campaign_id=v_campaign AND status='processing'), 'Live worker was touched.';
  SELECT * INTO v_row FROM public.email_campaigns WHERE id=v_campaign;
  ASSERT v_row.status='blocked' AND v_row.uncertain_count=1 AND v_row.next_batch_at IS NULL, 'Campaign not safely quarantined.';
  BEGIN
    PERFORM public.resume_email_campaign(v_campaign);
    RAISE EXCEPTION 'Unsafe resume was accepted.';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM='Unsafe resume was accepted.' THEN RAISE; END IF;
  END;

  SELECT id INTO v_delivery FROM public.email_campaign_deliveries WHERE campaign_id=v_campaign AND recipient_email='live@example.invalid';
  PERFORM public.finalize_email_campaign_batch(v_worker,v_campaign,jsonb_build_array(jsonb_build_object('delivery_id',v_delivery,'status','sent','provider_message_id','local-test-id')));
  ASSERT (SELECT status='sent' AND provider_message_id='local-test-id' FROM public.email_campaign_deliveries WHERE id=v_delivery), 'Single-delivery checkpoint failed.';

  SELECT id INTO v_delivery FROM public.email_campaign_deliveries WHERE campaign_id=v_campaign AND recipient_email='unstarted@example.invalid';
  PERFORM public.halt_email_campaign_batch(v_worker,v_campaign,ARRAY[v_delivery],NULL,FALSE);
  ASSERT (SELECT status='queued' AND locked_by IS NULL AND attempt_count=0 FROM public.email_campaign_deliveries WHERE id=v_delivery), 'Unstarted tail not released safely.';
  ASSERT (SELECT status='uncertain' FROM public.email_campaign_deliveries WHERE campaign_id=v_campaign AND recipient_email='stale@example.invalid'), 'Uncertain message was requeued.';
  ASSERT NOT has_function_privilege('authenticated','public.recover_interrupted_email_deliveries()','EXECUTE'), 'Recovery RPC exposed.';
  ASSERT NOT has_function_privilege('anon','public.halt_email_campaign_batch(uuid,uuid,uuid[],text,boolean)','EXECUTE'), 'Halt RPC exposed.';
  ASSERT (SELECT status='blocked' AND sent_count=1 AND uncertain_count=1 FROM public.email_campaigns WHERE id=v_campaign), 'Counters lost the uncertain outcome.';
END;
$$;
ROLLBACK;
SELECT 'Recovery, checkpoints, no duplicate retry and worker permissions passed' AS result;
