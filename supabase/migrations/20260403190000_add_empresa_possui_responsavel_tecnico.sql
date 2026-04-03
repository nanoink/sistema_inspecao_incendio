ALTER TABLE public.empresa
ADD COLUMN IF NOT EXISTS possui_responsavel_tecnico BOOLEAN NOT NULL DEFAULT false;
