from playwright.sync_api import sync_playwright
from .database import Database


class GupyBot:
    def __init__(self, db: Database):
        self.db = db
        self._pw = None
        self.browser = None
        self.context = None
        self.page = None

    def iniciar(self):
        self._pw = sync_playwright().start()
        self.context = self._pw.chromium.launch_persistent_context(
            user_data_dir="data/chrome_profile",
            headless=False,
            viewport={"width": 1280, "height": 800},
        )
        self.page = self.context.new_page()
        self.browser = None

    def buscar_vagas(self, palavras_chave, max_vagas=50):
        vagas = []
        for palavra in palavras_chave:
            termo = palavra
            url = f"https://portal.gupy.io/job-search?term={termo}&type=internship"
            self.page.goto(url, wait_until="domcontentloaded")
            self.page.wait_for_timeout(3000)

            try:
                self.page.wait_for_selector("[data-testid='job-list']", timeout=10000)
            except:
                continue

            for _ in range(3):
                self.page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                self.page.wait_for_timeout(1500)

            cards = self.page.query_selector_all("[data-testid='job-list-item']")
            for card in cards[:max_vagas]:
                try:
                    titulo_el = card.query_selector("h2")
                    empresa_el = card.query_selector("[data-testid='job-name']") or card.query_selector("p")
                    link_el = card.query_selector("a")

                    titulo = titulo_el.inner_text() if titulo_el else "N/A"
                    empresa = empresa_el.inner_text() if empresa_el else "N/A"
                    link = link_el.get_attribute("href") if link_el else ""
                    url_vaga = link if link.startswith("http") else f"https://portal.gupy.io{link}" if link else ""

                    if url_vaga and not self.db.ja_candidatado(url_vaga):
                        vagas.append({
                            "plataforma": "Gupy",
                            "empresa": empresa.strip(),
                            "cargo": titulo.strip(),
                            "url": url_vaga,
                        })
                except:
                    continue

        return vagas

    def candidatar(self, vaga, curriculo_path):
        self.page.goto(vaga["url"], wait_until="domcontentloaded")
        self.page.wait_for_timeout(3000)

        try:
            botoes_inscricao = self.page.query_selector_all("button:has-text('Inscrever'), button:has-text('Candidatar'), a:has-text('Inscrever')")
            for btn in botoes_inscricao:
                if btn.is_visible():
                    btn.click()
                    self.page.wait_for_timeout(2000)
                    break

            try:
                input_file = self.page.query_selector("input[type=file]")
                if input_file:
                    input_file.set_input_files(curriculo_path)
                    self.page.wait_for_timeout(2000)
            except:
                pass

            botoes_enviar = self.page.query_selector_all("button:has-text('Enviar'), button:has-text('Concluir')")
            for btn in botoes_enviar:
                if btn.is_visible():
                    btn.click()
                    self.page.wait_for_timeout(2000)
                    break

            self.db.registrar_candidatura(
                plataforma="Gupy",
                empresa=vaga["empresa"],
                cargo=vaga["cargo"],
                url=vaga["url"],
                status="enviado",
            )
            return True
        except:
            pass

        return False

    def fechar(self):
        try:
            if self.page:
                self.page.close()
        except:
            pass
        try:
            if self.context:
                self.context.close()
        except:
            pass
        try:
            if self._pw:
                self._pw.stop()
        except:
            pass
