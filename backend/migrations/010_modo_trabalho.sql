-- Como a unidade trabalha:
-- CLINICA: o administrador acompanha vendas, clientes e financeiro de todos os profissionais.
-- INDIVIDUAL: cada profissional (inclusive o administrador) vê só o que é seu;
--             a agenda é dividida e os horários dos outros aparecem como "Ocupado".
ALTER TABLE unidades
    ADD COLUMN modo_trabalho ENUM('CLINICA','INDIVIDUAL') NOT NULL DEFAULT 'CLINICA';
