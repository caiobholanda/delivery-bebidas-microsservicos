package com.delivery.catalogo;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.delivery.catalogo.Dtos.Bebida;
import com.delivery.catalogo.Dtos.BebidaRequest;

@RestController
public class CatalogoController {

    private final CatalogoService servico;
    private final AutenticacaoCliente autenticacao;

    public CatalogoController(CatalogoService servico, AutenticacaoCliente autenticacao) {
        this.servico = servico;
        this.autenticacao = autenticacao;
    }

    @GetMapping("/health")
    public Map<String, String> health() {
        return Map.of("servico", "catalogo", "status", "ok");
    }

    @GetMapping("/bebidas")
    public List<Bebida> listar(@RequestParam(required = false) String busca,
                               @RequestParam(required = false) String categoria,
                               @RequestParam(required = false) BigDecimal precoMin,
                               @RequestParam(required = false) BigDecimal precoMax,
                               @RequestParam(required = false) String ordem) {
        return servico.listar(busca, categoria, precoMin, precoMax, false, false, ordem);
    }

    @GetMapping("/bebidas/destaques")
    public List<Bebida> destaques() {
        return servico.listar(null, null, null, null, true, false, null);
    }

    @GetMapping("/bebidas/promocoes")
    public List<Bebida> promocoes() {
        return servico.listar(null, null, null, null, false, true, null);
    }

    @GetMapping("/bebidas/{id}")
    public Bebida buscar(@PathVariable int id) {
        return servico.buscarPorId(id);
    }

    @GetMapping("/categorias")
    public List<String> categorias() {
        return servico.listarCategorias();
    }

    @PostMapping("/bebidas")
    public ResponseEntity<Bebida> cadastrar(@RequestHeader(value = "Authorization", required = false) String autorizacao,
                                            @RequestBody BebidaRequest dados) {
        autenticacao.exigirAdministrador(autorizacao);
        return ResponseEntity.status(HttpStatus.CREATED).body(servico.cadastrar(dados));
    }

    @PutMapping("/bebidas/{id}")
    public Bebida atualizar(@RequestHeader(value = "Authorization", required = false) String autorizacao,
                            @PathVariable int id,
                            @RequestBody BebidaRequest dados) {
        autenticacao.exigirAdministrador(autorizacao);
        return servico.atualizar(id, dados);
    }

    @DeleteMapping("/bebidas/{id}")
    public ResponseEntity<Void> remover(@RequestHeader(value = "Authorization", required = false) String autorizacao,
                                        @PathVariable int id) {
        autenticacao.exigirAdministrador(autorizacao);
        servico.remover(id);
        return ResponseEntity.noContent().build();
    }
}
