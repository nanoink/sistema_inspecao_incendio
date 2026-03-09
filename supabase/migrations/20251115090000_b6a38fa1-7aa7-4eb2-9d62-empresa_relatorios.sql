CREATE TABLE public.empresa_relatorios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL UNIQUE REFERENCES public.empresa(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL DEFAULT 'Relatorio de Inspecao',
  numero_relatorio TEXT,
  data_inspecao DATE,
  data_emissao DATE,
  hora_inicio TIME,
  hora_fim TIME,
  inspetor_nome TEXT,
  inspetor_cargo TEXT,
  representante_nome TEXT,
  representante_cargo TEXT,
  objetivo TEXT,
  escopo TEXT,
  observacoes_gerais TEXT,
  recomendacoes TEXT,
  conclusao TEXT,
  status TEXT NOT NULL DEFAULT 'rascunho',
  checklist_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  dados_adicionais JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.empresa_relatorios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view company reports"
  ON public.empresa_relatorios
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert company reports"
  ON public.empresa_relatorios
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update company reports"
  ON public.empresa_relatorios
  FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete company reports"
  ON public.empresa_relatorios
  FOR DELETE
  USING (auth.role() = 'authenticated');

CREATE TRIGGER update_empresa_relatorios_updated_at
  BEFORE UPDATE ON public.empresa_relatorios
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
