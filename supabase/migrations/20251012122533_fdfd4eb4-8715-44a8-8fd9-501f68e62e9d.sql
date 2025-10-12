-- Create CNAE catalog table (will be populated with CSV data)
CREATE TABLE public.cnae_catalogo (
  cnae TEXT PRIMARY KEY,
  grupo TEXT NOT NULL,
  ocupacao_uso TEXT NOT NULL,
  divisao TEXT NOT NULL,
  descricao TEXT NOT NULL,
  carga_incendio_mj_m2 NUMERIC NOT NULL
);

-- Create building height reference table (Table 2 from IT-01)
CREATE TABLE public.altura_ref (
  tipo TEXT PRIMARY KEY CHECK (tipo IN ('I', 'II', 'III', 'IV', 'V')),
  denominacao TEXT NOT NULL,
  h_min_m NUMERIC,
  h_max_m NUMERIC
);

-- Populate altura_ref with fixed values from IT-01 Table 2
INSERT INTO public.altura_ref (tipo, denominacao, h_min_m, h_max_m) VALUES
  ('I', 'Edificação Térrea', NULL, NULL),
  ('II', 'Edificação de Baixa Altura', NULL, 6),
  ('III', 'Edificação de Baixa-Média Altura', 6, 12),
  ('IV', 'Edificação de Média Altura', 12, 30),
  ('V', 'Edificação de Grande Altura', 30, NULL);

-- Create empresa table
CREATE TABLE public.empresa (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Company data
  razao_social TEXT NOT NULL,
  nome_fantasia TEXT,
  cnpj TEXT NOT NULL UNIQUE,
  responsavel TEXT NOT NULL,
  email TEXT NOT NULL,
  telefone TEXT NOT NULL,
  
  -- Address data
  cep TEXT NOT NULL,
  rua TEXT NOT NULL,
  numero TEXT NOT NULL,
  bairro TEXT NOT NULL,
  cidade TEXT NOT NULL,
  estado TEXT NOT NULL,
  
  -- CNAE and auto-filled data
  cnae TEXT,
  grupo TEXT,
  ocupacao_uso TEXT,
  divisao TEXT,
  descricao TEXT,
  carga_incendio_mj_m2 NUMERIC,
  
  -- Classification data
  altura_tipo TEXT REFERENCES public.altura_ref(tipo),
  altura_denominacao TEXT,
  area_m2 NUMERIC NOT NULL,
  numero_ocupantes INTEGER NOT NULL,
  grau_risco TEXT CHECK (grau_risco IN ('baixo', 'medio', 'alto')),
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE public.cnae_catalogo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.altura_ref ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.empresa ENABLE ROW LEVEL SECURITY;

-- RLS Policies for cnae_catalogo (read-only for all)
CREATE POLICY "Anyone can read CNAE catalog"
  ON public.cnae_catalogo
  FOR SELECT
  USING (true);

-- RLS Policies for altura_ref (read-only for all)
CREATE POLICY "Anyone can read height reference"
  ON public.altura_ref
  FOR SELECT
  USING (true);

-- RLS Policies for empresa (public access for now - can be restricted later)
CREATE POLICY "Anyone can view companies"
  ON public.empresa
  FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert companies"
  ON public.empresa
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update companies"
  ON public.empresa
  FOR UPDATE
  USING (true);

CREATE POLICY "Anyone can delete companies"
  ON public.empresa
  FOR DELETE
  USING (true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_empresa_updated_at
  BEFORE UPDATE ON public.empresa
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();