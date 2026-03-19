CREATE TABLE IF NOT EXISTS public.empresa_luminarias (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresa(id) ON DELETE CASCADE,
  numero TEXT NOT NULL,
  localizacao TEXT NOT NULL,
  tipo_luminaria TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Conforme', 'Nao Conforme')),
  public_token UUID NOT NULL DEFAULT gen_random_uuid(),
  qr_code_url TEXT,
  qr_code_svg TEXT,
  checklist_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, numero)
);

CREATE INDEX IF NOT EXISTS idx_empresa_luminarias_empresa_id
  ON public.empresa_luminarias(empresa_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_empresa_luminarias_public_token
  ON public.empresa_luminarias(public_token);

ALTER TABLE public.empresa_luminarias ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'empresa_luminarias'
      AND policyname = 'Authenticated users can view company luminaires'
  ) THEN
    CREATE POLICY "Authenticated users can view company luminaires"
      ON public.empresa_luminarias
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'empresa_luminarias'
      AND policyname = 'Authenticated users can insert company luminaires'
  ) THEN
    CREATE POLICY "Authenticated users can insert company luminaires"
      ON public.empresa_luminarias
      FOR INSERT
      TO authenticated
      WITH CHECK (true);
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'empresa_luminarias'
      AND policyname = 'Authenticated users can update company luminaires'
  ) THEN
    CREATE POLICY "Authenticated users can update company luminaires"
      ON public.empresa_luminarias
      FOR UPDATE
      TO authenticated
      USING (true);
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'empresa_luminarias'
      AND policyname = 'Authenticated users can delete company luminaires'
  ) THEN
    CREATE POLICY "Authenticated users can delete company luminaires"
      ON public.empresa_luminarias
      FOR DELETE
      TO authenticated
      USING (true);
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS update_empresa_luminarias_updated_at
ON public.empresa_luminarias;

CREATE TRIGGER update_empresa_luminarias_updated_at
BEFORE UPDATE ON public.empresa_luminarias
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.empresa_luminarias;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_equipment_qr_page(p_token UUID)
RETURNS TABLE (
  equipment_type TEXT,
  equipment_id UUID,
  empresa_id UUID,
  empresa_razao_social TEXT,
  numero TEXT,
  localizacao TEXT,
  titulo TEXT,
  subtitulo TEXT,
  qr_code_url TEXT,
  qr_code_svg TEXT,
  checklist_snapshot JSONB,
  equipment_data JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    'extintor'::TEXT AS equipment_type,
    item.id AS equipment_id,
    item.empresa_id,
    company.razao_social AS empresa_razao_social,
    item.numero,
    item.localizacao,
    ('Extintor ' || item.numero)::TEXT AS titulo,
    (item.tipo || ' - ' || item.carga_nominal)::TEXT AS subtitulo,
    item.qr_code_url,
    item.qr_code_svg,
    item.checklist_snapshot,
    jsonb_build_object(
      'numero', item.numero,
      'localizacao', item.localizacao,
      'tipo', item.tipo,
      'carga_nominal', item.carga_nominal,
      'vencimento_carga', item.vencimento_carga,
      'vencimento_teste_hidrostatico_ano', item.vencimento_teste_hidrostatico_ano
    ) AS equipment_data
  FROM public.empresa_extintores AS item
  INNER JOIN public.empresa AS company
    ON company.id = item.empresa_id
  WHERE item.public_token = p_token

  UNION ALL

  SELECT
    'hidrante'::TEXT AS equipment_type,
    item.id AS equipment_id,
    item.empresa_id,
    company.razao_social AS empresa_razao_social,
    item.numero,
    item.localizacao,
    ('Hidrante ' || item.numero)::TEXT AS titulo,
    item.tipo_hidrante::TEXT AS subtitulo,
    item.qr_code_url,
    item.qr_code_svg,
    item.checklist_snapshot,
    jsonb_build_object(
      'numero', item.numero,
      'localizacao', item.localizacao,
      'tipo_hidrante', item.tipo_hidrante,
      'mangueira1_tipo', item.mangueira1_tipo,
      'mangueira1_vencimento_teste_hidrostatico', item.mangueira1_vencimento_teste_hidrostatico,
      'mangueira2_tipo', item.mangueira2_tipo,
      'mangueira2_vencimento_teste_hidrostatico', item.mangueira2_vencimento_teste_hidrostatico,
      'esguicho', item.esguicho,
      'chave_mangueira', item.chave_mangueira,
      'status', item.status
    ) AS equipment_data
  FROM public.empresa_hidrantes AS item
  INNER JOIN public.empresa AS company
    ON company.id = item.empresa_id
  WHERE item.public_token = p_token

  UNION ALL

  SELECT
    'luminaria'::TEXT AS equipment_type,
    item.id AS equipment_id,
    item.empresa_id,
    company.razao_social AS empresa_razao_social,
    item.numero,
    item.localizacao,
    ('Luminaria ' || item.numero)::TEXT AS titulo,
    item.tipo_luminaria::TEXT AS subtitulo,
    item.qr_code_url,
    item.qr_code_svg,
    item.checklist_snapshot,
    jsonb_build_object(
      'numero', item.numero,
      'localizacao', item.localizacao,
      'tipo_luminaria', item.tipo_luminaria,
      'status', item.status
    ) AS equipment_data
  FROM public.empresa_luminarias AS item
  INNER JOIN public.empresa AS company
    ON company.id = item.empresa_id
  WHERE item.public_token = p_token;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_equipment_qr_page(UUID) TO anon, authenticated;

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
      UPDATE public.empresa_luminarias AS luminaria
      SET checklist_snapshot = v_snapshot
      WHERE luminaria.public_token = p_token
      RETURNING luminaria.id, luminaria.empresa_id
      INTO v_equipment_id, v_empresa_id;

      IF FOUND THEN
        v_equipment_type := 'luminaria';
        v_inspection_code := 'A.19';
      ELSE
        RAISE EXCEPTION 'Equipamento nao encontrado para o token informado.';
      END IF;
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
  ELSIF v_equipment_type = 'hidrante' THEN
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
TO anon, authenticated;
