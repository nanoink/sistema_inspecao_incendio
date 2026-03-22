CREATE OR REPLACE FUNCTION public.get_equipment_qr_non_conformities(
  p_token UUID
)
RETURNS TABLE (
  id UUID,
  context_key TEXT,
  empresa_id UUID,
  checklist_item_id UUID,
  equipment_type TEXT,
  equipment_record_id UUID,
  descricao TEXT,
  imagem_data_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_equipment_type TEXT;
  v_empresa_id UUID;
  v_equipment_record_id UUID;
BEGIN
  SELECT 'extintor', item.empresa_id, item.id
  INTO v_equipment_type, v_empresa_id, v_equipment_record_id
  FROM public.empresa_extintores AS item
  WHERE item.public_token = p_token;

  IF NOT FOUND THEN
    SELECT 'hidrante', item.empresa_id, item.id
    INTO v_equipment_type, v_empresa_id, v_equipment_record_id
    FROM public.empresa_hidrantes AS item
    WHERE item.public_token = p_token;
  END IF;

  IF NOT FOUND THEN
    SELECT 'luminaria', item.empresa_id, item.id
    INTO v_equipment_type, v_empresa_id, v_equipment_record_id
    FROM public.empresa_luminarias AS item
    WHERE item.public_token = p_token;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Equipamento nao encontrado para o token informado.';
  END IF;

  RETURN QUERY
  SELECT
    record.id,
    record.context_key,
    record.empresa_id,
    record.checklist_item_id,
    record.equipment_type,
    record.equipment_record_id,
    record.descricao,
    record.imagem_data_url,
    record.created_at,
    record.updated_at
  FROM public.empresa_checklist_nao_conformidades AS record
  WHERE record.empresa_id = v_empresa_id
    AND record.equipment_type = v_equipment_type
    AND record.equipment_record_id = v_equipment_record_id
  ORDER BY record.updated_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_equipment_qr_non_conformity(
  p_token UUID,
  p_checklist_item_id UUID,
  p_descricao TEXT,
  p_imagem_data_url TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  context_key TEXT,
  empresa_id UUID,
  checklist_item_id UUID,
  equipment_type TEXT,
  equipment_record_id UUID,
  descricao TEXT,
  imagem_data_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_equipment_type TEXT;
  v_empresa_id UUID;
  v_equipment_record_id UUID;
  v_context_key TEXT;
BEGIN
  SELECT 'extintor', item.empresa_id, item.id
  INTO v_equipment_type, v_empresa_id, v_equipment_record_id
  FROM public.empresa_extintores AS item
  WHERE item.public_token = p_token;

  IF NOT FOUND THEN
    SELECT 'hidrante', item.empresa_id, item.id
    INTO v_equipment_type, v_empresa_id, v_equipment_record_id
    FROM public.empresa_hidrantes AS item
    WHERE item.public_token = p_token;
  END IF;

  IF NOT FOUND THEN
    SELECT 'luminaria', item.empresa_id, item.id
    INTO v_equipment_type, v_empresa_id, v_equipment_record_id
    FROM public.empresa_luminarias AS item
    WHERE item.public_token = p_token;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Equipamento nao encontrado para o token informado.';
  END IF;

  v_context_key :=
    v_empresa_id::TEXT
    || ':'
    || v_equipment_type
    || ':'
    || v_equipment_record_id::TEXT
    || ':'
    || p_checklist_item_id::TEXT;

  RETURN QUERY
  INSERT INTO public.empresa_checklist_nao_conformidades (
    context_key,
    empresa_id,
    checklist_item_id,
    equipment_type,
    equipment_record_id,
    descricao,
    imagem_data_url
  )
  VALUES (
    v_context_key,
    v_empresa_id,
    p_checklist_item_id,
    v_equipment_type,
    v_equipment_record_id,
    COALESCE(NULLIF(BTRIM(p_descricao), ''), ''),
    NULLIF(BTRIM(COALESCE(p_imagem_data_url, '')), '')
  )
  ON CONFLICT (context_key)
  DO UPDATE
    SET descricao = EXCLUDED.descricao,
        imagem_data_url = EXCLUDED.imagem_data_url,
        updated_at = now()
  RETURNING
    empresa_checklist_nao_conformidades.id,
    empresa_checklist_nao_conformidades.context_key,
    empresa_checklist_nao_conformidades.empresa_id,
    empresa_checklist_nao_conformidades.checklist_item_id,
    empresa_checklist_nao_conformidades.equipment_type,
    empresa_checklist_nao_conformidades.equipment_record_id,
    empresa_checklist_nao_conformidades.descricao,
    empresa_checklist_nao_conformidades.imagem_data_url,
    empresa_checklist_nao_conformidades.created_at,
    empresa_checklist_nao_conformidades.updated_at;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_equipment_qr_non_conformities(UUID)
TO authenticated;

GRANT EXECUTE ON FUNCTION public.save_equipment_qr_non_conformity(UUID, UUID, TEXT, TEXT)
TO authenticated;
