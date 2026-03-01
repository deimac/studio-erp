import json
from typing import Optional
from urllib import parse, request

BASE = "http://localhost:4000/trpc"


def post(path: str, data: dict, token: Optional[str] = None) -> dict:
    body = json.dumps(data).encode()
    req = request.Request(f"{BASE}/{path}", data=body, method="POST")
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    with request.urlopen(req) as resp:
        return json.load(resp)


def get(path: str, input_obj: dict, token: Optional[str] = None) -> dict:
    query = parse.urlencode({"input": json.dumps(input_obj)})
    req = request.Request(f"{BASE}/{path}?{query}")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    with request.urlopen(req) as resp:
        return json.load(resp)


def main() -> None:
    login = post("usuarios.login", {"email": "admin@studio.com", "senha": "123456"})
    token = login["result"]["data"]["token"]

    cliente = post(
        "clientes.create",
        {
            "nome": "Cliente Teste 2",
            "telefone": "11999990001",
            "email": "cliente2@exemplo.com",
            "observacoes": "Teste fluxo",
        },
        token,
    )
    cliente_id = cliente["result"]["data"]["id"]

    servico = post(
        "servicos.create",
        {
            "nome": "Massagem Teste",
            "duracao_minutos": 60,
            "valor": 120,
            "gera_credito": True,
        },
        token,
    )
    servico_id = servico["result"]["data"]["id"]

    pacote = post(
        "pacotes.create",
        {
            "cliente_id": cliente_id,
            "servico_id": servico_id,
            "quantidade_total": 3,
            "status": "PENDENTE_PAGAMENTO",
        },
        token,
    )
    pacote_id = pacote["result"]["data"]["id"]

    financeiro = post(
        "financeiro.create",
        {
            "cliente_id": cliente_id,
            "pacote_id": pacote_id,
            "tipo": "ENTRADA",
            "status": "PENDENTE",
            "valor": 120,
            "descricao": "Pagamento teste",
        },
        token,
    )
    financeiro_id = financeiro["result"]["data"]["id"]

    print(
        {
            "cliente_id": cliente_id,
            "servico_id": servico_id,
            "pacote_id": pacote_id,
            "financeiro_id": financeiro_id,
        }
    )

    print("clientes.list", get("clientes.list", {"search": "Cliente", "incluirInativos": False}, token))
    print("servicos.list", get("servicos.list", {"search": "Massagem", "incluirInativos": False}, token))
    print("pacotes.list", get("pacotes.list", {"clienteId": cliente_id}, token))
    print("financeiro.list", get("financeiro.list", {"clienteId": cliente_id}, token))


if __name__ == "__main__":
    main()
