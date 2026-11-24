-- Venda com vários itens (serviços e pacotes) e várias formas de pagamento.
--  * venda_itens: cada item vendido, com as sessões e o valor dele
--  * atendimentos.id_venda_item: de qual item o atendimento consome a sessão
--  * financeiro.id_forma_pagamento: cada parcela tem a sua forma (Pix, cartão…)
-- As colunas antigas de vendas (id_servico, id_pacote, quantidade_sessoes,
-- id_forma_pagamento) continuam como resumo: 1º item, total de sessões, 1ª forma.

CREATE TABLE IF NOT EXISTS venda_itens (
    id INT NOT NULL AUTO_INCREMENT,
    id_venda INT NOT NULL,
    id_servico INT NULL,
    id_pacote INT NULL,
    quantidade_sessoes INT NOT NULL,
    valor DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_vi_venda (id_venda),
    KEY idx_vi_servico (id_servico),
    KEY idx_vi_pacote (id_pacote),
    CONSTRAINT fk_vi_venda FOREIGN KEY (id_venda) REFERENCES vendas(id) ON DELETE CASCADE,
    CONSTRAINT fk_vi_servico FOREIGN KEY (id_servico) REFERENCES servicos(id),
    CONSTRAINT fk_vi_pacote FOREIGN KEY (id_pacote) REFERENCES pacotes(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Cada venda existente vira uma venda com 1 item
INSERT INTO venda_itens (id_venda, id_servico, id_pacote, quantidade_sessoes, valor)
    SELECT v.id, v.id_servico, v.id_pacote, v.quantidade_sessoes, v.valor
    FROM vendas v
    WHERE NOT EXISTS (SELECT 1 FROM venda_itens vi WHERE vi.id_venda = v.id);

ALTER TABLE atendimentos
    ADD COLUMN id_venda_item INT NULL AFTER id_venda,
    ADD KEY idx_atend_venda_item (id_venda_item),
    ADD CONSTRAINT fk_atend_venda_item FOREIGN KEY (id_venda_item) REFERENCES venda_itens(id) ON DELETE SET NULL;

UPDATE atendimentos a
    JOIN venda_itens vi ON vi.id_venda = a.id_venda
    SET a.id_venda_item = vi.id
    WHERE a.id_venda IS NOT NULL AND a.id_venda_item IS NULL;

ALTER TABLE financeiro
    ADD COLUMN id_forma_pagamento INT NULL AFTER id_receita_despesa,
    ADD KEY idx_financeiro_forma (id_forma_pagamento),
    ADD CONSTRAINT fk_financeiro_forma FOREIGN KEY (id_forma_pagamento) REFERENCES formas_pagamento(id);

UPDATE financeiro f
    JOIN vendas v ON v.id = f.id_venda
    SET f.id_forma_pagamento = v.id_forma_pagamento
    WHERE f.id_forma_pagamento IS NULL;
