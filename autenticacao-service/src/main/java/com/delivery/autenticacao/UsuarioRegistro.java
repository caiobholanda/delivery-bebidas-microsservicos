package com.delivery.autenticacao;

import java.time.LocalDate;

public record UsuarioRegistro(int id, String nome, String email, String senhaHash, LocalDate dataNascimento, String perfil) {
}
