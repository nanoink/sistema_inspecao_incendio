-- Limpar tabela e reinserir todos os CNAEs do IT-02 Anexo A
DELETE FROM cnae_catalogo;

-- GRUPO A - RESIDENCIAL
-- A-1: Habitação unifamiliar
INSERT INTO cnae_catalogo (cnae, descricao, grupo, ocupacao_uso, divisao, carga_incendio_mj_m2) VALUES
('8111-7/00', 'Serviços combinados para apoio a edifícios, exceto condomínios prediais', 'A', 'RESIDENCIAL', 'A-1', 300),
('4120-4/00', 'Construção de edifícios', 'A', 'RESIDENCIAL', 'A-1', 300),
('8121-4/00', 'Limpeza em prédios e em domicílios', 'A', 'RESIDENCIAL', 'A-1', 300);

-- A-2: Habitação multifamiliar
INSERT INTO cnae_catalogo (cnae, descricao, grupo, ocupacao_uso, divisao, carga_incendio_mj_m2) VALUES
('9700-5/00', 'Serviços domésticos', 'A', 'RESIDENCIAL', 'A-2', 300),
('8130-3/00', 'Atividades paisagísticas', 'A', 'RESIDENCIAL', 'A-2', 300);

-- A-3: Habitacional Transitória (hotéis, pensões, etc.)
INSERT INTO cnae_catalogo (cnae, descricao, grupo, ocupacao_uso, divisao, carga_incendio_mj_m2) VALUES
('5510-8/01', 'Hotéis', 'A', 'RESIDENCIAL', 'A-3', 300),
('5510-8/02', 'Apart-hotéis', 'A', 'RESIDENCIAL', 'A-3', 300),
('5590-6/01', 'Albergues, exceto assistenciais', 'A', 'RESIDENCIAL', 'A-3', 300),
('5590-6/02', 'Campings', 'A', 'RESIDENCIAL', 'A-3', 300),
('5590-6/03', 'Pensões (alojamento)', 'A', 'RESIDENCIAL', 'A-3', 300),
('5590-6/99', 'Outros alojamentos não especificados anteriormente', 'A', 'RESIDENCIAL', 'A-3', 300);

-- GRUPO B - SERVIÇO DE HOSPEDAGEM
-- B-1: Serviços de hospedagem e saúde com internação
INSERT INTO cnae_catalogo (cnae, descricao, grupo, ocupacao_uso, divisao, carga_incendio_mj_m2) VALUES
('8711-5/01', 'Clínicas e residências geriátricas', 'B', 'SERVIÇO DE HOSPEDAGEM', 'B-1', 300),
('8711-5/02', 'Instituições de longa permanência para idosos', 'B', 'SERVIÇO DE HOSPEDAGEM', 'B-1', 300),
('8720-4/01', 'Albergues assistenciais', 'B', 'SERVIÇO DE HOSPEDAGEM', 'B-1', 300),
('8720-4/02', 'Orfanatos', 'B', 'SERVIÇO DE HOSPEDAGEM', 'B-1', 300),
('8730-1/01', 'Orfanatos', 'B', 'SERVIÇO DE HOSPEDAGEM', 'B-1', 300),
('8730-1/02', 'Alojamento de estudantes', 'B', 'SERVIÇO DE HOSPEDAGEM', 'B-1', 300),
('8730-1/99', 'Atividades de assistência social prestadas em residências coletivas e particulares não especificadas anteriormente', 'B', 'SERVIÇO DE HOSPEDAGEM', 'B-1', 300);

-- B-2: Hospitais e estabelecimentos de saúde com internação
INSERT INTO cnae_catalogo (cnae, descricao, grupo, ocupacao_uso, divisao, carga_incendio_mj_m2) VALUES
('8610-1/01', 'Atividades de atendimento hospitalar, exceto pronto-socorro e unidades para atendimento a urgências', 'B', 'SERVIÇO DE HOSPEDAGEM', 'B-2', 300),
('8610-1/02', 'Atividades de atendimento em pronto-socorro e unidades hospitalares para atendimento a urgências', 'B', 'SERVIÇO DE HOSPEDAGEM', 'B-2', 300);