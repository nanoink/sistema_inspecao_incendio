-- Create table for safety requirements (exigências)
CREATE TABLE public.exigencias_seguranca (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  categoria TEXT NOT NULL,
  ordem INTEGER NOT NULL
);

-- Create table for company requirements selection
CREATE TABLE public.empresa_exigencias (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresa(id) ON DELETE CASCADE,
  exigencia_id UUID NOT NULL REFERENCES public.exigencias_seguranca(id) ON DELETE CASCADE,
  atende BOOLEAN NOT NULL DEFAULT false,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(empresa_id, exigencia_id)
);

-- Enable RLS
ALTER TABLE public.exigencias_seguranca ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.empresa_exigencias ENABLE ROW LEVEL SECURITY;

-- Create policies for exigencias_seguranca
CREATE POLICY "Anyone can view requirements"
ON public.exigencias_seguranca FOR SELECT
USING (true);

-- Create policies for empresa_exigencias
CREATE POLICY "Anyone can view company requirements"
ON public.empresa_exigencias FOR SELECT
USING (true);

CREATE POLICY "Anyone can insert company requirements"
ON public.empresa_exigencias FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can update company requirements"
ON public.empresa_exigencias FOR UPDATE
USING (true);

CREATE POLICY "Anyone can delete company requirements"
ON public.empresa_exigencias FOR DELETE
USING (true);

-- Create trigger for empresa_exigencias
CREATE TRIGGER update_empresa_exigencias_updated_at
BEFORE UPDATE ON public.empresa_exigencias
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert base requirements from IT-01 Table 4
INSERT INTO public.exigencias_seguranca (codigo, nome, categoria, ordem) VALUES
-- Restrição ao Surgimento e à Propagação de Incêndio
('CMAR', 'Controle de Materiais de Acabamento e Revestimento', 'Restrição ao Surgimento e à Propagação de Incêndio', 1),
('CH', 'Compartimentação Horizontal', 'Restrição ao Surgimento e à Propagação de Incêndio', 2),
('CV', 'Compartimentação Vertical', 'Restrição ao Surgimento e à Propagação de Incêndio', 3),

-- Controle de Crescimento e Supressão de Incêndio
('SPDA', 'Sistema de Proteção contra Descargas Atmosféricas', 'Controle de Crescimento e Supressão de Incêndio', 4),
('EXT', 'Extintores de Incêndio', 'Controle de Crescimento e Supressão de Incêndio', 5),
('HM', 'Sistema de Hidrantes e Mangotinhos', 'Controle de Crescimento e Supressão de Incêndio', 6),
('CA', 'Sistema de Chuveiros Automáticos', 'Controle de Crescimento e Supressão de Incêndio', 7),

-- Detecção e Alarme
('DI', 'Sistema de Detecção de Incêndio', 'Detecção e Alarme', 8),
('AI', 'Sistema de Alarme de Incêndio', 'Detecção e Alarme', 9),

-- Facilidades no Abandono
('SE', 'Saídas de Emergência', 'Facilidades no Abandono', 10),
('IE', 'Iluminação de Emergência', 'Facilidades no Abandono', 11),
('SINE', 'Sinalização de Emergência', 'Facilidades no Abandono', 12),

-- Acesso e Facilidades para Operações de Socorro
('AVE', 'Acesso de Viatura na Edificação', 'Acesso e Facilidades para Operações de Socorro', 13),

-- Proteção Estrutural
('SEI', 'Segurança Estrutural contra Incêndio', 'Proteção Estrutural em Situações de Incêndio', 14),

-- Gerenciamento de Risco
('BI', 'Brigada de Incêndio', 'Gerenciamento de Risco de Incêndio', 15),
('PECI', 'Plano de Emergência contra Incêndio', 'Gerenciamento de Risco de Incêndio', 16),
('PSIE', 'Programa de Segurança contra Incêndio e Emergências', 'Gerenciamento de Risco de Incêndio', 17),

-- Sistemas Adicionais
('SCF', 'Sistema de Controle de Fumaça', 'Controle de Fumaça e Gases', 18);