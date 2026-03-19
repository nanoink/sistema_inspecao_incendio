CREATE TABLE public.empresa_checklist_nao_conformidades (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  context_key TEXT NOT NULL UNIQUE,
  empresa_id UUID NOT NULL REFERENCES public.empresa(id) ON DELETE CASCADE,
  checklist_item_id UUID NOT NULL REFERENCES public.checklist_itens_modelo(id) ON DELETE CASCADE,
  equipment_type TEXT,
  equipment_record_id UUID,
  descricao TEXT NOT NULL DEFAULT '',
  imagem_data_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT empresa_checklist_nao_conformidades_equipment_scope_check CHECK (
    (equipment_type IS NULL AND equipment_record_id IS NULL)
    OR (
      equipment_type IN ('extintor', 'hidrante', 'luminaria')
      AND equipment_record_id IS NOT NULL
    )
  )
);

CREATE INDEX idx_empresa_checklist_nao_conformidades_empresa_id
  ON public.empresa_checklist_nao_conformidades(empresa_id);

CREATE INDEX idx_empresa_checklist_nao_conformidades_item_id
  ON public.empresa_checklist_nao_conformidades(checklist_item_id);

CREATE INDEX idx_empresa_checklist_nao_conformidades_equipment
  ON public.empresa_checklist_nao_conformidades(empresa_id, equipment_type, equipment_record_id);

ALTER TABLE public.empresa_checklist_nao_conformidades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view checklist non conformities"
  ON public.empresa_checklist_nao_conformidades
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert checklist non conformities"
  ON public.empresa_checklist_nao_conformidades
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update checklist non conformities"
  ON public.empresa_checklist_nao_conformidades
  FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete checklist non conformities"
  ON public.empresa_checklist_nao_conformidades
  FOR DELETE
  TO authenticated
  USING (true);

CREATE TRIGGER update_empresa_checklist_nao_conformidades_updated_at
BEFORE UPDATE ON public.empresa_checklist_nao_conformidades
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
