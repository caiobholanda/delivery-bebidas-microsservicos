package com.delivery.catalogo;

public class ErroHttp extends RuntimeException {

    private final int status;

    public ErroHttp(int status, String mensagem) {
        super(mensagem);
        this.status = status;
    }

    public int getStatus() {
        return status;
    }
}
