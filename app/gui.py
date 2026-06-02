import threading
from tkinter import filedialog, messagebox
import customtkinter as ctk
from .config import Config
from .database import Database
from .linkedin import LinkedInBot
from .gupy import GupyBot

ctk.set_appearance_mode("dark")
ctk.set_default_color_theme("blue")


class App(ctk.CTk):
    def __init__(self):
        super().__init__()
        self.db = Database()
        self.title("Candidatura Automática - Estágio TI")
        self.geometry("900x650")

        self.grid_columnconfigure(0, weight=1)
        self.grid_rowconfigure(0, weight=1)

        self.tabview = ctk.CTkTabview(self)
        self.tabview.grid(row=0, column=0, padx=20, pady=20, sticky="nsew")

        self.tab_config = self.tabview.add("Configurações")
        self.tab_buscar = self.tabview.add("Buscar Vagas")
        self.tab_historico = self.tabview.add("Histórico")

        self._build_config_tab()
        self._build_buscar_tab()
        self._build_historico_tab()

    def _build_config_tab(self):
        self.tab_config.grid_columnconfigure(1, weight=1)

        ctk.CTkLabel(self.tab_config, text="Email LinkedIn:", anchor="w").grid(row=0, column=0, padx=10, pady=10, sticky="w")
        self.email_entry = ctk.CTkEntry(self.tab_config, placeholder_text="seu@email.com")
        self.email_entry.grid(row=0, column=1, padx=10, pady=10, sticky="ew")
        self.email_entry.insert(0, Config.LINKEDIN_EMAIL)

        ctk.CTkLabel(self.tab_config, text="Senha LinkedIn:", anchor="w").grid(row=1, column=0, padx=10, pady=10, sticky="w")
        self.senha_entry = ctk.CTkEntry(self.tab_config, placeholder_text="sua senha", show="*")
        self.senha_entry.grid(row=1, column=1, padx=10, pady=10, sticky="ew")
        self.senha_entry.insert(0, Config.LINKEDIN_PASSWORD)

        ctk.CTkLabel(self.tab_config, text="Currículo (PDF):", anchor="w").grid(row=2, column=0, padx=10, pady=10, sticky="w")
        frame_curriculo = ctk.CTkFrame(self.tab_config, fg_color="transparent")
        frame_curriculo.grid(row=2, column=1, padx=10, pady=10, sticky="ew")
        frame_curriculo.grid_columnconfigure(0, weight=1)
        self.curriculo_entry = ctk.CTkEntry(frame_curriculo)
        self.curriculo_entry.grid(row=0, column=0, sticky="ew")
        self.curriculo_entry.insert(0, Config.detectar_curriculo())
        ctk.CTkButton(frame_curriculo, text="Procurar", width=80, command=self._selecionar_curriculo).grid(row=0, column=1, padx=(5, 0))

        ctk.CTkLabel(self.tab_config, text="Palavras-chave:", anchor="w").grid(row=3, column=0, padx=10, pady=10, sticky="w")
        frame_kw = ctk.CTkFrame(self.tab_config, fg_color="transparent")
        frame_kw.grid(row=3, column=1, padx=10, pady=10, sticky="ew")
        self.kw_label = ctk.CTkLabel(frame_kw, text=f"Arquivo: {Config.PALAVRAS_CHAVE_PATH}", anchor="w")
        self.kw_label.pack(side="left", fill="x", expand=True)

        ctk.CTkButton(self.tab_config, text="Salvar Configurações", command=self._salvar_config).grid(row=4, column=1, padx=10, pady=20, sticky="w")

    def _build_buscar_tab(self):
        self.tab_buscar.grid_columnconfigure(0, weight=1)
        self.tab_buscar.grid_rowconfigure(2, weight=1)

        frame_plataformas = ctk.CTkFrame(self.tab_buscar)
        frame_plataformas.grid(row=0, column=0, padx=10, pady=10, sticky="ew")
        self.linkedin_var = ctk.BooleanVar(value=True)
        self.gupy_var = ctk.BooleanVar(value=True)
        ctk.CTkCheckBox(frame_plataformas, text="LinkedIn", variable=self.linkedin_var).pack(side="left", padx=10)
        ctk.CTkCheckBox(frame_plataformas, text="Gupy", variable=self.gupy_var).pack(side="left", padx=10)

        frame_acoes = ctk.CTkFrame(self.tab_buscar)
        frame_acoes.grid(row=1, column=0, padx=10, pady=10, sticky="ew")
        self.buscar_btn = ctk.CTkButton(frame_acoes, text="Buscar Vagas", command=self._buscar_vagas)
        self.buscar_btn.pack(side="left", padx=5)
        self.candidatar_btn = ctk.CTkButton(frame_acoes, text="Candidatar-se a Todas", command=self._candidatar_todas, state="disabled")
        self.candidatar_btn.pack(side="left", padx=5)
        self.progress = ctk.CTkProgressBar(frame_acoes, width=200)
        self.progress.pack(side="left", padx=20)
        self.progress.set(0)

        self.vagas_text = ctk.CTkTextbox(self.tab_buscar)
        self.vagas_text.grid(row=2, column=0, padx=10, pady=10, sticky="nsew")

        self.status_label = ctk.CTkLabel(self.tab_buscar, text="")
        self.status_label.grid(row=3, column=0, padx=10, pady=5, sticky="w")

        self._vagas_encontradas = []

    def _build_historico_tab(self):
        self.tab_historico.grid_columnconfigure(0, weight=1)
        self.tab_historico.grid_rowconfigure(0, weight=1)

        self.historico_text = ctk.CTkTextbox(self.tab_historico)
        self.historico_text.grid(row=0, column=0, padx=10, pady=10, sticky="nsew")

        ctk.CTkButton(self.tab_historico, text="Atualizar", command=self._atualizar_historico).grid(row=1, column=0, pady=10)

    def _selecionar_curriculo(self):
        path = filedialog.askopenfilename(filetypes=[("PDF files", "*.pdf")])
        if path:
            self.curriculo_entry.delete(0, "end")
            self.curriculo_entry.insert(0, path)

    def _salvar_config(self):
        Config.salvar_no_env("LINKEDIN_EMAIL", self.email_entry.get())
        Config.salvar_no_env("LINKEDIN_PASSWORD", self.senha_entry.get())
        Config.salvar_no_env("CURRICULO_PATH", self.curriculo_entry.get())
        Config.LINKEDIN_EMAIL = self.email_entry.get()
        Config.LINKEDIN_PASSWORD = self.senha_entry.get()
        Config.CURRICULO_PATH = self.curriculo_entry.get()
        messagebox.showinfo("Sucesso", "Configurações salvas!")

    def _buscar_vagas(self):
        self._vagas_encontradas.clear()
        self.vagas_text.delete("1.0", "end")
        self.vagas_text.insert("end", "Buscando vagas... Aguarde.\n\n")
        self.buscar_btn.configure(state="disabled")
        self.candidatar_btn.configure(state="disabled")
        self.progress.set(0.2)
        threading.Thread(target=self._executar_busca, daemon=True).start()

    def _executar_busca(self):
        vagas = []
        try:
            if self.linkedin_var.get():
                if not Config.LINKEDIN_EMAIL or not Config.LINKEDIN_PASSWORD:
                    self.after(0, lambda: messagebox.showwarning("Aviso", "Configure email e senha do LinkedIn primeiro!"))
                    self.after(0, lambda: self.buscar_btn.configure(state="normal"))
                    return
                bot = LinkedInBot(self.db)
                try:
                    bot.login()
                    self.after(0, lambda: self.progress.set(0.5))
                    encontradas = bot.buscar_vagas(Config.palavras_chave_lista())
                    vagas.extend(encontradas)
                    self.after(0, lambda: self.progress.set(0.7))
                finally:
                    bot.fechar()

            if self.gupy_var.get():
                bot = GupyBot(self.db)
                try:
                    bot.iniciar()
                    encontradas = bot.buscar_vagas(Config.palavras_chave_lista())
                    vagas.extend(encontradas)
                    self.after(0, lambda: self.progress.set(0.9))
                finally:
                    bot.fechar()
        except Exception as e:
            import traceback
            traceback.print_exc()
            self.after(0, lambda e=e: messagebox.showerror("Erro", f"Ocorreu um erro:\n{e}"))
            self.after(0, lambda: self.buscar_btn.configure(state="normal"))
            return

        self._vagas_encontradas = vagas
        self.after(0, self._exibir_vagas)

    def _exibir_vagas(self):
        self.vagas_text.delete("1.0", "end")
        if not self._vagas_encontradas:
            self.vagas_text.insert("end", "Nenhuma vaga encontrada.")
            self.candidatar_btn.configure(state="disabled")
        else:
            for i, v in enumerate(self._vagas_encontradas, 1):
                self.vagas_text.insert(
                    "end",
                    f"{i}. [{v['plataforma']}] {v['cargo']} - {v['empresa']}\n   {v['url']}\n\n",
                )
            self.candidatar_btn.configure(state="normal")
        self.buscar_btn.configure(state="normal")
        self.progress.set(1)
        self.status_label.configure(text=f"{len(self._vagas_encontradas)} vaga(s) encontrada(s)")

    def _candidatar_todas(self):
        if not self._vagas_encontradas:
            messagebox.showinfo("Info", "Nenhuma vaga para candidatar.")
            return
        if not messagebox.askyesno("Confirmar", f"Candidatar-se a {len(self._vagas_encontradas)} vagas?"):
            return
        self.candidatar_btn.configure(state="disabled")
        self.buscar_btn.configure(state="disabled")
        threading.Thread(target=self._executar_candidaturas, daemon=True).start()

    def _executar_candidaturas(self):
        sucesso = 0
        total = len(self._vagas_encontradas)
        try:
            for i, vaga in enumerate(self._vagas_encontradas):
                self.after(0, lambda i=i, total=total: (
                    self.progress.set((i + 1) / total) if total else None,
                    self.status_label.configure(text=f"Candidatando {i+1}/{total}: {vaga['cargo']} - {vaga['empresa']}"),
                ))

                if vaga["plataforma"] == "LinkedIn":
                    if not Config.LINKEDIN_EMAIL or not Config.LINKEDIN_PASSWORD:
                        continue
                    bot = LinkedInBot(self.db)
                    try:
                        bot.login()
                        if bot.candidatar(vaga):
                            sucesso += 1
                    except Exception as e:
                        print(f"Erro LinkedIn: {e}")
                    finally:
                        bot.fechar()
                elif vaga["plataforma"] == "Gupy":
                    bot = GupyBot(self.db)
                    try:
                        bot.iniciar()
                        if bot.candidatar(vaga, Config.CURRICULO_PATH):
                            sucesso += 1
                    except Exception as e:
                        print(f"Erro Gupy: {e}")
                    finally:
                        bot.fechar()
        except Exception as e:
            import traceback
            traceback.print_exc()
            self.after(0, lambda e=e: messagebox.showerror("Erro", f"Erro nas candidaturas:\n{e}"))

        self.after(0, lambda: (
            self.progress.set(1),
            self.status_label.configure(text=f"{sucesso}/{total} candidaturas enviadas!"),
            self.candidatar_btn.configure(state="normal"),
            self.buscar_btn.configure(state="normal"),
            messagebox.showinfo("Concluído", f"{sucesso} de {total} candidaturas enviadas com sucesso!"),
            self._atualizar_historico(),
        ))

    def _atualizar_historico(self):
        self.historico_text.delete("1.0", "end")
        registros = self.db.listar_candidaturas()
        if not registros:
            self.historico_text.insert("end", "Nenhuma candidatura realizada ainda.")
        else:
            for r in registros:
                self.historico_text.insert(
                    "end",
                    f"#{r[0]} | {r[1]} | {r[2]} | {r[3]} | {r[4][:10]} | {r[5]}\n",
                )

    def fechar(self):
        self.db.fechar()
        self.destroy()
