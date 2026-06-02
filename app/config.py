import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)

class Config:
    LINKEDIN_EMAIL = os.getenv("LINKEDIN_EMAIL", "")
    LINKEDIN_PASSWORD = os.getenv("LINKEDIN_PASSWORD", "")
    CURRICULO_PATH = os.getenv("CURRICULO_PATH", "")
    PALAVRAS_CHAVE_PATH = DATA_DIR / "palavras-chave.txt"
    PALAVRAS_CHAVE = os.getenv("PALAVRAS_CHAVE", "")
    DB_PATH = BASE_DIR / "reports" / "historico.db"

    @classmethod
    def detectar_curriculo(cls):
        if cls.CURRICULO_PATH and Path(cls.CURRICULO_PATH).exists():
            return cls.CURRICULO_PATH
        pdfs = list(DATA_DIR.glob("*.pdf"))
        return str(pdfs[0]) if pdfs else ""

    @classmethod
    def palavras_chave_lista(cls):
        if cls.PALAVRAS_CHAVE_PATH.exists():
            raw = cls.PALAVRAS_CHAVE_PATH.read_text(encoding="utf-8")
            return [p.strip() for p in raw.replace("\n", ",").split(",") if p.strip()]
        return [p.strip() for p in cls.PALAVRAS_CHAVE.split(",") if p.strip()]

    @classmethod
    def palavras_chave_raw(cls):
        if cls.PALAVRAS_CHAVE_PATH.exists():
            return cls.PALAVRAS_CHAVE_PATH.read_text(encoding="utf-8").strip()
        return cls.PALAVRAS_CHAVE

    @classmethod
    def salvar_no_env(cls, chave, valor):
        env_path = BASE_DIR / ".env"
        linhas = []
        if env_path.exists():
            linhas = env_path.read_text(encoding="utf-8").splitlines()
        nova = True
        for i, linha in enumerate(linhas):
            if linha.startswith(f"{chave}="):
                linhas[i] = f"{chave}={valor}"
                nova = False
                break
        if nova:
            linhas.append(f"{chave}={valor}")
        env_path.write_text("\n".join(linhas) + "\n", encoding="utf-8")
        os.environ[chave] = valor
