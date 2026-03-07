FROM python:3.12-slim

WORKDIR /app

COPY packages/enhancer-sdk /app/packages/enhancer-sdk
COPY apps/api /app/apps/api

RUN pip install --no-cache-dir /app/packages/enhancer-sdk /app/apps/api

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--app-dir", "/app/apps/api"]
