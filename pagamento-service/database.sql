CREATE TABLE IF NOT EXISTS pagamentos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  pedido_id INT NOT NULL,
  metodo ENUM('pix', 'cartao', 'dinheiro') NOT NULL,
  valor DECIMAL(10,2) NOT NULL,
  status ENUM('pendente', 'aprovado', 'recusado', 'cancelado', 'estornado') NOT NULL,
  codigo_pix VARCHAR(120) NULL,
  pix_expira_em DATETIME NULL,
  cartao_final CHAR(4) NULL,
  cartao_bandeira VARCHAR(20) NULL,
  troco_para DECIMAL(10,2) NULL,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  confirmado_em DATETIME NULL,
  estornado_em DATETIME NULL,
  INDEX idx_pagamentos_pedido (pedido_id)
);
