ALTER TABLE public.empresa_checklist_respostas
ADD COLUMN IF NOT EXISTS relatorio_ciclo_id UUID;

ALTER TABLE public.empresa_checklist_nao_conformidades
ADD COLUMN IF NOT EXISTS relatorio_ciclo_id UUID;

WITH ciclo_ativo AS (
  SELECT DISTINCT ON (ciclos.empresa_id)
    ciclos.empresa_id,
    ciclos.id AS relatorio_ciclo_id
  FROM public.empresa_relatorio_ciclos AS ciclos
  WHERE ciclos.status = 'ativo'
  ORDER BY
    ciclos.empresa_id,
    ciclos.data_abertura DESC,
    ciclos.created_at DESC
)
UPDATE public.empresa_checklist_respostas AS resposta
SET relatorio_ciclo_id = ciclo_ativo.relatorio_ciclo_id
FROM ciclo_ativo
WHERE resposta.empresa_id = ciclo_ativo.empresa_id
  AND resposta.relatorio_ciclo_id IS NULL;

WITH ciclo_ativo AS (
  SELECT DISTINCT ON (ciclos.empresa_id)
    ciclos.empresa_id,
    ciclos.id AS relatorio_ciclo_id
  FROM public.empresa_relatorio_ciclos AS ciclos
  WHERE ciclos.status = 'ativo'
  ORDER BY
    ciclos.empresa_id,
    ciclos.data_abertura DESC,
    ciclos.created_at DESC
)
UPDATE public.empresa_checklist_nao_conformidades AS nao_conformidade
SET relatorio_ciclo_id = ciclo_ativo.relatorio_ciclo_id
FROM ciclo_ativo
WHERE nao_conformidade.empresa_id = ciclo_ativo.empresa_id
  AND nao_conformidade.relatorio_ciclo_id IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'empresa_checklist_respostas_relatorio_ciclo_id_fkey'
      AND conrelid = 'public.empresa_checklist_respostas'::regclass
  ) THEN
    ALTER TABLE public.empresa_checklist_respostas
    ADD CONSTRAINT empresa_checklist_respostas_relatorio_ciclo_id_fkey
    FOREIGN KEY (relatorio_ciclo_id)
    REFERENCES public.empresa_relatorio_ciclos(id)
    ON DELETE CASCADE;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'empresa_checklist_nao_conformidades_relatorio_ciclo_id_fkey'
      AND conrelid = 'public.empresa_checklist_nao_conformidades'::regclass
  ) THEN
    ALTER TABLE public.empresa_checklist_nao_conformidades
    ADD CONSTRAINT empresa_checklist_nao_conformidades_relatorio_ciclo_id_fkey
    FOREIGN KEY (relatorio_ciclo_id)
    REFERENCES public.empresa_relatorio_ciclos(id)
    ON DELETE CASCADE;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_empresa_checklist_respostas_empresa_ciclo
ON public.empresa_checklist_respostas (empresa_id, relatorio_ciclo_id);

CREATE INDEX IF NOT EXISTS idx_empresa_checklist_nao_conformidades_empresa_ciclo
ON public.empresa_checklist_nao_conformidades (empresa_id, relatorio_ciclo_id);

ALTER TABLE public.empresa_checklist_respostas
ALTER COLUMN relatorio_ciclo_id SET NOT NULL;

ALTER TABLE public.empresa_checklist_nao_conformidades
ALTER COLUMN relatorio_ciclo_id SET NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'empresa_checklist_respostas_empresa_id_checklist_item_id_key'
      AND conrelid = 'public.empresa_checklist_respostas'::regclass
  ) THEN
    ALTER TABLE public.empresa_checklist_respostas
    DROP CONSTRAINT empresa_checklist_respostas_empresa_id_checklist_item_id_key;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'empresa_checklist_respostas_empresa_id_relatorio_ciclo_id_checklist_item_id_key'
      AND conrelid = 'public.empresa_checklist_respostas'::regclass
  ) THEN
    ALTER TABLE public.empresa_checklist_respostas
    ADD CONSTRAINT empresa_checklist_respostas_empresa_id_relatorio_ciclo_id_checklist_item_id_key
    UNIQUE (empresa_id, relatorio_ciclo_id, checklist_item_id);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.build_checklist_non_conformity_context_key(
  p_empresa_id UUID,
  p_relatorio_ciclo_id UUID,
  p_checklist_item_id UUID,
  p_equipment_type TEXT DEFAULT NULL,
  p_equipment_record_id UUID DEFAULT NULL
)
RETURNS TEXT
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN NULLIF(BTRIM(COALESCE(p_equipment_type, '')), '') IS NOT NULL
      AND p_equipment_record_id IS NOT NULL
      THEN CONCAT_WS(
        ':',
        p_empresa_id::TEXT,
        p_relatorio_ciclo_id::TEXT,
        LOWER(BTRIM(p_equipment_type)),
        p_equipment_record_id::TEXT,
        p_checklist_item_id::TEXT
      )
    ELSE CONCAT_WS(
      ':',
      p_empresa_id::TEXT,
      p_relatorio_ciclo_id::TEXT,
      'principal',
      p_checklist_item_id::TEXT
    )
  END;
$$;

UPDATE public.empresa_checklist_nao_conformidades
SET context_key = public.build_checklist_non_conformity_context_key(
      empresa_id,
      relatorio_ciclo_id,
      checklist_item_id,
      equipment_type,
      equipment_record_id
    ),
    updated_at = now()
WHERE context_key IS DISTINCT FROM public.build_checklist_non_conformity_context_key(
  empresa_id,
  relatorio_ciclo_id,
  checklist_item_id,
  equipment_type,
  equipment_record_id
);

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

  DELETE FROM public.empresa_checklist_respostas AS resposta
  WHERE resposta.empresa_id = v_empresa_id
    AND resposta.relatorio_ciclo_id = v_relatorio_ciclo_id
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
      relatorio_ciclo_id,
      checklist_item_id,
      status,
      observacoes
    )
    SELECT
      v_empresa_id,
      v_relatorio_ciclo_id,
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
    ON CONFLICT ON CONSTRAINT empresa_checklist_respostas_empresa_id_relatorio_ciclo_id_checklist_item_id_key
    DO UPDATE
      SET status = EXCLUDED.status,
          observacoes = EXCLUDED.observacoes,
          updated_at = now();
  ELSIF v_equipment_type = 'hidrante' THEN
    INSERT INTO public.empresa_checklist_respostas (
      empresa_id,
      relatorio_ciclo_id,
      checklist_item_id,
      status,
      observacoes
    )
    SELECT
      v_empresa_id,
      v_relatorio_ciclo_id,
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
    ON CONFLICT ON CONSTRAINT empresa_checklist_respostas_empresa_id_relatorio_ciclo_id_checklist_item_id_key
    DO UPDATE
      SET status = EXCLUDED.status,
          observacoes = EXCLUDED.observacoes,
          updated_at = now();
  ELSE
    INSERT INTO public.empresa_checklist_respostas (
      empresa_id,
      relatorio_ciclo_id,
      checklist_item_id,
      status,
      observacoes
    )
    SELECT
      v_empresa_id,
      v_relatorio_ciclo_id,
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
            THEN 'Nao conformidade identificada em ao menos uma luminaria.'
          ELSE NULL
        END AS observacoes
      FROM public.empresa_luminarias AS equipamento
      CROSS JOIN LATERAL jsonb_array_elements(
        COALESCE(equipamento.checklist_snapshot->'items', '[]'::jsonb)
      ) AS item
      WHERE equipamento.empresa_id = v_empresa_id
      GROUP BY item->>'checklist_item_id'
    ) AS aggregated
    WHERE aggregated.checklist_item_id IS NOT NULL
      AND aggregated.checklist_item_id <> ''
      AND aggregated.status IS NOT NULL
    ON CONFLICT ON CONSTRAINT empresa_checklist_respostas_empresa_id_relatorio_ciclo_id_checklist_item_id_key
    DO UPDATE
      SET status = EXCLUDED.status,
          observacoes = EXCLUDED.observacoes,
          updated_at = now();
  END IF;

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

REVOKE ALL ON FUNCTION public.build_checklist_non_conformity_context_key(UUID, UUID, UUID, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.build_checklist_non_conformity_context_key(UUID, UUID, UUID, TEXT, UUID) TO authenticated;
