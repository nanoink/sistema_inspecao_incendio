-- Empresa fictícia, criada e removida por ROLLBACK na mesma transação.
-- Nunca finalizar, reiniciar ou alterar ciclos de empresas reais neste teste.
BEGIN;
SELECT set_config('request.jwt.claims', (
  SELECT jsonb_build_object('sub',id,'email',email,'role','authenticated')::text
  FROM auth.users WHERE lower(email)='firetetraedro@gmail.com' LIMIT 1
), true);
SET LOCAL ROLE authenticated;

DO $test$
DECLARE
  company_id uuid := gen_random_uuid();
  cycle_id uuid;
  editable_id uuid;
  next_id uuid;
  item_id uuid;
  equipment_id uuid := gen_random_uuid();
  equipment_token uuid := gen_random_uuid();
  report_snapshot jsonb := '{"generated_at":"2026-10-19T12:00:00.000Z","inspections":[],"overall":{"total":1,"conforme":1},"non_conformities":[]}';
  additional_data jsonb := '{"report_mode":"operacional","report_attachments":[{"id":"fixture-evidence","fileName":"evidencia.pdf"}]}';
  equipment_snapshot jsonb;
BEGIN
  IF NOT public.is_system_admin() THEN RAISE EXCEPTION 'Administrador de teste indisponivel'; END IF;
  INSERT INTO public.empresa(id,razao_social,cnpj,responsavel,email,telefone,cep,rua,numero,bairro,cidade,estado,area_m2,numero_ocupantes)
  VALUES(company_id,'[TESTE TRANSACIONAL] Preservacao ao finalizar',company_id::text,
    'Teste','fixture@example.invalid','0000000000','00000-000','Rua de teste','0','Teste','Teste','PA',100,1);
  SELECT id INTO cycle_id FROM public.get_or_create_active_report_cycle(company_id);
  additional_data := additional_data || jsonb_build_object('report_cycle_id', cycle_id);
  SELECT item.id INTO item_id FROM public.checklist_itens_modelo item
    JOIN public.checklist_grupos grupo ON grupo.id=item.grupo_id
    JOIN public.checklist_modelos modelo ON modelo.id=grupo.modelo_id
    WHERE modelo.codigo='A.23' AND item.avaliavel=true ORDER BY item.ordem LIMIT 1;
  IF item_id IS NULL THEN RAISE EXCEPTION 'Modelo de checklist de extintor indisponivel'; END IF;

  equipment_snapshot := jsonb_build_object('inspection_code','A.23','inspection_name','Extintor',
    'generated_at',clock_timestamp(),'items',jsonb_build_array(jsonb_build_object(
      'checklist_item_id',item_id,'item_numero','1','item_exibicao','1','secao','Teste',
      'descricao','Inspecao de teste','status','C','preenchido_por_nome','Teste',
      'preenchido_por_user_id',auth.uid(),'preenchido_em',clock_timestamp(),
      'localizacao',jsonb_build_object('latitude',-1.4,'longitude',-48.5,'accuracy_m',10,'captured_at','2026-10-19T12:00:00.000Z'))));
  INSERT INTO public.empresa_extintores(id,empresa_id,numero,localizacao,tipo,carga_nominal,
    vencimento_carga,vencimento_teste_hidrostatico_ano,public_token,checklist_snapshot)
    VALUES(equipment_id,company_id,'T-1','Area de teste','Agua Pressurizada','10 L',
      '2030-12-01',2030,equipment_token,equipment_snapshot);
  PERFORM 1 FROM public.save_equipment_qr_checklist(equipment_token,equipment_snapshot);
  INSERT INTO public.empresa_relatorios(empresa_id,relatorio_ciclo_id,titulo,status,checklist_snapshot,dados_adicionais)
    VALUES(company_id,cycle_id,'Relatorio de teste','rascunho',report_snapshot,additional_data)
    ON CONFLICT(empresa_id,relatorio_ciclo_id) DO UPDATE SET
      checklist_snapshot=EXCLUDED.checklist_snapshot,dados_adicionais=EXCLUDED.dados_adicionais;
  IF (SELECT count(*) FROM public.empresa_checklist_respostas WHERE empresa_id=company_id)<>1 THEN
    RAISE EXCEPTION 'Fixture de resposta nao foi gravada';
  END IF;

  -- O mesmo UPDATE efetuado pelo botão Finalizar relatório operacional.
  UPDATE public.empresa_relatorios SET status='finalizado'
    WHERE empresa_id=company_id AND relatorio_ciclo_id=cycle_id;
  SELECT id INTO editable_id FROM public.get_or_create_editable_report_cycle(company_id);
  IF editable_id IS DISTINCT FROM cycle_id OR
    (SELECT count(*) FROM public.empresa_relatorio_ciclos WHERE empresa_id=company_id)<>1 THEN
    RAISE EXCEPTION 'REGRESSAO: finalizar e voltar a gravar abriu outro ciclo automaticamente';
  END IF;

  -- Gravações de autoria e de QR depois da finalização não podem trocar de ciclo.
  PERFORM 1 FROM public.register_checklist_execution(company_id,'A.23','Extintor','principal');
  PERFORM 1 FROM public.save_equipment_qr_checklist(equipment_token,equipment_snapshot);
  SELECT id INTO editable_id FROM public.get_or_create_editable_report_cycle(company_id);
  IF editable_id IS DISTINCT FROM cycle_id OR
    (SELECT count(*) FROM public.empresa_relatorio_ciclos WHERE empresa_id=company_id)<>1 THEN
    RAISE EXCEPTION 'Gravar checklist apos finalizar trocou o ciclo ativo';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.empresa_checklist_respostas
    WHERE empresa_id=company_id AND relatorio_ciclo_id=cycle_id AND checklist_item_id=item_id
      AND status='C' AND localizacao IS NOT NULL) THEN
    RAISE EXCEPTION 'As respostas ou coordenadas foram perdidas apos finalizar';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.empresa_extintores
    WHERE id=equipment_id AND checklist_snapshot=equipment_snapshot) THEN
    RAISE EXCEPTION 'O cadastro ou snapshot do equipamento foi alterado';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.empresa_relatorios
    WHERE empresa_id=company_id AND relatorio_ciclo_id=cycle_id AND status='finalizado'
      AND checklist_snapshot=report_snapshot AND dados_adicionais=additional_data) THEN
    RAISE EXCEPTION 'O relatorio finalizado, seus anexos ou snapshot foram alterados';
  END IF;

  -- Apenas a ação explícita de novo ciclo pode criar a próxima rodada.
  SELECT id INTO next_id FROM public.start_new_report_cycle(company_id,'Novo ciclo confirmado no teste');
  IF next_id=cycle_id OR
    (SELECT count(*) FROM public.empresa_relatorio_ciclos WHERE empresa_id=company_id)<>2 OR
    NOT EXISTS(SELECT 1 FROM public.empresa_checklist_respostas WHERE empresa_id=company_id AND relatorio_ciclo_id=cycle_id) OR
    NOT EXISTS(SELECT 1 FROM public.empresa_relatorios WHERE empresa_id=company_id AND relatorio_ciclo_id=cycle_id AND status='finalizado') THEN
    RAISE EXCEPTION 'A troca explicita de ciclo nao preservou o historico';
  END IF;
END;
$test$;
ROLLBACK;
