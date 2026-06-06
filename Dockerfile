FROM python:3.11-slim

WORKDIR /app

COPY dist/vagabot-*.whl /app/
RUN pip install vagabot-*.whl --no-cache-dir && rm vagabot-*.whl

COPY .env.example /app/.env.example
COPY data/ /app/data/

RUN playwright install chromium --with-deps 2>/dev/null || true

ENTRYPOINT ["vagabot"]
