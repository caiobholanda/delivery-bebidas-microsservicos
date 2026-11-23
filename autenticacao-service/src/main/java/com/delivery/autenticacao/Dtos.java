package com.delivery.autenticacao;

/** Corpos de entrada e saída da API. */
public final class Dtos {

    private Dtos() {
    }

    public record CadastroRequest(String nome, String email, String senha, String dataNascimento) {
    }

    public record LoginRequest(String email, String senha) {
    }

    public record SenhaRequest(String senhaAtual, String novaSenha) {
    }

    public record UsuarioResposta(int id, String nome, String email, String perfil) {
    }

    public record LoginResposta(String token, UsuarioResposta usuario) {
    }
}
