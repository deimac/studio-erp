-- Serviços próprios de profissionais: id_profissional = dono.
-- NULL = serviço da clínica (cadastrado pelo admin). Serviço de profissional
-- nunca tem protocolo, então não aparece no site.
ALTER TABLE servicos
    ADD COLUMN id_profissional INT NULL,
    ADD KEY idx_servicos_profissional (id_profissional),
    ADD CONSTRAINT fk_servicos_profissional FOREIGN KEY (id_profissional) REFERENCES usuarios(id) ON DELETE SET NULL;
