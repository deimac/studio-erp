-- Agenda profissional: salas, expediente semanal, bloqueios, recorrência,
-- vários serviços por atendimento e venda opcional.

CREATE TABLE IF NOT EXISTS salas (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    id_unidade INT NOT NULL,
    nome VARCHAR(100) NOT NULL,
    cor VARCHAR(20) NULL,
    ordem INT NOT NULL DEFAULT 0,
    ativo TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_salas_unidade (id_unidade),
    CONSTRAINT fk_salas_unidade FOREIGN KEY (id_unidade) REFERENCES unidades(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS profissional_horarios (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    id_profissional INT NOT NULL,
    dia_semana TINYINT NOT NULL,
    hora_inicio TIME NOT NULL,
    hora_fim TIME NOT NULL,
    KEY idx_ph_profissional (id_profissional, dia_semana),
    CONSTRAINT fk_ph_profissional FOREIGN KEY (id_profissional) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS profissional_servicos (
    id_profissional INT NOT NULL,
    id_servico INT NOT NULL,
    PRIMARY KEY (id_profissional, id_servico),
    CONSTRAINT fk_ps_profissional FOREIGN KEY (id_profissional) REFERENCES usuarios(id) ON DELETE CASCADE,
    CONSTRAINT fk_ps_servico FOREIGN KEY (id_servico) REFERENCES servicos(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS agenda_bloqueios (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    id_unidade INT NOT NULL,
    id_profissional INT NULL,
    id_sala INT NULL,
    inicio DATETIME NOT NULL,
    fim DATETIME NOT NULL,
    motivo VARCHAR(255) NULL,
    criado_por INT NULL,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_bloqueios_periodo (id_unidade, inicio, fim),
    CONSTRAINT fk_bloqueios_unidade FOREIGN KEY (id_unidade) REFERENCES unidades(id),
    CONSTRAINT fk_bloqueios_profissional FOREIGN KEY (id_profissional) REFERENCES usuarios(id) ON DELETE CASCADE,
    CONSTRAINT fk_bloqueios_sala FOREIGN KEY (id_sala) REFERENCES salas(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS agenda_recorrencias (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    intervalo_semanas INT NOT NULL DEFAULT 1,
    quantidade INT NOT NULL,
    criado_por INT NULL,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE usuarios
    ADD COLUMN cor VARCHAR(20) NULL,
    ADD COLUMN telefone VARCHAR(20) NULL,
    ADD COLUMN intervalo_agenda_min INT NOT NULL DEFAULT 30;

ALTER TABLE atendimentos
    MODIFY id_venda INT UNSIGNED NULL,
    MODIFY status ENUM('AGENDADO','CONFIRMADO','REALIZADO','CANCELADO','FALTOU') NOT NULL,
    ADD COLUMN id_unidade INT NULL AFTER id,
    ADD COLUMN id_pessoa INT UNSIGNED NULL AFTER id_unidade,
    ADD COLUMN id_sala INT NULL,
    ADD COLUMN id_recorrencia INT NULL,
    ADD COLUMN criado_por INT NULL,
    ADD COLUMN confirmado_em TIMESTAMP NULL,
    ADD COLUMN lembrete_enviado_em TIMESTAMP NULL,
    ADD COLUMN motivo_cancelamento VARCHAR(255) NULL;

UPDATE atendimentos a
    JOIN vendas v ON v.id = a.id_venda
    SET a.id_pessoa = v.id_pessoa, a.id_unidade = v.id_unidade;

UPDATE atendimentos a
    JOIN usuarios u ON u.id = a.id_profissional
    SET a.id_unidade = u.unidade_id
    WHERE a.id_unidade IS NULL;

ALTER TABLE atendimentos
    MODIFY id_unidade INT NOT NULL,
    MODIFY id_pessoa INT UNSIGNED NOT NULL,
    ADD KEY idx_atend_prof_data (id_profissional, data),
    ADD KEY idx_atend_sala_data (id_sala, data),
    ADD KEY idx_atend_unidade_data (id_unidade, data),
    ADD KEY idx_atend_pessoa (id_pessoa),
    ADD CONSTRAINT fk_atend_unidade FOREIGN KEY (id_unidade) REFERENCES unidades(id),
    ADD CONSTRAINT fk_atend_pessoa FOREIGN KEY (id_pessoa) REFERENCES pessoas(id),
    ADD CONSTRAINT fk_atend_sala FOREIGN KEY (id_sala) REFERENCES salas(id) ON DELETE SET NULL,
    ADD CONSTRAINT fk_atend_recorrencia FOREIGN KEY (id_recorrencia) REFERENCES agenda_recorrencias(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS atendimento_servicos (
    id_atendimento INT NOT NULL,
    id_servico INT NOT NULL,
    duracao_minutos INT NOT NULL,
    valor DECIMAL(10,2) NOT NULL DEFAULT 0,
    PRIMARY KEY (id_atendimento, id_servico),
    CONSTRAINT fk_as_atendimento FOREIGN KEY (id_atendimento) REFERENCES atendimentos(id) ON DELETE CASCADE,
    CONSTRAINT fk_as_servico FOREIGN KEY (id_servico) REFERENCES servicos(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO atendimento_servicos (id_atendimento, id_servico, duracao_minutos, valor)
    SELECT a.id, s.id, s.duracao_minutos, s.valor
    FROM atendimentos a
    JOIN vendas v ON v.id = a.id_venda
    LEFT JOIN pacotes p ON p.id = v.id_pacote
    JOIN servicos s ON s.id = COALESCE(v.id_servico, p.id_servico);

INSERT INTO profissional_horarios (id_profissional, dia_semana, hora_inicio, hora_fim)
    SELECT c.id_profissional, d.dia, c.hora_inicio, c.hora_fim
    FROM agenda_configuracao c
    CROSS JOIN (SELECT 1 AS dia UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5) d;

UPDATE usuarios u
    JOIN agenda_configuracao c ON c.id_profissional = u.id
    SET u.intervalo_agenda_min = c.intervalo_minutos;
