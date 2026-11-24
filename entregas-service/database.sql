CREATE TABLE IF NOT EXISTS entregadores (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(120) NOT NULL,
  email VARCHAR(160) NULL UNIQUE,
  telefone VARCHAR(20) NOT NULL,
  veiculo ENUM('moto', 'carro', 'bicicleta') NOT NULL,
  placa VARCHAR(10) NULL,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS entregas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  pedido_id INT NOT NULL UNIQUE,
  cliente_id INT NOT NULL,
  endereco VARCHAR(255) NOT NULL,
  entregador_id INT NULL,
  status ENUM('aguardando_entregador', 'atribuida', 'em_rota', 'entregue', 'falhou', 'cancelada') NOT NULL DEFAULT 'aguardando_entregador',
  tentativas INT NOT NULL DEFAULT 0,
  motivo_falha VARCHAR(255) NULL,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atribuida_em DATETIME NULL,
  saiu_em DATETIME NULL,
  finalizada_em DATETIME NULL,
  INDEX idx_entregas_status (status),
  INDEX idx_entregas_entregador (entregador_id),
  FOREIGN KEY (entregador_id) REFERENCES entregadores(id)
);

INSERT IGNORE INTO entregadores (id, nome, telefone, veiculo, placa) VALUES
  (1, 'Carlos Souza', '85999810021', 'moto', 'PMX1A23'),
  (2, 'Ana Ribeiro', '85988120456', 'carro', 'OLV4B56'),
  (3, 'Pedro Alves', '85997430789', 'bicicleta', NULL);
