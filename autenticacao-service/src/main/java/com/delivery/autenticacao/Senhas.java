package com.delivery.autenticacao;

import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HexFormat;

import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;

public final class Senhas {

    private static final SecureRandom ALEATORIO = new SecureRandom();
    private static final int ITERACOES = 65536;

    private Senhas() {
    }

    public static String gerarHash(String senha) {
        byte[] sal = new byte[16];
        ALEATORIO.nextBytes(sal);
        return Base64.getEncoder().encodeToString(sal) + ":" + Base64.getEncoder().encodeToString(pbkdf2(senha, sal));
    }

    public static boolean conferir(String senha, String armazenado) {
        String[] partes = armazenado.split(":");
        if (partes.length != 2) return false;
        byte[] sal = Base64.getDecoder().decode(partes[0]);
        byte[] esperado = Base64.getDecoder().decode(partes[1]);
        return MessageDigest.isEqual(esperado, pbkdf2(senha, sal));
    }

    public static String novoToken() {
        byte[] bytes = new byte[32];
        ALEATORIO.nextBytes(bytes);
        return HexFormat.of().formatHex(bytes);
    }

    public static String hashDoToken(String token) {
        try {
            byte[] resumo = MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(resumo);
        } catch (GeneralSecurityException erro) {
            throw new IllegalStateException(erro);
        }
    }

    private static byte[] pbkdf2(String senha, byte[] sal) {
        try {
            PBEKeySpec especificacao = new PBEKeySpec(senha.toCharArray(), sal, ITERACOES, 256);
            return SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(especificacao).getEncoded();
        } catch (GeneralSecurityException erro) {
            throw new IllegalStateException(erro);
        }
    }
}
