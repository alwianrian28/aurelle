FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /srv

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Jalankan sebagai user tanpa hak istimewa.
RUN useradd --create-home --uid 10001 tracking
COPY alembic.ini .
COPY alembic ./alembic
COPY app ./app
USER tracking

EXPOSE 8000
# Konfigurasi (.env) diberikan saat container dijalankan, tidak ikut ke dalam image:
#   docker run --env-file .env -p 8000:8000 tracking
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
