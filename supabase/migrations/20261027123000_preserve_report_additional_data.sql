-- Older checklist clients send only report_cycle_id in dados_adicionais.
-- Treat that JSON as a patch, keeping permanent file paths and other fields.
CREATE OR REPLACE FUNCTION public.preserve_report_additional_data()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF jsonb_typeof(OLD.dados_adicionais) = 'object'
     AND jsonb_typeof(NEW.dados_adicionais) = 'object' THEN
    NEW.dados_adicionais := OLD.dados_adicionais || NEW.dados_adicionais;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS preserve_report_additional_data ON public.empresa_relatorios;
CREATE TRIGGER preserve_report_additional_data
BEFORE UPDATE OF dados_adicionais ON public.empresa_relatorios
FOR EACH ROW EXECUTE FUNCTION public.preserve_report_additional_data();

REVOKE ALL ON FUNCTION public.preserve_report_additional_data() FROM PUBLIC;
