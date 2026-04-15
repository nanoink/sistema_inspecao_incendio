ALTER TABLE public.empresa_checklist_respostas
ADD COLUMN IF NOT EXISTS preenchido_por_nome TEXT,
ADD COLUMN IF NOT EXISTS preenchido_por_user_id UUID,
ADD COLUMN IF NOT EXISTS preenchido_em TIMESTAMPTZ;
