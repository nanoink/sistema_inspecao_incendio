ALTER TABLE public.empresa
  ADD COLUMN IF NOT EXISTS altura_real_m NUMERIC,
  ADD COLUMN IF NOT EXISTS area_maior_pavimento_m2 NUMERIC,
  ADD COLUMN IF NOT EXISTS area_depositos_m2 NUMERIC,
  ADD COLUMN IF NOT EXISTS possui_atrio BOOLEAN;

ALTER TABLE public.empresa
  ALTER COLUMN area_depositos_m2 SET DEFAULT 0,
  ALTER COLUMN possui_atrio SET DEFAULT false;

UPDATE public.empresa
SET
  area_maior_pavimento_m2 = COALESCE(area_maior_pavimento_m2, area_m2),
  area_depositos_m2 = COALESCE(area_depositos_m2, 0),
  possui_atrio = COALESCE(possui_atrio, false)
WHERE area_maior_pavimento_m2 IS NULL
   OR area_depositos_m2 IS NULL
   OR possui_atrio IS NULL;

ALTER TABLE public.exigencias_criterios
  ADD COLUMN IF NOT EXISTS altura_real_min NUMERIC,
  ADD COLUMN IF NOT EXISTS altura_real_max NUMERIC,
  ADD COLUMN IF NOT EXISTS area_maior_pavimento_min NUMERIC,
  ADD COLUMN IF NOT EXISTS area_maior_pavimento_max NUMERIC,
  ADD COLUMN IF NOT EXISTS area_depositos_min NUMERIC,
  ADD COLUMN IF NOT EXISTS area_depositos_max NUMERIC,
  ADD COLUMN IF NOT EXISTS requer_atrio BOOLEAN;

DROP FUNCTION IF EXISTS public.resolve_exigencias_empresa(TEXT, NUMERIC, TEXT, INTEGER, TEXT);

CREATE OR REPLACE FUNCTION public.resolve_exigencias_empresa(
  p_divisao TEXT,
  p_area_m2 NUMERIC,
  p_altura_tipo TEXT,
  p_numero_ocupantes INTEGER DEFAULT NULL,
  p_grau_risco TEXT DEFAULT NULL,
  p_altura_real_m NUMERIC DEFAULT NULL,
  p_area_maior_pavimento_m2 NUMERIC DEFAULT NULL,
  p_area_depositos_m2 NUMERIC DEFAULT NULL,
  p_possui_atrio BOOLEAN DEFAULT NULL
)
RETURNS TABLE (
  criterio_id UUID,
  exigencia_id UUID,
  criterio_cenario TEXT,
  criterio_status TEXT,
  criterio_texto TEXT
)
LANGUAGE sql
STABLE
AS $$
  WITH empresa_normalizada AS (
    SELECT
      public.normalize_divisao_codigo(p_divisao) AS divisao,
      p_area_m2 AS area_m2,
      NULLIF(upper(trim(coalesce(p_altura_tipo, ''))), '') AS altura_tipo,
      p_numero_ocupantes AS numero_ocupantes,
      NULLIF(lower(trim(coalesce(p_grau_risco, ''))), '') AS grau_risco,
      p_altura_real_m AS altura_real_m,
      p_area_maior_pavimento_m2 AS area_maior_pavimento_m2,
      p_area_depositos_m2 AS area_depositos_m2,
      p_possui_atrio AS possui_atrio
  ),
  cenario_selecionado AS (
    SELECT CASE
      WHEN EXISTS (
        SELECT 1
        FROM public.exigencias_criterios ec
        CROSS JOIN empresa_normalizada en
        WHERE ec.cenario = 'ate_750_ate_12'
          AND ec.divisao = en.divisao
      )
      AND COALESCE((SELECT area_m2 FROM empresa_normalizada), 0) <= 750
      AND COALESCE((SELECT altura_tipo FROM empresa_normalizada), '') IN ('I', 'II', 'III')
      THEN 'ate_750_ate_12'
      ELSE 'matriz_por_altura'
    END AS cenario
  )
  SELECT
    ec.id AS criterio_id,
    ec.exigencia_id,
    ec.cenario AS criterio_cenario,
    CASE
      WHEN (
        (
          (ec.altura_real_min IS NOT NULL OR ec.altura_real_max IS NOT NULL)
          AND en.altura_real_m IS NULL
        )
        OR (
          (ec.area_maior_pavimento_min IS NOT NULL OR ec.area_maior_pavimento_max IS NOT NULL)
          AND en.area_maior_pavimento_m2 IS NULL
        )
        OR (
          (ec.area_depositos_min IS NOT NULL OR ec.area_depositos_max IS NOT NULL)
          AND en.area_depositos_m2 IS NULL
        )
        OR (
          ec.requer_atrio IS NOT NULL
          AND en.possui_atrio IS NULL
        )
      )
      THEN 'manual_review'
      ELSE ec.status_aplicabilidade
    END AS criterio_status,
    CASE
      WHEN NULLIF(btrim(coalesce(ec.observacao, '')), '') IS NOT NULL THEN ec.observacao
      WHEN upper(btrim(coalesce(ec.valor_raw, ''))) = 'SIM' THEN NULL
      ELSE ec.valor_raw
    END AS criterio_texto
  FROM public.exigencias_criterios ec
  CROSS JOIN empresa_normalizada en
  CROSS JOIN cenario_selecionado cs
  WHERE ec.cenario = cs.cenario
    AND ec.divisao = en.divisao
    AND ec.status_aplicabilidade IN ('required', 'conditional', 'manual_review')
    AND (ec.area_min IS NULL OR (en.area_m2 IS NOT NULL AND en.area_m2 >= ec.area_min))
    AND (ec.area_max IS NULL OR (en.area_m2 IS NOT NULL AND en.area_m2 <= ec.area_max))
    AND (
      ec.cenario = 'ate_750_ate_12'
      OR ec.altura_tipo IS NULL
      OR ec.altura_tipo = en.altura_tipo
    )
    AND (ec.ocupantes_min IS NULL OR (en.numero_ocupantes IS NOT NULL AND en.numero_ocupantes >= ec.ocupantes_min))
    AND (ec.ocupantes_max IS NULL OR (en.numero_ocupantes IS NOT NULL AND en.numero_ocupantes <= ec.ocupantes_max))
    AND (ec.graus_risco IS NULL OR (en.grau_risco IS NOT NULL AND en.grau_risco = ANY(ec.graus_risco)))
    AND (
      ec.altura_real_min IS NULL
      OR en.altura_real_m IS NULL
      OR en.altura_real_m >= ec.altura_real_min
    )
    AND (
      ec.altura_real_max IS NULL
      OR en.altura_real_m IS NULL
      OR en.altura_real_m <= ec.altura_real_max
    )
    AND (
      ec.area_maior_pavimento_min IS NULL
      OR en.area_maior_pavimento_m2 IS NULL
      OR en.area_maior_pavimento_m2 >= ec.area_maior_pavimento_min
    )
    AND (
      ec.area_maior_pavimento_max IS NULL
      OR en.area_maior_pavimento_m2 IS NULL
      OR en.area_maior_pavimento_m2 <= ec.area_maior_pavimento_max
    )
    AND (
      ec.area_depositos_min IS NULL
      OR en.area_depositos_m2 IS NULL
      OR en.area_depositos_m2 >= ec.area_depositos_min
    )
    AND (
      ec.area_depositos_max IS NULL
      OR en.area_depositos_m2 IS NULL
      OR en.area_depositos_m2 <= ec.area_depositos_max
    )
    AND (
      ec.requer_atrio IS NULL
      OR en.possui_atrio IS NULL
      OR en.possui_atrio = ec.requer_atrio
    )
  ORDER BY ec.divisao, ec.fonte_linha NULLS LAST, ec.created_at, ec.id;
$$;

CREATE OR REPLACE FUNCTION public.sync_empresa_exigencias(p_empresa_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa public.empresa%ROWTYPE;
  v_inserted_count INTEGER := 0;
BEGIN
  SELECT *
  INTO v_empresa
  FROM public.empresa
  WHERE id = p_empresa_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Empresa % nao encontrada', p_empresa_id;
  END IF;

  DELETE FROM public.empresa_exigencias
  WHERE empresa_id = p_empresa_id;

  IF v_empresa.divisao IS NULL OR v_empresa.area_m2 IS NULL OR v_empresa.altura_tipo IS NULL THEN
    RETURN 0;
  END IF;

  INSERT INTO public.empresa_exigencias (
    empresa_id,
    exigencia_id,
    atende,
    observacoes,
    criterio_id,
    criterio_cenario,
    criterio_status,
    criterio_texto
  )
  SELECT
    p_empresa_id,
    resolved.exigencia_id,
    false,
    NULL,
    resolved.criterio_id,
    resolved.criterio_cenario,
    resolved.criterio_status,
    resolved.criterio_texto
  FROM public.resolve_exigencias_empresa(
    v_empresa.divisao,
    v_empresa.area_m2,
    v_empresa.altura_tipo,
    v_empresa.numero_ocupantes,
    v_empresa.grau_risco,
    v_empresa.altura_real_m,
    v_empresa.area_maior_pavimento_m2,
    v_empresa.area_depositos_m2,
    v_empresa.possui_atrio
  ) AS resolved;

  GET DIAGNOSTICS v_inserted_count = ROW_COUNT;
  RETURN v_inserted_count;
END;
$$;

DROP TRIGGER IF EXISTS sync_empresa_exigencias_on_empresa ON public.empresa;

CREATE TRIGGER sync_empresa_exigencias_on_empresa
AFTER INSERT OR UPDATE OF divisao, area_m2, altura_tipo, numero_ocupantes, grau_risco, altura_real_m, area_maior_pavimento_m2, area_depositos_m2, possui_atrio
ON public.empresa
FOR EACH ROW
EXECUTE FUNCTION public.handle_empresa_exigencias_sync();

GRANT EXECUTE ON FUNCTION public.resolve_exigencias_empresa(TEXT, NUMERIC, TEXT, INTEGER, TEXT, NUMERIC, NUMERIC, NUMERIC, BOOLEAN) TO anon, authenticated;

SELECT public.sync_empresa_exigencias(id) FROM public.empresa;
