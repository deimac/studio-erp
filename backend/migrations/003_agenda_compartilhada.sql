-- Agenda compartilhada: profissionais que dividem o mesmo espaço não podem
-- ter atendimentos no mesmo horário. Padrão ligado (studio com um espaço só).
ALTER TABLE usuarios
    ADD COLUMN agenda_compartilhada TINYINT(1) NOT NULL DEFAULT 1;
