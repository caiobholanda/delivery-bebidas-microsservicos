import re

from fastapi import APIRouter, Body
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from db import engine
from erros import ErroHttp, inteiro
from routes.entregas import CONSULTA as CONSULTA_ENTREGAS, formatar_entrega

router = APIRouter(prefix="/entregadores")

VEICULOS = ["moto", "carro", "bicicleta"]
EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

CONSULTA = """SELECT d.*,
                (SELECT COUNT(*) FROM entregas e WHERE e.entregador_id = d.id AND e.status = 'atribuida') AS pendentes,
                (SELECT COUNT(*) FROM entregas e WHERE e.entregador_id = d.id AND e.status = 'em_rota') AS em_rota
              FROM entregadores d"""


def formatar_entregador(linha):
    return {
        "id": linha.id,
        "nome": linha.nome,
        "email": linha.email,
        "telefone": linha.telefone,
        "veiculo": linha.veiculo,
        "placa": linha.placa,
        "ativo": bool(linha.ativo),
        "entregasPendentes": linha.pendentes,
        "emRota": linha.em_rota,
        "disponivel": bool(linha.ativo) and linha.em_rota == 0,
    }


def ler_entregador_id(valor):
    entregador_id = inteiro(valor)
    if not entregador_id:
        raise ErroHttp(400, "id inválido")
    return entregador_id


def buscar_entregador(conexao, entregador_id):
    linha = conexao.execute(text(f"{CONSULTA} WHERE d.id = :id"), {"id": entregador_id}).first()
    if not linha:
        raise ErroHttp(404, "Entregador não encontrado")
    return linha


@router.get("")
def listar(ativos: bool = False, email: str | None = None):
    filtros, parametros = [], {}
    if ativos:
        filtros.append("d.ativo = TRUE")
    if email:
        filtros.append("d.email = :email")
        parametros["email"] = email.strip().lower()
    sql = CONSULTA + (" WHERE " + " AND ".join(filtros) if filtros else "") + " ORDER BY d.nome"
    with engine.connect() as conexao:
        return [formatar_entregador(linha) for linha in conexao.execute(text(sql), parametros)]


@router.post("", status_code=201)
def cadastrar(dados: dict | None = Body(None)):
    dados = dados or {}
    nome = str(dados.get("nome") or "").strip()
    email = str(dados.get("email") or "").strip().lower()
    telefone = re.sub(r"\D", "", str(dados.get("telefone") or ""))
    veiculo = dados.get("veiculo")
    placa = str(dados.get("placa") or "").strip().upper().replace("-", "") or None

    if not nome:
        raise ErroHttp(400, "Informe o nome do entregador")
    if not EMAIL.match(email):
        raise ErroHttp(400, "Informe o e-mail que o entregador usa para entrar no sistema")
    if len(telefone) not in (10, 11):
        raise ErroHttp(400, "Telefone deve ter DDD e 8 ou 9 dígitos")
    if veiculo not in VEICULOS:
        raise ErroHttp(400, "Veículo deve ser moto, carro ou bicicleta")
    if veiculo != "bicicleta" and not placa:
        raise ErroHttp(400, "Informe a placa do veículo")
    if placa and not re.fullmatch(r"[A-Z]{3}[0-9][A-Z0-9][0-9]{2}", placa):
        raise ErroHttp(400, "Placa inválida")

    try:
        with engine.begin() as conexao:
            resultado = conexao.execute(
                text(
                    """INSERT INTO entregadores (nome, email, telefone, veiculo, placa)
                       VALUES (:nome, :email, :telefone, :veiculo, :placa)"""
                ),
                {
                    "nome": nome[:120],
                    "email": email[:160],
                    "telefone": telefone,
                    "veiculo": veiculo,
                    "placa": placa if veiculo != "bicicleta" else None,
                },
            )
            return formatar_entregador(buscar_entregador(conexao, resultado.lastrowid))
    except IntegrityError:
        raise ErroHttp(409, "Já existe um entregador com este e-mail")


@router.get("/{entregador_id}")
def consultar(entregador_id: str):
    with engine.connect() as conexao:
        return formatar_entregador(buscar_entregador(conexao, ler_entregador_id(entregador_id)))


@router.get("/{entregador_id}/entregas")
def listar_entregas(entregador_id: str):
    entregador_id = ler_entregador_id(entregador_id)
    with engine.connect() as conexao:
        buscar_entregador(conexao, entregador_id)
        linhas = conexao.execute(
            text(f"{CONSULTA_ENTREGAS} WHERE e.entregador_id = :id ORDER BY e.criado_em DESC, e.id DESC"),
            {"id": entregador_id},
        )
        return [formatar_entrega(linha) for linha in linhas]


@router.patch("/{entregador_id}/status")
def alterar_status(entregador_id: str, dados: dict | None = Body(None)):
    entregador_id = ler_entregador_id(entregador_id)
    ativo = (dados or {}).get("ativo")
    if not isinstance(ativo, bool):
        raise ErroHttp(400, "Informe ativo como true ou false")

    with engine.begin() as conexao:
        entregador = buscar_entregador(conexao, entregador_id)
        if not ativo and entregador.em_rota:
            raise ErroHttp(409, f"{entregador.nome} está com entrega em rota")
        conexao.execute(
            text("UPDATE entregadores SET ativo = :ativo WHERE id = :id"), {"id": entregador_id, "ativo": ativo}
        )
        return formatar_entregador(buscar_entregador(conexao, entregador_id))
