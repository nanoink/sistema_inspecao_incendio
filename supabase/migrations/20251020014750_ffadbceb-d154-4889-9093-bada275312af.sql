-- Insert checklist items for A.7 - Compartimentação Horizontal (Renovação)
INSERT INTO public.checklist_itens (inspecao_id, item_numero, descricao, ordem)
SELECT id, '1', 'Para a Inspeção do Sistema de Compartimentação Horizontal o vistoriador deverá estar de posse do Projeto Técnico e, no caso de sistemas automatizados, responsável técnico para execução de testes dos sistemas.', 1
FROM public.inspecoes WHERE codigo = 'A.7'
UNION ALL
SELECT id, '2', 'Unidades Compartimentadas – UC', 2 FROM public.inspecoes WHERE codigo = 'A.7'
UNION ALL
SELECT id, '2.1', 'Verificar o número de unidades compartimentadas, bem como suas áreas, conforme indicado em projeto.', 3
FROM public.inspecoes WHERE codigo = 'A.7'
UNION ALL
SELECT id, '3', 'Divisória de Compartimentação entre as UC', 4 FROM public.inspecoes WHERE codigo = 'A.7'
UNION ALL
SELECT id, '3.1', 'Verificar a inexistência de qualquer abertura entre as unidades compartimentadas que não esteja prevista em projeto.', 5
FROM public.inspecoes WHERE codigo = 'A.7'
UNION ALL
SELECT id, '3.2', 'Verificar, caso haja abertura permanente (ex.: correias transportadoras), que está possua área máxima de 1,5 m² com proteção de cortina d''água conforme indicado em projeto.', 6
FROM public.inspecoes WHERE codigo = 'A.7'
UNION ALL
SELECT id, '4', 'Elementos que compõem a divisória das Unidades de Compartimentação', 7 FROM public.inspecoes WHERE codigo = 'A.7'
UNION ALL
SELECT id, '4.1', 'Verificar a integridade da parede de compartimentação.', 8
FROM public.inspecoes WHERE codigo = 'A.7'
UNION ALL
SELECT id, '5', 'Outros', 9 FROM public.inspecoes WHERE codigo = 'A.7';

-- Insert basic checklist items for remaining inspections
-- A.9 - Compartimentação Vertical
INSERT INTO public.checklist_itens (inspecao_id, item_numero, descricao, ordem)
SELECT id, '1', 'Verificar projeto técnico e execução conforme aprovado.', 1 FROM public.inspecoes WHERE codigo = 'A.9'
UNION ALL
SELECT id, '2', 'Verificar elementos de compartimentação vertical.', 2 FROM public.inspecoes WHERE codigo = 'A.9'
UNION ALL
SELECT id, '3', 'Outros', 3 FROM public.inspecoes WHERE codigo = 'A.9';

-- A.11 - Saída de Emergência – Escada Não Enclausurada (ENE)
INSERT INTO public.checklist_itens (inspecao_id, item_numero, descricao, ordem)
SELECT id, '1', 'Verificar projeto técnico das saídas de emergência.', 1 FROM public.inspecoes WHERE codigo = 'A.11'
UNION ALL
SELECT id, '2', 'Verificar dimensões e características da escada.', 2 FROM public.inspecoes WHERE codigo = 'A.11'
UNION ALL
SELECT id, '3', 'Verificar corrimãos e guarda-corpos.', 3 FROM public.inspecoes WHERE codigo = 'A.11'
UNION ALL
SELECT id, '4', 'Outros', 4 FROM public.inspecoes WHERE codigo = 'A.11';

-- A.13 - Saída de Emergência – Escada Enclausurada Protegida (EEP)
INSERT INTO public.checklist_itens (inspecao_id, item_numero, descricao, ordem)
SELECT id, '1', 'Verificar projeto técnico da escada enclausurada.', 1 FROM public.inspecoes WHERE codigo = 'A.13'
UNION ALL
SELECT id, '2', 'Verificar portas corta-fogo e sistema de ventilação.', 2 FROM public.inspecoes WHERE codigo = 'A.13'
UNION ALL
SELECT id, '3', 'Verificar dimensões e características.', 3 FROM public.inspecoes WHERE codigo = 'A.13'
UNION ALL
SELECT id, '4', 'Outros', 4 FROM public.inspecoes WHERE codigo = 'A.13';

-- A.15 - Saída de Emergência – Escada à Prova de Fumaça
INSERT INTO public.checklist_itens (inspecao_id, item_numero, descricao, ordem)
SELECT id, '1', 'Verificar projeto técnico da escada à prova de fumaça.', 1 FROM public.inspecoes WHERE codigo = 'A.15'
UNION ALL
SELECT id, '2', 'Verificar sistema de dutos e ventilação.', 2 FROM public.inspecoes WHERE codigo = 'A.15'
UNION ALL
SELECT id, '3', 'Verificar antecâmara e portas corta-fogo.', 3 FROM public.inspecoes WHERE codigo = 'A.15'
UNION ALL
SELECT id, '4', 'Outros', 4 FROM public.inspecoes WHERE codigo = 'A.15';

-- A.17 - Saída de Emergência – Escada Pressurizada (EEPFP)
INSERT INTO public.checklist_itens (inspecao_id, item_numero, descricao, ordem)
SELECT id, '1', 'Verificar projeto técnico da escada pressurizada.', 1 FROM public.inspecoes WHERE codigo = 'A.17'
UNION ALL
SELECT id, '2', 'Verificar sistema de pressurização e ventiladores.', 2 FROM public.inspecoes WHERE codigo = 'A.17'
UNION ALL
SELECT id, '3', 'Testar funcionamento do sistema de pressurização.', 3 FROM public.inspecoes WHERE codigo = 'A.17'
UNION ALL
SELECT id, '4', 'Outros', 4 FROM public.inspecoes WHERE codigo = 'A.17';

-- A.19 - Iluminação de Emergência
INSERT INTO public.checklist_itens (inspecao_id, item_numero, descricao, ordem)
SELECT id, '1', 'Verificar projeto técnico de iluminação de emergência.', 1 FROM public.inspecoes WHERE codigo = 'A.19'
UNION ALL
SELECT id, '2', 'Verificar luminárias e pontos de iluminação.', 2 FROM public.inspecoes WHERE codigo = 'A.19'
UNION ALL
SELECT id, '3', 'Testar funcionamento das luminárias.', 3 FROM public.inspecoes WHERE codigo = 'A.19'
UNION ALL
SELECT id, '4', 'Verificar autonomia do sistema.', 4 FROM public.inspecoes WHERE codigo = 'A.19'
UNION ALL
SELECT id, '5', 'Outros', 5 FROM public.inspecoes WHERE codigo = 'A.19';

-- A.21 - Sinalização de Emergência
INSERT INTO public.checklist_itens (inspecao_id, item_numero, descricao, ordem)
SELECT id, '1', 'Verificar projeto técnico de sinalização.', 1 FROM public.inspecoes WHERE codigo = 'A.21'
UNION ALL
SELECT id, '2', 'Verificar placas de sinalização e rotas de fuga.', 2 FROM public.inspecoes WHERE codigo = 'A.21'
UNION ALL
SELECT id, '3', 'Verificar sinalização fotoluminescente.', 3 FROM public.inspecoes WHERE codigo = 'A.21'
UNION ALL
SELECT id, '4', 'Outros', 4 FROM public.inspecoes WHERE codigo = 'A.21';

-- A.23 - Extintores de Incêndio
INSERT INTO public.checklist_itens (inspecao_id, item_numero, descricao, ordem)
SELECT id, '1', 'Verificar projeto técnico de extintores.', 1 FROM public.inspecoes WHERE codigo = 'A.23'
UNION ALL
SELECT id, '2', 'Verificar quantidade, tipo e localização dos extintores.', 2 FROM public.inspecoes WHERE codigo = 'A.23'
UNION ALL
SELECT id, '3', 'Verificar validade da carga e lacre.', 3 FROM public.inspecoes WHERE codigo = 'A.23'
UNION ALL
SELECT id, '4', 'Verificar sinalização dos extintores.', 4 FROM public.inspecoes WHERE codigo = 'A.23'
UNION ALL
SELECT id, '5', 'Outros', 5 FROM public.inspecoes WHERE codigo = 'A.23';

-- A.25 - Sistema de Hidrantes e Mangotinhos
INSERT INTO public.checklist_itens (inspecao_id, item_numero, descricao, ordem)
SELECT id, '1', 'Verificar projeto técnico do sistema.', 1 FROM public.inspecoes WHERE codigo = 'A.25'
UNION ALL
SELECT id, '2', 'Verificar reservatório e bomba de incêndio.', 2 FROM public.inspecoes WHERE codigo = 'A.25'
UNION ALL
SELECT id, '3', 'Verificar hidrantes e mangotinhos.', 3 FROM public.inspecoes WHERE codigo = 'A.25'
UNION ALL
SELECT id, '4', 'Testar funcionamento do sistema.', 4 FROM public.inspecoes WHERE codigo = 'A.25'
UNION ALL
SELECT id, '5', 'Outros', 5 FROM public.inspecoes WHERE codigo = 'A.25';

-- A.27 - Sistema de Chuveiros Automáticos (SPK)
INSERT INTO public.checklist_itens (inspecao_id, item_numero, descricao, ordem)
SELECT id, '1', 'Verificar projeto técnico do sistema sprinkler.', 1 FROM public.inspecoes WHERE codigo = 'A.27'
UNION ALL
SELECT id, '2', 'Verificar rede de tubulações e sprinklers.', 2 FROM public.inspecoes WHERE codigo = 'A.27'
UNION ALL
SELECT id, '3', 'Verificar válvulas e sistema de alarme.', 3 FROM public.inspecoes WHERE codigo = 'A.27'
UNION ALL
SELECT id, '4', 'Testar funcionamento do sistema.', 4 FROM public.inspecoes WHERE codigo = 'A.27'
UNION ALL
SELECT id, '5', 'Outros', 5 FROM public.inspecoes WHERE codigo = 'A.27';

-- A.29 - Sistema de Alarme de Incêndio (SAI)
INSERT INTO public.checklist_itens (inspecao_id, item_numero, descricao, ordem)
SELECT id, '1', 'Verificar projeto técnico do sistema de alarme.', 1 FROM public.inspecoes WHERE codigo = 'A.29'
UNION ALL
SELECT id, '2', 'Verificar central de alarme e acionadores.', 2 FROM public.inspecoes WHERE codigo = 'A.29'
UNION ALL
SELECT id, '3', 'Verificar sirenes e avisadores sonoros.', 3 FROM public.inspecoes WHERE codigo = 'A.29'
UNION ALL
SELECT id, '4', 'Testar funcionamento do sistema.', 4 FROM public.inspecoes WHERE codigo = 'A.29'
UNION ALL
SELECT id, '5', 'Outros', 5 FROM public.inspecoes WHERE codigo = 'A.29';

-- A.31 - Sistema de Detecção e Alarme de Incêndio (SDAI)
INSERT INTO public.checklist_itens (inspecao_id, item_numero, descricao, ordem)
SELECT id, '1', 'Verificar projeto técnico do SDAI.', 1 FROM public.inspecoes WHERE codigo = 'A.31'
UNION ALL
SELECT id, '2', 'Verificar detectores de fumaça e temperatura.', 2 FROM public.inspecoes WHERE codigo = 'A.31'
UNION ALL
SELECT id, '3', 'Verificar central de detecção.', 3 FROM public.inspecoes WHERE codigo = 'A.31'
UNION ALL
SELECT id, '4', 'Testar funcionamento dos detectores.', 4 FROM public.inspecoes WHERE codigo = 'A.31'
UNION ALL
SELECT id, '5', 'Outros', 5 FROM public.inspecoes WHERE codigo = 'A.31';

-- A.33 - Central e Rede de Distribuição Interna de GLP/GN
INSERT INTO public.checklist_itens (inspecao_id, item_numero, descricao, ordem)
SELECT id, '1', 'Verificar projeto técnico da central de GLP/GN.', 1 FROM public.inspecoes WHERE codigo = 'A.33'
UNION ALL
SELECT id, '2', 'Verificar localização e instalação da central.', 2 FROM public.inspecoes WHERE codigo = 'A.33'
UNION ALL
SELECT id, '3', 'Verificar tubulações e conexões.', 3 FROM public.inspecoes WHERE codigo = 'A.33'
UNION ALL
SELECT id, '4', 'Verificar ventilação e sinalização.', 4 FROM public.inspecoes WHERE codigo = 'A.33'
UNION ALL
SELECT id, '5', 'Outros', 5 FROM public.inspecoes WHERE codigo = 'A.33';

-- A.35 - Sistema de Proteção Contra Descargas Atmosféricas (SPDA)
INSERT INTO public.checklist_itens (inspecao_id, item_numero, descricao, ordem)
SELECT id, '1', 'Verificar projeto técnico do SPDA.', 1 FROM public.inspecoes WHERE codigo = 'A.35'
UNION ALL
SELECT id, '2', 'Verificar captores e condutores.', 2 FROM public.inspecoes WHERE codigo = 'A.35'
UNION ALL
SELECT id, '3', 'Verificar aterramento.', 3 FROM public.inspecoes WHERE codigo = 'A.35'
UNION ALL
SELECT id, '4', 'Verificar laudo de continuidade elétrica.', 4 FROM public.inspecoes WHERE codigo = 'A.35'
UNION ALL
SELECT id, '5', 'Outros', 5 FROM public.inspecoes WHERE codigo = 'A.35';

-- A.37 - Controle de Material de Acabamento e Revestimento (CMAR)
INSERT INTO public.checklist_itens (inspecao_id, item_numero, descricao, ordem)
SELECT id, '1', 'Verificar projeto técnico de CMAR.', 1 FROM public.inspecoes WHERE codigo = 'A.37'
UNION ALL
SELECT id, '2', 'Verificar materiais de acabamento e revestimento.', 2 FROM public.inspecoes WHERE codigo = 'A.37'
UNION ALL
SELECT id, '3', 'Verificar certificados de ensaio de reação ao fogo.', 3 FROM public.inspecoes WHERE codigo = 'A.37'
UNION ALL
SELECT id, '4', 'Outros', 4 FROM public.inspecoes WHERE codigo = 'A.37';

-- A.39 - Hidrante de Urbano de Coluna (HUC)
INSERT INTO public.checklist_itens (inspecao_id, item_numero, descricao, ordem)
SELECT id, '1', 'Verificar projeto técnico do HUC.', 1 FROM public.inspecoes WHERE codigo = 'A.39'
UNION ALL
SELECT id, '2', 'Verificar localização e instalação do hidrante.', 2 FROM public.inspecoes WHERE codigo = 'A.39'
UNION ALL
SELECT id, '3', 'Verificar conexões e válvulas.', 3 FROM public.inspecoes WHERE codigo = 'A.39'
UNION ALL
SELECT id, '4', 'Testar funcionamento do hidrante.', 4 FROM public.inspecoes WHERE codigo = 'A.39'
UNION ALL
SELECT id, '5', 'Outros', 5 FROM public.inspecoes WHERE codigo = 'A.39';