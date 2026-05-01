CREATE OR REPLACE FUNCTION public.save_equipment_qr_checklist(
  p_token UUID,
  p_checklist_snapshot JSONB
)
RETURNS TABLE (
  equipment_type TEXT,
  equipment_id UUID,
  empresa_id UUID,
  checklist_snapshot JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_equipment_type TEXT;
  v_equipment_id UUID;
  v_empresa_id UUID;
  v_inspection_code TEXT;
  v_inspection_name TEXT;
  v_equipment_title TEXT;
  v_equipment_number TEXT;
  v_localizacao TEXT;
  v_source_label TEXT;
  v_relatorio_ciclo_id UUID;
  v_snapshot JSONB := COALESCE(p_checklist_snapshot, '{}'::jsonb);
  v_source_table TEXT;
  v_non_conforming_message TEXT;
BEGIN
  IF auth.role() <> 'authenticated' OR auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuario autenticado nao encontrado.';
  END IF;

  SELECT
    'extintor',
    extintor.id,
    extintor.empresa_id,
    extintor.numero,
    extintor.localizacao
  INTO
    v_equipment_type,
    v_equipment_id,
    v_empresa_id,
    v_equipment_number,
    v_localizacao
  FROM public.empresa_extintores AS extintor
  WHERE extintor.public_token = p_token;

  IF FOUND THEN
    v_inspection_code := 'A.23';
    v_inspection_name := 'Checklist de extintor';
    v_equipment_title := 'Extintor';
    v_source_table := 'empresa_extintores';
    v_non_conforming_message :=
      'Nao conformidade identificada em ao menos um extintor.';
  ELSE
    SELECT
      'hidrante',
      hidrante.id,
      hidrante.empresa_id,
      hidrante.numero,
      hidrante.localizacao
    INTO
      v_equipment_type,
      v_equipment_id,
      v_empresa_id,
      v_equipment_number,
      v_localizacao
    FROM public.empresa_hidrantes AS hidrante
    WHERE hidrante.public_token = p_token;

    IF FOUND THEN
      v_inspection_code := 'A.25';
      v_inspection_name := 'Checklist de hidrante';
      v_equipment_title := 'Hidrante';
      v_source_table := 'empresa_hidrantes';
      v_non_conforming_message :=
        'Nao conformidade identificada em ao menos um hidrante.';
    ELSE
      SELECT
        'luminaria',
        luminaria.id,
        luminaria.empresa_id,
        luminaria.numero,
        luminaria.localizacao
      INTO
        v_equipment_type,
        v_equipment_id,
        v_empresa_id,
        v_equipment_number,
        v_localizacao
      FROM public.empresa_luminarias AS luminaria
      WHERE luminaria.public_token = p_token;

      IF FOUND THEN
        v_inspection_code := 'A.19';
        v_inspection_name := 'Checklist de luminaria';
        v_equipment_title := 'Luminaria';
        v_source_table := 'empresa_luminarias';
        v_non_conforming_message :=
          'Nao conformidade identificada em ao menos uma luminaria.';
      ELSE
        RAISE EXCEPTION 'Equipamento nao encontrado para o token informado.';
      END IF;
    END IF;
  END IF;

  PERFORM public.ensure_empresa_membership_bootstrap(v_empresa_id);

  IF NOT public.can_access_empresa(v_empresa_id) THEN
    RAISE EXCEPTION 'Acesso negado para a empresa informada.';
  END IF;

  IF NOT public.can_execute_empresa_checklists(v_empresa_id) THEN
    RAISE EXCEPTION 'Seu usuario nao esta liberado para executar checklists desta empresa.';
  END IF;

  SELECT ciclo.id
  INTO v_relatorio_ciclo_id
  FROM public.get_or_create_active_report_cycle(v_empresa_id) AS ciclo
  LIMIT 1;

  IF v_relatorio_ciclo_id IS NULL THEN
    RAISE EXCEPTION 'Nao foi possivel resolver o ciclo ativo do relatorio.';
  END IF;

  IF v_equipment_type = 'extintor' THEN
    UPDATE public.empresa_extintores
    SET checklist_snapshot = v_snapshot
    WHERE id = v_equipment_id;
  ELSIF v_equipment_type = 'hidrante' THEN
    UPDATE public.empresa_hidrantes
    SET checklist_snapshot = v_snapshot
    WHERE id = v_equipment_id;
  ELSE
    UPDATE public.empresa_luminarias
    SET checklist_snapshot = v_snapshot
    WHERE id = v_equipment_id;
  END IF;

  EXECUTE format(
    $sql$
      WITH equipment_items AS (
        SELECT
          item->>'checklist_item_id' AS checklist_item_id,
          item->>'status' AS status,
          NULLIF(BTRIM(item->>'preenchido_por_nome'), '') AS preenchido_por_nome,
          NULLIF(BTRIM(item->>'preenchido_por_user_id'), '') AS preenchido_por_user_id,
          CASE
            WHEN NULLIF(BTRIM(item->>'preenchido_em'), '') IS NULL THEN NULL
            ELSE (item->>'preenchido_em')::timestamptz
          END AS preenchido_em
        FROM public.%I AS equipamento
        CROSS JOIN LATERAL jsonb_array_elements(
          COALESCE(equipamento.checklist_snapshot->'items', '[]'::jsonb)
        ) AS item
        WHERE equipamento.empresa_id = $1
          AND NULLIF(BTRIM(item->>'checklist_item_id'), '') IS NOT NULL
      ),
      target_item_ids AS (
        SELECT DISTINCT checklist_item_id::uuid AS checklist_item_id
        FROM equipment_items
      ),
      latest_audit AS (
        SELECT DISTINCT ON (checklist_item_id)
          checklist_item_id::uuid AS checklist_item_id,
          preenchido_por_nome,
          CASE
            WHEN preenchido_por_user_id IS NULL THEN NULL
            ELSE preenchido_por_user_id::uuid
          END AS preenchido_por_user_id,
          preenchido_em
        FROM equipment_items
        WHERE
          preenchido_por_nome IS NOT NULL OR
          preenchido_por_user_id IS NOT NULL OR
          preenchido_em IS NOT NULL
        ORDER BY checklist_item_id, preenchido_em DESC NULLS LAST
      ),
      aggregated AS (
        SELECT
          checklist_item_id::uuid AS checklist_item_id,
          CASE
            WHEN bool_or(status = 'NC') THEN 'NC'
            WHEN count(*) > 0 AND bool_and(status = 'NA') THEN 'NA'
            WHEN bool_or(status = 'C') THEN 'C'
            ELSE NULL
          END AS status,
          CASE
            WHEN bool_or(status = 'NC') THEN $3
            ELSE NULL
          END AS observacoes
        FROM equipment_items
        GROUP BY checklist_item_id
      ),
      deleted AS (
        DELETE FROM public.empresa_checklist_respostas AS resposta
        WHERE resposta.empresa_id = $1
          AND resposta.relatorio_ciclo_id = $2
          AND resposta.checklist_item_id IN (
            SELECT checklist_item_id
            FROM target_item_ids
          )
        RETURNING resposta.checklist_item_id
      )
      INSERT INTO public.empresa_checklist_respostas (
        empresa_id,
        relatorio_ciclo_id,
        checklist_item_id,
        status,
        observacoes,
        preenchido_por_nome,
        preenchido_por_user_id,
        preenchido_em
      )
      SELECT
        $1,
        $2,
        aggregated.checklist_item_id,
        aggregated.status,
        aggregated.observacoes,
        latest_audit.preenchido_por_nome,
        latest_audit.preenchido_por_user_id,
        latest_audit.preenchido_em
      FROM aggregated
      LEFT JOIN latest_audit
        USING (checklist_item_id)
      WHERE aggregated.status IS NOT NULL
      ON CONFLICT ON CONSTRAINT empresa_checklist_respostas_empresa_id_relatorio_ciclo_id_checklist_item_id_key
      DO UPDATE
        SET status = EXCLUDED.status,
            observacoes = EXCLUDED.observacoes,
            preenchido_por_nome = EXCLUDED.preenchido_por_nome,
            preenchido_por_user_id = EXCLUDED.preenchido_por_user_id,
            preenchido_em = EXCLUDED.preenchido_em,
            updated_at = now();
    $sql$,
    v_source_table
  )
  USING v_empresa_id, v_relatorio_ciclo_id, v_non_conforming_message;

  v_source_label := CONCAT_WS(
    ' | ',
    NULLIF(BTRIM(CONCAT(v_equipment_title, ' ', COALESCE(v_equipment_number, ''))), ''),
    NULLIF(BTRIM(COALESCE(v_localizacao, '')), '')
  );

  PERFORM 1
  FROM public.register_checklist_execution(
    v_empresa_id,
    v_inspection_code,
    v_inspection_name,
    'equipamento',
    v_equipment_type,
    v_equipment_id,
    NULLIF(BTRIM(COALESCE(v_source_label, '')), '')
  );

  RETURN QUERY
  SELECT
    v_equipment_type,
    v_equipment_id,
    v_empresa_id,
    v_snapshot;
END;
$$;

REVOKE ALL ON FUNCTION public.save_equipment_qr_checklist(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_equipment_qr_checklist(UUID, JSONB) TO authenticated;
