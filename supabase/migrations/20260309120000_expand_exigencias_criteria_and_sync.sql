ALTER TABLE public.exigencias_seguranca
  ADD CONSTRAINT exigencias_seguranca_codigo_key UNIQUE (codigo);

ALTER TABLE public.exigencias_criterios
  ADD COLUMN IF NOT EXISTS cenario TEXT NOT NULL DEFAULT 'matriz_por_altura',
  ADD COLUMN IF NOT EXISTS status_aplicabilidade TEXT NOT NULL DEFAULT 'required',
  ADD COLUMN IF NOT EXISTS valor_raw TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS altura_denominacao TEXT,
  ADD COLUMN IF NOT EXISTS descricao_edificacao TEXT,
  ADD COLUMN IF NOT EXISTS ocupantes_min INTEGER,
  ADD COLUMN IF NOT EXISTS ocupantes_max INTEGER,
  ADD COLUMN IF NOT EXISTS graus_risco TEXT[],
  ADD COLUMN IF NOT EXISTS fonte_arquivo TEXT,
  ADD COLUMN IF NOT EXISTS fonte_linha INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'exigencias_criterios_status_aplicabilidade_check'
  ) THEN
    ALTER TABLE public.exigencias_criterios
      ADD CONSTRAINT exigencias_criterios_status_aplicabilidade_check
      CHECK (status_aplicabilidade IN ('required', 'conditional', 'not_applicable', 'manual_review'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS exigencias_criterios_lookup_idx
  ON public.exigencias_criterios (cenario, divisao, altura_tipo, exigencia_id);

ALTER TABLE public.empresa_exigencias
  ADD COLUMN IF NOT EXISTS criterio_id UUID REFERENCES public.exigencias_criterios(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS criterio_cenario TEXT,
  ADD COLUMN IF NOT EXISTS criterio_status TEXT,
  ADD COLUMN IF NOT EXISTS criterio_texto TEXT;

CREATE INDEX IF NOT EXISTS empresa_exigencias_criterio_id_idx
  ON public.empresa_exigencias (criterio_id);

CREATE OR REPLACE FUNCTION public.normalize_divisao_codigo(p_value TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NULLIF(regexp_replace(upper(trim(coalesce(p_value, ''))), '\s*-\s*', '-', 'g'), '');
$$;

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
    AND ec.status_aplicabilidade IN ('required', 'conditional')
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
    v_empresa.grau_risco
  ) AS resolved;

  GET DIAGNOSTICS v_inserted_count = ROW_COUNT;
  RETURN v_inserted_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_empresa_exigencias_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.sync_empresa_exigencias(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_empresa_exigencias_on_empresa ON public.empresa;

CREATE TRIGGER sync_empresa_exigencias_on_empresa
AFTER INSERT OR UPDATE OF divisao, area_m2, altura_tipo, numero_ocupantes, grau_risco
ON public.empresa
FOR EACH ROW
EXECUTE FUNCTION public.handle_empresa_exigencias_sync();

GRANT EXECUTE ON FUNCTION public.normalize_divisao_codigo(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_exigencias_empresa(TEXT, NUMERIC, TEXT, INTEGER, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_empresa_exigencias(UUID) TO authenticated;
