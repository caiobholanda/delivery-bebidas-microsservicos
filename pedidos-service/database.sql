CREATE TABLE IF NOT EXISTS carrinhos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  cliente_id INT NOT NULL UNIQUE,
  cupom_codigo VARCHAR(30) NULL,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS itens_carrinho (
  id INT AUTO_INCREMENT PRIMARY KEY,
  carrinho_id INT NOT NULL,
  bebida_id INT NOT NULL,
  nome VARCHAR(120) NOT NULL,
  preco_unitario DECIMAL(10,2) NOT NULL,
  quantidade INT NOT NULL,
  UNIQUE KEY uk_carrinho_bebida (carrinho_id, bebida_id),
  FOREIGN KEY (carrinho_id) REFERENCES carrinhos(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS cupons (
  codigo VARCHAR(30) PRIMARY KEY,
  tipo ENUM('percentual', 'fixo') NOT NULL,
  valor DECIMAL(10,2) NOT NULL,
  valor_minimo DECIMAL(10,2) NOT NULL DEFAULT 0,
  validade DATE NULL,
  ativo BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS pedidos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  cliente_id INT NOT NULL,
  status ENUM('aguardando_pagamento', 'confirmado', 'em_entrega', 'entregue', 'cancelado') NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL,
  desconto DECIMAL(10,2) NOT NULL DEFAULT 0,
  total DECIMAL(10,2) NOT NULL,
  cupom_codigo VARCHAR(30) NULL,
  forma_pagamento ENUM('pix', 'cartao', 'dinheiro') NOT NULL,
  pagamento_id INT NULL,
  endereco VARCHAR(255) NOT NULL,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_pedidos_cliente (cliente_id)
);

CREATE TABLE IF NOT EXISTS itens_pedido (
  id INT AUTO_INCREMENT PRIMARY KEY,
  pedido_id INT NOT NULL,
  bebida_id INT NOT NULL,
  nome VARCHAR(120) NOT NULL,
  preco_unitario DECIMAL(10,2) NOT NULL,
  quantidade INT NOT NULL,
  FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE
);

INSERT IGNORE INTO cupons (codigo, tipo, valor, valor_minimo, validade, ativo) VALUES
  ('BEMVINDO10', 'percentual', 10, 0, NULL, TRUE),
  ('GELADA5', 'fixo', 5, 30, NULL, TRUE),
  ('VENCIDO20', 'percentual', 20, 0, '2024-01-01', TRUE);
