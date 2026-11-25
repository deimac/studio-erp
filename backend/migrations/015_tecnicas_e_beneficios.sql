-- Cadastro "Técnicas e benefícios": cada item tem um tipo e é escolhido no serviço.
-- A página do site passa a mostrar só o que vem dos serviços (nada digitado na página).
ALTER TABLE tecnicas ADD COLUMN tipo VARCHAR(20) NOT NULL DEFAULT 'TECNICA';

-- Itens já cadastrados como técnica que são benefícios
UPDATE tecnicas SET tipo = 'BENEFICIO'
WHERE id_profissional IS NULL AND nome IN (
    'Acelera o metabolismo', 'Alivia tensões musculares', 'Bem-estar mental e emocional',
    'Deixa a pele mais firme e o corpo mais leve', 'Diminui inchaço e ativa a circulação',
    'Elimina líquidos e toxinas', 'Melhora a circulação e oxigenação', 'Melhora a qualidade do sono',
    'Redução de medidas e melhora do contorno corporal', 'Reduz estresse e ansiedade',
    'Reduz inchaço e previne celulite', 'Restaura energia vital'
);

-- Técnica de teste, sem uso
DELETE FROM tecnicas WHERE nome = 'teste' AND id NOT IN (SELECT tecnica_id FROM servico_tecnica);

-- Textos digitados nas páginas ("O que inclui" = técnica, "Benefícios" = benefício) viram itens do cadastro,
-- na ordem em que estavam (páginas pela ordem do site)
INSERT INTO tecnicas (nome, id_profissional, tipo)
SELECT x.nome, NULL, x.tipo FROM (SELECT p.id id_protocolo, p.ordem, 'TECNICA' tipo, j.ord, TRIM(TRAILING '.' FROM TRIM(CONVERT(j.txt USING utf8mb4))) COLLATE utf8mb4_unicode_ci nome FROM protocolos p, JSON_TABLE(IF(JSON_VALID(p.inclui), p.inclui, '[]'), '$[*]' COLUMNS (ord FOR ORDINALITY, txt VARCHAR(255) PATH '$')) j UNION ALL SELECT p.id, p.ordem, 'BENEFICIO', j.ord, TRIM(TRAILING '.' FROM TRIM(CONVERT(j.txt USING utf8mb4))) COLLATE utf8mb4_unicode_ci FROM protocolos p, JSON_TABLE(IF(JSON_VALID(p.beneficios), p.beneficios, '[]'), '$[*]' COLUMNS (ord FOR ORDINALITY, txt VARCHAR(255) PATH '$')) j) x
WHERE x.nome <> '' AND NOT EXISTS (SELECT 1 FROM tecnicas t WHERE t.nome = x.nome AND t.id_profissional IS NULL)
GROUP BY x.nome, x.tipo
ORDER BY MIN(x.ordem * 1000 + x.ord);

-- ...e ficam marcados em todos os serviços da página onde estavam
INSERT IGNORE INTO servico_tecnica (servico_id, tecnica_id)
SELECT s.id, t.id FROM (SELECT p.id id_protocolo, p.ordem, 'TECNICA' tipo, j.ord, TRIM(TRAILING '.' FROM TRIM(CONVERT(j.txt USING utf8mb4))) COLLATE utf8mb4_unicode_ci nome FROM protocolos p, JSON_TABLE(IF(JSON_VALID(p.inclui), p.inclui, '[]'), '$[*]' COLUMNS (ord FOR ORDINALITY, txt VARCHAR(255) PATH '$')) j UNION ALL SELECT p.id, p.ordem, 'BENEFICIO', j.ord, TRIM(TRAILING '.' FROM TRIM(CONVERT(j.txt USING utf8mb4))) COLLATE utf8mb4_unicode_ci FROM protocolos p, JSON_TABLE(IF(JSON_VALID(p.beneficios), p.beneficios, '[]'), '$[*]' COLUMNS (ord FOR ORDINALITY, txt VARCHAR(255) PATH '$')) j) x
JOIN servicos s ON s.id_protocolo = x.id_protocolo
JOIN tecnicas t ON t.nome = x.nome AND t.tipo = x.tipo AND t.id_profissional IS NULL
WHERE x.nome <> '';
