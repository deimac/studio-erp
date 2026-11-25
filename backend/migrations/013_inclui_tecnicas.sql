-- "O que inclui" da página do site passa a trazer as técnicas dos serviços dela.
-- tecnicas_ocultas: ids (JSON) das técnicas que a página escolheu não mostrar.
ALTER TABLE protocolos ADD COLUMN tecnicas_ocultas TEXT NULL;

-- Textos digitados que já eram técnicas cadastradas viram técnicas dos serviços da página
-- Método TS (1) e Alívio Terapêutico (3): "Liberação miofascial."
INSERT IGNORE INTO servico_tecnica (servico_id, tecnica_id)
SELECT s.id, t.id FROM servicos s JOIN tecnicas t ON t.nome = 'Liberação miofascial' AND t.id_profissional IS NULL
WHERE s.id_protocolo IN (1, 3);

-- Alívio Terapêutico (3): "Ventosaterapia."
INSERT IGNORE INTO servico_tecnica (servico_id, tecnica_id)
SELECT s.id, t.id FROM servicos s JOIN tecnicas t ON t.nome = 'Ventosaterapia' AND t.id_profissional IS NULL
WHERE s.id_protocolo = 3;

-- E saem do texto livre (para não aparecer duas vezes)
UPDATE protocolos SET inclui = '["Drenagem linfática manual.","Massagem modeladora.","Técnicas adaptadas às regiões escolhidas."]'
WHERE id = 1 AND inclui = '["Drenagem linfática manual.","Liberação miofascial.","Massagem modeladora.","Técnicas adaptadas às regiões escolhidas."]';

UPDATE protocolos SET inclui = '["Alongamentos terapêuticos.","Liberação de pontos-gatilho.","Técnicas adaptadas à avaliação individual."]'
WHERE id = 3 AND inclui = '["Liberação miofascial.","Ventosaterapia.","Alongamentos terapêuticos.","Liberação de pontos-gatilho.","Técnicas adaptadas à avaliação individual."]';
