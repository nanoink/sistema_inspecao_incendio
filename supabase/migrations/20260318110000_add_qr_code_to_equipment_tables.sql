ALTER TABLE public.empresa_extintores
ADD COLUMN IF NOT EXISTS public_token UUID NOT NULL DEFAULT gen_random_uuid(),
ADD COLUMN IF NOT EXISTS qr_code_url TEXT,
ADD COLUMN IF NOT EXISTS qr_code_svg TEXT,
ADD COLUMN IF NOT EXISTS checklist_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.empresa_hidrantes
ADD COLUMN IF NOT EXISTS public_token UUID NOT NULL DEFAULT gen_random_uuid(),
ADD COLUMN IF NOT EXISTS qr_code_url TEXT,
ADD COLUMN IF NOT EXISTS qr_code_svg TEXT,
ADD COLUMN IF NOT EXISTS checklist_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS idx_empresa_extintores_public_token
  ON public.empresa_extintores(public_token);

CREATE UNIQUE INDEX IF NOT EXISTS idx_empresa_hidrantes_public_token
  ON public.empresa_hidrantes(public_token);

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
  WHERE item.public_token = p_token;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_equipment_qr_page(UUID) TO authenticated;
