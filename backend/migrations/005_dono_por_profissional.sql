-- Cada profissional controla o que é dele: clientes, vendas e lançamentos financeiros.
-- O admin vê tudo. Registros antigos sem dono ficam visíveis só para o admin.

-- Clientes/fornecedores: quais profissionais atendem cada pessoa (N:N)
CREATE TABLE IF NOT EXISTS pessoa_profissionais (
    id_pessoa INT UNSIGNED NOT NULL,
    id_profissional INT NOT NULL,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id_pessoa, id_profissional),
    KEY idx_pp_profissional (id_profissional),
    CONSTRAINT fk_pp_pessoa FOREIGN KEY (id_pessoa) REFERENCES pessoas(id) ON DELETE CASCADE,
    CONSTRAINT fk_pp_profissional FOREIGN KEY (id_profissional) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Quem vendeu
ALTER TABLE vendas
    ADD COLUMN id_profissional INT NULL,
    ADD KEY idx_vendas_profissional (id_profissional),
    ADD CONSTRAINT fk_vendas_profissional FOREIGN KEY (id_profissional) REFERENCES usuarios(id) ON DELETE SET NULL;

-- De quem é a receita/despesa
ALTER TABLE receitas_despesas
    ADD COLUMN id_profissional INT NULL,
    ADD KEY idx_rd_profissional (id_profissional),
    ADD CONSTRAINT fk_rd_profissional FOREIGN KEY (id_profissional) REFERENCES usuarios(id) ON DELETE SET NULL;

-- Vínculos a partir dos atendimentos já existentes
INSERT IGNORE INTO pessoa_profissionais (id_pessoa, id_profissional)
    SELECT DISTINCT id_pessoa, id_profissional FROM atendimentos;
