import os

import requests

from erros import ErroHttp


def atualizar_status_pedido(pedido_id, status):
    url = os.getenv("PEDIDOS_URL")
    if not url:
        return None

    try:
        resposta = requests.patch(
            f"{url.rstrip('/')}/pedidos/{pedido_id}/status",
            json={"status": status},
            timeout=60,
        )
    except requests.RequestException:
        raise ErroHttp(503, "Serviço de pedidos indisponível")

    try:
        dados = resposta.json()
    except ValueError:
        dados = {}

    if not resposta.ok:
        mensagem = dados.get("erro") or f"Serviço de pedidos respondeu {resposta.status_code}"
        raise ErroHttp(resposta.status_code if resposta.status_code < 500 else 502, f"Pedidos: {mensagem}")
    return dados
