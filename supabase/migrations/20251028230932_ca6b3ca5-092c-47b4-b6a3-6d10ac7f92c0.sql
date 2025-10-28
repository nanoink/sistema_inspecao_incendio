-- Drop existing tables and recreate with new structure
DROP TABLE IF EXISTS public.empresa_exigencias CASCADE;
DROP TABLE IF EXISTS public.exigencias_seguranca CASCADE;

-- Create new exigencias_seguranca table with categories and order
CREATE TABLE public.exigencias_seguranca (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo TEXT NOT NULL,
  nome TEXT NOT NULL,
  categoria TEXT NOT NULL,
  subcategoria TEXT,
  ordem INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create exigencias_criterios table to define which requirements apply to which company characteristics
CREATE TABLE public.exigencias_criterios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  exigencia_id UUID NOT NULL REFERENCES public.exigencias_seguranca(id) ON DELETE CASCADE,
  divisao TEXT, -- A-1, A-2, B-1, etc. (null means applies to all)
  area_min NUMERIC, -- minimum area in m²
  area_max NUMERIC, -- maximum area in m²
  altura_min NUMERIC, -- minimum height in m
  altura_max NUMERIC, -- maximum height in m
  altura_tipo TEXT, -- I, II, III, IV, V
  observacao TEXT, -- additional notes about applicability
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create empresa_exigencias table
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
ALTER TABLE public.exigencias_criterios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.empresa_exigencias ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Anyone can view requirements" ON public.exigencias_seguranca FOR SELECT USING (true);
CREATE POLICY "Anyone can view criteria" ON public.exigencias_criterios FOR SELECT USING (true);
CREATE POLICY "Anyone can view company requirements" ON public.empresa_exigencias FOR SELECT USING (true);
CREATE POLICY "Anyone can insert company requirements" ON public.empresa_exigencias FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update company requirements" ON public.empresa_exigencias FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete company requirements" ON public.empresa_exigencias FOR DELETE USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_empresa_exigencias_updated_at
  BEFORE UPDATE ON public.empresa_exigencias
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert all security requirements with categories
-- Category 1: Restrição ao Surgimento e à Propagação de Incêndio (yellow)
INSERT INTO public.exigencias_seguranca (codigo, nome, categoria, subcategoria, ordem) VALUES
('1.1', 'Compartimentação Horizontal', 'Restrição ao Surgimento e à Propagação de Incêndio', NULL, 1),
('1.2', 'Compartimentação Vertical', 'Restrição ao Surgimento e à Propagação de Incêndio', NULL, 2),
('1.3', 'Controle de Materiais de Acabamento e Revestimento - CMAR', 'Restrição ao Surgimento e à Propagação de Incêndio', NULL, 3),
('1.4', 'Sistema de Proteção contra Descargas Atmosféricas - SPDA', 'Restrição ao Surgimento e à Propagação de Incêndio', NULL, 4);

-- Category 2: Controle de Crescimento e Supressão de Incêndio (red)
INSERT INTO public.exigencias_seguranca (codigo, nome, categoria, subcategoria, ordem) VALUES
('2.1', 'Sistemas de Extintores de Incêndio', 'Controle de Crescimento e Supressão de Incêndio', NULL, 5),
('2.2', 'Sistema de Hidrantes e Mangotinhos', 'Controle de Crescimento e Supressão de Incêndio', NULL, 6),
('2.3', 'Sistema de Chuveiros Automáticos', 'Controle de Crescimento e Supressão de Incêndio', NULL, 7),
('2.4', 'Sistema de Supressão de Incêndio', 'Controle de Crescimento e Supressão de Incêndio', NULL, 8),
('2.5', 'Sistema de Espuma', 'Controle de Crescimento e Supressão de Incêndio', NULL, 9);

-- Category 3: Meios de Aviso (blue)
INSERT INTO public.exigencias_seguranca (codigo, nome, categoria, subcategoria, ordem) VALUES
('3.1', 'Sistema de Detecção de Incêndio', 'Meios de Aviso', NULL, 10),
('3.2', 'Sistema de Alarme de Incêndio', 'Meios de Aviso', NULL, 11);

-- Category 4: Facilidades no Abandono (green)
INSERT INTO public.exigencias_seguranca (codigo, nome, categoria, subcategoria, ordem) VALUES
('4.1', 'Saídas de Emergência', 'Facilidades no Abandono', NULL, 12),
('4.2', 'Iluminação de Emergência', 'Facilidades no Abandono', NULL, 13),
('4.3', 'Sinalização de Emergência', 'Facilidades no Abandono', NULL, 14);

-- Category 5: Acesso e Facilidades para Operações de Socorro (yellow-orange)
INSERT INTO public.exigencias_seguranca (codigo, nome, categoria, subcategoria, ordem) VALUES
('5.1', 'Acesso de Viatura na Edificação', 'Acesso e Facilidades para Operações de Socorro', NULL, 15),
('5.2', 'Hidrante Público', 'Acesso e Facilidades para Operações de Socorro', NULL, 16);

-- Category 6: Proteção Estrutural em Situações de Incêndio (gray)
INSERT INTO public.exigencias_seguranca (codigo, nome, categoria, ordem) VALUES
('6.1', 'Segurança Estrutural contra Incêndio', 'Proteção Estrutural em Situações de Incêndio', 17);

-- Category 7: Gerenciamento de Risco de Incêndio (orange)
INSERT INTO public.exigencias_seguranca (codigo, nome, categoria, subcategoria, ordem) VALUES
('7.1', 'Brigada de Incêndio', 'Gerenciamento de Risco de Incêndio', NULL, 18),
('7.2', 'Brigada Profissional', 'Gerenciamento de Risco de Incêndio', NULL, 19),
('7.3', 'Programa de Segurança contra Incêndio e Emergências - PSIE', 'Gerenciamento de Risco de Incêndio', NULL, 20),
('7.4', 'Plano de Emergência contra Incêndio', 'Gerenciamento de Risco de Incêndio', NULL, 21);

-- Category 8: Controle de Fumaça e Gases (light blue)
INSERT INTO public.exigencias_seguranca (codigo, nome, categoria, ordem) VALUES
('8.1', 'Sistema de Controle de Fumaça', 'Controle de Fumaça e Gases', 22);