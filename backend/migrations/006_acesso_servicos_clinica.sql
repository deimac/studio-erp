-- O admin decide, por profissional, se ele usa os serviços/técnicas da clínica.
-- Padrão desligado: o profissional só vê os próprios.
ALTER TABLE usuarios
    ADD COLUMN ve_servicos_clinica TINYINT(1) NOT NULL DEFAULT 0;

-- Técnicas também podem ser próprias de um profissional (NULL = da clínica)
ALTER TABLE tecnicas
    ADD COLUMN id_profissional INT NULL,
    DROP INDEX nome,
    ADD UNIQUE KEY uq_tecnicas_dono_nome (id_profissional, nome),
    ADD CONSTRAINT fk_tecnicas_profissional FOREIGN KEY (id_profissional) REFERENCES usuarios(id) ON DELETE CASCADE;
