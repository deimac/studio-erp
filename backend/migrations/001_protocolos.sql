-- Protocolos (agrupam serviços/modalidades para o site público)
CREATE TABLE IF NOT EXISTS protocolos (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(150) NOT NULL,
    slug VARCHAR(160) NOT NULL,
    subtitulo VARCHAR(255) NULL,
    descricao TEXT NULL,
    inclui TEXT NULL,
    beneficios TEXT NULL,
    aviso TEXT NULL,
    frase_final VARCHAR(255) NULL,
    icone VARCHAR(50) NULL,
    imagem_url VARCHAR(500) NULL,
    ordem INT NOT NULL DEFAULT 0,
    permite_vale_presente TINYINT(1) NOT NULL DEFAULT 0,
    ativo TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_protocolos_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE servicos
    ADD COLUMN id_protocolo INT NULL,
    ADD COLUMN nome_modalidade VARCHAR(150) NULL,
    ADD COLUMN regioes TEXT NULL,
    ADD COLUMN ordem_modalidade INT NOT NULL DEFAULT 0,
    ADD CONSTRAINT fk_servicos_protocolo FOREIGN KEY (id_protocolo) REFERENCES protocolos(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS site_config (
    chave VARCHAR(100) NOT NULL PRIMARY KEY,
    valor TEXT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
