"""
FinancePro v2 — setup.py
Cria o banco de dados e todas as tabelas automaticamente.
"""
import mysql.connector
from mysql.connector import Error

HOST     = "localhost"
USER     = "root"
PASSWORD = "@Jhon2008"
DB_NAME  = "financepro"

STATEMENTS = [
    f"CREATE DATABASE IF NOT EXISTS {DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci",
    f"USE {DB_NAME}",
    """CREATE TABLE IF NOT EXISTS users (
      id         INT AUTO_INCREMENT PRIMARY KEY,
      name       VARCHAR(100)  NOT NULL,
      email      VARCHAR(100)  NOT NULL UNIQUE,
      password   VARCHAR(255)  NOT NULL,
      avatar     VARCHAR(255)  DEFAULT NULL,
      currency   VARCHAR(10)   DEFAULT 'BRL',
      created_at TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_email (email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4""",
    """CREATE TABLE IF NOT EXISTS categories (
      id         INT AUTO_INCREMENT PRIMARY KEY,
      user_id    INT           NOT NULL,
      name       VARCHAR(80)   NOT NULL,
      type       ENUM('income','expense') NOT NULL,
      icon       VARCHAR(10)   DEFAULT '💰',
      color      VARCHAR(7)    DEFAULT '#6366F1',
      created_at TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_user_type (user_id, type)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4""",
    """CREATE TABLE IF NOT EXISTS transactions (
      id          INT AUTO_INCREMENT PRIMARY KEY,
      user_id     INT             NOT NULL,
      category_id INT             NOT NULL,
      description VARCHAR(255)    NOT NULL,
      amount      DECIMAL(14,2)   NOT NULL,
      type        ENUM('income','expense') NOT NULL,
      date        DATE            NOT NULL,
      notes       TEXT            DEFAULT NULL,
      created_at  TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,
      updated_at  TIMESTAMP       DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id)     REFERENCES users(id)      ON DELETE CASCADE,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT,
      INDEX idx_user_date (user_id, date),
      INDEX idx_user_type (user_id, type)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4""",
    """CREATE TABLE IF NOT EXISTS goals (
      id             INT AUTO_INCREMENT PRIMARY KEY,
      user_id        INT           NOT NULL,
      title          VARCHAR(120)  NOT NULL,
      description    TEXT          DEFAULT NULL,
      target_amount  DECIMAL(14,2) NOT NULL,
      current_amount DECIMAL(14,2) DEFAULT 0.00,
      deadline       DATE          DEFAULT NULL,
      status         ENUM('active','completed','cancelled') DEFAULT 'active',
      created_at     TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
      updated_at     TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_user_status (user_id, status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4""",
]

def main():
    print("=" * 50)
    print("  FinancePro v2 — Setup do Banco de Dados")
    print("=" * 50)
    print(f"\n🔗 Conectando ao MySQL em {HOST}...")

    try:
        conn = mysql.connector.connect(host=HOST, user=USER, password=PASSWORD)
        cursor = conn.cursor()
        print("✅ Conexão estabelecida!\n")

        for stmt in STATEMENTS:
            cursor.execute(stmt)
            conn.commit()

        print(f"✅ Banco '{DB_NAME}' criado com sucesso!")
        print("\n📋 Tabelas criadas:")

        cursor.execute(f"USE {DB_NAME}")
        cursor.execute("SHOW TABLES")
        for (table,) in cursor.fetchall():
            print(f"   ✓ {table}")

        cursor.close()
        conn.close()

        print("\n" + "=" * 50)
        print("  ✅ Tudo pronto! Agora rode:")
        print("     python app.py")
        print("=" * 50 + "\n")

    except Error as e:
        print(f"\n❌ ERRO: {e}")

if __name__ == "__main__":
    main()