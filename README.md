# vagabot

Busca automática de vagas de estágio em TI no LinkedIn e Gupy com filtros inteligentes.

## Funcionalidades

- **Busca em lote** — percorre múltiplas palavras-chave automaticamente
- **LinkedIn + Gupy** — suporte às duas plataformas
- **Filtro de localização** — apenas vagas em São Paulo (45+ cidades + remoto)
- **Filtro de data** — publicado nos últimos: 24h, 3d, 7d, 14d, 30d ou qualquer data
- **Filtro por palavras** — positivo (estágio, suporte, desenvolvimento...) e negativo (vendedor, telemarketing...)
- **Easy Apply** — tenta candidatura automática em vagas com Candidatura Simplificada do LinkedIn
- **Redirecionamento externo** — registra mas não tenta auto-apply
- **Cache de URLs** — nunca revisita a mesma vaga
- **Histórico** — vagas processadas salvas com status (enviada / externo / falha)
- **Interface dark** — estética OpenCode/Warp/VS Code

## Extensão Chrome

### Instalação

1. Abra `chrome://extensions`
2. Ative o **Modo do desenvolvedor** (canto superior direito)
3. Clique em **Carregar sem compactação**
4. Selecione a pasta `extension/` deste repositório
5. A extensão aparecerá na barra de ferramentas

### Como usar

1. Clique no ícone da extensão
2. Ajuste as palavras-chave (uma por linha)
3. Selecione as plataformas (LinkedIn / Gupy)
4. Escolha o filtro de data
5. Clique em **Iniciar** (ou `⌘+Enter`)
6. Acompanhe o progresso no terminal integrado
7. Vagas com Easy Apply são candidatadas automaticamente

### Atalhos

| Atalho | Ação |
|--------|------|
| `⌘+Enter` | Iniciar busca |
| `Esc` | Parar busca |

### Estrutura

```
extension/
├── manifest.json
├── background.js          # Service worker (MV3)
├── lib/
│   └── validator.js       # Validações e filtros
├── content/
│   ├── linkedin.js        # Scraper LinkedIn
│   └── gupy.js            # Scraper Gupy + Google
├── popup/
│   ├── popup.html         # Interface
│   └── popup.js           # Lógica do popup
└── icons/
```

## App Python (legado)

Versão desktop anterior usando Playwright + CustomTkinter.

```bash
pip install -r requirements.txt
python main.py
```

Configure as credenciais no arquivo `.env`:

```env
LINKEDIN_EMAIL=seu@email.com
LINKEDIN_PASSWORD=sua_senha
CURRICULO_PATH=data/curriculo.pdf
```

Coloque seu currículo em `data/curriculo.pdf` (ignorado pelo `.gitignore`).

## Licença

MIT
