CREATE OR REPLACE FUNCTION public.resolve_exigencias_empresa(
  p_divisao TEXT,
  p_area_m2 NUMERIC,
  p_altura_tipo TEXT,
  p_numero_ocupantes INTEGER DEFAULT NULL,
  p_grau_risco TEXT DEFAULT NULL
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
      NULLIF(lower(trim(coalesce(p_grau_risco, ''))), '') AS grau_risco
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
    ec.status_aplicabilidade AS criterio_status,
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
  ORDER BY ec.divisao, ec.fonte_linha NULLS LAST, ec.created_at, ec.id;
$$;

SELECT public.sync_empresa_exigencias(id) FROM public.empresa;
