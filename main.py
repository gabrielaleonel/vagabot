import sys
import traceback
from tkinter import messagebox
from app.gui import App


def excecao_global(exc_type, exc_value, exc_tb):
    erro = "".join(traceback.format_exception(exc_type, exc_value, exc_tb))
    with open("erro.log", "w", encoding="utf-8") as f:
        f.write(erro)
    try:
        messagebox.showerror("Erro inesperado", f"Ocorreu um erro e o app será fechado.\nDetalhes salvos em erro.log")
    except:
        pass


if __name__ == "__main__":
    sys.excepthook = excecao_global
    app = App()
    app.protocol("WM_DELETE_WINDOW", app.fechar)
    app.mainloop()
