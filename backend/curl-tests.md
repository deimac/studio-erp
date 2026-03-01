# Colecao de testes curl (tRPC v11)

Base URL: http://localhost:4000/trpc

Substitua <TOKEN_EXEMPLO> pelo JWT retornado em usuarios.login.

## login rapido

```bash
curl -X POST http://localhost:4000/trpc/usuarios.login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@studio.com","senha":"123456"}'
```

Para exportar o token e usar nos demais comandos:

```bash
TOKEN_EXEMPLO=$(curl -s -X POST http://localhost:4000/trpc/usuarios.login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@studio.com","senha":"123456"}' \
  | python3 -c 'import sys, json; print(json.load(sys.stdin)["result"]["data"]["token"])')
echo "TOKEN_EXEMPLO=$TOKEN_EXEMPLO"
```

## usuarios

### usuarios.login (mutation, public)
```bash
curl -X POST http://localhost:4000/trpc/usuarios.login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@studio.com","senha":"123456"}'
```

### usuarios.me (query, protected)
```bash
curl -G http://localhost:4000/trpc/usuarios.me \
  -H 'Authorization: Bearer <TOKEN_EXEMPLO>' \
  --data-urlencode 'input={}'
```

## clientes (CRUD completo)

### clientes.list (query, protected)
```bash
curl -G http://localhost:4000/trpc/clientes.list \
  -H 'Authorization: Bearer <TOKEN_EXEMPLO>' \
  --data-urlencode 'input={"search":"Ana","incluirInativos":false}'
```

### clientes.getById (query, protected)
```bash
curl -G http://localhost:4000/trpc/clientes.getById \
  -H 'Authorization: Bearer <TOKEN_EXEMPLO>' \
  --data-urlencode 'input={"id":1}'
```

### clientes.create (mutation, protected)
```bash
curl -X POST http://localhost:4000/trpc/clientes.create \
  -H 'Authorization: Bearer <TOKEN_EXEMPLO>' \
  -H 'Content-Type: application/json' \
  -d '{"nome":"Ana Silva","telefone":"11999990000","email":"ana@exemplo.com","observacoes":"Prefere tarde"}'
```

### clientes.update (mutation, protected)
```bash
curl -X POST http://localhost:4000/trpc/clientes.update \
  -H 'Authorization: Bearer <TOKEN_EXEMPLO>' \
  -H 'Content-Type: application/json' \
  -d '{"id":1,"nome":"Ana S.","telefone":null,"email":"ana.nova@exemplo.com","observacoes":null,"ativo":true}'
```

### clientes.setAtivo (mutation, admin)
```bash
curl -X POST http://localhost:4000/trpc/clientes.setAtivo \
  -H 'Authorization: Bearer <TOKEN_EXEMPLO>' \
  -H 'Content-Type: application/json' \
  -d '{"id":1,"ativo":false}'
```

## servicos (CRUD completo)

### servicos.list (query, protected)
```bash
curl -G http://localhost:4000/trpc/servicos.list \
  -H 'Authorization: Bearer <TOKEN_EXEMPLO>' \
  --data-urlencode 'input={"search":"Corte","incluirInativos":false}'
```

### servicos.getById (query, protected)
```bash
curl -G http://localhost:4000/trpc/servicos.getById \
  -H 'Authorization: Bearer <TOKEN_EXEMPLO>' \
  --data-urlencode 'input={"id":1}'
```

### servicos.create (mutation, admin)
```bash
curl -X POST http://localhost:4000/trpc/servicos.create \
  -H 'Authorization: Bearer <TOKEN_EXEMPLO>' \
  -H 'Content-Type: application/json' \
  -d '{"nome":"Massagem relaxante","duracao_minutos":60,"valor":120,"gera_credito":true}'
```

### servicos.update (mutation, admin)
```bash
curl -X POST http://localhost:4000/trpc/servicos.update \
  -H 'Authorization: Bearer <TOKEN_EXEMPLO>' \
  -H 'Content-Type: application/json' \
  -d '{"id":1,"valor":140,"ativo":true}'
```

## pacotes (CRUD completo + marcarPago + finalizar)

### pacotes.list (query, protected)
```bash
curl -G http://localhost:4000/trpc/pacotes.list \
  -H 'Authorization: Bearer <TOKEN_EXEMPLO>' \
  --data-urlencode 'input={"clienteId":1,"status":"PENDENTE_PAGAMENTO"}'
```

### pacotes.getById (query, protected)
```bash
curl -G http://localhost:4000/trpc/pacotes.getById \
  -H 'Authorization: Bearer <TOKEN_EXEMPLO>' \
  --data-urlencode 'input={"id":1}'
```

### pacotes.create (mutation, admin)
```bash
curl -X POST http://localhost:4000/trpc/pacotes.create \
  -H 'Authorization: Bearer <TOKEN_EXEMPLO>' \
  -H 'Content-Type: application/json' \
  -d '{"cliente_id":1,"servico_id":1,"quantidade_total":5,"status":"PENDENTE_PAGAMENTO"}'
```

### pacotes.marcarPago (mutation, admin)
```bash
curl -X POST http://localhost:4000/trpc/pacotes.marcarPago \
  -H 'Authorization: Bearer <TOKEN_EXEMPLO>' \
  -H 'Content-Type: application/json' \
  -d '{"id":1}'
```

### pacotes.finalizar (mutation, admin)
```bash
curl -X POST http://localhost:4000/trpc/pacotes.finalizar \
  -H 'Authorization: Bearer <TOKEN_EXEMPLO>' \
  -H 'Content-Type: application/json' \
  -d '{"id":1}'
```

## atendimentos (CRUD, agenda, agendar, confirmar)

### atendimentos.agendaCriarSlots (mutation, profissional)
```bash
curl -X POST http://localhost:4000/trpc/atendimentos.agendaCriarSlots \
  -H 'Authorization: Bearer <TOKEN_EXEMPLO>' \
  -H 'Content-Type: application/json' \
  -d '{"inicio":"2026-02-24T09:00:00.000Z","fim":"2026-02-24T12:00:00.000Z","intervaloMinutos":30}'
```

### atendimentos.agendaListar (query, protected)
```bash
curl -G http://localhost:4000/trpc/atendimentos.agendaListar \
  -H 'Authorization: Bearer <TOKEN_EXEMPLO>' \
  --data-urlencode 'input={"profissionalId":2,"de":"2026-02-24T00:00:00.000Z","ate":"2026-02-25T00:00:00.000Z","status":"DISPONIVEL"}'
```

### atendimentos.agendaBloquear (mutation, profissional)
```bash
curl -X POST http://localhost:4000/trpc/atendimentos.agendaBloquear \
  -H 'Authorization: Bearer <TOKEN_EXEMPLO>' \
  -H 'Content-Type: application/json' \
  -d '{"id":10,"bloquear":true}'
```

### atendimentos.list (query, protected)
```bash
curl -G http://localhost:4000/trpc/atendimentos.list \
  -H 'Authorization: Bearer <TOKEN_EXEMPLO>' \
  --data-urlencode 'input={"de":"2026-02-24","ate":"2026-02-25","status":"AGENDADO"}'
```

### atendimentos.create (mutation, profissional)
```bash
curl -X POST http://localhost:4000/trpc/atendimentos.create \
  -H 'Authorization: Bearer <TOKEN_EXEMPLO>' \
  -H 'Content-Type: application/json' \
  -d '{"cliente_id":1,"servico_id":1,"data":"2026-02-24","hora_inicio":"10:00:00","hora_fim":"11:00:00","pacote_id":1,"observacoes":"Primeira visita"}'
```

### atendimentos.cancelar (mutation, protected)
```bash
curl -X POST http://localhost:4000/trpc/atendimentos.cancelar \
  -H 'Authorization: Bearer <TOKEN_EXEMPLO>' \
  -H 'Content-Type: application/json' \
  -d '{"id":1,"observacoes":"Cliente pediu remarcacao"}'
```

### atendimentos.marcarRealizado (mutation, protected)
```bash
curl -X POST http://localhost:4000/trpc/atendimentos.marcarRealizado \
  -H 'Authorization: Bearer <TOKEN_EXEMPLO>' \
  -H 'Content-Type: application/json' \
  -d '{"id":1}'
```

### atendimentos.marcarFaltou (mutation, protected)
```bash
curl -X POST http://localhost:4000/trpc/atendimentos.marcarFaltou \
  -H 'Authorization: Bearer <TOKEN_EXEMPLO>' \
  -H 'Content-Type: application/json' \
  -d '{"id":1}'
```

### atendimentos.softDelete (mutation, admin)
```bash
curl -X POST http://localhost:4000/trpc/atendimentos.softDelete \
  -H 'Authorization: Bearer <TOKEN_EXEMPLO>' \
  -H 'Content-Type: application/json' \
  -d '{"id":1}'
```

## financeiro (CRUD basico, alterar status)

### financeiro.list (query, protected)
```bash
curl -G http://localhost:4000/trpc/financeiro.list \
  -H 'Authorization: Bearer <TOKEN_EXEMPLO>' \
  --data-urlencode 'input={"clienteId":1,"status":"PENDENTE","tipo":"ENTRADA"}'
```

### financeiro.create (mutation, admin)
```bash
curl -X POST http://localhost:4000/trpc/financeiro.create \
  -H 'Authorization: Bearer <TOKEN_EXEMPLO>' \
  -H 'Content-Type: application/json' \
  -d '{"cliente_id":1,"pacote_id":1,"tipo":"ENTRADA","status":"PENDENTE","valor":120,"descricao":"Sinal do pacote"}'
```

### financeiro.updateStatus (mutation, admin)
```bash
curl -X POST http://localhost:4000/trpc/financeiro.updateStatus \
  -H 'Authorization: Bearer <TOKEN_EXEMPLO>' \
  -H 'Content-Type: application/json' \
  -d '{"id":1,"status":"PAGO"}'
```
