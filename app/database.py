import sqlite3
from datetime import datetime
from pathlib import Path
from .config import Config


class Database:
    def __init__(self):
        Path(Config.DB_PATH.parent).mkdir(exist_ok=True)
        self.conn = sqlite3.connect(str(Config.DB_PATH))
        self._criar_tabelas()

    def _criar_tabelas(self):
        self.conn.executescript("""
            CREATE TABLE IF NOT EXISTS candidaturas (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                plataforma TEXT NOT NULL,
                empresa TEXT NOT NULL,
                cargo TEXT NOT NULL,
                url TEXT,
                data_candidatura TEXT NOT NULL,
                status TEXT DEFAULT 'enviado',
                notas TEXT
            );
            CREATE TABLE IF NOT EXISTS configuracoes (
                chave TEXT PRIMARY KEY,
                valor TEXT NOT NULL
            );
        """)
        self.conn.commit()

    def registrar_candidatura(self, plataforma, empresa, cargo, url=None, status="enviado", notas=None):
        self.conn.execute(
            """INSERT INTO candidaturas (plataforma, empresa, cargo, url, data_candidatura, status, notas)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (plataforma, empresa, cargo, url, datetime.now().isoformat(), status, notas),
        )
        self.conn.commit()

    def listar_candidaturas(self):
        cursor = self.conn.execute(
            "SELECT id, plataforma, empresa, cargo, data_candidatura, status FROM candidaturas ORDER BY data_candidatura DESC"
        )
        return cursor.fetchall()

    def ja_candidatado(self, url):
        cursor = self.conn.execute("SELECT COUNT(*) FROM candidaturas WHERE url = ?", (url,))
        return cursor.fetchone()[0] > 0

    def atualizar_status(self, candidatura_id, status, notas=None):
        if notas:
            self.conn.execute(
                "UPDATE candidaturas SET status = ?, notas = ? WHERE id = ?",
                (status, notas, candidatura_id),
            )
        else:
            self.conn.execute(
                "UPDATE candidaturas SET status = ? WHERE id = ?",
                (status, candidatura_id),
            )
        self.conn.commit()

    def fechar(self):
        self.conn.close()
