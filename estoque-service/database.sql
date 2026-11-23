CREATE TABLE IF NOT EXISTS estoque (
  bebida_id INT PRIMARY KEY,
  quantidade INT NOT NULL DEFAULT 0,
  quantidade_minima INT NOT NULL DEFAULT 5,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS movimentacoes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  bebida_id INT NOT NULL,
  pedido_id INT NULL,
  tipo ENUM('reposicao', 'ajuste', 'baixa', 'restauracao') NOT NULL,
  quantidade INT NOT NULL,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_movimentacoes_bebida (bebida_id),
  INDEX idx_movimentacoes_pedido (pedido_id)
);

INSERT IGNORE INTO estoque (bebida_id, quantidade, quantidade_minima) VALUES
  (1, 120, 24),
  (2, 96, 24),
  (3, 150, 24),
  (4, 60, 12),
  (5, 40, 10),
  (6, 35, 10),
  (7, 200, 30),
  (8, 25, 8),
  (9, 15, 5),
  (10, 20, 5),
  (11, 8, 5),
  (12, 4, 10);
