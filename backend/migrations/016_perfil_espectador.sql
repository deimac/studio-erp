-- Novo perfil "Espectador": só vê a agenda compartilhada e os serviços da clínica, sem alterar nada.
ALTER TABLE usuarios MODIFY perfil ENUM('ADMIN', 'PROFISSIONAL', 'ESPECTADOR') NOT NULL;
