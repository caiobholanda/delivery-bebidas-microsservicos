package com.delivery.autenticacao;

import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

@RestControllerAdvice
public class TratadorErros {

    private static ResponseEntity<Map<String, String>> resposta(int status, String mensagem) {
        return ResponseEntity.status(status).body(Map.of("erro", mensagem));
    }

    @ExceptionHandler(ErroHttp.class)
    public ResponseEntity<Map<String, String>> erroHttp(ErroHttp erro) {
        return resposta(erro.getStatus(), erro.getMessage());
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<Map<String, String>> corpoInvalido(HttpMessageNotReadableException erro) {
        return resposta(400, "Corpo da requisição inválido");
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<Map<String, String>> parametroInvalido(MethodArgumentTypeMismatchException erro) {
        return resposta(400, "Parâmetro inválido: " + erro.getName());
    }

    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<Map<String, String>> rotaNaoEncontrada(NoResourceFoundException erro) {
        return resposta(404, "Rota não encontrada");
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<Map<String, String>> metodoNaoSuportado(HttpRequestMethodNotSupportedException erro) {
        return resposta(405, "Método não permitido nesta rota");
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, String>> erroInterno(Exception erro) {
        erro.printStackTrace();
        return resposta(500, "Erro interno no servidor");
    }
}
