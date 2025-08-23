# Railway-Optimized Frappe + Flansa Dockerfile
FROM frappe/bench:latest

USER root

# Install system dependencies for Railway
RUN apt-get update && apt-get install -y \
    git \
    curl \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

USER frappe
WORKDIR /home/frappe

# Initialize bench and get apps
RUN bench init --skip-redis-config-generation --frappe-branch version-15 frappe-bench
WORKDIR /home/frappe/frappe-bench

# Install gunicorn for production server
RUN pip install gunicorn

# Get Flansa app
RUN bench get-app https://github.com/dineshvijayakumar2/flansa.git

# Pre-build assets during Docker build to reduce startup time
RUN echo "🔨 Pre-building assets during Docker build..." && \
    bench build --app frappe || echo "⚠️  Frappe pre-build failed, will retry at startup" && \
    bench build --app flansa || echo "⚠️  Flansa pre-build failed, will retry at startup"

# Copy Railway solution with Redis support
COPY --chown=frappe:frappe railway-with-redis.sh ./start.sh
RUN chmod +x start.sh

# Environment variables
ENV ADMIN_PASSWORD=${ADMIN_PASSWORD:-admin123}
ENV DEVELOPER_MODE=${DEVELOPER_MODE:-0}

# Railway automatically provides DATABASE_URL and REDIS_URL
# No need for individual DB environment variables

EXPOSE ${PORT:-8000}

CMD ["./start.sh"]