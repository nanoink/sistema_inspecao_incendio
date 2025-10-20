-- Create table for inspection checklists
CREATE TABLE public.inspecoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo TEXT NOT NULL,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL, -- 'licenciamento' or 'renovacao'
  ordem INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.inspecoes ENABLE ROW LEVEL SECURITY;

-- Create policy to allow anyone to read
CREATE POLICY "Anyone can view inspections"
ON public.inspecoes
FOR SELECT
USING (true);

-- Create table for checklist items
CREATE TABLE public.checklist_itens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  inspecao_id UUID NOT NULL REFERENCES public.inspecoes(id) ON DELETE CASCADE,
  item_numero TEXT NOT NULL,
  descricao TEXT NOT NULL,
  ordem INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.checklist_itens ENABLE ROW LEVEL SECURITY;

-- Create policy to allow anyone to read
CREATE POLICY "Anyone can view checklist items"
ON public.checklist_itens
FOR SELECT
USING (true);

-- Create table for company checklist responses
CREATE TABLE public.empresa_checklist (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresa(id) ON DELETE CASCADE,
  checklist_item_id UUID NOT NULL REFERENCES public.checklist_itens(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'NA', -- 'C' (Conforme), 'NC' (Não Conforme), 'NA' (Não Aplicável)
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.empresa_checklist ENABLE ROW LEVEL SECURITY;

-- Create policies for empresa_checklist
CREATE POLICY "Anyone can view company checklists"
ON public.empresa_checklist
FOR SELECT
USING (true);

CREATE POLICY "Anyone can insert company checklists"
ON public.empresa_checklist
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can update company checklists"
ON public.empresa_checklist
FOR UPDATE
USING (true);

CREATE POLICY "Anyone can delete company checklists"
ON public.empresa_checklist
FOR DELETE
USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_empresa_checklist_updated_at
BEFORE UPDATE ON public.empresa_checklist
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert inspection types from the PDF (Tabelas de Renovação - A.2, A.4, A.7, etc.)
INSERT INTO public.inspecoes (codigo, nome, tipo, ordem) VALUES
('A.2', 'Informações básicas do PSCIE', 'renovacao', 1),
('A.4', 'Acesso de Viaturas', 'renovacao', 2),
('A.7', 'Compartimentação Horizontal', 'renovacao', 3),
('A.9', 'Compartimentação Vertical', 'renovacao', 4),
('A.11', 'Saída de Emergência – Escada Não Enclausurada (ENE)', 'renovacao', 5),
('A.13', 'Saída de Emergência – Escada Enclausurada Protegida (EEP)', 'renovacao', 6),
('A.15', 'Saída de Emergência – Escada à Prova de Fumaça - Dutos (EPF)', 'renovacao', 7),
('A.17', 'Saída de Emergência – Escada Pressurizada (EEPFP)', 'renovacao', 8),
('A.19', 'Iluminação de Emergência', 'renovacao', 9),
('A.21', 'Sinalização de Emergência', 'renovacao', 10),
('A.23', 'Extintores de Incêndio', 'renovacao', 11),
('A.25', 'Sistema de Hidrantes e Mangotinhos', 'renovacao', 12),
('A.27', 'Sistema de Chuveiros Automáticos (SPK)', 'renovacao', 13),
('A.29', 'Sistema de Alarme de Incêndio (SAI)', 'renovacao', 14),
('A.31', 'Sistema de Detecção e Alarme de Incêndio (SDAI)', 'renovacao', 15),
('A.33', 'Central e Rede de Distribuição Interna de GLP/GN', 'renovacao', 16),
('A.35', 'Sistema de Proteção Contra Descargas Atmosféricas (SPDA)', 'renovacao', 17),
('A.37', 'Controle de Material de Acabamento e Revestimento (CMAR)', 'renovacao', 18),
('A.39', 'Hidrante de Urbano de Coluna (HUC)', 'renovacao', 19);

-- Insert checklist items for A.2 - Informações básicas do PSCIE (Renovação)
INSERT INTO public.checklist_itens (inspecao_id, item_numero, descricao, ordem)
SELECT id, '1', 'Para a vistoria da Edificação e Área de Risco o vistoriador deverá estar de posse do Projeto Técnico.', 1
FROM public.inspecoes WHERE codigo = 'A.2'
UNION ALL
SELECT id, '2', 'Endereço', 2 FROM public.inspecoes WHERE codigo = 'A.2'
UNION ALL
SELECT id, '2.1', 'Verificar se o endereço cadastrado no sistema confere com o endereço "in loco".', 3
FROM public.inspecoes WHERE codigo = 'A.2'
UNION ALL
SELECT id, '3', 'Ocupação', 4 FROM public.inspecoes WHERE codigo = 'A.2'
UNION ALL
SELECT id, '3.1', 'Verificar se a ocupação "in loco" confere com o projeto aprovado.', 5
FROM public.inspecoes WHERE codigo = 'A.2'
UNION ALL
SELECT id, '4', 'Carga de Incêndio', 6 FROM public.inspecoes WHERE codigo = 'A.2'
UNION ALL
SELECT id, '4.1', 'Verificar se carga de incêndio confere com o projeto aprovado.', 7
FROM public.inspecoes WHERE codigo = 'A.2'
UNION ALL
SELECT id, '5', 'Altura da Edificação (em relação ao nível de terreno circundante)', 8
FROM public.inspecoes WHERE codigo = 'A.2'
UNION ALL
SELECT id, '5.1', 'Verificar se a altura da edificação confere com o projeto aprovado.', 9
FROM public.inspecoes WHERE codigo = 'A.2'
UNION ALL
SELECT id, '5.2', 'Verificar se o número de pavimentos confere com o projeto aprovado.', 10
FROM public.inspecoes WHERE codigo = 'A.2'
UNION ALL
SELECT id, '6', 'Área', 11 FROM public.inspecoes WHERE codigo = 'A.2'
UNION ALL
SELECT id, '6.1', 'Verificar se a área indicada em projeto confere com a área indicada em formulário de segurança da vistoria.', 12
FROM public.inspecoes WHERE codigo = 'A.2'
UNION ALL
SELECT id, '6.2', 'Verificar se a área de projeto confere com a área "in loco".', 13
FROM public.inspecoes WHERE codigo = 'A.2'
UNION ALL
SELECT id, '6.3', 'Verificar se taxa de vistoria foi pago baseado na área de vistoria.', 14
FROM public.inspecoes WHERE codigo = 'A.2'
UNION ALL
SELECT id, '7', 'Edificações no mesmo lote', 15 FROM public.inspecoes WHERE codigo = 'A.2'
UNION ALL
SELECT id, '7.1', 'Verificar a compatibilidade do número de edificações a serem vistoriada "in loco" com o número de edificações indicadas em projeto.', 16
FROM public.inspecoes WHERE codigo = 'A.2'
UNION ALL
SELECT id, '8', 'Edificações Vizinhas', 17 FROM public.inspecoes WHERE codigo = 'A.2'
UNION ALL
SELECT id, '8.1', 'Verificar se existe comunicação entre a edificação vistoriada e as edificações vizinhas localizadas em lotes distintos.', 18
FROM public.inspecoes WHERE codigo = 'A.2'
UNION ALL
SELECT id, '9', 'Medidas de Segurança e Áreas de Risco', 19 FROM public.inspecoes WHERE codigo = 'A.2'
UNION ALL
SELECT id, '9.1', 'Selecionar os checklists das medidas de segurança e áreas de risco que deverão ser utilizados na vistoria.', 20
FROM public.inspecoes WHERE codigo = 'A.2'
UNION ALL
SELECT id, '10', 'Exigência Complementar', 21 FROM public.inspecoes WHERE codigo = 'A.2'
UNION ALL
SELECT id, '10.1', 'Verificar se as instalações e conexões elétricas da edificação ou área de risco estão em boas condições visuais (conduites, sem pontas ou fiações expostas, etc).', 22
FROM public.inspecoes WHERE codigo = 'A.2'
UNION ALL
SELECT id, '11', 'Outros', 23 FROM public.inspecoes WHERE codigo = 'A.2';

-- Insert checklist items for A.4 - Acesso de Viaturas (Renovação)
INSERT INTO public.checklist_itens (inspecao_id, item_numero, descricao, ordem)
SELECT id, '1', 'Procedimentos iniciais antes da vistoria "in loco" - Para a Inspeção da medida de segurança acesso de viatura o vistoriador deverá estar de posse do Projeto Técnico', 1
FROM public.inspecoes WHERE codigo = 'A.4'
UNION ALL
SELECT id, '2', 'Localização da(s) via(s) de tráfego de veículos - Verificar se a localização dos arruamentos ou vias de acesso que são limítrofes à edificação estão de acordo com o projeto aprovado (planta de localização e planta de situação).', 2
FROM public.inspecoes WHERE codigo = 'A.4'
UNION ALL
SELECT id, '3', 'Características da(s) via(s) de acesso - Verificar altura livre mínima de 4,50 m', 3
FROM public.inspecoes WHERE codigo = 'A.4'
UNION ALL
SELECT id, '3.1', 'Verificar largura mínima de 4,00 m', 4
FROM public.inspecoes WHERE codigo = 'A.4'
UNION ALL
SELECT id, '3.2', 'Verificar altura mínima de 4,5 m para guarita de acesso (condomínios)', 5
FROM public.inspecoes WHERE codigo = 'A.4'
UNION ALL
SELECT id, '3.3', 'Verificar largura mínima de 4,0 m para guarita de acesso (condomínios)', 6
FROM public.inspecoes WHERE codigo = 'A.4'
UNION ALL
SELECT id, '4', 'Outros', 7
FROM public.inspecoes WHERE codigo = 'A.4';