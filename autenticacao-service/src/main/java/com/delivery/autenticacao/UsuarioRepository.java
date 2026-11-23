package com.delivery.autenticacao;

import java.sql.Date;
import java.sql.PreparedStatement;
import java.sql.Statement;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Repository;

@Repository
public class UsuarioRepository {

    private static final RowMapper<UsuarioRegistro> MAPEADOR = (rs, linha) -> new UsuarioRegistro(
            rs.getInt("id"),
            rs.getString("nome"),
            rs.getString("email"),
            rs.getString("senha_hash"),
            rs.getDate("data_nascimento").toLocalDate(),
            rs.getString("perfil"));

    private final JdbcTemplate jdbc;

    public UsuarioRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public int criar(String nome, String email, String senhaHash, LocalDate dataNascimento, String perfil) {
        KeyHolder chave = new GeneratedKeyHolder();
        jdbc.update(conexao -> {
            PreparedStatement ps = conexao.prepareStatement(
                    "INSERT INTO usuarios (nome, email, senha_hash, data_nascimento, perfil) VALUES (?, ?, ?, ?, ?)",
                    Statement.RETURN_GENERATED_KEYS);
            ps.setString(1, nome);
            ps.setString(2, email);
            ps.setString(3, senhaHash);
            ps.setDate(4, Date.valueOf(dataNascimento));
            ps.setString(5, perfil);
            return ps;
        }, chave);
        return chave.getKey().intValue();
    }

    public Optional<UsuarioRegistro> buscarPorEmail(String email) {
        List<UsuarioRegistro> lista = jdbc.query("SELECT * FROM usuarios WHERE email = ?", MAPEADOR, email);
        return lista.stream().findFirst();
    }

    public Optional<UsuarioRegistro> buscarPorId(int id) {
        List<UsuarioRegistro> lista = jdbc.query("SELECT * FROM usuarios WHERE id = ?", MAPEADOR, id);
        return lista.stream().findFirst();
    }

    public boolean existePerfil(String perfil) {
        Integer total = jdbc.queryForObject("SELECT COUNT(*) FROM usuarios WHERE perfil = ?", Integer.class, perfil);
        return total != null && total > 0;
    }

    public void atualizarSenha(int id, String senhaHash) {
        jdbc.update("UPDATE usuarios SET senha_hash = ? WHERE id = ?", senhaHash, id);
    }

    public void criarSessao(String tokenHash, int usuarioId, LocalDateTime expiraEm) {
        jdbc.update("INSERT INTO sessoes (token_hash, usuario_id, expira_em) VALUES (?, ?, ?)",
                tokenHash, usuarioId, java.sql.Timestamp.valueOf(expiraEm));
    }

    public Optional<UsuarioRegistro> buscarPorSessao(String tokenHash) {
        List<UsuarioRegistro> lista = jdbc.query(
                "SELECT u.* FROM usuarios u JOIN sessoes s ON s.usuario_id = u.id "
                        + "WHERE s.token_hash = ? AND s.expira_em > ?",
                MAPEADOR, tokenHash, java.sql.Timestamp.valueOf(LocalDateTime.now()));
        return lista.stream().findFirst();
    }

    public void removerSessoes(int usuarioId) {
        jdbc.update("DELETE FROM sessoes WHERE usuario_id = ?", usuarioId);
    }

    public void removerSessoesExpiradas() {
        jdbc.update("DELETE FROM sessoes WHERE expira_em < ?", java.sql.Timestamp.valueOf(LocalDateTime.now()));
    }
}
