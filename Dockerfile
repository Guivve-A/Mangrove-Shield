FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source
COPY backend/ .

# Copy zone GeoJSON files so the backend can load them for GEE analysis
COPY frontend/public/data/demo/ data/demo/

EXPOSE 8080

# Use Railway's $PORT env var, fallback to 8080
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8080}"]
