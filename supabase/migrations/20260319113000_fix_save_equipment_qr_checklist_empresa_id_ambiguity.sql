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
  v_snapshot JSONB := COALESCE(p_checklist_snapshot, '{}'::jsonb);
BEGIN
  UPDATE public.empresa_extintores AS extintor
  SET checklist_snapshot = v_snapshot
  WHERE extintor.public_token = p_token
  RETURNING extintor.id, extintor.empresa_id
  INTO v_equipment_id, v_empresa_id;

  IF FOUND THEN
    v_equipment_type := 'extintor';
    v_inspection_code := 'A.23';
  ELSE
    UPDATE public.empresa_hidrantes AS hidrante
    SET checklist_snapshot = v_snapshot
    WHERE hidrante.public_token = p_token
    RETURNING hidrante.id, hidrante.empresa_id
    INTO v_equipment_id, v_empresa_id;

    IF FOUND THEN
      v_equipment_type := 'hidrante';
      v_inspection_code := 'A.25';
    ELSE
      RAISE EXCEPTION 'Equipamento nao encontrado para o token informado.';
    END IF;
  END IF;

  DELETE FROM public.empresa_checklist_respostas AS resposta
  WHERE resposta.empresa_id = v_empresa_id
    AND resposta.checklist_item_id IN (
      SELECT item.id
      FROM public.checklist_itens_modelo AS item
      INNER JOIN public.checklist_grupos AS grupo
        ON grupo.id = item.grupo_id
      INNER JOIN public.checklist_modelos AS modelo
        ON modelo.id = grupo.modelo_id
      WHERE modelo.codigo = v_inspection_code
        AND item.avaliavel = true
    );

  IF v_equipment_type = 'extintor' THEN
    INSERT INTO public.empresa_checklist_respostas (
      empresa_id,
      checklist_item_id,
      status,
      observacoes
    )
    SELECT
      v_empresa_id,
      aggregated.checklist_item_id::UUID,
      aggregated.status,
      aggregated.observacoes
    FROM (
      SELECT
        item->>'checklist_item_id' AS checklist_item_id,
        CASE
          WHEN bool_or(item->>'status' = 'NC') THEN 'NC'
          WHEN count(*) > 0 AND bool_and(item->>'status' = 'NA') THEN 'NA'
          WHEN bool_or(item->>'status' = 'C') THEN 'C'
          ELSE NULL
        END AS status,
        CASE
          WHEN bool_or(item->>'status' = 'NC')
            THEN 'Nao conformidade identificada em ao menos um extintor.'
          ELSE NULL
        END AS observacoes
      FROM public.empresa_extintores AS equipamento
      CROSS JOIN LATERAL jsonb_array_elements(
        COALESCE(equipamento.checklist_snapshot->'items', '[]'::jsonb)
      ) AS item
      WHERE equipamento.empresa_id = v_empresa_id
      GROUP BY item->>'checklist_item_id'
    ) AS aggregated
    WHERE aggregated.checklist_item_id IS NOT NULL
      AND aggregated.checklist_item_id <> ''
      AND aggregated.status IS NOT NULL
    ON CONFLICT ON CONSTRAINT empresa_checklist_respostas_empresa_id_checklist_item_id_key
    DO UPDATE
      SET status = EXCLUDED.status,
          observacoes = EXCLUDED.observacoes,
          updated_at = now();
  ELSE
    INSERT INTO public.empresa_checklist_respostas (
      empresa_id,
      checklist_item_id,
      status,
      observacoes
    )
    SELECT
      v_empresa_id,
      aggregated.checklist_item_id::UUID,
      aggregated.status,
      aggregated.observacoes
    FROM (
      SELECT
        item->>'checklist_item_id' AS checklist_item_id,
        CASE
          WHEN bool_or(item->>'status' = 'NC') THEN 'NC'
          WHEN count(*) > 0 AND bool_and(item->>'status' = 'NA') THEN 'NA'
          WHEN bool_or(item->>'status' = 'C') THEN 'C'
          ELSE NULL
        END AS status,
        CASE
          WHEN bool_or(item->>'status' = 'NC')
            THEN 'Nao conformidade identificada em ao menos um hidrante.'
          ELSE NULL
        END AS observacoes
      FROM public.empresa_hidrantes AS equipamento
      CROSS JOIN LATERAL jsonb_array_elements(
        COALESCE(equipamento.checklist_snapshot->'items', '[]'::jsonb)
      ) AS item
      WHERE equipamento.empresa_id = v_empresa_id
      GROUP BY item->>'checklist_item_id'
    ) AS aggregated
    WHERE aggregated.checklist_item_id IS NOT NULL
      AND aggregated.checklist_item_id <> ''
      AND aggregated.status IS NOT NULL
    ON CONFLICT ON CONSTRAINT empresa_checklist_respostas_empresa_id_checklist_item_id_key
    DO UPDATE
      SET status = EXCLUDED.status,
          observacoes = EXCLUDED.observacoes,
          updated_at = now();
  END IF;

  RETURN QUERY
  SELECT
    v_equipment_type,
    v_equipment_id,
    v_empresa_id,
    v_snapshot;
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_equipment_qr_checklist(UUID, JSONB)
TO authenticated;
