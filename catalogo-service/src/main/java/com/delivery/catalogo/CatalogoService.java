package com.delivery.catalogo;

import java.math.BigDecimal;
import java.util.List;

import org.springframework.stereotype.Service;

import com.delivery.catalogo.Dtos.Bebida;
import com.delivery.catalogo.Dtos.BebidaRequest;

@Service
public class CatalogoService {

    private final BebidaRepository repositorio;

    public CatalogoService(BebidaRepository repositorio) {
        this.repositorio = repositorio;
    }

    public List<Bebida> listar(String busca, String categoria, BigDecimal precoMin, BigDecimal precoMax,
                               boolean destaques, boolean promocoes, String ordem) {
        if (precoMin != null && precoMax != null && precoMin.compareTo(precoMax) > 0) {
            throw new ErroHttp(400, "O preço mínimo não pode ser maior que o máximo");
        }
        return repositorio.listar(busca, categoria, precoMin, precoMax, destaques, promocoes, ordem);
    }

    public Bebida buscarPorId(int id) {
        return repositorio.buscarPorId(id).orElseThrow(() -> new ErroHttp(404, "Bebida não encontrada"));
    }

    public List<String> listarCategorias() {
        return repositorio.listarCategorias();
    }

    public Bebida cadastrar(BebidaRequest dados) {
        validar(dados);
        int id = repositorio.inserir(dados.nome().trim(), dados.categoria().trim(), descricao(dados),
                dados.preco(), dados.precoPromocional(), Boolean.TRUE.equals(dados.destaque()));
        return buscarPorId(id);
    }

    public Bebida atualizar(int id, BebidaRequest dados) {
        buscarPorId(id);
        validar(dados);
        repositorio.atualizar(id, dados.nome().trim(), dados.categoria().trim(), descricao(dados),
                dados.preco(), dados.precoPromocional(), Boolean.TRUE.equals(dados.destaque()));
        return buscarPorId(id);
    }

    private static String descricao(BebidaRequest dados) {
        return dados.descricao() == null || dados.descricao().isBlank() ? null : dados.descricao().trim();
    }

    private static void validar(BebidaRequest dados) {
        if (dados == null) throw new ErroHttp(400, "Corpo da requisição inválido");
        if (dados.nome() == null || dados.nome().isBlank()) throw new ErroHttp(400, "Informe o nome da bebida");
        if (dados.categoria() == null || dados.categoria().isBlank()) throw new ErroHttp(400, "Informe a categoria");
        if (dados.preco() == null || dados.preco().signum() <= 0) throw new ErroHttp(400, "O preço precisa ser maior que zero");
        BigDecimal promocional = dados.precoPromocional();
        if (promocional != null && (promocional.signum() <= 0 || promocional.compareTo(dados.preco()) >= 0)) {
            throw new ErroHttp(400, "O preço promocional precisa ser maior que zero e menor que o preço normal");
        }
    }
}
