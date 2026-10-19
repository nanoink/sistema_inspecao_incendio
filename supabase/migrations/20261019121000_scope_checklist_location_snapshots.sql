-- Os snapshots de equipamentos e relatórios também carregam as coordenadas.
-- Restringir essas cópias à mesma empresa, inclusive em bases com políticas legadas.
DO $$
DECLARE
  target_table text;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'empresa_extintores', 'empresa_hidrantes', 'empresa_luminarias', 'empresa_relatorios'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', target_table);
    EXECUTE format(
      'CREATE POLICY "Company scoped checklist location snapshots" ON public.%I
       AS RESTRICTIVE FOR ALL TO authenticated
       USING (public.can_access_empresa(empresa_id))
       WITH CHECK (public.can_access_empresa(empresa_id))', target_table
    );
  END LOOP;
END;
$$;
