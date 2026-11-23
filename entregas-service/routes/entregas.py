from fastapi import APIRouter, Body
from sqlalchemy import text

from db import engine
from erros import ErroHttp, inteiro
from pedidos import atualizar_status_pedido

router = APIRouter(prefix="/entregas")

STATUS = ["aguardando_entregador", "atribuida", "em_rota", "entregue", "falhou", "cancelada"]

CONSULTA = """SELECT e.*, d.nome AS entregador_nome FROM entregas e
              LEFT JOIN entregadores d ON d.id = e.entregador_id"""


def formatar_entrega(linha):
    return {
        "id": linha.id,
        "pedidoId": linha.pedido_id,
        "clienteId": linha.cliente_id,
        "endereco": linha.endereco,
        "status": linha.status,
        "entregadorId": linha.entregador_id,
        "entregadorNome": linha.entregador_nome,
        "tentativas": linha.tentativas,
        "motivoFalha": linha.motivo_falha,
        "criadoEm": linha.criado_em,
        "atribuidaEm": linha.atribuida_em,
        "saiuEm": linha.saiu_em,
        "finalizadaEm": linha.finalizada_em,
    }


def ler_id(valor, nome="id"):
    numero = inteiro(valor)
    if not numero:
        raise ErroHttp(400, f"{nome} inválido")
    return numero


def buscar_entrega(conexao, entrega_id):
    linha = conexao.execute(text(f"{CONSULTA} WHERE e.id = :id"), {"id": entrega_id}).first()
    if not linha:
        raise ErroHttp(404, "Entrega não encontrada")
    return linha


def buscar_por_pedido(conexao, pedido_id):
    linha = conexao.execute(text(f"{CONSULTA} WHERE e.pedido_id = :pedido"), {"pedido": pedido_id}).first()
    if not linha:
        raise ErroHttp(404, "Nenhuma entrega para este pedido")
    return linha


def exigir_status(entrega, permitidos, acao):
    if entrega.status not in permitidos:
        raise ErroHttp(409, f'Entrega com status "{entrega.status}" não pode {acao}')


@router.post("", status_code=201)
def gerar(dados: dict | None = Body(None)):
    dados = dados or {}
    pedido_id = ler_id(dados.get("pedidoId"), "pedidoId")
    cliente_id = ler_id(dados.get("clienteId"), "clienteId")
    endereco = str(dados.get("endereco") or "").strip()
    if not endereco:
        raise ErroHttp(400, "Informe o endereço de entrega")

    with engine.begin() as conexao:
        existente = conexao.execute(
            text("SELECT id FROM entregas WHERE pedido_id = :pedido"), {"pedido": pedido_id}
        ).first()
        if existente:
            raise ErroHttp(409, f"Já existe uma entrega para o pedido {pedido_id}")

        resultado = conexao.execute(
            text("INSERT INTO entregas (pedido_id, cliente_id, endereco) VALUES (:pedido, :cliente, :endereco)"),
            {"pedido": pedido_id, "cliente": cliente_id, "endereco": endereco[:255]},
        )
        return formatar_entrega(buscar_entrega(conexao, resultado.lastrowid))


@router.get("")
def listar(status: str | None = None, entregadorId: str | None = None):
    filtros = []
    parametros = {}
    if status:
        if status not in STATUS:
            raise ErroHttp(400, f"Status deve ser um de: {', '.join(STATUS)}")
        filtros.append("e.status = :status")
        parametros["status"] = status
    if entregadorId:
        filtros.append("e.entregador_id = :entregador")
        parametros["entregador"] = ler_id(entregadorId, "entregadorId")

    sql = CONSULTA
    if filtros:
        sql += " WHERE " + " AND ".join(filtros)
    sql += " ORDER BY e.criado_em DESC, e.id DESC"

    with engine.connect() as conexao:
        return [formatar_entrega(linha) for linha in conexao.execute(text(sql), parametros)]


@router.get("/pedido/{pedido_id}")
def consultar_por_pedido(pedido_id: str):
    with engine.connect() as conexao:
        return formatar_entrega(buscar_por_pedido(conexao, ler_id(pedido_id, "pedidoId")))


@router.patch("/pedido/{pedido_id}/cancelar")
def cancelar(pedido_id: str):
    pedido_id = ler_id(pedido_id, "pedidoId")
    with engine.begin() as conexao:
        entrega = buscar_por_pedido(conexao, pedido_id)
        if entrega.status != "cancelada":
            exigir_status(entrega, ["aguardando_entregador", "atribuida", "falhou"], "ser cancelada")
            conexao.execute(
                text("UPDATE entregas SET status = 'cancelada', finalizada_em = NOW() WHERE id = :id"),
                {"id": entrega.id},
            )
        return formatar_entrega(buscar_entrega(conexao, entrega.id))


@router.get("/{entrega_id}")
def consultar(entrega_id: str):
    with engine.connect() as conexao:
        return formatar_entrega(buscar_entrega(conexao, ler_id(entrega_id)))


@router.patch("/{entrega_id}/atribuir")
def atribuir(entrega_id: str, dados: dict | None = Body(None)):
    entrega_id = ler_id(entrega_id)
    entregador_id = ler_id((dados or {}).get("entregadorId"), "entregadorId")

    with engine.begin() as conexao:
        entrega = buscar_entrega(conexao, entrega_id)
        exigir_status(entrega, ["aguardando_entregador", "atribuida", "falhou"], "receber entregador")

        entregador = conexao.execute(
            text("SELECT * FROM entregadores WHERE id = :id"), {"id": entregador_id}
        ).first()
        if not entregador:
            raise ErroHttp(404, "Entregador não encontrado")
        if not entregador.ativo:
            raise ErroHttp(409, f"{entregador.nome} está inativo")

        conexao.execute(
            text(
                """UPDATE entregas SET entregador_id = :entregador, status = 'atribuida', atribuida_em = NOW()
                   WHERE id = :id"""
            ),
            {"id": entrega_id, "entregador": entregador_id},
        )
        return formatar_entrega(buscar_entrega(conexao, entrega_id))


@router.patch("/{entrega_id}/iniciar")
def iniciar(entrega_id: str):
    entrega_id = ler_id(entrega_id)
    with engine.begin() as conexao:
        entrega = buscar_entrega(conexao, entrega_id)
        exigir_status(entrega, ["atribuida"], "sair para entrega")

        if entrega.tentativas == 0:
            atualizar_status_pedido(entrega.pedido_id, "em_entrega")

        conexao.execute(
            text(
                """UPDATE entregas SET status = 'em_rota', tentativas = tentativas + 1, saiu_em = NOW()
                   WHERE id = :id"""
            ),
            {"id": entrega_id},
        )
        return formatar_entrega(buscar_entrega(conexao, entrega_id))


@router.patch("/{entrega_id}/finalizar")
def finalizar(entrega_id: str):
    entrega_id = ler_id(entrega_id)
    with engine.begin() as conexao:
        entrega = buscar_entrega(conexao, entrega_id)
        exigir_status(entrega, ["em_rota"], "ser finalizada")

        atualizar_status_pedido(entrega.pedido_id, "entregue")

        conexao.execute(
            text("UPDATE entregas SET status = 'entregue', finalizada_em = NOW() WHERE id = :id"),
            {"id": entrega_id},
        )
        return formatar_entrega(buscar_entrega(conexao, entrega_id))


@router.patch("/{entrega_id}/falha")
def registrar_falha(entrega_id: str, dados: dict | None = Body(None)):
    entrega_id = ler_id(entrega_id)
    motivo = str((dados or {}).get("motivo") or "").strip()
    if not motivo:
        raise ErroHttp(400, "Informe o motivo da falha")

    with engine.begin() as conexao:
        entrega = buscar_entrega(conexao, entrega_id)
        exigir_status(entrega, ["em_rota"], "registrar falha")

        conexao.execute(
            text("UPDATE entregas SET status = 'falhou', motivo_falha = :motivo WHERE id = :id"),
            {"id": entrega_id, "motivo": motivo[:255]},
        )
        return formatar_entrega(buscar_entrega(conexao, entrega_id))
