import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise SystemExit("DATABASE_URL não definida. Crie o arquivo .env a partir do .env.example.")

engine = create_engine(DATABASE_URL, pool_size=5, pool_pre_ping=True, pool_recycle=280)


def criar_banco_se_nao_existir():
    url = make_url(DATABASE_URL)
    servidor = create_engine(url._replace(database=None))
    with servidor.begin() as conexao:
        conexao.execute(text(f"CREATE DATABASE IF NOT EXISTS `{url.database}`"))
    servidor.dispose()


def iniciar_banco():
    criar_banco_se_nao_existir()
    sql = (Path(__file__).parent / "database.sql").read_text(encoding="utf-8")
    with engine.begin() as conexao:
        for comando in sql.split(";"):
            if comando.strip():
                conexao.execute(text(comando))
