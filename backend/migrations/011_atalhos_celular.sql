-- Atalhos da barra de baixo do celular, escolhidos por cada profissional
-- (ids separados por vírgula; vazio = padrão do sistema).
ALTER TABLE usuarios
    ADD COLUMN atalhos_celular VARCHAR(200) NULL;
