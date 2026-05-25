INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'empresa-checklist-nao-conformidades',
  'empresa-checklist-nao-conformidades',
  false,
  10485760,
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif'
  ]
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE OR REPLACE FUNCTION public.get_empresa_id_from_storage_object_name(p_name TEXT)
RETURNS UUID
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_prefix TEXT;
BEGIN
  v_prefix := split_part(COALESCE(p_name, ''), '/', 1);

  IF v_prefix = '' THEN
    RETURN NULL;
  END IF;

  BEGIN
    RETURN v_prefix::UUID;
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;
END;
$$;

CREATE OR REPLACE FUNCTION public.can_read_empresa_checklist_non_conformity_images(p_empresa_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  IF auth.role() <> 'authenticated' OR auth.uid() IS NULL OR p_empresa_id IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN public.can_access_empresa(p_empresa_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.can_upload_empresa_checklist_non_conformity_images(p_empresa_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  IF auth.role() <> 'authenticated' OR auth.uid() IS NULL OR p_empresa_id IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN public.can_execute_empresa_checklists(p_empresa_id);
END;
$$;

DROP POLICY IF EXISTS "Empresa members can read checklist non conformity images" ON storage.objects;
CREATE POLICY "Empresa members can read checklist non conformity images"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'empresa-checklist-nao-conformidades'
  AND public.can_read_empresa_checklist_non_conformity_images(
    public.get_empresa_id_from_storage_object_name(name)
  )
);

DROP POLICY IF EXISTS "Empresa members can upload checklist non conformity images" ON storage.objects;
CREATE POLICY "Empresa members can upload checklist non conformity images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'empresa-checklist-nao-conformidades'
  AND public.can_upload_empresa_checklist_non_conformity_images(
    public.get_empresa_id_from_storage_object_name(name)
  )
);

DROP POLICY IF EXISTS "Empresa members can update checklist non conformity images" ON storage.objects;
CREATE POLICY "Empresa members can update checklist non conformity images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'empresa-checklist-nao-conformidades'
  AND public.can_upload_empresa_checklist_non_conformity_images(
    public.get_empresa_id_from_storage_object_name(name)
  )
)
WITH CHECK (
  bucket_id = 'empresa-checklist-nao-conformidades'
  AND public.can_upload_empresa_checklist_non_conformity_images(
    public.get_empresa_id_from_storage_object_name(name)
  )
);

DROP POLICY IF EXISTS "Empresa members can delete checklist non conformity images" ON storage.objects;
CREATE POLICY "Empresa members can delete checklist non conformity images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'empresa-checklist-nao-conformidades'
  AND public.can_upload_empresa_checklist_non_conformity_images(
    public.get_empresa_id_from_storage_object_name(name)
  )
);

REVOKE ALL ON FUNCTION public.get_empresa_id_from_storage_object_name(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_read_empresa_checklist_non_conformity_images(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_upload_empresa_checklist_non_conformity_images(UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_empresa_id_from_storage_object_name(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_read_empresa_checklist_non_conformity_images(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_upload_empresa_checklist_non_conformity_images(UUID) TO authenticated;
