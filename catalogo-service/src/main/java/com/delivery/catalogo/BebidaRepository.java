package com.delivery.catalogo;

import java.math.BigDecimal;
import java.sql.PreparedStatement;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Repository;

import com.delivery.catalogo.Dtos.Bebida;

@Repository
public class BebidaRepository {

    private static final String NAO_REMOVIDA = "id NOT IN (SELECT bebida_id FROM bebidas_removidas)";

    private static final String PRECO_FINAL = "COALESCE(preco_promocional, preco)";

    private static final RowMapper<Bebida> MAPEADOR = (rs, linha) -> new Bebida(
            rs.getInt("id"),
            rs.getString("nome"),
            rs.getString("categoria"),
            rs.getString("descricao"),
            rs.getBigDecimal("preco"),
            rs.getBigDecimal("preco_promocional"),
            rs.getBoolean("destaque"));

    private final JdbcTemplate jdbc;

    public BebidaRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<Bebida> listar(String busca, String categoria, BigDecimal precoMin, BigDecimal precoMax,
                               boolean somenteDestaques, boolean somentePromocoes, String ordem) {
        StringBuilder sql = new StringBuilder("SELECT * FROM bebidas WHERE " + NAO_REMOVIDA);
        List<Object> argumentos = new ArrayList<>();

        if (busca != null && !busca.isBlank()) {
            sql.append(" AND (nome LIKE ? OR descricao LIKE ?)");
            argumentos.add("%" + busca.trim() + "%");
            argumentos.add("%" + busca.trim() + "%");
        }
        if (categoria != null && !categoria.isBlank()) {
            sql.append(" AND categoria = ?");
            argumentos.add(categoria.trim());
        }
        if (precoMin != null) {
            sql.append(" AND ").append(PRECO_FINAL).append(" >= ?");
            argumentos.add(precoMin);
        }
        if (precoMax != null) {
            sql.append(" AND ").append(PRECO_FINAL).append(" <= ?");
            argumentos.add(precoMax);
        }
        if (somenteDestaques) sql.append(" AND destaque = TRUE");
        if (somentePromocoes) sql.append(" AND preco_promocional IS NOT NULL");

        sql.append(" ORDER BY ").append(clausulaOrdem(ordem));
        return jdbc.query(sql.toString(), MAPEADOR, argumentos.toArray());
    }

    public Optional<Bebida> buscarPorId(int id) {
        return jdbc.query("SELECT * FROM bebidas WHERE id = ? AND " + NAO_REMOVIDA, MAPEADOR, id).stream().findFirst();
    }

    public List<String> listarCategorias() {
        return jdbc.queryForList("SELECT DISTINCT categoria FROM bebidas WHERE " + NAO_REMOVIDA + " ORDER BY categoria", String.class);
    }

    public int inserir(String nome, String categoria, String descricao, BigDecimal preco,
                       BigDecimal precoPromocional, boolean destaque) {
        KeyHolder chave = new GeneratedKeyHolder();
        jdbc.update(conexao -> {
            PreparedStatement ps = conexao.prepareStatement(
                    "INSERT INTO bebidas (nome, categoria, descricao, preco, preco_promocional, destaque) VALUES (?, ?, ?, ?, ?, ?)",
                    Statement.RETURN_GENERATED_KEYS);
            ps.setString(1, nome);
            ps.setString(2, categoria);
            ps.setString(3, descricao);
            ps.setBigDecimal(4, preco);
            ps.setBigDecimal(5, precoPromocional);
            ps.setBoolean(6, destaque);
            return ps;
        }, chave);
        return chave.getKey().intValue();
    }

    public void atualizar(int id, String nome, String categoria, String descricao, BigDecimal preco,
                          BigDecimal precoPromocional, boolean destaque) {
        jdbc.update("UPDATE bebidas SET nome = ?, categoria = ?, descricao = ?, preco = ?, preco_promocional = ?, destaque = ? WHERE id = ?",
                nome, categoria, descricao, preco, precoPromocional, destaque, id);
    }

    public void remover(int id) {
        jdbc.update("INSERT IGNORE INTO bebidas_removidas (bebida_id) VALUES (?)", id);
    }

    private static String clausulaOrdem(String ordem) {
        if ("preco_asc".equals(ordem)) return PRECO_FINAL + " ASC, nome ASC";
        if ("preco_desc".equals(ordem)) return PRECO_FINAL + " DESC, nome ASC";
        return "nome ASC";
    }
}
