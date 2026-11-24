CREATE TABLE IF NOT EXISTS bebidas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(120) NOT NULL,
  categoria VARCHAR(40) NOT NULL,
  descricao VARCHAR(255) NULL,
  preco DECIMAL(10,2) NOT NULL,
  preco_promocional DECIMAL(10,2) NULL,
  destaque BOOLEAN NOT NULL DEFAULT FALSE,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_bebidas_categoria (categoria)
);

INSERT IGNORE INTO bebidas (id, nome, categoria, descricao, preco, preco_promocional, destaque) VALUES
  (1, 'Heineken 350ml', 'Cerveja', 'Lata gelada de 350ml', 6.50, NULL, TRUE),
  (2, 'Brahma Duplo Malte 350ml', 'Cerveja', 'Lata de 350ml', 4.50, 3.99, FALSE),
  (3, 'Skol Lata 350ml', 'Cerveja', 'Lata de 350ml', 4.00, NULL, FALSE),
  (4, 'Corona Extra 330ml', 'Cerveja', 'Long neck de 330ml', 8.90, 7.90, TRUE),
  (5, 'Coca-Cola 2L', 'Refrigerante', 'Garrafa PET de 2 litros', 10.00, NULL, FALSE),
  (6, 'Guaraná Antarctica 2L', 'Refrigerante', 'Garrafa PET de 2 litros', 8.50, 7.50, FALSE),
  (7, 'Água Mineral 500ml', 'Água', 'Sem gás', 2.50, NULL, FALSE),
  (8, 'Suco de Laranja 1L', 'Suco', 'Suco integral de laranja', 9.00, NULL, FALSE),
  (9, 'Vinho Tinto Casillero del Diablo 750ml', 'Vinho', 'Cabernet Sauvignon chileno', 59.90, 54.90, TRUE),
  (10, 'Vodka Smirnoff 998ml', 'Destilado', 'Vodka tradicional', 39.90, NULL, FALSE),
  (11, 'Whisky Red Label 1L', 'Destilado', 'Blended scotch whisky', 99.90, 89.90, TRUE),
  (12, 'Red Bull 250ml', 'Energético', 'Lata de 250ml', 9.50, NULL, FALSE);

CREATE TABLE IF NOT EXISTS bebidas_removidas (
  bebida_id INT PRIMARY KEY,
  removido_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
