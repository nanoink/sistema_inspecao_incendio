ALTER TABLE public.empresa
  ALTER COLUMN area_depositos_m2 DROP DEFAULT,
  ALTER COLUMN possui_atrio DROP DEFAULT;

UPDATE public.empresa
SET
  area_depositos_m2 = NULL,
  possui_atrio = NULL
WHERE area_maior_pavimento_m2 IS NULL
  AND altura_real_m IS NULL
  AND (
    area_depositos_m2 IS NOT NULL
    OR possui_atrio IS NOT NULL
  );

SELECT public.sync_empresa_exigencias(id) FROM public.empresa;
