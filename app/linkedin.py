import re
from playwright.sync_api import sync_playwright
from .config import Config
from .database import Database


class LinkedInBot:
    def __init__(self, db: Database):
        self.db = db
        self._pw = None
        self.browser = None
        self.context = None
        self.page = None

    def _preencher_login(self):
        try:
            self.page.locator("#username").fill(Config.LINKEDIN_EMAIL, timeout=5000)
            return
        except:
            pass
        try:
            self.page.locator("input[name='session_key']").fill(Config.LINKEDIN_EMAIL, timeout=5000)
            return
        except:
            pass
        raise Exception("Campo de email n\u00e3o encontrado no LinkedIn")

    def _preencher_senha(self):
        try:
            self.page.locator("#password").fill(Config.LINKEDIN_PASSWORD, timeout=5000)
            return
        except:
            pass
        try:
            self.page.locator("input[name='session_password']").fill(Config.LINKEDIN_PASSWORD, timeout=5000)
            return
        except:
            pass
        raise Exception("Campo de senha n\u00e3o encontrado no LinkedIn")

    def login(self):
        self._pw = sync_playwright().start()
        self.context = self._pw.chromium.launch_persistent_context(
            user_data_dir="data/chrome_profile",
            headless=False,
            viewport={"width": 1280, "height": 800},
            locale="pt-BR",
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            args=[
                "--disable-blink-features=AutomationControlled",
                "--disable-infobars",
                "--no-sandbox",
            ],
        )
        self.context.add_init_script("""
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        """)
        self.page = self.context.new_page()
        self.browser = None

        self.page.goto("https://www.linkedin.com/login", wait_until="load")
        self.page.wait_for_timeout(5000)

        print(f"[DEBUG] URL: {self.page.url}")
        print(f"[DEBUG] Título: {self.page.title()}")

        try:
            self.page.wait_for_selector("#username", timeout=8000)
        except:
            print("[DEBUG] Seletor #username n\u00e3o encontrado, tentando alternativos")
            self.page.screenshot(path="debug_linkedin.png")

        self._preencher_login()
        self.page.wait_for_timeout(500)
        self._preencher_senha()

        with self.page.expect_navigation(timeout=30000):
            self.page.click("button[type=submit]")

        self.page.wait_for_timeout(3000)
        print(f"[DEBUG] URL p\u00f3s-login: {self.page.url}")

        if "checkpoint" in self.page.url:
            print("=== LinkedIn pediu verifica\u00e7\u00e3o 2FA ===")
            print("Complete o login manualmente no navegador aberto.")
            print("Assim que concluir, volte aqui e aguarde...")
            import time
            for _ in range(180):
                time.sleep(1)
                url_atual = self.page.url
                if "checkpoint" not in url_atual and "login" not in url_atual:
                    print("Login 2FA conclu\u00eddo!")
                    break
            else:
                raise Exception("Tempo excedido na verifica\u00e7\u00e3o 2FA")

        if "login" in self.page.url:
            raise Exception("Login falhou - credenciais incorretas ou bloqueio")

        return True

    def buscar_vagas(self, palavras_chave, local="Brasil", max_vagas=50):
        vagas = []
        for palavra in palavras_chave:
            termo = f"{palavra}"
            url = f"https://www.linkedin.com/jobs/search/?keywords={termo}&location={local}&f_PP=1&f_E=1"
            self.page.goto(url, wait_until="domcontentloaded")
            self.page.wait_for_timeout(3000)

            try:
                self.page.wait_for_selector(".jobs-search-results-list", timeout=10000)
            except:
                continue

            for _ in range(5):
                self.page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                self.page.wait_for_timeout(1500)

            cards = self.page.query_selector_all(".job-card-container")
            for card in cards[:max_vagas]:
                try:
                    titulo_el = card.query_selector(".job-card-list__title")
                    empresa_el = card.query_selector(".job-card-container__company-name")
                    link_el = card.query_selector("a.job-card-list__title")

                    titulo = titulo_el.inner_text() if titulo_el else "N/A"
                    empresa = empresa_el.inner_text() if empresa_el else "N/A"
                    link = link_el.get_attribute("href") if link_el else ""
                    url_vaga = f"https://www.linkedin.com{link}" if link and link.startswith("/") else link

                    if url_vaga and not self.db.ja_candidatado(url_vaga):
                        vagas.append({
                            "plataforma": "LinkedIn",
                            "empresa": empresa.strip(),
                            "cargo": titulo.strip(),
                            "url": url_vaga,
                        })
                except:
                    continue

        return vagas

    def candidatar(self, vaga):
        self.page.goto(vaga["url"], wait_until="domcontentloaded")
        self.page.wait_for_timeout(3000)

        try:
            botao = self.page.query_selector("button.jobs-apply-button")
            if botao:
                botao.click()
                self.page.wait_for_timeout(2000)

                try:
                    input_file = self.page.query_selector("input[type=file]")
                    if input_file:
                        input_file.set_input_files(Config.CURRICULO_PATH)
                        self.page.wait_for_timeout(1000)
                except:
                    pass

                botoes = self.page.query_selector_all("button[aria-label='Enviar candidatura'], button:has-text('Enviar')")
                for btn in botoes:
                    if btn.is_visible():
                        btn.click()
                        self.page.wait_for_timeout(2000)
                        break

                self.db.registrar_candidatura(
                    plataforma="LinkedIn",
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
