package com.delivery.autenticacao;

import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

import com.delivery.autenticacao.Dtos.CadastroRequest;
import com.delivery.autenticacao.Dtos.LoginRequest;
import com.delivery.autenticacao.Dtos.LoginResposta;
import com.delivery.autenticacao.Dtos.SenhaRequest;
import com.delivery.autenticacao.Dtos.UsuarioResposta;

@RestController
public class AutenticacaoController {

    private final AutenticacaoService servico;

    public AutenticacaoController(AutenticacaoService servico) {
        this.servico = servico;
    }

    @GetMapping("/health")
    public Map<String, String> health() {
        return Map.of("servico", "autenticacao", "status", "ok");
    }

    @PostMapping("/auth/cadastro")
    public ResponseEntity<UsuarioResposta> cadastrar(@RequestBody CadastroRequest dados) {
        return ResponseEntity.status(HttpStatus.CREATED).body(servico.cadastrarCliente(dados));
    }

    @PostMapping("/auth/entregadores")
    public ResponseEntity<UsuarioResposta> cadastrarEntregador(@RequestHeader(value = "Authorization", required = false) String autorizacao,
                                                               @RequestBody CadastroRequest dados) {
        return ResponseEntity.status(HttpStatus.CREATED).body(servico.cadastrarEntregador(autorizacao, dados));
    }

    @PostMapping("/auth/login")
    public LoginResposta login(@RequestBody LoginRequest dados) {
        return servico.login(dados);
    }

    @GetMapping("/auth/validar")
    public UsuarioResposta validar(@RequestHeader(value = "Authorization", required = false) String autorizacao) {
        return servico.validar(autorizacao);
    }

    @PutMapping("/auth/senha")
    public Map<String, String> alterarSenha(@RequestHeader(value = "Authorization", required = false) String autorizacao,
                                            @RequestBody SenhaRequest dados) {
        servico.alterarSenha(autorizacao, dados);
        return Map.of("mensagem", "Senha alterada. Faça login novamente.");
    }
}
