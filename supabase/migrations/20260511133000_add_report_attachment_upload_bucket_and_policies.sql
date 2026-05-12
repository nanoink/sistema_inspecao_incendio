INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'empresa-relatorio-anexos',
  'empresa-relatorio-anexos',
  false,
  20971520,
  ARRAY[
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
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

CREATE OR REPLACE FUNCTION public.can_manage_empresa_report_attachments(p_empresa_id UUID)
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

  IF EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND LOWER(BTRIM(COALESCE(email, ''))) = 'firetetraedro@gmail.com'
  ) THEN
    RETURN TRUE;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.empresa_usuarios
    WHERE empresa_id = p_empresa_id
      AND user_id = auth.uid()
  );
END;
$$;

DROP POLICY IF EXISTS "Empresa members can read report attachments" ON storage.objects;
CREATE POLICY "Empresa members can read report attachments"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'empresa-relatorio-anexos'
  AND public.can_manage_empresa_report_attachments(
    public.get_empresa_id_from_storage_object_name(name)
  )
);

DROP POLICY IF EXISTS "Empresa members can upload report attachments" ON storage.objects;
CREATE POLICY "Empresa members can upload report attachments"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'empresa-relatorio-anexos'
  AND public.can_manage_empresa_report_attachments(
    public.get_empresa_id_from_storage_object_name(name)
  )
);

DROP POLICY IF EXISTS "Empresa members can update report attachments" ON storage.objects;
CREATE POLICY "Empresa members can update report attachments"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'empresa-relatorio-anexos'
  AND public.can_manage_empresa_report_attachments(
    public.get_empresa_id_from_storage_object_name(name)
  )
)
WITH CHECK (
  bucket_id = 'empresa-relatorio-anexos'
  AND public.can_manage_empresa_report_attachments(
    public.get_empresa_id_from_storage_object_name(name)
  )
);

DROP POLICY IF EXISTS "Empresa members can delete report attachments" ON storage.objects;
CREATE POLICY "Empresa members can delete report attachments"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'empresa-relatorio-anexos'
  AND public.can_manage_empresa_report_attachments(
    public.get_empresa_id_from_storage_object_name(name)
  )
);

REVOKE ALL ON FUNCTION public.get_empresa_id_from_storage_object_name(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_manage_empresa_report_attachments(UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_empresa_id_from_storage_object_name(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_empresa_report_attachments(UUID) TO authenticated;
