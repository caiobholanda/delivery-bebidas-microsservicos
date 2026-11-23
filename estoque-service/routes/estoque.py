from fastapi import APIRouter, Body
from sqlalchemy import bindparam, text

from db import engine
from erros import ErroHttp, inteiro

router = APIRouter(prefix="/estoque")


def formatar_estoque(linha):
    return {
        "bebidaId": linha.bebida_id,
        "quantidade": linha.quantidade,
        "quantidadeMinima": linha.quantidade_minima,
        "precisaRepor": linha.quantidade <= linha.quantidade_minima,
        "atualizadoEm": linha.atualizado_em,
    }


def formatar_movimentacao(linha):
    return {
        "id": linha.id,
        "bebidaId": linha.bebida_id,
        "pedidoId": linha.pedido_id,
        "tipo": linha.tipo,
        "quantidade": linha.quantidade,
        "criadoEm": linha.criado_em,
    }


def ler_bebida_id(valor):
    bebida_id = inteiro(valor)
    if not bebida_id:
        raise ErroHttp(400, "bebidaId inválido")
    return bebida_id


def ler_pedido_id(dados):
    pedido_id = inteiro(dados.get("pedidoId"))
    if not pedido_id:
        raise ErroHttp(400, "pedidoId inválido")
    return pedido_id


def ler_itens(itens):
    if not isinstance(itens, list) or not itens:
        raise ErroHttp(400, "Informe os itens")

    quantidades = {}
    for item in itens:
        bebida_id = inteiro(item.get("bebidaId")) if isinstance(item, dict) else None
        quantidade = inteiro(item.get("quantidade")) if isinstance(item, dict) else None
        if not bebida_id or not quantidade:
            raise ErroHttp(400, "Cada item precisa de bebidaId e quantidade maior que zero")
        quantidades[bebida_id] = quantidades.get(bebida_id, 0) + quantidade
    return quantidades


def buscar_estoque(conexao, bebida_id):
    return conexao.execute(
        text("SELECT * FROM estoque WHERE bebida_id = :bebida"), {"bebida": bebida_id}
    ).first()


def conferir_itens(conexao, quantidades, travar=False):
    sql = "SELECT bebida_id, quantidade FROM estoque WHERE bebida_id IN :ids ORDER BY bebida_id"
    if travar:
        sql += " FOR UPDATE"
    consulta = text(sql).bindparams(bindparam("ids", expanding=True))
    em_estoque = {linha.bebida_id: linha.quantidade for linha in conexao.execute(consulta, {"ids": sorted(quantidades)})}

    return [
        {
            "bebidaId": bebida_id,
            "solicitado": quantidade,
            "emEstoque": em_estoque.get(bebida_id, 0),
            "disponivel": em_estoque.get(bebida_id, 0) >= quantidade,
        }
        for bebida_id, quantidade in quantidades.items()
    ]


def baixado_no_pedido(conexao, pedido_id):
    linhas = conexao.execute(
        text(
            """SELECT bebida_id, -SUM(quantidade) AS quantidade FROM movimentacoes
               WHERE pedido_id = :pedido AND tipo IN ('baixa', 'restauracao')
               GROUP BY bebida_id
               HAVING -SUM(quantidade) > 0"""
        ),
        {"pedido": pedido_id},
    )
    return {linha.bebida_id: int(linha.quantidade) for linha in linhas}


def registrar_movimentacao(conexao, bebida_id, tipo, quantidade, pedido_id=None):
    conexao.execute(
        text(
            """INSERT INTO movimentacoes (bebida_id, pedido_id, tipo, quantidade)
               VALUES (:bebida, :pedido, :tipo, :quantidade)"""
        ),
        {"bebida": bebida_id, "pedido": pedido_id, "tipo": tipo, "quantidade": quantidade},
    )


def somar_estoque(conexao, bebida_id, quantidade):
    conexao.execute(
        text("UPDATE estoque SET quantidade = quantidade + :quantidade WHERE bebida_id = :bebida"),
        {"bebida": bebida_id, "quantidade": quantidade},
    )


@router.get("")
def listar():
    with engine.connect() as conexao:
        linhas = conexao.execute(text("SELECT * FROM estoque ORDER BY bebida_id"))
        return [formatar_estoque(linha) for linha in linhas]


@router.get("/reposicao")
def listar_reposicao():
    with engine.connect() as conexao:
        linhas = conexao.execute(
            text("SELECT * FROM estoque WHERE quantidade <= quantidade_minima ORDER BY quantidade, bebida_id")
        )
        return [formatar_estoque(linha) for linha in linhas]


@router.post("/verificar")
def verificar(dados: dict | None = Body(None)):
    quantidades = ler_itens((dados or {}).get("itens"))
    with engine.connect() as conexao:
        itens = conferir_itens(conexao, quantidades)
    return {"disponivel": all(item["disponivel"] for item in itens), "itens": itens}


@router.post("/baixar")
def baixar(dados: dict | None = Body(None)):
    dados = dados or {}
    pedido_id = ler_pedido_id(dados)
    quantidades = ler_itens(dados.get("itens"))

    with engine.begin() as conexao:
        if baixado_no_pedido(conexao, pedido_id):
            raise ErroHttp(409, f"O estoque do pedido {pedido_id} já foi baixado")

        faltando = [item for item in conferir_itens(conexao, quantidades, travar=True) if not item["disponivel"]]
        if faltando:
            detalhes = ", ".join(
                f"bebida {item['bebidaId']} (disponível: {item['emEstoque']}, pedido: {item['solicitado']})"
                for item in faltando
            )
            raise ErroHttp(409, f"Estoque insuficiente para {detalhes}")

        for bebida_id, quantidade in quantidades.items():
            somar_estoque(conexao, bebida_id, -quantidade)
            registrar_movimentacao(conexao, bebida_id, "baixa", -quantidade, pedido_id)

    return {
        "pedidoId": pedido_id,
        "itens": [{"bebidaId": bebida_id, "quantidade": quantidade} for bebida_id, quantidade in quantidades.items()],
    }


@router.post("/restaurar")
def restaurar(dados: dict | None = Body(None)):
    pedido_id = ler_pedido_id(dados or {})

    with engine.begin() as conexao:
        baixados = baixado_no_pedido(conexao, pedido_id)
        for bebida_id, quantidade in baixados.items():
            somar_estoque(conexao, bebida_id, quantidade)
            registrar_movimentacao(conexao, bebida_id, "restauracao", quantidade, pedido_id)

    return {
        "pedidoId": pedido_id,
        "itens": [{"bebidaId": bebida_id, "quantidade": quantidade} for bebida_id, quantidade in baixados.items()],
    }


@router.get("/{bebida_id}")
def consultar(bebida_id: str):
    bebida_id = ler_bebida_id(bebida_id)
    with engine.connect() as conexao:
        linha = buscar_estoque(conexao, bebida_id)
    if not linha:
        return {"bebidaId": bebida_id, "quantidade": 0, "quantidadeMinima": 0, "precisaRepor": True, "atualizadoEm": None}
    return formatar_estoque(linha)


@router.get("/{bebida_id}/movimentacoes")
def listar_movimentacoes(bebida_id: str):
    bebida_id = ler_bebida_id(bebida_id)
    with engine.connect() as conexao:
        linhas = conexao.execute(
            text("SELECT * FROM movimentacoes WHERE bebida_id = :bebida ORDER BY id DESC LIMIT 50"),
            {"bebida": bebida_id},
        )
        return [formatar_movimentacao(linha) for linha in linhas]


@router.post("/{bebida_id}/repor")
def repor(bebida_id: str, dados: dict | None = Body(None)):
    bebida_id = ler_bebida_id(bebida_id)
    quantidade = inteiro((dados or {}).get("quantidade"))
    if not quantidade:
        raise ErroHttp(400, "Quantidade deve ser maior que zero")

    with engine.begin() as conexao:
        conexao.execute(
            text(
                """INSERT INTO estoque (bebida_id, quantidade) VALUES (:bebida, :quantidade)
                   ON DUPLICATE KEY UPDATE quantidade = quantidade + :quantidade"""
            ),
            {"bebida": bebida_id, "quantidade": quantidade},
        )
        registrar_movimentacao(conexao, bebida_id, "reposicao", quantidade)
        return formatar_estoque(buscar_estoque(conexao, bebida_id))


@router.put("/{bebida_id}")
def ajustar(bebida_id: str, dados: dict | None = Body(None)):
    bebida_id = ler_bebida_id(bebida_id)
    dados = dados or {}
    quantidade = inteiro(dados.get("quantidade"), minimo=0)
    minima = inteiro(dados.get("quantidadeMinima"), minimo=0)

    if "quantidade" in dados and quantidade is None:
        raise ErroHttp(400, "Quantidade não pode ser negativa")
    if "quantidadeMinima" in dados and minima is None:
        raise ErroHttp(400, "Quantidade mínima não pode ser negativa")
    if quantidade is None and minima is None:
        raise ErroHttp(400, "Informe quantidade ou quantidadeMinima")

    with engine.begin() as conexao:
        atual = conexao.execute(
            text("SELECT * FROM estoque WHERE bebida_id = :bebida FOR UPDATE"), {"bebida": bebida_id}
        ).first()
        if not atual:
            conexao.execute(
                text("INSERT INTO estoque (bebida_id, quantidade) VALUES (:bebida, 0)"), {"bebida": bebida_id}
            )
            atual = buscar_estoque(conexao, bebida_id)

        if minima is not None:
            conexao.execute(
                text("UPDATE estoque SET quantidade_minima = :minima WHERE bebida_id = :bebida"),
                {"bebida": bebida_id, "minima": minima},
            )
        if quantidade is not None and quantidade != atual.quantidade:
            somar_estoque(conexao, bebida_id, quantidade - atual.quantidade)
            registrar_movimentacao(conexao, bebida_id, "ajuste", quantidade - atual.quantidade)

        return formatar_estoque(buscar_estoque(conexao, bebida_id))
