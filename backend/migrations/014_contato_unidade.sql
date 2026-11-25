-- Contato de cada unidade (aparece no rodapé do site e nos botões de WhatsApp).
-- whatsapp: formato internacional (+5543998468294).
ALTER TABLE unidades ADD COLUMN endereco VARCHAR(200) NULL;
ALTER TABLE unidades ADD COLUMN bairro VARCHAR(120) NULL;
ALTER TABLE unidades ADD COLUMN cidade VARCHAR(120) NULL;
ALTER TABLE unidades ADD COLUMN whatsapp VARCHAR(30) NULL;

-- O que estava fixo no código do site passa para a unidade 1
UPDATE unidades SET endereco = 'R. Dr. Saulo Porto Virmond, 989', bairro = 'Chácara Paulista', cidade = 'Maringá – PR', whatsapp = '+5543998468294'
WHERE id = 1 AND endereco IS NULL;

-- Dados da marca (um só para a clínica)
INSERT IGNORE INTO site_config (chave, valor) VALUES
    ('instagram', 'massoterapeuta_tayna'),
    ('nome_mensagem', 'Tayna'),
    ('rodape_texto', 'Massoterapia e estética com protocolos personalizados, em um ambiente pensado para você desacelerar.'),
    ('rodape_assinatura', 'Tayna Santos · Massoterapia & Estética');
