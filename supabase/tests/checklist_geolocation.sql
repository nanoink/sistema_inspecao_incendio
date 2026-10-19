-- Teste transacional: nenhuma inspeção ou coordenada de teste é mantida no banco.
BEGIN;

SELECT set_config('request.jwt.claims', (
  SELECT jsonb_build_object('sub',id,'email',email,'role','authenticated')::text
  FROM auth.users WHERE lower(email)='firetetraedro@gmail.com' LIMIT 1
), true);
SET LOCAL ROLE authenticated;

DO $verification$
DECLARE
  v_token uuid;
  v_company_id uuid;
  v_snapshot jsonb;
  v_item_id uuid;
  v_location jsonb := '{"latitude":-1.455833,"longitude":-48.503889,"accuracy_m":8.4,"captured_at":"2026-10-19T14:30:00.000Z"}';
BEGIN
  IF NOT public.is_system_admin() THEN RAISE EXCEPTION 'Administrador de teste indisponivel'; END IF;
  IF NOT public.is_valid_checklist_location(v_location) OR
    public.is_valid_checklist_location(v_location || '{"latitude":91}') OR
    public.is_valid_checklist_location(v_location || '{"longitude":-181}') OR
    public.is_valid_checklist_location(v_location || '{"accuracy_m":-1}') OR
    public.is_valid_checklist_location(v_location || '{"latitude":"-1.4"}') OR
    public.is_valid_checklist_location(v_location || '{"captured_at":"invalid"}') OR
    public.is_valid_checklist_location('null'::jsonb) THEN
    RAISE EXCEPTION 'Validacao de coordenadas incorreta';
  END IF;

  SELECT public_token, empresa_id, checklist_snapshot
  INTO v_token, v_company_id, v_snapshot FROM public.empresa_extintores
  WHERE public_token IS NOT NULL AND jsonb_typeof(checklist_snapshot->'items')='array'
    AND jsonb_array_length(checklist_snapshot->'items') > 0 LIMIT 1;
  IF v_token IS NULL THEN RAISE EXCEPTION 'Fixture: nenhum checklist de extintor disponivel'; END IF;
  v_item_id := (v_snapshot->'items'->0->>'checklist_item_id')::uuid;
  v_snapshot := jsonb_set(v_snapshot, '{items,0,status}', '"C"');
  v_snapshot := jsonb_set(v_snapshot, '{items,0,preenchido_por_user_id}', to_jsonb(auth.uid()::text));
  v_snapshot := jsonb_set(v_snapshot, '{items,0,preenchido_por_nome}', '"Verificacao transacional"');
  v_snapshot := jsonb_set(v_snapshot, '{items,0,preenchido_em}', to_jsonb((clock_timestamp()+interval '1 minute')::text));
  v_snapshot := jsonb_set(v_snapshot, '{items,0,localizacao}', v_location);

  PERFORM 1 FROM public.save_equipment_qr_checklist(v_token, v_snapshot);
  IF NOT EXISTS(SELECT 1 FROM public.empresa_checklist_respostas
    WHERE empresa_id=v_company_id AND checklist_item_id=v_item_id AND localizacao=v_location) THEN
    RAISE EXCEPTION 'A localizacao do QR nao foi preservada na resposta consolidada';
  END IF;

  BEGIN
    UPDATE public.empresa_checklist_respostas SET localizacao=v_location || '{"latitude":91}'
      WHERE empresa_id=v_company_id AND checklist_item_id=v_item_id;
    RAISE EXCEPTION 'A constraint aceitou coordenadas invalidas';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  UPDATE public.empresa_checklist_respostas SET localizacao=NULL
    WHERE empresa_id=v_company_id AND checklist_item_id=v_item_id;
  IF EXISTS(SELECT 1 FROM public.empresa_checklist_respostas
    WHERE empresa_id=v_company_id AND checklist_item_id=v_item_id AND localizacao IS NOT NULL) THEN
    RAISE EXCEPTION 'Nao foi possivel salvar uma resposta sem GPS';
  END IF;

  IF has_function_privilege('anon','public.save_equipment_qr_checklist(uuid,jsonb)','EXECUTE') THEN
    RAISE EXCEPTION 'RPC de inspecao acessivel sem login';
  END IF;
  PERFORM set_config('request.jwt.claims','{"sub":"ffffffff-ffff-ffff-ffff-ffffffffffff","email":"other-user@example.invalid","role":"authenticated"}',true);
  IF EXISTS(SELECT 1 FROM public.empresa_checklist_respostas WHERE empresa_id=v_company_id) THEN
    RAISE EXCEPTION 'RLS permitiu acesso a inspecao de outra empresa';
  END IF;
  IF EXISTS(SELECT 1 FROM public.empresa_extintores WHERE empresa_id=v_company_id) OR
    EXISTS(SELECT 1 FROM public.empresa_hidrantes WHERE empresa_id=v_company_id) OR
    EXISTS(SELECT 1 FROM public.empresa_luminarias WHERE empresa_id=v_company_id) OR
    EXISTS(SELECT 1 FROM public.empresa_relatorios WHERE empresa_id=v_company_id) THEN
    RAISE EXCEPTION 'RLS permitiu acesso a snapshots com coordenadas de outra empresa';
  END IF;
END;
$verification$;

ROLLBACK;
