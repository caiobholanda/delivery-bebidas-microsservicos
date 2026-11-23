package com.delivery.catalogo;

import java.math.BigDecimal;

public final class Dtos {

    private Dtos() {
    }

    public record Bebida(int id, String nome, String categoria, String descricao,
                         BigDecimal preco, BigDecimal precoPromocional, boolean destaque) {
    }

    public record BebidaRequest(String nome, String categoria, String descricao,
                                BigDecimal preco, BigDecimal precoPromocional, Boolean destaque) {
    }

    public record Usuario(int id, String nome, String email, String perfil) {
    }
}
