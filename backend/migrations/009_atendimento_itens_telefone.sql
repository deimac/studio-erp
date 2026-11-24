-- Atendimento usando vários itens de venda (ex.: uma sessão de Pernas e uma de
-- Braços no mesmo horário), venda "a receber" sem forma definida e telefones
-- em formato internacional (+55…).

CREATE TABLE IF NOT EXISTS atendimento_itens (
    id_atendimento INT NOT NULL,
    id_venda_item INT NOT NULL,
    PRIMARY KEY (id_atendimento, id_venda_item),
    KEY idx_ai_item (id_venda_item),
    CONSTRAINT fk_ai_atendimento FOREIGN KEY (id_atendimento) REFERENCES atendimentos(id) ON DELETE CASCADE,
    CONSTRAINT fk_ai_item FOREIGN KEY (id_venda_item) REFERENCES venda_itens(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Vínculos atuais (sessão do pacote e item cobrado do atendimento livre)
INSERT IGNORE INTO atendimento_itens (id_atendimento, id_venda_item)
    SELECT id, id_venda_item FROM atendimentos WHERE id_venda_item IS NOT NULL;
INSERT IGNORE INTO atendimento_itens (id_atendimento, id_venda_item)
    SELECT a.id, vi.id FROM atendimentos a JOIN venda_itens vi ON vi.id_venda = a.id_venda_extra;

-- Venda "a receber": a forma de pagamento pode ser definida só na baixa
ALTER TABLE vendas MODIFY id_forma_pagamento INT NULL;

-- Telefones brasileiros antigos (só dígitos) para o formato internacional
UPDATE pessoas SET telefone = CONCAT('+55', REGEXP_REPLACE(telefone, '[^0-9]', ''))
    WHERE telefone IS NOT NULL AND telefone NOT LIKE '+%'
      AND CHAR_LENGTH(REGEXP_REPLACE(telefone, '[^0-9]', '')) IN (10, 11);
UPDATE pessoas SET telefone = CONCAT('+', REGEXP_REPLACE(telefone, '[^0-9]', ''))
    WHERE telefone IS NOT NULL AND telefone NOT LIKE '+%'
      AND CHAR_LENGTH(REGEXP_REPLACE(telefone, '[^0-9]', '')) IN (12, 13)
      AND REGEXP_REPLACE(telefone, '[^0-9]', '') LIKE '55%';
UPDATE usuarios SET telefone = CONCAT('+55', REGEXP_REPLACE(telefone, '[^0-9]', ''))
    WHERE telefone IS NOT NULL AND telefone NOT LIKE '+%'
      AND CHAR_LENGTH(REGEXP_REPLACE(telefone, '[^0-9]', '')) IN (10, 11);

-- Telefones já com "+" mas formatados (espaços, traços): só dígitos
UPDATE pessoas SET telefone = CONCAT('+', REGEXP_REPLACE(telefone, '[^0-9]', ''))
    WHERE telefone LIKE '+%' AND telefone REGEXP '[^+0-9]';
UPDATE usuarios SET telefone = CONCAT('+', REGEXP_REPLACE(telefone, '[^0-9]', ''))
    WHERE telefone LIKE '+%' AND telefone REGEXP '[^+0-9]';
