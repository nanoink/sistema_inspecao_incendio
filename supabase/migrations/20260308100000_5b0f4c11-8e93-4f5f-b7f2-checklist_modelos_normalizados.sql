CREATE TABLE public.checklist_modelos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  titulo TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'renovacao',
  ordem INTEGER NOT NULL,
  total_grupos INTEGER,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.checklist_grupos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  modelo_id UUID NOT NULL REFERENCES public.checklist_modelos(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'grupo' CHECK (tipo IN ('grupo', 'outros')),
  ordem INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (modelo_id, ordem)
);

CREATE TABLE public.checklist_itens_modelo (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  grupo_id UUID NOT NULL REFERENCES public.checklist_grupos(id) ON DELETE CASCADE,
  numero_original TEXT,
  descricao TEXT NOT NULL,
  complemento TEXT,
  tipo TEXT NOT NULL DEFAULT 'item' CHECK (tipo IN ('item', 'informativo')),
  avaliavel BOOLEAN NOT NULL DEFAULT true,
  ordem INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (grupo_id, ordem)
);

CREATE TABLE public.empresa_checklist_respostas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresa(id) ON DELETE CASCADE,
  checklist_item_id UUID NOT NULL REFERENCES public.checklist_itens_modelo(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'NA' CHECK (status IN ('C', 'NC', 'NA')),
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, checklist_item_id)
);

CREATE INDEX idx_checklist_grupos_modelo_id ON public.checklist_grupos(modelo_id);
CREATE INDEX idx_checklist_itens_modelo_grupo_id ON public.checklist_itens_modelo(grupo_id);
CREATE INDEX idx_empresa_checklist_respostas_empresa_id ON public.empresa_checklist_respostas(empresa_id);
CREATE INDEX idx_empresa_checklist_respostas_item_id ON public.empresa_checklist_respostas(checklist_item_id);

ALTER TABLE public.checklist_modelos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_grupos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_itens_modelo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.empresa_checklist_respostas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view checklist models"
  ON public.checklist_modelos
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can view checklist groups"
  ON public.checklist_grupos
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can view checklist template items"
  ON public.checklist_itens_modelo
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can view company checklist responses v2"
  ON public.empresa_checklist_respostas
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert company checklist responses v2"
  ON public.empresa_checklist_respostas
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update company checklist responses v2"
  ON public.empresa_checklist_respostas
  FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete company checklist responses v2"
  ON public.empresa_checklist_respostas
  FOR DELETE
  TO authenticated
  USING (true);

CREATE TRIGGER update_empresa_checklist_respostas_updated_at
BEFORE UPDATE ON public.empresa_checklist_respostas
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
