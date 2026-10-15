-- Exercita a fila e as permissões sem enviar mensagens e sem manter dados.
BEGIN;

SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000001","email":"firetetraedro@gmail.com"}', true);

DO $$
DECLARE
  v_list_id UUID;
  v_campaign_id UUID;
  v_worker_id UUID := gen_random_uuid();
  v_token UUID;
  v_batch RECORD;
  v_count INTEGER;
  v_campaign public.email_campaigns;
BEGIN
  INSERT INTO public.email_recipient_lists(name)
  VALUES ('Teste transacional ' || gen_random_uuid()::TEXT)
  RETURNING id INTO v_list_id;

  INSERT INTO public.email_recipients(list_id, email, name)
  VALUES
    (v_list_id, 'primeiro-' || v_list_id || '@example.invalid', 'Primeiro'),
    (v_list_id, 'segundo-' || v_list_id || '@example.invalid', 'Segundo'),
    (v_list_id, 'terceiro-' || v_list_id || '@example.invalid', 'Terceiro');

  INSERT INTO public.email_campaigns(name, subject, html_body, recipient_list_id, batch_size, interval_minutes)
  VALUES ('Teste de fila', 'Teste sem envio', '<p>Teste</p>', v_list_id, 1, 10)
  RETURNING id INTO v_campaign_id;

  v_campaign := public.schedule_email_campaign(v_campaign_id, now());
  ASSERT v_campaign.total_recipients = 3, 'Snapshot incorreto.';

  SELECT * INTO v_batch FROM public.claim_due_email_campaign_batch(v_worker_id);
  ASSERT v_batch.campaign_id = v_campaign_id, 'Campanha não reservada.';
  SELECT count(*) INTO v_count FROM public.email_campaign_deliveries WHERE campaign_id = v_campaign_id AND status = 'processing';
  ASSERT v_count = 1, 'Tamanho do lote não respeitado.';

  v_campaign := public.finalize_email_campaign_batch(v_worker_id, v_campaign_id,
    jsonb_build_array(jsonb_build_object('delivery_id', v_batch.delivery_id, 'status', 'sent', 'provider_message_id', 'teste-sem-envio')));
  ASSERT v_campaign.sent_count = 1, 'Contador de enviados incorreto.';
  SELECT count(*) INTO v_count FROM public.claim_due_email_campaign_batch(v_worker_id);
  ASSERT v_count = 0, 'Intervalo entre lotes não respeitado.';

  v_campaign := public.pause_email_campaign(v_campaign_id);
  ASSERT v_campaign.status = 'paused' AND v_campaign.next_batch_at IS NULL, 'Falha ao pausar.';
  v_campaign := public.resume_email_campaign(v_campaign_id);
  SELECT * INTO v_batch FROM public.claim_due_email_campaign_batch(v_worker_id);
  ASSERT v_batch.delivery_id IS NOT NULL, 'Falha ao retomar.';

  v_campaign := public.block_email_campaign_batch(v_worker_id, v_campaign_id, 'Teste de indisponibilidade');
  ASSERT v_campaign.status = 'blocked', 'Falha ao bloquear transporte.';
  SELECT count(*) INTO v_count FROM public.email_campaign_deliveries WHERE campaign_id = v_campaign_id AND status = 'processing';
  ASSERT v_count = 0, 'Bloqueio deixou entregas reservadas.';

  v_campaign := public.resume_email_campaign(v_campaign_id);
  SELECT * INTO v_batch FROM public.claim_due_email_campaign_batch(v_worker_id);
  SELECT unsubscribe_token INTO v_token FROM public.email_campaign_deliveries
    WHERE campaign_id = v_campaign_id AND status = 'queued' LIMIT 1;
  ASSERT public.unsubscribe_email_recipient(v_token), 'Descadastro não confirmado.';
  ASSERT public.unsubscribe_email_recipient(v_token), 'Descadastro deve ser idempotente.';

  v_campaign := public.finalize_email_campaign_batch(v_worker_id, v_campaign_id,
    jsonb_build_array(jsonb_build_object('delivery_id', v_batch.delivery_id, 'status', 'sent')));
  ASSERT v_campaign.status = 'completed', 'Campanha não concluída.';
  ASSERT v_campaign.sent_count = 2 AND v_campaign.skipped_count = 1, 'Contadores finais incorretos.';
  ASSERT v_campaign.next_batch_at IS NULL, 'Campanha concluída ainda possui próximo lote.';
  ASSERT NOT has_function_privilege('authenticated', 'public.claim_due_email_campaign_batch(uuid)', 'EXECUTE'), 'Usuário comum pode executar o worker.';
  ASSERT NOT has_function_privilege('anon', 'public.configure_bulk_email_worker(text)', 'EXECUTE'), 'Anônimo pode configurar o cron.';
END;
$$;

SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000002","email":"usuario@example.invalid"}', true);
SET LOCAL ROLE authenticated;

DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT count(*) INTO v_count FROM public.email_campaigns;
  ASSERT v_count = 0, 'RLS expôs campanhas a usuário comum.';
  SELECT count(*) INTO v_count FROM public.email_recipients;
  ASSERT v_count = 0, 'RLS expôs destinatários a usuário comum.';
  BEGIN
    INSERT INTO public.email_recipient_lists(name) VALUES ('Inserção não autorizada');
    RAISE EXCEPTION 'RLS permitiu escrita não autorizada.';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END;
$$;

RESET ROLE;
ROLLBACK;
SELECT 'Fila, intervalo, pausa, retomada, bloqueio, descadastro e RLS validados sem envio' AS result;
