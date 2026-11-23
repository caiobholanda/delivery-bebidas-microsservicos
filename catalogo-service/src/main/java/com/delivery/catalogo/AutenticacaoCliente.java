package com.delivery.catalogo;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import com.delivery.catalogo.Dtos.Usuario;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;

/** Consome o serviço de Autenticação para saber quem está chamando o catálogo. */
@Component
public class AutenticacaoCliente {

    private final String url;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(60)).build();
    private final ObjectMapper json = new ObjectMapper().configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

    public AutenticacaoCliente(@Value("${AUTENTICACAO_URL:http://localhost:8080}") String url) {
        this.url = url.endsWith("/") ? url.substring(0, url.length() - 1) : url;
    }

    /** Exige um administrador logado. Lança 401 (sem login) ou 403 (não é administrador). */
    public Usuario exigirAdministrador(String cabecalho) {
        if (cabecalho == null || cabecalho.isBlank()) throw new ErroHttp(401, "Token não informado");

        HttpResponse<String> resposta;
        try {
            HttpRequest requisicao = HttpRequest.newBuilder(URI.create(url + "/auth/validar"))
                    .header("Authorization", cabecalho)
                    .timeout(Duration.ofSeconds(60))
                    .GET()
                    .build();
            resposta = http.send(requisicao, HttpResponse.BodyHandlers.ofString());
        } catch (InterruptedException erro) {
            Thread.currentThread().interrupt();
            throw new ErroHttp(503, "Serviço de autenticação indisponível");
        } catch (IOException | IllegalArgumentException erro) {
            throw new ErroHttp(503, "Serviço de autenticação indisponível");
        }

        if (resposta.statusCode() == 401) throw new ErroHttp(401, "Token inválido ou expirado");
        if (resposta.statusCode() != 200) throw new ErroHttp(503, "Serviço de autenticação indisponível");

        Usuario usuario;
        try {
            usuario = json.readValue(resposta.body(), Usuario.class);
        } catch (IOException erro) {
            throw new ErroHttp(503, "Resposta inválida do serviço de autenticação");
        }
        if (!"administrador".equals(usuario.perfil())) {
            throw new ErroHttp(403, "Apenas administradores podem alterar o catálogo");
        }
        return usuario;
    }
}
