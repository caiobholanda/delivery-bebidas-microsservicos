package com.delivery.autenticacao;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

@Component
public class AdministradorInicial implements ApplicationRunner {

    private final AutenticacaoService servico;
    private final String email;
    private final String senha;

    public AdministradorInicial(AutenticacaoService servico,
                                @Value("${ADMIN_EMAIL:admin@delivery.com}") String email,
                                @Value("${ADMIN_SENHA:admin123}") String senha) {
        this.servico = servico;
        this.email = email;
        this.senha = senha;
    }

    @Override
    public void run(ApplicationArguments args) {
        servico.criarAdministradorSeNaoExistir(email, senha);
    }
}
