CREATE TABLE IF NOT EXISTS public.empresa_usuarios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresa(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  papel TEXT NOT NULL CHECK (papel IN ('gestor', 'membro')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.empresa_checklist_execucoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresa(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  inspection_code TEXT NOT NULL,
  inspection_name TEXT NOT NULL,
  context_type TEXT NOT NULL CHECK (context_type IN ('principal', 'equipamento')),
  equipment_type TEXT CHECK (equipment_type IN ('extintor', 'hidrante', 'luminaria')),
  equipment_record_id UUID,
  source_label TEXT,
  context_key TEXT NOT NULL UNIQUE,
  first_activity_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_activity_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  total_saves INTEGER NOT NULL DEFAULT 1 CHECK (total_saves >= 1),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT empresa_checklist_execucoes_scope_check CHECK (
    (context_type = 'principal' AND equipment_type IS NULL AND equipment_record_id IS NULL)
    OR (
      context_type = 'equipamento'
      AND equipment_type IS NOT NULL
      AND equipment_record_id IS NOT NULL
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_empresa_usuarios_empresa_id
  ON public.empresa_usuarios(empresa_id);

CREATE INDEX IF NOT EXISTS idx_empresa_usuarios_user_id
  ON public.empresa_usuarios(user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_empresa_usuarios_gestor_unico
  ON public.empresa_usuarios(empresa_id)
  WHERE papel = 'gestor';

CREATE INDEX IF NOT EXISTS idx_empresa_checklist_execucoes_empresa_usuario
  ON public.empresa_checklist_execucoes(empresa_id, user_id);

CREATE INDEX IF NOT EXISTS idx_empresa_checklist_execucoes_empresa_inspection
  ON public.empresa_checklist_execucoes(empresa_id, inspection_code);

CREATE INDEX IF NOT EXISTS idx_empresa_checklist_execucoes_empresa_context
  ON public.empresa_checklist_execucoes(
    empresa_id,
    context_type,
    equipment_type,
    equipment_record_id
  );

CREATE INDEX IF NOT EXISTS idx_empresa_checklist_nao_conformidades_empresa_type_updated
  ON public.empresa_checklist_nao_conformidades(
    empresa_id,
    equipment_type,
    updated_at DESC
  );

CREATE INDEX IF NOT EXISTS idx_empresa_extintores_empresa_numero
  ON public.empresa_extintores(empresa_id, numero);

CREATE INDEX IF NOT EXISTS idx_empresa_hidrantes_empresa_numero
  ON public.empresa_hidrantes(empresa_id, numero);

CREATE INDEX IF NOT EXISTS idx_empresa_luminarias_empresa_numero
  ON public.empresa_luminarias(empresa_id, numero);

CREATE INDEX IF NOT EXISTS idx_empresa_checklist_respostas_empresa_updated
  ON public.empresa_checklist_respostas(empresa_id, updated_at DESC);

ALTER TABLE public.empresa_usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.empresa_checklist_execucoes ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_empresa_members(p_empresa_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.empresa_usuarios
    WHERE empresa_id = p_empresa_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_empresa_member(p_empresa_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    auth.role() = 'authenticated'
    AND auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.empresa_usuarios
      WHERE empresa_id = p_empresa_id
        AND user_id = auth.uid()
    );
$$;

CREATE OR REPLACE FUNCTION public.can_access_empresa(p_empresa_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  IF auth.role() <> 'authenticated' OR auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;

  IF public.has_empresa_members(p_empresa_id) THEN
    RETURN public.is_empresa_member(p_empresa_id);
  END IF;

  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.can_manage_empresa_members(p_empresa_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  IF auth.role() <> 'authenticated' OR auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;

  IF NOT public.has_empresa_members(p_empresa_id) THEN
    RETURN TRUE;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.empresa_usuarios
    WHERE empresa_id = p_empresa_id
      AND user_id = auth.uid()
      AND papel = 'gestor'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_empresa_membership_bootstrap(p_empresa_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() <> 'authenticated' OR auth.uid() IS NULL THEN
    RETURN;
  END IF;

  IF public.has_empresa_members(p_empresa_id) THEN
    RETURN;
  END IF;

  INSERT INTO public.empresa_usuarios (empresa_id, user_id, papel)
  VALUES (p_empresa_id, auth.uid(), 'gestor')
  ON CONFLICT (empresa_id, user_id)
  DO UPDATE
    SET papel = EXCLUDED.papel,
        updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_empresa_created_add_gestor()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'authenticated' AND auth.uid() IS NOT NULL THEN
    INSERT INTO public.empresa_usuarios (empresa_id, user_id, papel)
    VALUES (NEW.id, auth.uid(), 'gestor')
    ON CONFLICT (empresa_id, user_id)
    DO UPDATE
      SET papel = EXCLUDED.papel,
          updated_at = now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS handle_empresa_created_add_gestor ON public.empresa;

CREATE TRIGGER handle_empresa_created_add_gestor
AFTER INSERT ON public.empresa
FOR EACH ROW
EXECUTE FUNCTION public.handle_empresa_created_add_gestor();

DROP TRIGGER IF EXISTS update_empresa_usuarios_updated_at ON public.empresa_usuarios;
CREATE TRIGGER update_empresa_usuarios_updated_at
BEFORE UPDATE ON public.empresa_usuarios
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_empresa_checklist_execucoes_updated_at ON public.empresa_checklist_execucoes;
CREATE TRIGGER update_empresa_checklist_execucoes_updated_at
BEFORE UPDATE ON public.empresa_checklist_execucoes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.empresa_usuarios (empresa_id, user_id, papel)
SELECT
  empresa.id,
  profiles.id,
  'gestor'
FROM public.empresa AS empresa
INNER JOIN public.profiles AS profiles
  ON LOWER(BTRIM(profiles.email)) = LOWER(BTRIM(empresa.email))
WHERE NOT EXISTS (
  SELECT 1
  FROM public.empresa_usuarios AS empresa_usuarios
  WHERE empresa_usuarios.empresa_id = empresa.id
)
ON CONFLICT (empresa_id, user_id)
DO NOTHING;

DROP POLICY IF EXISTS "Authenticated users can view companies" ON public.empresa;
DROP POLICY IF EXISTS "Authenticated users can insert companies" ON public.empresa;
DROP POLICY IF EXISTS "Authenticated users can update companies" ON public.empresa;
DROP POLICY IF EXISTS "Authenticated users can delete companies" ON public.empresa;

CREATE POLICY "Authenticated company members can view companies"
  ON public.empresa
  FOR SELECT
  TO authenticated
  USING (public.can_access_empresa(id));

CREATE POLICY "Authenticated users can insert companies"
  ON public.empresa
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated company members can update companies"
  ON public.empresa
  FOR UPDATE
  TO authenticated
  USING (public.can_access_empresa(id));

CREATE POLICY "Authenticated company members can delete companies"
  ON public.empresa
  FOR DELETE
  TO authenticated
  USING (public.can_access_empresa(id));

DROP POLICY IF EXISTS "Authenticated users can view company checklists" ON public.empresa_checklist;
DROP POLICY IF EXISTS "Authenticated users can insert company checklists" ON public.empresa_checklist;
DROP POLICY IF EXISTS "Authenticated users can update company checklists" ON public.empresa_checklist;
DROP POLICY IF EXISTS "Authenticated users can delete company checklists" ON public.empresa_checklist;

CREATE POLICY "Authenticated company members can view company checklists"
  ON public.empresa_checklist
  FOR SELECT
  TO authenticated
  USING (public.can_access_empresa(empresa_id));

CREATE POLICY "Authenticated company members can insert company checklists"
  ON public.empresa_checklist
  FOR INSERT
  TO authenticated
  WITH CHECK (public.can_access_empresa(empresa_id));

CREATE POLICY "Authenticated company members can update company checklists"
  ON public.empresa_checklist
  FOR UPDATE
  TO authenticated
  USING (public.can_access_empresa(empresa_id));

CREATE POLICY "Authenticated company members can delete company checklists"
  ON public.empresa_checklist
  FOR DELETE
  TO authenticated
  USING (public.can_access_empresa(empresa_id));

DROP POLICY IF EXISTS "Authenticated users can view company requirements" ON public.empresa_exigencias;
DROP POLICY IF EXISTS "Authenticated users can insert company requirements" ON public.empresa_exigencias;
DROP POLICY IF EXISTS "Authenticated users can update company requirements" ON public.empresa_exigencias;
DROP POLICY IF EXISTS "Authenticated users can delete company requirements" ON public.empresa_exigencias;

CREATE POLICY "Authenticated company members can view company requirements"
  ON public.empresa_exigencias
  FOR SELECT
  TO authenticated
  USING (public.can_access_empresa(empresa_id));

CREATE POLICY "Authenticated company members can insert company requirements"
  ON public.empresa_exigencias
  FOR INSERT
  TO authenticated
  WITH CHECK (public.can_access_empresa(empresa_id));

CREATE POLICY "Authenticated company members can update company requirements"
  ON public.empresa_exigencias
  FOR UPDATE
  TO authenticated
  USING (public.can_access_empresa(empresa_id));

CREATE POLICY "Authenticated company members can delete company requirements"
  ON public.empresa_exigencias
  FOR DELETE
  TO authenticated
  USING (public.can_access_empresa(empresa_id));

DROP POLICY IF EXISTS "Authenticated users can view company reports" ON public.empresa_relatorios;
DROP POLICY IF EXISTS "Authenticated users can insert company reports" ON public.empresa_relatorios;
DROP POLICY IF EXISTS "Authenticated users can update company reports" ON public.empresa_relatorios;
DROP POLICY IF EXISTS "Authenticated users can delete company reports" ON public.empresa_relatorios;

CREATE POLICY "Authenticated company members can view company reports"
  ON public.empresa_relatorios
  FOR SELECT
  TO authenticated
  USING (public.can_access_empresa(empresa_id));

CREATE POLICY "Authenticated company members can insert company reports"
  ON public.empresa_relatorios
  FOR INSERT
  TO authenticated
  WITH CHECK (public.can_access_empresa(empresa_id));

CREATE POLICY "Authenticated company members can update company reports"
  ON public.empresa_relatorios
  FOR UPDATE
  TO authenticated
  USING (public.can_access_empresa(empresa_id));

CREATE POLICY "Authenticated company members can delete company reports"
  ON public.empresa_relatorios
  FOR DELETE
  TO authenticated
  USING (public.can_access_empresa(empresa_id));

DROP POLICY IF EXISTS "Authenticated users can view company checklist responses v2" ON public.empresa_checklist_respostas;
DROP POLICY IF EXISTS "Authenticated users can insert company checklist responses v2" ON public.empresa_checklist_respostas;
DROP POLICY IF EXISTS "Authenticated users can update company checklist responses v2" ON public.empresa_checklist_respostas;
DROP POLICY IF EXISTS "Authenticated users can delete company checklist responses v2" ON public.empresa_checklist_respostas;

CREATE POLICY "Authenticated company members can view company checklist responses"
  ON public.empresa_checklist_respostas
  FOR SELECT
  TO authenticated
  USING (public.can_access_empresa(empresa_id));

CREATE POLICY "Authenticated company members can insert company checklist responses"
  ON public.empresa_checklist_respostas
  FOR INSERT
  TO authenticated
  WITH CHECK (public.can_access_empresa(empresa_id));

CREATE POLICY "Authenticated company members can update company checklist responses"
  ON public.empresa_checklist_respostas
  FOR UPDATE
  TO authenticated
  USING (public.can_access_empresa(empresa_id));

CREATE POLICY "Authenticated company members can delete company checklist responses"
  ON public.empresa_checklist_respostas
  FOR DELETE
  TO authenticated
  USING (public.can_access_empresa(empresa_id));

DROP POLICY IF EXISTS "Authenticated users can view checklist non conformities" ON public.empresa_checklist_nao_conformidades;
DROP POLICY IF EXISTS "Authenticated users can insert checklist non conformities" ON public.empresa_checklist_nao_conformidades;
DROP POLICY IF EXISTS "Authenticated users can update checklist non conformities" ON public.empresa_checklist_nao_conformidades;
DROP POLICY IF EXISTS "Authenticated users can delete checklist non conformities" ON public.empresa_checklist_nao_conformidades;

CREATE POLICY "Authenticated company members can view checklist non conformities"
  ON public.empresa_checklist_nao_conformidades
  FOR SELECT
  TO authenticated
  USING (public.can_access_empresa(empresa_id));

CREATE POLICY "Authenticated company members can insert checklist non conformities"
  ON public.empresa_checklist_nao_conformidades
  FOR INSERT
  TO authenticated
  WITH CHECK (public.can_access_empresa(empresa_id));

CREATE POLICY "Authenticated company members can update checklist non conformities"
  ON public.empresa_checklist_nao_conformidades
  FOR UPDATE
  TO authenticated
  USING (public.can_access_empresa(empresa_id));

CREATE POLICY "Authenticated company members can delete checklist non conformities"
  ON public.empresa_checklist_nao_conformidades
  FOR DELETE
  TO authenticated
  USING (public.can_access_empresa(empresa_id));

DROP POLICY IF EXISTS "Authenticated users can view company extinguishers" ON public.empresa_extintores;
DROP POLICY IF EXISTS "Authenticated users can insert company extinguishers" ON public.empresa_extintores;
DROP POLICY IF EXISTS "Authenticated users can update company extinguishers" ON public.empresa_extintores;
DROP POLICY IF EXISTS "Authenticated users can delete company extinguishers" ON public.empresa_extintores;

CREATE POLICY "Authenticated company members can view company extinguishers"
  ON public.empresa_extintores
  FOR SELECT
  TO authenticated
  USING (public.can_access_empresa(empresa_id));

CREATE POLICY "Authenticated company members can insert company extinguishers"
  ON public.empresa_extintores
  FOR INSERT
  TO authenticated
  WITH CHECK (public.can_access_empresa(empresa_id));

CREATE POLICY "Authenticated company members can update company extinguishers"
  ON public.empresa_extintores
  FOR UPDATE
  TO authenticated
  USING (public.can_access_empresa(empresa_id));

CREATE POLICY "Authenticated company members can delete company extinguishers"
  ON public.empresa_extintores
  FOR DELETE
  TO authenticated
  USING (public.can_access_empresa(empresa_id));

DROP POLICY IF EXISTS "Authenticated users can view company hydrants" ON public.empresa_hidrantes;
DROP POLICY IF EXISTS "Authenticated users can insert company hydrants" ON public.empresa_hidrantes;
DROP POLICY IF EXISTS "Authenticated users can update company hydrants" ON public.empresa_hidrantes;
DROP POLICY IF EXISTS "Authenticated users can delete company hydrants" ON public.empresa_hidrantes;

CREATE POLICY "Authenticated company members can view company hydrants"
  ON public.empresa_hidrantes
  FOR SELECT
  TO authenticated
  USING (public.can_access_empresa(empresa_id));

CREATE POLICY "Authenticated company members can insert company hydrants"
  ON public.empresa_hidrantes
  FOR INSERT
  TO authenticated
  WITH CHECK (public.can_access_empresa(empresa_id));

CREATE POLICY "Authenticated company members can update company hydrants"
  ON public.empresa_hidrantes
  FOR UPDATE
  TO authenticated
  USING (public.can_access_empresa(empresa_id));

CREATE POLICY "Authenticated company members can delete company hydrants"
  ON public.empresa_hidrantes
  FOR DELETE
  TO authenticated
  USING (public.can_access_empresa(empresa_id));

DROP POLICY IF EXISTS "Authenticated users can view company luminaires" ON public.empresa_luminarias;
DROP POLICY IF EXISTS "Authenticated users can insert company luminaires" ON public.empresa_luminarias;
DROP POLICY IF EXISTS "Authenticated users can update company luminaires" ON public.empresa_luminarias;
DROP POLICY IF EXISTS "Authenticated users can delete company luminaires" ON public.empresa_luminarias;

CREATE POLICY "Authenticated company members can view company luminaires"
  ON public.empresa_luminarias
  FOR SELECT
  TO authenticated
  USING (public.can_access_empresa(empresa_id));

CREATE POLICY "Authenticated company members can insert company luminaires"
  ON public.empresa_luminarias
  FOR INSERT
  TO authenticated
  WITH CHECK (public.can_access_empresa(empresa_id));

CREATE POLICY "Authenticated company members can update company luminaires"
  ON public.empresa_luminarias
  FOR UPDATE
  TO authenticated
  USING (public.can_access_empresa(empresa_id));

CREATE POLICY "Authenticated company members can delete company luminaires"
  ON public.empresa_luminarias
  FOR DELETE
  TO authenticated
  USING (public.can_access_empresa(empresa_id));

DROP POLICY IF EXISTS "Authenticated company members can view memberships" ON public.empresa_usuarios;
DROP POLICY IF EXISTS "Authenticated gestores can insert memberships" ON public.empresa_usuarios;
DROP POLICY IF EXISTS "Authenticated gestores can update memberships" ON public.empresa_usuarios;
DROP POLICY IF EXISTS "Authenticated gestores can delete memberships" ON public.empresa_usuarios;

CREATE POLICY "Authenticated company members can view memberships"
  ON public.empresa_usuarios
  FOR SELECT
  TO authenticated
  USING (public.can_access_empresa(empresa_id));

CREATE POLICY "Authenticated gestores can insert memberships"
  ON public.empresa_usuarios
  FOR INSERT
  TO authenticated
  WITH CHECK (public.can_manage_empresa_members(empresa_id));

CREATE POLICY "Authenticated gestores can update memberships"
  ON public.empresa_usuarios
  FOR UPDATE
  TO authenticated
  USING (public.can_manage_empresa_members(empresa_id));

CREATE POLICY "Authenticated gestores can delete memberships"
  ON public.empresa_usuarios
  FOR DELETE
  TO authenticated
  USING (public.can_manage_empresa_members(empresa_id));

DROP POLICY IF EXISTS "Authenticated company members can view checklist executions" ON public.empresa_checklist_execucoes;
DROP POLICY IF EXISTS "Authenticated company members can insert checklist executions" ON public.empresa_checklist_execucoes;
DROP POLICY IF EXISTS "Authenticated company members can update checklist executions" ON public.empresa_checklist_execucoes;
DROP POLICY IF EXISTS "Authenticated company members can delete checklist executions" ON public.empresa_checklist_execucoes;

CREATE POLICY "Authenticated company members can view checklist executions"
  ON public.empresa_checklist_execucoes
  FOR SELECT
  TO authenticated
  USING (public.can_access_empresa(empresa_id));

CREATE POLICY "Authenticated company members can insert checklist executions"
  ON public.empresa_checklist_execucoes
  FOR INSERT
  TO authenticated
  WITH CHECK (public.can_access_empresa(empresa_id));

CREATE POLICY "Authenticated company members can update checklist executions"
  ON public.empresa_checklist_execucoes
  FOR UPDATE
  TO authenticated
  USING (public.can_access_empresa(empresa_id));

CREATE POLICY "Authenticated company members can delete checklist executions"
  ON public.empresa_checklist_execucoes
  FOR DELETE
  TO authenticated
  USING (public.can_access_empresa(empresa_id));

CREATE OR REPLACE FUNCTION public.list_empresa_usuarios(p_empresa_id UUID)
RETURNS TABLE (
  user_id UUID,
  nome TEXT,
  email TEXT,
  papel TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.ensure_empresa_membership_bootstrap(p_empresa_id);

  IF NOT public.can_access_empresa(p_empresa_id) THEN
    RAISE EXCEPTION 'Acesso negado para a empresa informada.';
  END IF;

  RETURN QUERY
  SELECT
    profiles.id AS user_id,
    COALESCE(NULLIF(BTRIM(profiles.nome), ''), profiles.email, 'Usuario sem nome') AS nome,
    profiles.email,
    empresa_usuarios.papel,
    empresa_usuarios.created_at,
    empresa_usuarios.updated_at
  FROM public.empresa_usuarios
  INNER JOIN public.profiles
    ON profiles.id = empresa_usuarios.user_id
  WHERE empresa_usuarios.empresa_id = p_empresa_id
  ORDER BY
    CASE WHEN empresa_usuarios.papel = 'gestor' THEN 0 ELSE 1 END,
    COALESCE(NULLIF(BTRIM(profiles.nome), ''), profiles.email, 'Usuario sem nome');
END;
$$;

CREATE OR REPLACE FUNCTION public.add_empresa_usuario_by_email(
  p_empresa_id UUID,
  p_email TEXT,
  p_papel TEXT DEFAULT 'membro'
)
RETURNS TABLE (
  user_id UUID,
  nome TEXT,
  email TEXT,
  papel TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target_profile public.profiles%ROWTYPE;
  v_normalized_email TEXT := LOWER(BTRIM(COALESCE(p_email, '')));
  v_role TEXT := LOWER(BTRIM(COALESCE(p_papel, 'membro')));
BEGIN
  PERFORM public.ensure_empresa_membership_bootstrap(p_empresa_id);

  IF NOT public.can_manage_empresa_members(p_empresa_id) THEN
    RAISE EXCEPTION 'Somente o gestor pode alterar os usuarios da empresa.';
  END IF;

  IF v_normalized_email = '' THEN
    RAISE EXCEPTION 'Informe um e-mail valido para vincular o usuario.';
  END IF;

  IF v_role NOT IN ('gestor', 'membro') THEN
    RAISE EXCEPTION 'Papel invalido. Use gestor ou membro.';
  END IF;

  SELECT *
  INTO v_target_profile
  FROM public.profiles
  WHERE LOWER(BTRIM(COALESCE(email, ''))) = v_normalized_email
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nenhum usuario cadastrado foi encontrado com o e-mail informado.';
  END IF;

  IF v_role = 'gestor' THEN
    UPDATE public.empresa_usuarios
    SET papel = 'membro',
        updated_at = now()
    WHERE empresa_id = p_empresa_id
      AND papel = 'gestor'
      AND user_id <> v_target_profile.id;
  END IF;

  INSERT INTO public.empresa_usuarios (
    empresa_id,
    user_id,
    papel
  )
  VALUES (
    p_empresa_id,
    v_target_profile.id,
    v_role
  )
  ON CONFLICT (empresa_id, user_id)
  DO UPDATE
    SET papel = EXCLUDED.papel,
        updated_at = now();

  RETURN QUERY
  SELECT
    profiles.id AS user_id,
    COALESCE(NULLIF(BTRIM(profiles.nome), ''), profiles.email, 'Usuario sem nome') AS nome,
    profiles.email,
    empresa_usuarios.papel,
    empresa_usuarios.created_at,
    empresa_usuarios.updated_at
  FROM public.empresa_usuarios
  INNER JOIN public.profiles
    ON profiles.id = empresa_usuarios.user_id
  WHERE empresa_usuarios.empresa_id = p_empresa_id
    AND empresa_usuarios.user_id = v_target_profile.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_empresa_usuario_role(
  p_empresa_id UUID,
  p_user_id UUID,
  p_papel TEXT
)
RETURNS TABLE (
  user_id UUID,
  nome TEXT,
  email TEXT,
  papel TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT := LOWER(BTRIM(COALESCE(p_papel, 'membro')));
BEGIN
  PERFORM public.ensure_empresa_membership_bootstrap(p_empresa_id);

  IF NOT public.can_manage_empresa_members(p_empresa_id) THEN
    RAISE EXCEPTION 'Somente o gestor pode alterar os usuarios da empresa.';
  END IF;

  IF v_role NOT IN ('gestor', 'membro') THEN
    RAISE EXCEPTION 'Papel invalido. Use gestor ou membro.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.empresa_usuarios
    WHERE empresa_id = p_empresa_id
      AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Usuario nao vinculado a esta empresa.';
  END IF;

  IF v_role = 'membro' AND EXISTS (
    SELECT 1
    FROM public.empresa_usuarios
    WHERE empresa_id = p_empresa_id
      AND user_id = p_user_id
      AND papel = 'gestor'
  ) THEN
    RAISE EXCEPTION 'Nao e permitido remover o papel de gestor sem promover outro usuario antes.';
  END IF;

  IF v_role = 'gestor' THEN
    UPDATE public.empresa_usuarios
    SET papel = 'membro',
        updated_at = now()
    WHERE empresa_id = p_empresa_id
      AND papel = 'gestor'
      AND user_id <> p_user_id;
  END IF;

  UPDATE public.empresa_usuarios
  SET papel = v_role,
      updated_at = now()
  WHERE empresa_id = p_empresa_id
    AND user_id = p_user_id;

  RETURN QUERY
  SELECT
    profiles.id AS user_id,
    COALESCE(NULLIF(BTRIM(profiles.nome), ''), profiles.email, 'Usuario sem nome') AS nome,
    profiles.email,
    empresa_usuarios.papel,
    empresa_usuarios.created_at,
    empresa_usuarios.updated_at
  FROM public.empresa_usuarios
  INNER JOIN public.profiles
    ON profiles.id = empresa_usuarios.user_id
  WHERE empresa_usuarios.empresa_id = p_empresa_id
    AND empresa_usuarios.user_id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_empresa_usuario(
  p_empresa_id UUID,
  p_user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.ensure_empresa_membership_bootstrap(p_empresa_id);

  IF NOT public.can_manage_empresa_members(p_empresa_id) THEN
    RAISE EXCEPTION 'Somente o gestor pode alterar os usuarios da empresa.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.empresa_usuarios
    WHERE empresa_id = p_empresa_id
      AND user_id = p_user_id
      AND papel = 'gestor'
  ) THEN
    RAISE EXCEPTION 'Nao e permitido remover o gestor sem promover outro usuario antes.';
  END IF;

  DELETE FROM public.empresa_usuarios
  WHERE empresa_id = p_empresa_id
    AND user_id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.register_checklist_execution(
  p_empresa_id UUID,
  p_inspection_code TEXT,
  p_inspection_name TEXT,
  p_context_type TEXT,
  p_equipment_type TEXT DEFAULT NULL,
  p_equipment_record_id UUID DEFAULT NULL,
  p_source_label TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  empresa_id UUID,
  user_id UUID,
  inspection_code TEXT,
  inspection_name TEXT,
  context_type TEXT,
  equipment_type TEXT,
  equipment_record_id UUID,
  source_label TEXT,
  context_key TEXT,
  first_activity_at TIMESTAMP WITH TIME ZONE,
  last_activity_at TIMESTAMP WITH TIME ZONE,
  total_saves INTEGER,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_context_type TEXT := LOWER(BTRIM(COALESCE(p_context_type, '')));
  v_equipment_type TEXT := LOWER(BTRIM(COALESCE(p_equipment_type, '')));
  v_context_key TEXT;
BEGIN
  IF auth.role() <> 'authenticated' OR auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuario autenticado nao encontrado.';
  END IF;

  PERFORM public.ensure_empresa_membership_bootstrap(p_empresa_id);

  IF NOT public.can_access_empresa(p_empresa_id) THEN
    RAISE EXCEPTION 'Acesso negado para a empresa informada.';
  END IF;

  IF v_context_type NOT IN ('principal', 'equipamento') THEN
    RAISE EXCEPTION 'Tipo de contexto invalido. Use principal ou equipamento.';
  END IF;

  IF v_context_type = 'equipamento' AND (v_equipment_type = '' OR p_equipment_record_id IS NULL) THEN
    RAISE EXCEPTION 'Checklist de equipamento exige tipo e registro do equipamento.';
  END IF;

  IF v_context_type = 'principal' THEN
    v_equipment_type := NULL;
    p_equipment_record_id := NULL;
    v_context_key :=
      p_empresa_id::TEXT
      || ':'
      || auth.uid()::TEXT
      || ':'
      || COALESCE(NULLIF(BTRIM(p_inspection_code), ''), 'sem-codigo')
      || ':principal';
  ELSE
    v_context_key :=
      p_empresa_id::TEXT
      || ':'
      || auth.uid()::TEXT
      || ':'
      || COALESCE(NULLIF(BTRIM(p_inspection_code), ''), 'sem-codigo')
      || ':equipamento:'
      || COALESCE(v_equipment_type, 'sem-tipo')
      || ':'
      || p_equipment_record_id::TEXT;
  END IF;

  RETURN QUERY
  INSERT INTO public.empresa_checklist_execucoes (
    empresa_id,
    user_id,
    inspection_code,
    inspection_name,
    context_type,
    equipment_type,
    equipment_record_id,
    source_label,
    context_key
  )
  VALUES (
    p_empresa_id,
    auth.uid(),
    COALESCE(NULLIF(BTRIM(p_inspection_code), ''), 'Sem codigo'),
    COALESCE(NULLIF(BTRIM(p_inspection_name), ''), 'Checklist sem nome'),
    v_context_type,
    v_equipment_type,
    p_equipment_record_id,
    NULLIF(BTRIM(COALESCE(p_source_label, '')), ''),
    v_context_key
  )
  ON CONFLICT (context_key)
  DO UPDATE
    SET inspection_code = EXCLUDED.inspection_code,
        inspection_name = EXCLUDED.inspection_name,
        context_type = EXCLUDED.context_type,
        equipment_type = EXCLUDED.equipment_type,
        equipment_record_id = EXCLUDED.equipment_record_id,
        source_label = EXCLUDED.source_label,
        last_activity_at = now(),
        total_saves = public.empresa_checklist_execucoes.total_saves + 1,
        updated_at = now()
  RETURNING
    empresa_checklist_execucoes.id,
    empresa_checklist_execucoes.empresa_id,
    empresa_checklist_execucoes.user_id,
    empresa_checklist_execucoes.inspection_code,
    empresa_checklist_execucoes.inspection_name,
    empresa_checklist_execucoes.context_type,
    empresa_checklist_execucoes.equipment_type,
    empresa_checklist_execucoes.equipment_record_id,
    empresa_checklist_execucoes.source_label,
    empresa_checklist_execucoes.context_key,
    empresa_checklist_execucoes.first_activity_at,
    empresa_checklist_execucoes.last_activity_at,
    empresa_checklist_execucoes.total_saves,
    empresa_checklist_execucoes.created_at,
    empresa_checklist_execucoes.updated_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_empresa_relatorio_assinaturas(p_empresa_id UUID)
RETURNS TABLE (
  user_id UUID,
  nome TEXT,
  email TEXT,
  papel TEXT,
  is_gestor BOOLEAN,
  assinatura_nome TEXT,
  executed_checklists JSONB,
  first_activity_at TIMESTAMP WITH TIME ZONE,
  last_activity_at TIMESTAMP WITH TIME ZONE,
  total_checklists INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.ensure_empresa_membership_bootstrap(p_empresa_id);

  IF NOT public.can_access_empresa(p_empresa_id) THEN
    RAISE EXCEPTION 'Acesso negado para a empresa informada.';
  END IF;

  RETURN QUERY
  WITH empresa_base AS (
    SELECT id, responsavel
    FROM public.empresa
    WHERE id = p_empresa_id
  ),
  membros AS (
    SELECT
      empresa_usuarios.user_id,
      COALESCE(NULLIF(BTRIM(profiles.nome), ''), profiles.email, 'Usuario sem nome') AS nome,
      profiles.email,
      empresa_usuarios.papel
    FROM public.empresa_usuarios
    INNER JOIN public.profiles
      ON profiles.id = empresa_usuarios.user_id
    WHERE empresa_usuarios.empresa_id = p_empresa_id
  ),
  execucoes AS (
    SELECT
      empresa_checklist_execucoes.user_id,
      jsonb_agg(
        jsonb_build_object(
          'inspection_code', empresa_checklist_execucoes.inspection_code,
          'inspection_name', empresa_checklist_execucoes.inspection_name,
          'context_type', empresa_checklist_execucoes.context_type,
          'equipment_type', empresa_checklist_execucoes.equipment_type,
          'equipment_record_id', empresa_checklist_execucoes.equipment_record_id,
          'source_label', empresa_checklist_execucoes.source_label,
          'first_activity_at', empresa_checklist_execucoes.first_activity_at,
          'last_activity_at', empresa_checklist_execucoes.last_activity_at,
          'total_saves', empresa_checklist_execucoes.total_saves
        )
        ORDER BY
          empresa_checklist_execucoes.inspection_code,
          empresa_checklist_execucoes.context_type,
          COALESCE(empresa_checklist_execucoes.source_label, '')
      ) AS executed_checklists,
      MIN(empresa_checklist_execucoes.first_activity_at) AS first_activity_at,
      MAX(empresa_checklist_execucoes.last_activity_at) AS last_activity_at,
      COUNT(*)::INTEGER AS total_checklists
    FROM public.empresa_checklist_execucoes
    WHERE empresa_checklist_execucoes.empresa_id = p_empresa_id
    GROUP BY empresa_checklist_execucoes.user_id
  )
  SELECT
    membros.user_id,
    membros.nome,
    membros.email,
    membros.papel,
    (membros.papel = 'gestor') AS is_gestor,
    CASE
      WHEN membros.papel = 'gestor'
        THEN COALESCE(NULLIF(BTRIM(empresa_base.responsavel), ''), membros.nome)
      ELSE membros.nome
    END AS assinatura_nome,
    COALESCE(execucoes.executed_checklists, '[]'::JSONB) AS executed_checklists,
    execucoes.first_activity_at,
    execucoes.last_activity_at,
    COALESCE(execucoes.total_checklists, 0) AS total_checklists
  FROM membros
  CROSS JOIN empresa_base
  LEFT JOIN execucoes
    ON execucoes.user_id = membros.user_id
  WHERE membros.papel = 'gestor'
     OR execucoes.user_id IS NOT NULL
  ORDER BY
    CASE WHEN membros.papel = 'gestor' THEN 0 ELSE 1 END,
    membros.nome;
END;
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
  PERFORM public.ensure_empresa_membership_bootstrap(p_empresa_id);

  IF NOT public.can_access_empresa(p_empresa_id) THEN
    RAISE EXCEPTION 'Acesso negado para a empresa informada.';
  END IF;

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
DECLARE
  v_record RECORD;
BEGIN
  SELECT *
  INTO v_record
  FROM (
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
    WHERE item.public_token = p_token
  ) AS resolved
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Equipamento nao encontrado para o token informado.';
  END IF;

  PERFORM public.ensure_empresa_membership_bootstrap(v_record.empresa_id);

  IF NOT public.can_access_empresa(v_record.empresa_id) THEN
    RAISE EXCEPTION 'Acesso negado para a empresa informada.';
  END IF;

  RETURN QUERY
  SELECT
    v_record.equipment_type,
    v_record.equipment_id,
    v_record.empresa_id,
    v_record.empresa_razao_social,
    v_record.numero,
    v_record.localizacao,
    v_record.titulo,
    v_record.subtitulo,
    v_record.qr_code_url,
    v_record.qr_code_svg,
    v_record.checklist_snapshot,
    v_record.equipment_data;
END;
$$;

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
  SELECT 'extintor', item.id, item.empresa_id
  INTO v_equipment_type, v_equipment_id, v_empresa_id
  FROM public.empresa_extintores AS item
  WHERE item.public_token = p_token;

  IF NOT FOUND THEN
    SELECT 'hidrante', item.id, item.empresa_id
    INTO v_equipment_type, v_equipment_id, v_empresa_id
    FROM public.empresa_hidrantes AS item
    WHERE item.public_token = p_token;
  END IF;

  IF NOT FOUND THEN
    SELECT 'luminaria', item.id, item.empresa_id
    INTO v_equipment_type, v_equipment_id, v_empresa_id
    FROM public.empresa_luminarias AS item
    WHERE item.public_token = p_token;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Equipamento nao encontrado para o token informado.';
  END IF;

  PERFORM public.ensure_empresa_membership_bootstrap(v_empresa_id);

  IF NOT public.can_access_empresa(v_empresa_id) THEN
    RAISE EXCEPTION 'Acesso negado para a empresa informada.';
  END IF;

  IF v_equipment_type = 'extintor' THEN
    v_inspection_code := 'A.23';
    UPDATE public.empresa_extintores
    SET checklist_snapshot = v_snapshot
    WHERE id = v_equipment_id;
  ELSIF v_equipment_type = 'hidrante' THEN
    v_inspection_code := 'A.25';
    UPDATE public.empresa_hidrantes
    SET checklist_snapshot = v_snapshot
    WHERE id = v_equipment_id;
  ELSE
    v_inspection_code := 'A.19';
    UPDATE public.empresa_luminarias
    SET checklist_snapshot = v_snapshot
    WHERE id = v_equipment_id;
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
    INSERT INTO public.empresa_checklist_respostas (empresa_id, checklist_item_id, status, observacoes)
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
      CROSS JOIN LATERAL jsonb_array_elements(COALESCE(equipamento.checklist_snapshot->'items', '[]'::jsonb)) AS item
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
    INSERT INTO public.empresa_checklist_respostas (empresa_id, checklist_item_id, status, observacoes)
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
      CROSS JOIN LATERAL jsonb_array_elements(COALESCE(equipamento.checklist_snapshot->'items', '[]'::jsonb)) AS item
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
    INSERT INTO public.empresa_checklist_respostas (empresa_id, checklist_item_id, status, observacoes)
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
      CROSS JOIN LATERAL jsonb_array_elements(COALESCE(equipamento.checklist_snapshot->'items', '[]'::jsonb)) AS item
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
  SELECT v_equipment_type, v_equipment_id, v_empresa_id, v_snapshot;
END;
$$;

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

  PERFORM public.ensure_empresa_membership_bootstrap(v_empresa_id);

  IF NOT public.can_access_empresa(v_empresa_id) THEN
    RAISE EXCEPTION 'Acesso negado para a empresa informada.';
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

  PERFORM public.ensure_empresa_membership_bootstrap(v_empresa_id);

  IF NOT public.can_access_empresa(v_empresa_id) THEN
    RAISE EXCEPTION 'Acesso negado para a empresa informada.';
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

REVOKE ALL ON FUNCTION public.list_empresa_usuarios(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.add_empresa_usuario_by_email(UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_empresa_usuario_role(UUID, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.remove_empresa_usuario(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.register_checklist_execution(UUID, TEXT, TEXT, TEXT, TEXT, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_empresa_relatorio_assinaturas(UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.list_empresa_usuarios(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_empresa_usuario_by_email(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_empresa_usuario_role(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_empresa_usuario(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_checklist_execution(UUID, TEXT, TEXT, TEXT, TEXT, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_empresa_relatorio_assinaturas(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_equipment_qr_page(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_equipment_qr_checklist(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_equipment_qr_non_conformities(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_equipment_qr_non_conformity(UUID, UUID, TEXT, TEXT) TO authenticated;
