-- Regra de falta (desconta ou devolve a sessão do pacote) e atendimento livre
-- (ex.: "Avaliação", "Retoque": título próprio, cobrado ou não).

-- Regra da clínica: DESCONTAR | DEVOLVER | PERGUNTAR; e se cada profissional define a sua
ALTER TABLE unidades
    ADD COLUMN falta_regra ENUM('DESCONTAR','DEVOLVER','PERGUNTAR') NOT NULL DEFAULT 'PERGUNTAR',
    ADD COLUMN falta_por_profissional TINYINT(1) NOT NULL DEFAULT 0;

-- Regra do profissional (vale quando a clínica deixa cada um definir; NULL = segue a da clínica)
ALTER TABLE usuarios
    ADD COLUMN falta_regra ENUM('DESCONTAR','DEVOLVER','PERGUNTAR') NULL;

-- Falta que consumiu a sessão do pacote; atendimento livre e a venda dele
ALTER TABLE atendimentos
    ADD COLUMN falta_consome TINYINT(1) NOT NULL DEFAULT 0,
    ADD COLUMN titulo_extra VARCHAR(120) NULL,
    ADD COLUMN duracao_extra INT NULL,
    ADD COLUMN id_venda_extra INT NULL,
    ADD KEY idx_atend_venda_extra (id_venda_extra),
    ADD CONSTRAINT fk_atend_venda_extra FOREIGN KEY (id_venda_extra) REFERENCES vendas(id) ON DELETE SET NULL;

-- Item de venda sem serviço/pacote cadastrado (título livre)
ALTER TABLE venda_itens
    ADD COLUMN descricao VARCHAR(120) NULL AFTER id_pacote;

-- A venda de um item livre não tem serviço nem pacote nas colunas-resumo
ALTER TABLE vendas DROP CHECK chk_servico_ou_pacote;
ALTER TABLE vendas
    ADD CONSTRAINT chk_servico_ou_pacote CHECK (id_servico IS NULL OR id_pacote IS NULL);
