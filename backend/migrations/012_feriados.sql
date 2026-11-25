-- Feriados da cidade/estado cadastrados pela clínica (os nacionais são calculados).
-- ano NULL = repete todo ano. Só aparecem como aviso na agenda.
CREATE TABLE IF NOT EXISTS feriados (
    id SERIAL PRIMARY KEY,
    id_unidade INT NOT NULL,
    dia TINYINT NOT NULL,
    mes TINYINT NOT NULL,
    ano SMALLINT NULL,
    nome VARCHAR(120) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_feriados_unidade (id_unidade)
);

-- Sugestão inicial: aniversário de Maringá (10/05)
INSERT INTO feriados (id_unidade, dia, mes, ano, nome)
SELECT id, 10, 5, NULL, 'Aniversário de Maringá' FROM unidades;
