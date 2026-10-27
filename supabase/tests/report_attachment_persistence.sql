BEGIN;
SELECT set_config('request.jwt.claims', (
  SELECT jsonb_build_object('sub',id,'email',email,'role','authenticated')::text
  FROM auth.users WHERE lower(email)='firetetraedro@gmail.com' LIMIT 1
), true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE
  v_company UUID := gen_random_uuid();
  v_cycle UUID;
  v_report UUID;
  v_files JSONB := '[{"id":"test-attachment","file_path":"fixture/planta.pdf","file_name":"planta.pdf","title":"Planta"}]';
  v_data JSONB;
BEGIN
  ASSERT public.is_system_admin(), 'Admin fixture missing';
  INSERT INTO public.empresa(id,razao_social,cnpj,responsavel,email,telefone,cep,rua,numero,bairro,cidade,estado,area_m2,numero_ocupantes)
  VALUES(v_company,'[TESTE TRANSACIONAL] Anexos',v_company::text,'Teste','fixture@example.invalid','0000000000','00000-000','Teste','0','Teste','Teste','PA',100,1);
  SELECT id INTO v_cycle FROM public.get_or_create_active_report_cycle(v_company);
  INSERT INTO public.empresa_relatorios(empresa_id,relatorio_ciclo_id,dados_adicionais)
    VALUES(v_company,v_cycle,jsonb_build_object('report_attachments',v_files,'art_file_path','fixture/art.pdf','custom','keep'))
  ON CONFLICT(empresa_id,relatorio_ciclo_id) DO UPDATE SET dados_adicionais=EXCLUDED.dados_adicionais
  RETURNING id INTO v_report;

  -- Exact data-loss path from the old checklist client.
  INSERT INTO public.empresa_relatorios(empresa_id,relatorio_ciclo_id,checklist_snapshot,dados_adicionais)
    VALUES(v_company,v_cycle,'{"total":10}',jsonb_build_object('report_cycle_id',v_cycle))
  ON CONFLICT(empresa_id,relatorio_ciclo_id) DO UPDATE SET
    checklist_snapshot=EXCLUDED.checklist_snapshot,dados_adicionais=EXCLUDED.dados_adicionais;
  SELECT dados_adicionais INTO v_data FROM public.empresa_relatorios WHERE id=v_report;
  ASSERT v_data->'report_attachments'=v_files, 'Checklist erased attachment references';
  ASSERT v_data->>'art_file_path'='fixture/art.pdf', 'Checklist erased ART';
  ASSERT v_data->>'custom'='keep', 'Other metadata was lost';

  UPDATE public.empresa_relatorios SET status='finalizado',dados_adicionais='{"report_mode":"operacional"}' WHERE id=v_report;
  ASSERT (SELECT dados_adicionais->'report_attachments'=v_files FROM public.empresa_relatorios WHERE id=v_report), 'Finalization erased files';
  UPDATE public.empresa_relatorios SET dados_adicionais='{"report_attachments":[]}' WHERE id=v_report;
  SELECT dados_adicionais INTO v_data FROM public.empresa_relatorios WHERE id=v_report;
  ASSERT v_data->'report_attachments'='[]'::JSONB, 'Explicit attachment removal was blocked';
  ASSERT v_data->>'art_file_path'='fixture/art.pdf', 'Removal erased unrelated ART';
END;
$$;
ROLLBACK;
SELECT 'Checklist, finalize, reload metadata and explicit removal passed; fictional data rolled back' AS result;
