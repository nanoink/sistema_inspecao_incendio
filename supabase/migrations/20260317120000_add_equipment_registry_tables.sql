CREATE TABLE public.empresa_extintores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresa(id) ON DELETE CASCADE,
  numero TEXT NOT NULL,
  localizacao TEXT NOT NULL,
  tipo TEXT NOT NULL,
  carga_nominal TEXT NOT NULL,
  vencimento_carga DATE NOT NULL,
  vencimento_teste_hidrostatico_ano INTEGER NOT NULL CHECK (vencimento_teste_hidrostatico_ano >= 1900),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, numero)
);

CREATE TABLE public.empresa_hidrantes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresa(id) ON DELETE CASCADE,
  numero TEXT NOT NULL,
  localizacao TEXT NOT NULL,
  tipo_hidrante TEXT NOT NULL,
  mangueira1_tipo TEXT NOT NULL,
  mangueira1_vencimento_teste_hidrostatico DATE NOT NULL,
  mangueira2_tipo TEXT,
  mangueira2_vencimento_teste_hidrostatico DATE,
  esguicho BOOLEAN NOT NULL DEFAULT false,
  chave_mangueira BOOLEAN NOT NULL DEFAULT false,
  status TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, numero)
);

CREATE INDEX idx_empresa_extintores_empresa_id ON public.empresa_extintores(empresa_id);
CREATE INDEX idx_empresa_hidrantes_empresa_id ON public.empresa_hidrantes(empresa_id);

ALTER TABLE public.empresa_extintores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.empresa_hidrantes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view company extinguishers"
  ON public.empresa_extintores
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert company extinguishers"
  ON public.empresa_extintores
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update company extinguishers"
  ON public.empresa_extintores
  FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete company extinguishers"
  ON public.empresa_extintores
  FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can view company hydrants"
  ON public.empresa_hidrantes
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert company hydrants"
  ON public.empresa_hidrantes
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update company hydrants"
  ON public.empresa_hidrantes
  FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete company hydrants"
  ON public.empresa_hidrantes
  FOR DELETE
  TO authenticated
  USING (true);

CREATE TRIGGER update_empresa_extintores_updated_at
BEFORE UPDATE ON public.empresa_extintores
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_empresa_hidrantes_updated_at
BEFORE UPDATE ON public.empresa_hidrantes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
