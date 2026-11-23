import os
import traceback
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import OperationalError
from starlette.exceptions import HTTPException

from db import iniciar_banco
from erros import ErroHttp
from routes import entregadores, entregas


def motivo_erro_banco(erro):
    codigo = erro.orig.args[0] if erro.orig and erro.orig.args else None
    if codigo == 2003:
        return "MySQL não está rodando ou a porta está errada"
    if codigo == 1045:
        return "usuário ou senha incorretos"
    return str(erro.orig or erro)


@asynccontextmanager
async def ciclo_de_vida(app):
    try:
        iniciar_banco()
    except OperationalError as erro:
        print(f"Erro ao conectar no banco: {motivo_erro_banco(erro)}. Confira a DATABASE_URL no arquivo .env", flush=True)
        os._exit(1)
    yield


app = FastAPI(title="Serviço de Entregas", lifespan=ciclo_de_vida)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.get("/health")
def health():
    return {"servico": "entregas", "status": "ok"}


app.include_router(entregas.router)
app.include_router(entregadores.router)


@app.exception_handler(ErroHttp)
async def tratar_erro_http(request, erro):
    return JSONResponse(status_code=erro.status, content={"erro": erro.mensagem})


@app.exception_handler(RequestValidationError)
async def tratar_corpo_invalido(request, erro):
    return JSONResponse(status_code=400, content={"erro": "Corpo da requisição inválido"})


@app.exception_handler(HTTPException)
async def tratar_rota(request, erro):
    if erro.status_code == 404:
        return JSONResponse(status_code=404, content={"erro": "Rota não encontrada"})
    if erro.status_code == 405:
        return JSONResponse(status_code=405, content={"erro": "Método não permitido"})
    return JSONResponse(status_code=erro.status_code, content={"erro": str(erro.detail)})


@app.exception_handler(Exception)
async def tratar_erro_interno(request, erro):
    traceback.print_exception(erro)
    return JSONResponse(status_code=500, content={"erro": "Erro interno no servidor"})


if __name__ == "__main__":
    porta = int(os.getenv("PORT", "5002"))
    print(f"Serviço de entregas rodando na porta {porta}")
    uvicorn.run(app, host="0.0.0.0", port=porta)
