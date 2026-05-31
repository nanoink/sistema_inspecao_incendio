WITH upsert_model AS (
  INSERT INTO public.checklist_modelos (
    codigo,
    nome,
    titulo,
    tipo,
    ordem,
    total_grupos,
    ativo
  )
  VALUES (
    'A.41',
    'Fontes de Calor e Materiais Combustiveis',
    'CHECKLIST INTELIGENTE DE INSPECAO - FONTES DE CALOR E MATERIAIS COMBUSTIVEIS',
    'renovacao',
    18,
    3,
    true
  )
  ON CONFLICT (codigo) DO UPDATE
  SET
    nome = EXCLUDED.nome,
    titulo = EXCLUDED.titulo,
    tipo = EXCLUDED.tipo,
    ordem = EXCLUDED.ordem,
    total_grupos = EXCLUDED.total_grupos,
    ativo = EXCLUDED.ativo
  RETURNING id
)
INSERT INTO public.checklist_grupos (
  modelo_id,
  titulo,
  tipo,
  ordem
)
SELECT
  upsert_model.id,
  payload.titulo,
  payload.tipo,
  payload.ordem
FROM upsert_model
JOIN (
  VALUES
    ('Fontes de Calor e Ignicao', 'grupo', 1),
    ('Controle de Materiais Combustiveis', 'grupo', 2),
    ('Distanciamento e Segregacao', 'grupo', 3)
) AS payload(titulo, tipo, ordem)
  ON true
ON CONFLICT (modelo_id, ordem) DO UPDATE
SET
  titulo = EXCLUDED.titulo,
  tipo = EXCLUDED.tipo;

WITH target_model AS (
  SELECT id
  FROM public.checklist_modelos
  WHERE codigo = 'A.41'
),
target_groups AS (
  SELECT id, ordem
  FROM public.checklist_grupos
  WHERE modelo_id = (SELECT id FROM target_model)
),
payload AS (
  VALUES
    (1, '1', 'Quadros eletricos identificados e acessiveis', 1),
    (1, '2', 'Ausencia de aquecimento anormal em quadros', 2),
    (1, '3', 'Cabos eletricos sem danos aparentes', 3),
    (1, '4', 'Ausencia de ligacoes improvisadas', 4),
    (1, '5', 'Equipamentos termicos monitorados', 5),
    (1, '6', 'Trabalho a quente com Permissao de Trabalho', 6),
    (1, '7', 'Extintor disponivel proximo ao servico', 7),
    (2, '1', 'Materiais combustiveis armazenados adequadamente', 1),
    (2, '2', 'Ausencia de acumulo de papel/papelao', 2),
    (2, '3', 'Liquidos inflamaveis identificados', 3),
    (2, '4', 'Recipientes integros e fechados', 4),
    (2, '5', 'GLP armazenado conforme norma', 5),
    (2, '6', 'Controle de carga de incendio implementado', 6),
    (3, '1', 'Distancia segura entre calor e combustivel', 1),
    (3, '2', 'Rotas de fuga desobstruidas', 2),
    (3, '3', 'Sinalizacao de risco instalada', 3),
    (3, '4', 'Extintores acessiveis e compativeis', 4)
),
named_payload(grupo_ordem, numero_original, descricao, ordem) AS (
  SELECT *
  FROM payload
)
INSERT INTO public.checklist_itens_modelo (
  grupo_id,
  numero_original,
  descricao,
  complemento,
  tipo,
  avaliavel,
  ordem
)
SELECT
  target_groups.id,
  named_payload.numero_original,
  named_payload.descricao,
  NULL,
  'item',
  true,
  named_payload.ordem
FROM named_payload
JOIN target_groups
  ON target_groups.ordem = named_payload.grupo_ordem
ON CONFLICT (grupo_id, ordem) DO UPDATE
SET
  numero_original = EXCLUDED.numero_original,
  descricao = EXCLUDED.descricao,
  complemento = EXCLUDED.complemento,
  tipo = EXCLUDED.tipo,
  avaliavel = EXCLUDED.avaliavel;
