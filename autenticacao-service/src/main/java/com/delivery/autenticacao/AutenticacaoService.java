package com.delivery.autenticacao;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeParseException;
import java.time.temporal.ChronoUnit;
import java.util.regex.Pattern;

import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;

import com.delivery.autenticacao.Dtos.CadastroRequest;
import com.delivery.autenticacao.Dtos.LoginRequest;
import com.delivery.autenticacao.Dtos.LoginResposta;
import com.delivery.autenticacao.Dtos.SenhaRequest;
import com.delivery.autenticacao.Dtos.UsuarioResposta;

@Service
public class AutenticacaoService {

    private static final Pattern EMAIL = Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");
    private static final int IDADE_MINIMA = 18;
    private static final int HORAS_DA_SESSAO = 24;

    private final UsuarioRepository repositorio;

    public AutenticacaoService(UsuarioRepository repositorio) {
        this.repositorio = repositorio;
    }

    public UsuarioResposta cadastrarCliente(CadastroRequest dados) {
        return cadastrar(dados, "cliente");
    }

    public UsuarioResposta cadastrarEntregador(String cabecalho, CadastroRequest dados) {
        UsuarioRegistro usuario = usuarioDoToken(cabecalho);
        if (!"administrador".equals(usuario.perfil())) {
            throw new ErroHttp(403, "Apenas o administrador pode cadastrar entregadores");
        }
        return cadastrar(dados, "entregador");
    }

    private UsuarioResposta cadastrar(CadastroRequest dados, String perfil) {
        if (dados == null) throw new ErroHttp(400, "Corpo da requisição inválido");

        String nome = textoObrigatorio(dados.nome(), "Informe o nome");
        String email = textoObrigatorio(dados.email(), "Informe o e-mail").toLowerCase();
        String senha = dados.senha();
        if (!EMAIL.matcher(email).matches()) throw new ErroHttp(400, "E-mail inválido");
        validarSenha(senha, "senha");

        LocalDate nascimento = lerData(dados.dataNascimento());
        if (nascimento.plusYears(IDADE_MINIMA).isAfter(LocalDate.now())) {
            throw new ErroHttp(400, "O cadastro é permitido apenas para maiores de 18 anos");
        }

        return criarUsuario(nome, email, senha, nascimento, perfil);
    }

    public void criarAdministradorSeNaoExistir(String email, String senha) {
        if (repositorio.existePerfil("administrador")) return;
        criarUsuario("Administrador", email.toLowerCase(), senha, LocalDate.of(1990, 1, 1), "administrador");
    }

    public LoginResposta login(LoginRequest dados) {
        if (dados == null || dados.email() == null || dados.senha() == null) {
            throw new ErroHttp(400, "Informe e-mail e senha");
        }
        UsuarioRegistro usuario = repositorio.buscarPorEmail(dados.email().trim().toLowerCase())
                .filter(u -> Senhas.conferir(dados.senha(), u.senhaHash()))
                .orElseThrow(() -> new ErroHttp(401, "E-mail ou senha incorretos"));

        repositorio.removerSessoesExpiradas();
        String token = Senhas.novoToken();
        repositorio.criarSessao(Senhas.hashDoToken(token), usuario.id(), LocalDateTime.now().plus(HORAS_DA_SESSAO, ChronoUnit.HOURS));
        return new LoginResposta(token, resposta(usuario));
    }

    public UsuarioResposta validar(String cabecalho) {
        return resposta(usuarioDoToken(cabecalho));
    }

    public void alterarSenha(String cabecalho, SenhaRequest dados) {
        UsuarioRegistro usuario = usuarioDoToken(cabecalho);
        if (dados == null || dados.senhaAtual() == null) throw new ErroHttp(400, "Informe a senha atual e a nova senha");
        validarSenha(dados.novaSenha(), "nova senha");
        if (!Senhas.conferir(dados.senhaAtual(), usuario.senhaHash())) {
            throw new ErroHttp(401, "Senha atual incorreta");
        }
        repositorio.atualizarSenha(usuario.id(), Senhas.gerarHash(dados.novaSenha()));
        repositorio.removerSessoes(usuario.id());
    }

    private UsuarioRegistro usuarioDoToken(String cabecalho) {
        if (cabecalho == null || !cabecalho.startsWith("Bearer ") || cabecalho.length() < 8) {
            throw new ErroHttp(401, "Token não informado");
        }
        String token = cabecalho.substring(7).trim();
        return repositorio.buscarPorSessao(Senhas.hashDoToken(token))
                .orElseThrow(() -> new ErroHttp(401, "Token inválido ou expirado"));
    }

    private UsuarioResposta criarUsuario(String nome, String email, String senha, LocalDate nascimento, String perfil) {
        if (repositorio.buscarPorEmail(email).isPresent()) throw new ErroHttp(409, "E-mail já cadastrado");
        try {
            int id = repositorio.criar(nome, email, Senhas.gerarHash(senha), nascimento, perfil);
            return new UsuarioResposta(id, nome, email, perfil);
        } catch (DuplicateKeyException erro) {
            throw new ErroHttp(409, "E-mail já cadastrado");
        }
    }

    private static UsuarioResposta resposta(UsuarioRegistro usuario) {
        return new UsuarioResposta(usuario.id(), usuario.nome(), usuario.email(), usuario.perfil());
    }

    private static String textoObrigatorio(String valor, String mensagem) {
        if (valor == null || valor.isBlank()) throw new ErroHttp(400, mensagem);
        return valor.trim();
    }

    private static void validarSenha(String senha, String campo) {
        if (senha == null || senha.length() < 6) throw new ErroHttp(400, "A " + campo + " precisa ter pelo menos 6 caracteres");
    }

    private static LocalDate lerData(String texto) {
        if (texto == null || texto.isBlank()) throw new ErroHttp(400, "Informe a data de nascimento (AAAA-MM-DD)");
        try {
            return LocalDate.parse(texto.trim());
        } catch (DateTimeParseException erro) {
            throw new ErroHttp(400, "Data de nascimento inválida. Use o formato AAAA-MM-DD");
        }
    }
}
